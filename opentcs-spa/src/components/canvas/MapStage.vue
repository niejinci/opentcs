<script setup lang="ts">
// SPDX-FileCopyrightText: The openTCS Authors
// SPDX-License-Identifier: MIT
//
// MapStage — root Konva.Stage hosting the editor's three layers.
//
// Coordinate systems (kept brutally simple — single transform on the Stage):
//   - Stage local coords ≡ natural PNG pixel coords (BackgroundLayer is
//     drawn at (0, 0) with size = imageWidth × imageHeight). All child
//     layers therefore work in "pixel space" without knowing the zoom.
//   - Stage is then scaled + translated to fit the screen container.
//   - Pixel → world (meters) is delegated to AffineMapping
//     (`src/domain/geometry/affine.ts`).
//
// Interaction:
//   - Wheel              → zoom toward cursor, clamped to [MIN_SCALE, MAX_SCALE]
//   - Left-drag empty canvas → pan
//   - Click (when tool ≠ select) → emits `tool-fire` with stage + world point
//   - Reset View button  → fit the image to the container with 5% padding
//   - Pointer move       → emits `pointer-move` for the parent status bar

import Konva from 'konva';
import type { KonvaEventObject } from 'konva/lib/Node';
import { computed, onBeforeUnmount, onMounted, ref, useTemplateRef, watch } from 'vue';

import AnnotationLayer from '@/components/canvas/AnnotationLayer.vue';
import BackgroundLayer from '@/components/canvas/BackgroundLayer.vue';
import GridLayer from '@/components/canvas/GridLayer.vue';
import HoverLayer from '@/components/canvas/HoverLayer.vue';
import MiniMap from '@/components/canvas/MiniMap.vue';
import { getEditorTool, type EditorToolId } from '@/domain/editor/tools';
import { snapToGrid } from '@/domain/editor/grid';
import { pixelToWorld, type AffineMapping } from '@/domain/geometry/affine';
import { useEditorSettingsStore } from '@/stores/editorSettings';

const props = defineProps<{
  image: HTMLImageElement;
  imageWidth: number;
  imageHeight: number;
  affine: AffineMapping;
  tool: EditorToolId;
  /** Read-only render mode for pages that monitor instead of edit. */
  readonly?: boolean;
  /** Vehicle name highlighted by an external selection. */
  selectedVehicleName?: string | null;
  /** Point name highlighted by an external selection. */
  selectedPointName?: string | null;
  /** Whether Point / Location / Vehicle name labels should be rendered. */
  showEntityLabels?: boolean;
}>();

const settings = useEditorSettingsStore();

const emit = defineEmits<{
  /** Fires while the cursor moves over the stage; values in pixel + world space. */
  'pointer-move': [{ pixel: { x: number; y: number }; world: { x: number; y: number } } | null];
  /** Click while a creation tool (point/path) is active. */
  'tool-fire': [
    {
      tool: EditorToolId;
      pixel: { x: number; y: number };
      world: { x: number; y: number };
    },
  ];
  /** Forwarded from AnnotationLayer when a Point/Location is clicked in read-only mode. */
  'target-click': [target: { kind: 'point' | 'location'; name: string }];
  /** Forwarded from AnnotationLayer when a vehicle is clicked in monitor mode. */
  'vehicle-click': [name: string];
  /** Forwarded when a vehicle click also has an underlying Point candidate. */
  'vehicle-point-overlap-click': [
    payload: { vehicleName: string; pointName: string; clientX: number; clientY: number },
  ];
  /** Fired when a read-only monitor click lands on empty canvas. */
  'blank-click': [];
}>();

/* ---------------------------- Container sizing --------------------------- */

const hostRef = useTemplateRef<HTMLDivElement>('hostRef');
const stageRef = useTemplateRef<{ getStage: () => Konva.Stage }>('stageRef');
const stageWidth = ref(1);
const stageHeight = ref(1);

let resizeObserver: ResizeObserver | null = null;
let focusAnimationFrame: number | null = null;

/* ---------------------------- Stage transform --------------------------- */

const MIN_SCALE = 0.05;
const MAX_SCALE = 20;
const ZOOM_STEP = 1.1;
const FOCUS_ANIMATION_MS = 280;

const scale = ref(1);
const stageX = ref(0);
const stageY = ref(0);
const isPanning = ref(false);
const cursorStage = ref<{ x: number; y: number } | null>(null);

const stageConfig = computed(() => ({
  width: stageWidth.value,
  height: stageHeight.value,
  scaleX: scale.value,
  scaleY: scale.value,
  x: stageX.value,
  y: stageY.value,
}));

