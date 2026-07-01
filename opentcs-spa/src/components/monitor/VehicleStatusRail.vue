<script setup lang="ts">
// SPDX-FileCopyrightText: The openTCS Authors
// SPDX-License-Identifier: MIT

import {
  VEHICLE_MONITOR_CATEGORIES,
  type VehicleMonitorCategoryId,
} from '@/domain/vehicles/monitor';

defineProps<{
  active: VehicleMonitorCategoryId;
  counts: Record<VehicleMonitorCategoryId, number>;
}>();

const emit = defineEmits<{
  select: [category: VehicleMonitorCategoryId];
}>();
</script>

<template>
  <nav class="status-rail" aria-label="车辆状态分类">
    <button
      v-for="category in VEHICLE_MONITOR_CATEGORIES"
      :key="category.id"
      type="button"
      class="status-btn"
      :class="{ active: active === category.id }"
      :data-category="category.id"
      @click="emit('select', category.id)"
    >
      <span class="badge">{{ counts[category.id] }}</span>
      <span class="label">{{ category.label }}</span>
    </button>
  </nav>
</template>

<style scoped>
.status-rail {
  width: 5.8rem;
  border-right: 1px solid #d8dee4;
  background: #f6f8fa;
  overflow-y: auto;
  padding: 0.45rem 0.35rem;
}
.status-btn {
  width: 100%;
  min-height: 2.25rem;
  display: grid;
  grid-template-columns: 1.8rem minmax(0, 1fr);
  gap: 0.35rem;
  align-items: center;
  border: 1px solid transparent;
  border-radius: 6px;
  background: transparent;
  color: #57606a;
  cursor: pointer;
  font: inherit;
  padding: 0.2rem 0.25rem;
  text-align: left;
}
.status-btn:hover,
.status-btn.active {
  background: #ffffff;
  border-color: #d0d7de;
  color: #1f2328;
}
.badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 1.55rem;
  height: 1.55rem;
  border-radius: 999px;
  background: #d0d7de;
  color: #1f2328;
  font-size: 0.78rem;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
}
.label {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 0.86rem;
}
.status-btn[data-category='charging'] .badge {
  background: #fff8c5;
  color: #9a6700;
}
.status-btn[data-category='working'] .badge {
  background: #ddf4ff;
  color: #0969da;
}
.status-btn[data-category='waiting'] .badge {
  background: #dafbe1;
  color: #1a7f37;
}
.status-btn[data-category='error'] .badge,
.status-btn[data-category='blocked'] .badge {
  background: #ffebe9;
  color: #cf222e;
}
.status-btn[data-category='offline'] .badge,
.status-btn[data-category='disabled'] .badge {
  background: #eaeef2;
  color: #57606a;
}
</style>
