<script setup lang="ts">
// SPDX-FileCopyrightText: The openTCS Authors
// SPDX-License-Identifier: MIT
//
// BackgroundLayer — renders the imported PNG as a single Konva.Image at
// natural pixel size. The parent <MapStage> handles all zoom/pan via the
// Stage scale + position; this layer never transforms itself.

import { computed } from 'vue';

const props = defineProps<{
  image: HTMLImageElement;
  width: number;
  height: number;
}>();

// Konva imageSmoothing toggles via a stage-level call in MapStage. The image
// is drawn at (0, 0) in stage coordinates; stage coordinates ARE natural
// image pixel coordinates by construction (see MapStage docstring).
const imageConfig = computed(() => ({
  image: props.image,
  width: props.width,
  height: props.height,
  x: 0,
  y: 0,
  listening: false, // background never reacts to clicks; tools live on AnnotationLayer
}));
</script>

<template>
  <v-layer :config="{ listening: false }">
    <v-image :config="imageConfig" />
  </v-layer>
</template>