const cursorWorld = computed(() =>
  cursorStage.value ? pixelToWorld(props.affine, cursorStage.value) : null,
);

const activeToolMeta = computed(() => getEditorTool(props.tool));
const cursorCss = computed(() => {
  if (isPanning.value) return 'grabbing';
  return activeToolMeta.value.cursor;
});

/* ------------------------------ View helpers ---------------------------- */

function cancelFocusAnimation(): void {
  if (focusAnimationFrame === null) return;
  window.cancelAnimationFrame(focusAnimationFrame);
  focusAnimationFrame = null;
}

function prefersReducedMotion(): boolean {
  return window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
}

function easeOutCubic(t: number): number {
  return 1 - (1 - t) ** 3;
}

function fitToContainer(): void {
  cancelFocusAnimation();
  if (!props.imageWidth || !props.imageHeight) return;
  const padding = 0.05; // 5% breathing room
  const sx = (stageWidth.value * (1 - padding)) / props.imageWidth;
  const sy = (stageHeight.value * (1 - padding)) / props.imageHeight;
  const next = Math.max(MIN_SCALE, Math.min(MAX_SCALE, Math.min(sx, sy)));
  scale.value = next;
  stageX.value = (stageWidth.value - props.imageWidth * next) / 2;
  stageY.value = (stageHeight.value - props.imageHeight * next) / 2;
}

function focusPixel(pixel: { x: number; y: number }, preferredScale?: number): void {
  const nextScale =
    preferredScale === undefined
      ? scale.value
      : Math.max(MIN_SCALE, Math.min(MAX_SCALE, preferredScale));
  const nextX = stageWidth.value / 2 - pixel.x * nextScale;
  const nextY = stageHeight.value / 2 - pixel.y * nextScale;
  cancelFocusAnimation();

  if (prefersReducedMotion()) {
    scale.value = nextScale;
    stageX.value = nextX;
    stageY.value = nextY;
    return;
  }

  const startScale = scale.value;
  const startX = stageX.value;
  const startY = stageY.value;
  const startedAt = window.performance.now();

  const step = (now: number): void => {
    const progress = Math.min(1, (now - startedAt) / FOCUS_ANIMATION_MS);
    const eased = easeOutCubic(progress);
    scale.value = startScale + (nextScale - startScale) * eased;
    stageX.value = startX + (nextX - startX) * eased;
    stageY.value = startY + (nextY - startY) * eased;
    if (progress < 1) {
      focusAnimationFrame = window.requestAnimationFrame(step);
      return;
    }
    focusAnimationFrame = null;
  };

  focusAnimationFrame = window.requestAnimationFrame(step);
}

function setScaleAtScreenPoint(newScale: number, screenX: number, screenY: number): void {
  cancelFocusAnimation();
  const clamped = Math.max(MIN_SCALE, Math.min(MAX_SCALE, newScale));
  if (clamped === scale.value) return;
  // Keep the stage point currently under the screen point pinned in place.
  const localX = (screenX - stageX.value) / scale.value;
  const localY = (screenY - stageY.value) / scale.value;
  stageX.value = screenX - localX * clamped;
  stageY.value = screenY - localY * clamped;
  scale.value = clamped;
}

/* -------------------------------- Events -------------------------------- */

function onWheel(e: KonvaEventObject<WheelEvent>): void {
  e.evt.preventDefault();
  const stage = stageRef.value?.getStage();
  if (!stage) return;
  const pointer = stage.getPointerPosition();
  if (!pointer) return;
  const factor = e.evt.deltaY < 0 ? ZOOM_STEP : 1 / ZOOM_STEP;
  setScaleAtScreenPoint(scale.value * factor, pointer.x, pointer.y);
}

function onPointerMove(): void {
  const stage = stageRef.value?.getStage();
  if (!stage) return;
  const pointer = stage.getPointerPosition();
  if (!pointer) {
    cursorStage.value = null;
    emit('pointer-move', null);
    return;
  }
  const localX = (pointer.x - stageX.value) / scale.value;
  const localY = (pointer.y - stageY.value) / scale.value;
  cursorStage.value = { x: localX, y: localY };
  emit('pointer-move', {
    pixel: { x: localX, y: localY },
    world: pixelToWorld(props.affine, { x: localX, y: localY }),
  });
}

function onPointerLeave(): void {
  cursorStage.value = null;
  emit('pointer-move', null);
}

