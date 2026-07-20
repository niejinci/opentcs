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
  compact?: boolean;
}>();

const emit = defineEmits<{
  select: [category: VehicleMonitorCategoryId];
  'toggle-compact': [];
}>();
</script>

<template>
  <nav class="status-rail" :class="{ 'status-rail--compact': compact }" aria-label="车辆状态分类">
    <button
      type="button"
      class="rail-toggle"
      :title="compact ? '展开车辆列表' : '收起车辆列表'"
      :aria-label="compact ? '展开车辆列表' : '收起车辆列表'"
      @click="emit('toggle-compact')"
    >
      <span aria-hidden="true">{{ compact ? '‹' : '›' }}</span>
    </button>
    <button
      v-for="category in VEHICLE_MONITOR_CATEGORIES"
      :key="category.id"
      type="button"
      class="status-btn"
      :class="{ active: active === category.id }"
      :data-category="category.id"
      :aria-pressed="active === category.id"
      :title="compact ? `${category.label}：${counts[category.id]}` : undefined"
      @click="emit('select', category.id)"
    >
      <span class="badge">{{ counts[category.id] }}</span>
      <span class="label">{{ category.label }}</span>
    </button>
  </nav>
</template>

<style scoped>
.status-rail {
  box-sizing: border-box;
  width: 5.8rem;
  border-right: 1px solid #d8dee4;
  background: #f6f8fa;
  overflow-y: auto;
  padding: 0.45rem 0.35rem;
}
.rail-toggle {
  width: 100%;
  min-height: 2rem;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 0.35rem;
  border: 1px solid #d0d7de;
  border-radius: 6px;
  background: #ffffff;
  color: #0969da;
  cursor: pointer;
  font: inherit;
  font-size: 1rem;
  line-height: 1;
}
.rail-toggle:hover,
.rail-toggle:focus-visible {
  background: #ddf4ff;
  outline: none;
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
.status-rail--compact {
  width: 3.25rem;
  padding: 0.4rem 0.3rem;
}
.status-rail--compact .status-btn {
  grid-template-columns: 1fr;
  justify-items: center;
  min-height: 2.15rem;
  padding: 0.22rem;
}
.status-rail--compact .label {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip: rect(0 0 0 0);
  white-space: nowrap;
}

@media (max-width: 1080px) {
  .status-rail--compact {
    width: auto;
    display: flex;
    gap: 0.3rem;
    overflow-x: auto;
    overflow-y: hidden;
    border-right: 0;
    border-bottom: 1px solid #d8dee4;
  }
  .status-rail--compact .rail-toggle,
  .status-rail--compact .status-btn {
    flex: 0 0 2.6rem;
    width: 2.6rem;
    margin-bottom: 0;
  }
}
</style>
