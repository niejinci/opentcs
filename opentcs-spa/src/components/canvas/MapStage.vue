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
//   - Hold Space + drag  → pan (Konva's `draggable` flag is flipped while held)
//   - Click (when tool ≠ select) → emits `tool-fire` with stage + world point
//   - Reset View button  → fit the image to the container with 5% padding
//   - Pointer move       → emits `pointer-move` for the parent status bar

import Konva from 'konva';
import type { KonvaEventObject } from 'konva/lib/Node';
import { computed, onBeforeUnmount, onMounted, ref, useTemplateRef, watch } from 'vue';

import AnnotationLayer from '@/components/canvas/AnnotationLayer.vue';
import BackgroundLayer from '@/components/canvas/BackgroundLayer.vue';
import HoverLayer from '@/components/canvas/HoverLayer.vue';
import { getEditorTool, type EditorToolId } from '@/domain/editor/tools';
import { pixelToWorld, type AffineMapping } from '@/domain/geometry/affine';

const props = defineProps<{
  image: HTMLImageElement;
  imageWidth: number;
  imageHeight: number;
  affine: AffineMapping;
  tool: EditorToolId;
}>();

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
}>();

/* ---------------------------- Container sizing --------------------------- */

const hostRef = useTemplateRef<HTMLDivElement>('hostRef');
const stageRef = useTemplateRef<{ getStage: () => Konva.Stage }>('stageRef');
const stageWidth = ref(640);
const stageHeight = ref(480);

let resizeObserver: ResizeObserver | null = null;

/* ---------------------------- Stage transform --------------------------- */

const MIN_SCALE = 0.05;
const MAX_SCALE = 20;
const ZOOM_STEP = 1.1;

const scale = ref(1);
const stageX = ref(0);
const stageY = ref(0);
const isPanning = ref(false); // true while Space is held
const cursorStage = ref<{ x: number; y: number } | null>(null);

const stageConfig = computed(() => ({
  width: stageWidth.value,
  height: stageHeight.value,
  scaleX: scale.value,
  scaleY: scale.value,
  x: stageX.value,
  y: stageY.value,
  draggable: isPanning.value,
}));

const cursorWorld = computed(() =>
  cursorStage.value ? pixelToWorld(props.affine, cursorStage.value) : null,
);

const activeToolMeta = computed(() => getEditorTool(props.tool));
const cursorCss = computed(() => {
  if (isPanning.value) return 'grab';
  return activeToolMeta.value.cursor;
});

/* ------------------------------ View helpers ---------------------------- */

function fitToContainer(): void {
  if (!props.imageWidth || !props.imageHeight) return;
  const padding = 0.05; // 5% breathing room
  const sx = (stageWidth.value * (1 - padding)) / props.imageWidth;
  const sy = (stageHeight.value * (1 - padding)) / props.imageHeight;
  const next = Math.max(MIN_SCALE, Math.min(MAX_SCALE, Math.min(sx, sy)));
  scale.value = next;
  stageX.value = (stageWidth.value - props.imageWidth * next) / 2;
  stageY.value = (stageHeight.value - props.imageHeight * next) / 2;
}

function setScaleAtScreenPoint(newScale: number, screenX: number, screenY: number): void {
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
  if (isPanning.value) return;
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
  emit('tool-fire', {
    tool: props.tool,
    pixel: cursor,
    world: pixelToWorld(props.affine, cursor),
  });
}

// Set by AnnotationLayer just before the Konva click bubble reaches the
// Stage, so we know to swallow the matching stage click below.
let entityClickPending = false;
function onEntityClick(): void {
  entityClickPending = true;
}

function onStageDragEnd(): void {
  // Sync our refs from the Stage after a user drag, otherwise the next
  // wheel zoom would jump back to the pre-drag position.
  const stage = stageRef.value?.getStage();
  if (!stage) return;
  stageX.value = stage.x();
  stageY.value = stage.y();
}

/* ----------------------------- Keyboard pan ----------------------------- */

function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  return target.isContentEditable || tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT';
}

function onKeyDown(e: KeyboardEvent): void {
  if (isEditableTarget(e.target)) return;
  if (e.code === 'Space' && !e.repeat) {
    e.preventDefault();
    isPanning.value = true;
    return;
  }
  // Tool hotkeys are owned by EditorView (which also handles the bus toast);
  // MapStage only handles space-pan to keep responsibilities local.
}

function onKeyUp(e: KeyboardEvent): void {
  if (e.code === 'Space') {
    e.preventDefault();
    isPanning.value = false;
  }
}

/* --------------------------- Lifecycle hooks ---------------------------- */

onMounted(() => {
  if (hostRef.value) {
    resizeObserver = new ResizeObserver(([entry]) => {
      if (!entry) return;
      const { width, height } = entry.contentRect;
      stageWidth.value = Math.max(1, Math.round(width));
      stageHeight.value = Math.max(1, Math.round(height));
      // Re-fit once the very first measurement comes in.
      if (scale.value === 1 && stageX.value === 0 && stageY.value === 0) {
        fitToContainer();
      }
    });
    resizeObserver.observe(hostRef.value);
  }
  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);
});

onBeforeUnmount(() => {
  resizeObserver?.disconnect();
  resizeObserver = null;
  window.removeEventListener('keydown', onKeyDown);
  window.removeEventListener('keyup', onKeyUp);
});

// Re-fit whenever the underlying image changes (user imports a different map).
watch(
  () => [props.image, props.imageWidth, props.imageHeight] as const,
  () => fitToContainer(),
);

/* ------------------------------ Public API ------------------------------ */

defineExpose({
  resetView: fitToContainer,
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
  <div ref="hostRef" class="map-stage" :style="{ cursor: cursorCss }">
    <v-stage
      ref="stageRef"
      :config="stageConfig"
      @wheel="onWheel"
      @pointermove="onPointerMove"
      @pointerleave="onPointerLeave"
      @click="onStageClick"
      @tap="onStageClick"
      @dragend="onStageDragEnd"
    >
      <BackgroundLayer :image="image" :width="imageWidth" :height="imageHeight" />
      <AnnotationLayer :tool="tool" :scale="scale" @entity-click="onEntityClick" />
      <HoverLayer :cursor="cursorStage" :tool="tool" :scale="scale" />
    </v-stage>
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
  background:
    repeating-conic-gradient(#eee 0% 25%, #fff 0% 50%) 0 0 / 16px 16px,
    #ffffff;
  /* Konva creates an absolutely-positioned <canvas> inside; the host stays
     responsive via ResizeObserver. */
}
</style>
