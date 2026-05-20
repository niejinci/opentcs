<script setup lang="ts">
// SPDX-FileCopyrightText: The openTCS Authors
// SPDX-License-Identifier: MIT
//
// AnnotationLayer — placeholder Konva layer that will hold user-created
// entities (Points / Paths / Locations / Blocks / Vehicles) starting in S5.
// S4 only renders nothing; keeping the layer in the tree means future PRs
// can drop shapes in without re-touching MapStage's layer ordering.
</script>

<template>
  <v-layer />
</template>
