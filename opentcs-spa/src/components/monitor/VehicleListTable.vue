<script setup lang="ts">
// SPDX-FileCopyrightText: The openTCS Authors
// SPDX-License-Identifier: MIT

import type { VehicleMonitorRow } from '@/domain/vehicles/monitor';

defineProps<{
  rows: readonly VehicleMonitorRow[];
  selectedVehicleName: string | null;
}>();

const emit = defineEmits<{
  select: [name: string];
}>();

function formatEnergy(level: number): string {
  return Number.isFinite(level) ? `${Math.round(level)}%` : '-';
}

function activeOrderText(row: VehicleMonitorRow): string {
  return row.activeOrder?.name ?? '-';
}
</script>

<template>
  <div class="vehicle-list">
    <p v-if="rows.length === 0" class="empty">暂无匹配车辆</p>
    <table v-else>
      <thead>
        <tr>
          <th scope="col">机器人</th>
          <th scope="col">状态</th>
          <th scope="col">电量</th>
          <th scope="col">任务</th>
          <th scope="col">点位</th>
          <th scope="col">详情</th>
        </tr>
      </thead>
      <tbody>
        <tr
          v-for="row in rows"
          :key="row.vehicle.name"
          :class="{ selected: selectedVehicleName === row.vehicle.name }"
          @click="emit('select', row.vehicle.name)"
        >
          <th scope="row">{{ row.vehicle.name }}</th>
          <td>{{ row.vehicle.state }}</td>
          <td>{{ formatEnergy(row.vehicle.energyLevel) }}</td>
          <td>{{ activeOrderText(row) }}</td>
          <td>{{ row.vehicle.currentPosition ?? '-' }}</td>
          <td>
            <button type="button" @click.stop="emit('select', row.vehicle.name)">详情</button>
          </td>
        </tr>
      </tbody>
    </table>
  </div>
</template>

<style scoped>
.vehicle-list {
  min-height: 0;
  overflow: auto;
  background: #ffffff;
}
.empty {
  margin: 0;
  padding: 1.5rem 0.75rem;
  color: #6e7781;
  text-align: center;
  font-size: 0.9rem;
}
table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.86rem;
}
thead th {
  position: sticky;
  top: 0;
  z-index: 1;
  padding: 0.5rem 0.45rem;
  border-bottom: 1px solid #d8dee4;
  background: #f6f8fa;
  text-align: left;
  color: #57606a;
  font-weight: 600;
  white-space: nowrap;
}
tbody th,
tbody td {
  padding: 0.48rem 0.45rem;
  border-bottom: 1px solid #f0f3f6;
  text-align: left;
  white-space: nowrap;
}
tbody tr {
  cursor: pointer;
}
tbody tr:hover,
tbody tr.selected {
  background: #ddf4ff;
}
tbody th {
  color: #1f2328;
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-weight: 600;
}
button {
  border: none;
  background: transparent;
  color: #0969da;
  cursor: pointer;
  font: inherit;
  padding: 0;
}
</style>
