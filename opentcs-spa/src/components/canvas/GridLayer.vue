<script setup lang="ts">
// SPDX-FileCopyrightText: The openTCS Authors
// SPDX-License-Identifier: MIT
//
// GridLayer — faint grid that materialises the snap target locations for
// the currently active grid spacing. Drawn in stage (= natural pixel)
// coords just like every other layer; lines are sized in screen pixels by
// dividing by the current stage scale (mirrors HoverLayer's convention).
//
// Visual budget: lines stay subtle (#d0d7de, ~30 % opacity) so they cannot
// obscure the imported PNG; major lines (every 5th) are slightly stronger
// so the user can still read the canvas at a glance.
//
// Performance: only lines that fall inside the stage viewport are emitted,
// so a 100 m × 100 m map at 1 mm/px never draws more than the visible
// ~screen-width / spacing lines.

import { computed } from 'vue';

import { gridLineXs, gridLineYs, MIN_GRID_SPACING_PX } from '@/domain/editor/grid';

const props = defineProps<{
  /** Source raster width in natural pixels (== stage local width). */
  imageWidth: number;
  /** Source raster height in natural pixels. */
  imageHeight: number;
  /** Stage width in CSS pixels (the visible viewport). */
  stageWidth: number;
  /** Stage height in CSS pixels. */
  stageHeight: number;
  /** Current stage scale (== zoom). */
  scale: number;
  /** Stage X translation (CSS px). */
  stageX: number;
  /** Stage Y translation (CSS px). */
  stageY: number;
  /** Grid spacing in stage (== pixel) coords. */
  spacingPx: number;
}>();

const safeScale = computed(() => Math.max(props.scale, 0.0001));

/** Visible viewport in stage coords (intersected with the image bounds). */
const viewport = computed(() => {
  if (props.spacingPx < MIN_GRID_SPACING_PX) return null;
  // Convert (0, stageWidth) screen px → stage px via `(s - tx) / scale`.
  const x0 = Math.max(0, (0 - props.stageX) / safeScale.value);
  const x1 = Math.min(props.imageWidth, (props.stageWidth - props.stageX) / safeScale.value);
  const y0 = Math.max(0, (0 - props.stageY) / safeScale.value);
  const y1 = Math.min(props.imageHeight, (props.stageHeight - props.stageY) / safeScale.value);
  if (x1 <= x0 || y1 <= y0) return null;
  return { x0, x1, y0, y1 };
});

/**
 * Hide the visual grid when the user has zoomed so far out that grid lines
 * would be <= 4 screen pixels apart. Snap math itself is unaffected.
 */
const visualVisible = computed(() => props.spacingPx * safeScale.value >= 4);

const lines = computed(() => {
  const v = viewport.value;
  if (!v || !visualVisible.value) return null;
  const xs = gridLineXs(v.x0, v.x1, props.spacingPx);
  const ys = gridLineYs(v.y0, v.y1, props.spacingPx);
  return {
    xs,
    ys,
    minorWidth: 1 / safeScale.value,
    majorWidth: 1.4 / safeScale.value,
    extentY: [v.y0, v.y1] as const,
    extentX: [v.x0, v.x1] as const,
  };
});

/** Major lines = every 5th, anchored at 0 so they don't drift while panning. */
function isMajor(value: number): boolean {
  const k = Math.round(value / props.spacingPx);
  return k % 5 === 0;
}
</script>

<template>
  <v-layer :config="{ listening: false }">
    <template v-if="lines">
      <v-line
        v-for="x in lines.xs"
        :key="`gx-${x}`"
        :config="{
          points: [x, lines.extentY[0], x, lines.extentY[1]],
          stroke: isMajor(x) ? '#9aa4ad' : '#d0d7de',
          strokeWidth: isMajor(x) ? lines.majorWidth : lines.minorWidth,
          opacity: isMajor(x) ? 0.55 : 0.4,
          perfectDrawEnabled: false,
          shadowEnabled: false,
          hitStrokeWidth: 0,
        }"
      />
      <v-line
        v-for="y in lines.ys"
        :key="`gy-${y}`"
        :config="{
          points: [lines.extentX[0], y, lines.extentX[1], y],
          stroke: isMajor(y) ? '#9aa4ad' : '#d0d7de',
          strokeWidth: isMajor(y) ? lines.majorWidth : lines.minorWidth,
          opacity: isMajor(y) ? 0.55 : 0.4,
          perfectDrawEnabled: false,
          shadowEnabled: false,
          hitStrokeWidth: 0,
        }"
      />
    </template>
  </v-layer>
</template>
