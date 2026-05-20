<script setup lang="ts">
// SPDX-FileCopyrightText: The openTCS Authors
// SPDX-License-Identifier: MIT
//
// HoverLayer — transient visual feedback that follows the cursor in stage
// (= natural image pixel) coordinates.
//
// Modes:
//   1. Crosshair: drawn whenever a creation tool is active and the cursor
//      is over the map (S4 behaviour, unchanged).
//   2. Path rubber-band: when the Path tool is active *and* the user has
//      already clicked a source Point, draw a dashed line from that source
//      to the current cursor so the user can see what Path they would
//      create with the next click. (S5)

import { computed } from 'vue';

import type { EditorToolId } from '@/domain/editor/tools';
import { useProjectStore } from '@/stores/project';

const props = defineProps<{
  /** Cursor position in stage (= natural image pixel) coordinates, or null. */
  cursor: { x: number; y: number } | null;
  /** Currently active editor tool. */
  tool: EditorToolId;
  /** Current stage scale; used to keep visual sizes constant on screen. */
  scale: number;
}>();

const store = useProjectStore();

const safeScale = computed(() => Math.max(props.scale, 0.0001));

/* ----------------------------- Crosshair ------------------------------- */

const showCrosshair = computed(() => props.cursor !== null && props.tool !== 'select');

const crossConfig = computed(() => {
  const cursor = props.cursor;
  if (!cursor) return null;
  const halfSize = 6 / safeScale.value;
  return {
    cursor,
    halfSize,
    strokeWidth: 1 / safeScale.value,
  };
});

/* --------------------------- Path rubber-band -------------------------- */

const pathPreview = computed(() => {
  if (props.tool !== 'path') return null;
  const srcName = store.pathDraftSrc;
  const cursor = props.cursor;
  if (!srcName || !cursor) return null;
  const src = store.findPoint(srcName);
  if (!src) return null;
  return {
    points: [src.layout.pixelX, src.layout.pixelY, cursor.x, cursor.y],
    strokeWidth: 1.5 / safeScale.value,
    dash: [6 / safeScale.value, 4 / safeScale.value],
  };
});
</script>

<template>
  <v-layer :config="{ listening: false }">
    <template v-if="pathPreview">
      <v-line
        :config="{
          points: pathPreview.points,
          stroke: '#bf8700',
          strokeWidth: pathPreview.strokeWidth,
          dash: pathPreview.dash,
        }"
      />
    </template>
    <template v-if="showCrosshair && crossConfig">
      <v-line
        :config="{
          points: [
            crossConfig.cursor.x - crossConfig.halfSize,
            crossConfig.cursor.y,
            crossConfig.cursor.x + crossConfig.halfSize,
            crossConfig.cursor.y,
          ],
          stroke: '#0969da',
          strokeWidth: crossConfig.strokeWidth,
        }"
      />
      <v-line
        :config="{
          points: [
            crossConfig.cursor.x,
            crossConfig.cursor.y - crossConfig.halfSize,
            crossConfig.cursor.x,
            crossConfig.cursor.y + crossConfig.halfSize,
          ],
          stroke: '#0969da',
          strokeWidth: crossConfig.strokeWidth,
        }"
      />
    </template>
  </v-layer>
</template>
