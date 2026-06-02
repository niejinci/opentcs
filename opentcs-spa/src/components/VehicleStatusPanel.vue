<script setup lang="ts">
// SPDX-FileCopyrightText: The openTCS Authors
// SPDX-License-Identifier: MIT
//
// VehicleStatusPanel — read-only "live status board" listing every kernel
// vehicle the SSE bridge currently knows about. Mounted in EditorView and
// OrdersView so the user can monitor fleet state without leaving either
// page.
//
// Acceptance criteria covered:
//   - 3.4 Renders state / procState / integrationLevel / currentPosition /
//         energyLevel / paused for every vehicle.
//   - 3.5 Auto-refreshes via reactivity on `useLiveStatusStore().vehicles`
//         (driven by SSE) — no polling or manual refresh.
//   - 3.6 currentPosition column updates whenever the kernel emits a
//         vehicle event with a new position (same store, same reactivity).
//   - 3.8 Displays a "暂无车辆" placeholder when the kernel has no vehicles.
//   - 3.9 The list body is a scrollable container so 40+ vehicles stay
//         performant; rendering plain rows in a single <ol> is well
//         within Vue's 30 FPS budget at this scale.
//
// 3.7 (双向选中联动) is explicitly marked optional in the acceptance
// matrix and intentionally left out — wiring it would require coupling
// this panel to the canvas selection store and is best done in a
// follow-up PR.

import { computed } from 'vue';

import type { VehicleIntegrationLevel, VehicleState } from '@/api/types/bff';
import { useLiveStatusStore } from '@/stores/liveStatus';

const live = useLiveStatusStore();

const vehicles = computed(() => live.vehicleList);

const STATE_TONE: Record<VehicleState, 'ok' | 'info' | 'warn' | 'bad' | 'idle'> = {
  IDLE: 'ok',
  EXECUTING: 'info',
  CHARGING: 'warn',
  ERROR: 'bad',
  UNAVAILABLE: 'idle',
  UNKNOWN: 'idle',
};

const INTEGRATION_LEVEL_LABEL: Record<VehicleIntegrationLevel, string> = {
  TO_BE_IGNORED: '忽略',
  TO_BE_NOTICED: '关注',
  TO_BE_RESPECTED: '受控',
  TO_BE_UTILIZED: '使用',
};

function formatEnergy(level: number): string {
  if (!Number.isFinite(level)) return '—';
  return `${Math.round(level)}%`;
}
</script>

<template>
  <aside class="vehicle-panel" aria-label="车辆实时状态面板">
    <header class="hdr">
      <h3>车辆实时状态</h3>
      <span class="count">{{ vehicles.length }} 台</span>
    </header>
    <div class="body" :data-empty="vehicles.length === 0">
      <p v-if="vehicles.length === 0" class="empty">暂无车辆</p>
      <table v-else class="grid">
        <thead>
          <tr>
            <th scope="col">名称</th>
            <th scope="col">状态</th>
            <th scope="col">运行</th>
            <th scope="col">集成级别</th>
            <th scope="col">当前点位</th>
            <th scope="col">电量</th>
            <th scope="col">暂停</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="v in vehicles" :key="v.name">
            <th scope="row" class="name">{{ v.name }}</th>
            <td>
              <span class="badge" :data-tone="STATE_TONE[v.state]">{{ v.state }}</span>
            </td>
            <td class="proc">{{ v.procState }}</td>
            <td class="ilevel">{{ INTEGRATION_LEVEL_LABEL[v.integrationLevel] }}</td>
            <td class="pos">{{ v.currentPosition || '—' }}</td>
            <td class="energy">{{ formatEnergy(v.energyLevel) }}</td>
            <td class="paused" :data-on="v.paused">{{ v.paused ? '是' : '否' }}</td>
          </tr>
        </tbody>
      </table>
    </div>
  </aside>
</template>

<style scoped>
.vehicle-panel {
  display: flex;
  flex-direction: column;
  background: #fff;
  border: 1px solid #d0d7de;
  border-radius: 6px;
  font-size: 0.85rem;
  min-width: 0;
}
.hdr {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.5rem 0.75rem;
  border-bottom: 1px solid #d0d7de;
}
.hdr h3 {
  margin: 0;
  font-size: 0.95rem;
}
.count {
  color: #57606a;
  font-variant-numeric: tabular-nums;
}
.body {
  /* Bounded height so 40+ vehicles scroll instead of pushing the page —
     covers acceptance 3.9. */
  max-height: 360px;
  overflow-y: auto;
}
.body[data-empty='true'] {
  max-height: none;
}
.empty {
  margin: 0;
  padding: 1.25rem 0.75rem;
  color: #6e7781;
  text-align: center;
}
.grid {
  border-collapse: collapse;
  width: 100%;
}
.grid thead th {
  position: sticky;
  top: 0;
  background: #f6f8fa;
  text-align: left;
  font-weight: 600;
  color: #1f2328;
  padding: 0.4rem 0.6rem;
  border-bottom: 1px solid #d0d7de;
  white-space: nowrap;
}
.grid tbody td,
.grid tbody th {
  padding: 0.35rem 0.6rem;
  border-bottom: 1px solid #f0f3f6;
  font-weight: normal;
  text-align: left;
  vertical-align: middle;
  white-space: nowrap;
}
.grid tbody tr:last-child td,
.grid tbody tr:last-child th {
  border-bottom: none;
}
.grid .name {
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  color: #1f2328;
}
.badge {
  display: inline-block;
  padding: 0.05rem 0.45rem;
  border-radius: 999px;
  font-size: 0.75rem;
  border: 1px solid #d0d7de;
  background: #f6f8fa;
  color: #1f2328;
}
.badge[data-tone='ok'] {
  color: #1a7f37;
  border-color: #b4dbac;
  background: #dafbe1;
}
.badge[data-tone='info'] {
  color: #0969da;
  border-color: #b6dcfb;
  background: #ddf4ff;
}
.badge[data-tone='warn'] {
  color: #9a6700;
  border-color: #e8c570;
  background: #fff8c5;
}
.badge[data-tone='bad'] {
  color: #cf222e;
  border-color: #ffabab;
  background: #ffebe9;
}
.badge[data-tone='idle'] {
  color: #57606a;
}
.energy {
  font-variant-numeric: tabular-nums;
}
.paused[data-on='true'] {
  color: #cf222e;
  font-weight: 600;
}
</style>
