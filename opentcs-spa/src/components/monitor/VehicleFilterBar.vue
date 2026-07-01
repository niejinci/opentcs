<script setup lang="ts">
// SPDX-FileCopyrightText: The openTCS Authors
// SPDX-License-Identifier: MIT

defineProps<{
  groups: readonly string[];
  group: string;
  query: string;
}>();

const emit = defineEmits<{
  'update:group': [value: string];
  'update:query': [value: string];
  locate: [];
}>();
</script>

<template>
  <div class="filter-bar">
    <button type="button" class="locate-btn" @click="emit('locate')">定位</button>
    <select
      :value="group"
      aria-label="车辆分组筛选"
      @change="emit('update:group', ($event.target as HTMLSelectElement).value)"
    >
      <option value="">全部分组</option>
      <option v-for="g in groups" :key="g" :value="g">{{ g }}</option>
    </select>
    <input
      :value="query"
      type="search"
      placeholder="搜索小车 / 点位"
      aria-label="搜索小车或点位"
      @input="emit('update:query', ($event.target as HTMLInputElement).value)"
    />
  </div>
</template>

<style scoped>
.filter-bar {
  display: grid;
  grid-template-columns: auto minmax(7.5rem, 0.75fr) minmax(10rem, 1fr);
  gap: 0.45rem;
  padding: 0.55rem;
  border-bottom: 1px solid #d8dee4;
  background: #ffffff;
}
.locate-btn,
select,
input {
  min-width: 0;
  height: 2rem;
  border: 1px solid #d0d7de;
  border-radius: 5px;
  background: #ffffff;
  color: #1f2328;
  font: inherit;
  font-size: 0.85rem;
}
.locate-btn {
  padding: 0 0.65rem;
  cursor: pointer;
  color: #0969da;
  background: #f6f8fa;
}
.locate-btn:hover {
  background: #ddf4ff;
}
select,
input {
  padding: 0 0.5rem;
}
</style>
