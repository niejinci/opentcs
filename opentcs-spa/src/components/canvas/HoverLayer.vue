<script setup lang="ts">
// SPDX-FileCopyrightText: The openTCS Authors
// SPDX-License-Identifier: MIT
//
// HoverLayer — draws transient visual feedback that follows the cursor in
// stage coordinates (= natural image pixels). In S4 we only draw a small
// crosshair when a creation-style tool (point / path) is active and the
// cursor is over the map. S5+ may extend this for path-preview rubber band.

import { computed } from 'vue';

import type { EditorToolId } from '@/domain/editor/tools';

const props = defineProps<{
  /** Cursor position in stage (= natural image pixel) coordinates, or null. */
  cursor: { x: number; y: number } | null;
  /** Currently active editor tool. */
  tool: EditorToolId;
  /** Current stage scale; used to keep the crosshair size constant on screen. */
  scale: number;
}>();

const visible = computed(() => props.cursor !== null && props.tool !== 'select');

// Keep the crosshair ~12 CSS pixels regardless of zoom by dividing by scale.
const crossConfig = computed(() => {
  const cursor = props.cursor;
  if (!cursor) return null;
  const halfSize = 6 / Math.max(props.scale, 0.0001);
  return {
    cursor,
    halfSize,
    strokeWidth: 1 / Math.max(props.scale, 0.0001),
  };
});
</script>

<template>
  <v-layer :config="{ listening: false }">
    <template v-if="visible && crossConfig">
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
