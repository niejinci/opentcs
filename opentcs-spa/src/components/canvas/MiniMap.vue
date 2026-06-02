<script setup lang="ts">
// SPDX-FileCopyrightText: The openTCS Authors
// SPDX-License-Identifier: MIT
//
// MiniMap — bottom-right overlay that thumbnails the imported PNG and
// shows the part of it currently visible on the main canvas. Clicking (or
// dragging) the thumbnail recenters the main stage on the picked point.
//
// Why a plain HTMLCanvas instead of a second Konva stage?
//   - The minimap is read-only; we only need a one-time draw of the image
//     plus a CSS-positioned <div> for the viewport rectangle. A second
//     Konva stage would pull in another animation loop / hit-test stack
//     for no UX benefit.
//   - Drawing the source <img> straight onto a 2-D context via
//     `drawImage` automatically downscales without us having to manage
//     scaling state per pixel.

import { computed, onMounted, onBeforeUnmount, ref, useTemplateRef, watch } from 'vue';

import {
  fitThumbnail,
  panToStagePoint,
  thumbnailPointToStage,
  viewportRectOnThumbnail,
} from '@/domain/editor/minimap';

const props = defineProps<{
  image: HTMLImageElement;
  imageWidth: number;
  imageHeight: number;
  stageWidth: number;
  stageHeight: number;
  scale: number;
  stageX: number;
  stageY: number;
  /** Outer width of the minimap card in CSS px (default 160). */
  width?: number;
  /** Outer height of the minimap card in CSS px (default 120). */
  height?: number;
}>();

const emit = defineEmits<{
  /** User picked a new stage translation by clicking/dragging the minimap. */
  recenter: [{ stageX: number; stageY: number }];
}>();

const cardWidth = computed(() => props.width ?? 160);
const cardHeight = computed(() => props.height ?? 120);

const thumb = computed(() =>
  fitThumbnail(props.imageWidth, props.imageHeight, cardWidth.value, cardHeight.value),
);

const viewportRect = computed(() =>
  viewportRectOnThumbnail(
    thumb.value,
    props.imageWidth,
    props.imageHeight,
    props.scale,
    props.stageX,
    props.stageY,
    props.stageWidth,
    props.stageHeight,
  ),
);

/* ----------------------- Image draw (cached) ---------------------------- */

const canvasRef = useTemplateRef<HTMLCanvasElement>('canvasRef');

function paint(): void {
  const c = canvasRef.value;
  if (!c) return;
  const t = thumb.value;
  // Resize the backing store to match the device pixel ratio so the
  // thumbnail stays crisp on HiDPI screens; CSS size is set on the element
  // itself via the style binding in the template.
  const dpr = typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1;
  c.width = Math.max(1, Math.round(cardWidth.value * dpr));
  c.height = Math.max(1, Math.round(cardHeight.value * dpr));
  const ctx = c.getContext('2d');
  if (!ctx) return;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, cardWidth.value, cardHeight.value);
  if (t.width > 0 && t.height > 0) {
    try {
      ctx.drawImage(props.image, t.x, t.y, t.width, t.height);
    } catch {
      // jsdom in tests has no real canvas; swallow so the component keeps
      // rendering its viewport rectangle for unit assertions.
    }
  }
}

onMounted(paint);
watch(
  () => [props.image, props.imageWidth, props.imageHeight, cardWidth.value, cardHeight.value],
  () => paint(),
);

/* ---------------------- Pointer interaction ----------------------------- */

const dragging = ref(false);

function recenterFromPointer(e: PointerEvent): void {
  const card = (e.currentTarget as HTMLElement).getBoundingClientRect();
  const localX = e.clientX - card.left;
  const localY = e.clientY - card.top;
  const stagePoint = thumbnailPointToStage(thumb.value, localX, localY);
  if (!stagePoint) return;
  emit(
    'recenter',
    panToStagePoint(stagePoint, props.scale, props.stageWidth, props.stageHeight),
  );
}

function onPointerDown(e: PointerEvent): void {
  dragging.value = true;
  (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
  recenterFromPointer(e);
}
function onPointerMove(e: PointerEvent): void {
  if (!dragging.value) return;
  recenterFromPointer(e);
}
function onPointerUp(e: PointerEvent): void {
  dragging.value = false;
  (e.currentTarget as HTMLElement).releasePointerCapture?.(e.pointerId);
}

onBeforeUnmount(() => {
  dragging.value = false;
});
</script>

<template>
  <div
    class="minimap"
    :style="{ width: `${cardWidth}px`, height: `${cardHeight}px` }"
    aria-label="缩略图导航"
    role="region"
    @pointerdown="onPointerDown"
    @pointermove="onPointerMove"
    @pointerup="onPointerUp"
    @pointercancel="onPointerUp"
  >
    <canvas
      ref="canvasRef"
      class="minimap__canvas"
      :style="{ width: `${cardWidth}px`, height: `${cardHeight}px` }"
    />
    <div
      v-if="viewportRect"
      class="minimap__viewport"
      :style="{
        left: `${viewportRect.x}px`,
        top: `${viewportRect.y}px`,
        width: `${viewportRect.width}px`,
        height: `${viewportRect.height}px`,
      }"
      data-testid="minimap-viewport"
    />
  </div>
</template>

<style scoped>
.minimap {
  position: absolute;
  right: 12px;
  bottom: 56px; /* leave room for the .statusbar at the bottom of MapStage */
  background: rgba(255, 255, 255, 0.92);
  border: 1px solid #d0d7de;
  border-radius: 6px;
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.12);
  overflow: hidden;
  cursor: crosshair;
  z-index: 5;
  user-select: none;
  touch-action: none;
}
.minimap__canvas {
  display: block;
}
.minimap__viewport {
  position: absolute;
  border: 1px solid #0969da;
  background: rgba(9, 105, 218, 0.18);
  pointer-events: none;
}
</style>