function onStageClick(): void {
  // Konva differentiates click vs drag automatically; this handler only
  // fires for taps that did not move past the drag threshold.
  if (isPanning.value || suppressNextStageClick) {
    suppressNextStageClick = false;
    return;
  }
  // If the click landed on a Point or a Path (handled by AnnotationLayer),
  // suppress the stage-level "create / deselect" reaction.
  if (entityClickPending) {
    entityClickPending = false;
    return;
  }
  if (props.tool === 'select') {
    // Click on empty canvas in select tool = clear selection (handled by
    // EditorView via tool-fire emit). We still emit tool-fire so the
    // parent can decide; here we just leave it to the existing emit below.
  }
  const cursor = cursorStage.value;
  if (!cursor) return;
  if (props.readonly) {
    emit('blank-click');
    return;
  }
  // Snap creation tools to the nearest grid intersection when grid-snap
  // is enabled. The `select` tool keeps the raw cursor so empty-canvas
  // clicks remain pixel-accurate (selection logic does not care about
  // sub-grid offsets).
  const snap = settings.gridSnap && props.tool !== 'select';
  const pixel = snap ? snapToGrid(cursor, settings.gridSpacingPx) : cursor;
  emit('tool-fire', {
    tool: props.tool,
    pixel,
    world: pixelToWorld(props.affine, pixel),
  });
}

// Set by AnnotationLayer just before the Konva click bubble reaches the
// Stage, so we know to swallow the matching stage click below.
let entityClickPending = false;
function onEntityClick(): void {
  entityClickPending = true;
}

/* ------------------------------ Canvas pan ----------------------------- */

const PAN_DRAG_THRESHOLD_PX = 3;

let panStart: {
  clientX: number;
  clientY: number;
  stageX: number;
  stageY: number;
} | null = null;
let suppressNextStageClick = false;
let clearSuppressedClickTimer: number | null = null;

function onStagePointerDown(e: KonvaEventObject<PointerEvent>): void {
  if (e.evt.button !== 0) return;
  const stage = stageRef.value?.getStage();
  if (!stage || e.target !== stage) return;

  panStart = {
    clientX: e.evt.clientX,
    clientY: e.evt.clientY,
    stageX: stageX.value,
    stageY: stageY.value,
  };
  window.addEventListener('pointermove', onPanPointerMove);
  window.addEventListener('pointerup', onPanPointerEnd, { once: true });
  window.addEventListener('pointercancel', onPanPointerEnd, { once: true });
}

function onPanPointerMove(e: PointerEvent): void {
  if (!panStart) return;
  cancelFocusAnimation();
  if ((e.buttons & 1) === 0) {
    onPanPointerEnd();
    return;
  }

  const dx = e.clientX - panStart.clientX;
  const dy = e.clientY - panStart.clientY;
  if (!isPanning.value && dx * dx + dy * dy < PAN_DRAG_THRESHOLD_PX ** 2) return;

  isPanning.value = true;
  suppressNextStageClick = true;
  stageX.value = panStart.stageX + dx;
  stageY.value = panStart.stageY + dy;
  e.preventDefault();
}

function onPanPointerEnd(): void {
  if (isPanning.value) {
    suppressNextStageClick = true;
    if (clearSuppressedClickTimer !== null) {
      window.clearTimeout(clearSuppressedClickTimer);
    }
    clearSuppressedClickTimer = window.setTimeout(() => {
      suppressNextStageClick = false;
      clearSuppressedClickTimer = null;
    }, 150);
  }
  isPanning.value = false;
  panStart = null;
  window.removeEventListener('pointermove', onPanPointerMove);
  window.removeEventListener('pointerup', onPanPointerEnd);
  window.removeEventListener('pointercancel', onPanPointerEnd);
}

/**
 * Recenter the main viewport on a stage-space point chosen via the
 * mini-map. The minimap component already converted the click into a
 * (stageX, stageY) translation that places the picked point in the centre
 * of the visible canvas.
 */
function onMinimapRecenter(payload: { stageX: number; stageY: number }): void {
  cancelFocusAnimation();
  stageX.value = payload.stageX;
  stageY.value = payload.stageY;
}

/* --------------------------- Lifecycle hooks ---------------------------- */

onMounted(() => {
  if (hostRef.value) {
    // 1) Sync-measure the canvas area before Konva's first paint —
    //    eliminates the "640×480 → real-size" flash.
    const rect = hostRef.value.getBoundingClientRect();
    stageWidth.value = Math.max(1, Math.round(rect.width));
    stageHeight.value = Math.max(1, Math.round(rect.height));
    fitToContainer();

    // 2) Track resize, but never auto re-fit — the user owns the viewport
    //    after the initial fit, with the "重置视口" button as escape hatch.
    resizeObserver = new ResizeObserver(([entry]) => {
      if (!entry) return;
      const { width, height } = entry.contentRect;
      stageWidth.value = Math.max(1, Math.round(width));
      stageHeight.value = Math.max(1, Math.round(height));
    });
    resizeObserver.observe(hostRef.value);
  }
});

onBeforeUnmount(() => {
  cancelFocusAnimation();
  resizeObserver?.disconnect();
  resizeObserver = null;
  window.removeEventListener('pointermove', onPanPointerMove);
  window.removeEventListener('pointerup', onPanPointerEnd);
  window.removeEventListener('pointercancel', onPanPointerEnd);
  if (clearSuppressedClickTimer !== null) {
    window.clearTimeout(clearSuppressedClickTimer);
    clearSuppressedClickTimer = null;
  }
});

// Re-fit whenever the underlying image changes (user imports a different map).
watch(
  () => [props.image, props.imageWidth, props.imageHeight] as const,
  () => fitToContainer(),
);

/* ------------------------------ Public API ------------------------------ */

defineExpose({
  resetView: fitToContainer,
  focusPixel,
  zoomIn: () => {
    setScaleAtScreenPoint(scale.value * ZOOM_STEP, stageWidth.value / 2, stageHeight.value / 2);
  },
  zoomOut: () => {
    setScaleAtScreenPoint(scale.value / ZOOM_STEP, stageWidth.value / 2, stageHeight.value / 2);
  },
});

// Expose read-only zoom + cursor info to the parent template for the status bar.
defineSlots<{
  status(props: {
    scale: number;
    pixel: { x: number; y: number } | null;
    world: { x: number; y: number } | null;
    panning: boolean;
  }): unknown;
}>();
</script>

<template>
  <div class="map-stage" :style="{ cursor: cursorCss }">
    <!-- Konva canvas 用绝对定位脱离文档流，避免其像素高度反向撑大父级
         而触发 ResizeObserver 反馈环（白闪 / 页面无限增高的根因）。 -->
    <div ref="hostRef" class="map-stage__canvas">
      <v-stage
        ref="stageRef"
        :config="stageConfig"
        @wheel="onWheel"
        @pointerdown="onStagePointerDown"
        @pointermove="onPointerMove"
        @pointerleave="onPointerLeave"
        @click="onStageClick"
        @tap="onStageClick"
      >
        <BackgroundLayer :image="image" :width="imageWidth" :height="imageHeight" />
        <GridLayer
          v-if="settings.gridSnap"
          :image-width="imageWidth"
          :image-height="imageHeight"
          :stage-width="stageWidth"
          :stage-height="stageHeight"
          :scale="scale"
          :stage-x="stageX"
          :stage-y="stageY"
          :spacing-px="settings.gridSpacingPx"
        />
        <AnnotationLayer
          :tool="tool"
          :scale="scale"
          :readonly="readonly"
          :selected-vehicle-name="selectedVehicleName"
          :selected-point-name="selectedPointName"
          :show-entity-labels="showEntityLabels"
          @entity-click="onEntityClick"
          @target-click="(target) => emit('target-click', target)"
          @vehicle-click="(name: string) => emit('vehicle-click', name)"
          @vehicle-point-overlap-click="(payload) => emit('vehicle-point-overlap-click', payload)"
        />
        <HoverLayer :cursor="cursorStage" :tool="tool" :scale="scale" />
      </v-stage>
    </div>
    <MiniMap
      v-if="settings.minimap"
      :image="image"
      :image-width="imageWidth"
      :image-height="imageHeight"
      :stage-width="stageWidth"
      :stage-height="stageHeight"
      :scale="scale"
      :stage-x="stageX"
      :stage-y="stageY"
      @recenter="onMinimapRecenter"
    />
    <slot
      name="status"
      :scale="scale"
      :pixel="cursorStage"
      :world="cursorWorld"
      :panning="isPanning"
    />
  </div>
</template>

<style scoped>
.map-stage {
  position: relative;
  width: 100%;
  height: 100%;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  background:
    repeating-conic-gradient(#eee 0% 25%, #fff 0% 50%) 0 0 / 16px 16px,
    #ffffff;
}
.map-stage__canvas {
  position: relative;
  flex: 1 1 0;
  min-height: 0;
  overflow: hidden;
}
/* v-stage renders a child <div> sized to stageWidth/Height in CSS pixels.
   Absolutize it so it cannot contribute to parent intrinsic height. */
.map-stage__canvas :deep(> div) {
  position: absolute;
  inset: 0;
}
</style>
