<script setup lang="ts">
// SPDX-FileCopyrightText: The openTCS Authors
// SPDX-License-Identifier: MIT
//
// OrderStatusSidebar — small "live console" embedded into EditorView's
// right side. Renders:
//   - SSE connection pill (open / reconnecting / closed)
//   - The newest N timeline entries from `liveStatus.orderTimeline`,
//     scrolling top-to-bottom so the most recent state-change is
//     visible without scroll-up.
//
// S9 scope: read-only. Withdraw / cancel actions land in S10+.

import { computed } from 'vue';

import { useLiveStatusStore } from '@/stores/liveStatus';
import type { TransportOrderState } from '@/api/types/bff';

const live = useLiveStatusStore();

const visibleEntries = computed(() => live.orderTimeline.slice(0, 50));

const sseLabel = computed(() => {
  switch (live.sseState) {
    case 'idle':
      return '未连接';
    case 'connecting':
      return '连接中…';
    case 'open':
      return '已连接';
    case 'reconnecting':
      return '重连中…';
    case 'closed':
      return '已关闭';
    default:
      return live.sseState;
  }
});

const sseTone = computed<'ok' | 'warn' | 'idle'>(() => {
  if (live.sseState === 'open') return 'ok';
  if (live.sseState === 'reconnecting' || live.sseState === 'closed') return 'warn';
  return 'idle';
});

const STATE_TONE: Record<TransportOrderState, 'info' | 'warn' | 'ok' | 'bad'> = {
  RAW: 'info',
  ACTIVE: 'info',
  DISPATCHABLE: 'info',
  BEING_PROCESSED: 'warn',
  WITHDRAWN: 'warn',
  FINISHED: 'ok',
  FAILED: 'bad',
  UNROUTABLE: 'bad',
};

function formatTime(ts: number): string {
  const d = new Date(ts);
  return d.toLocaleTimeString();
}
</script>

<template>
  <aside class="order-sidebar" aria-label="订单状态侧栏">
    <header class="hdr">
      <h3>订单状态</h3>
      <span class="sse-pill" :data-tone="sseTone">SSE · {{ sseLabel }}</span>
    </header>
    <div v-if="live.activeOrders.length > 0" class="active-summary">
      在执行：{{ live.activeOrders.length }}
    </div>
    <ol class="timeline" :data-empty="visibleEntries.length === 0">
      <li v-if="visibleEntries.length === 0" class="empty">暂无订单事件…</li>
      <li
        v-for="entry in visibleEntries"
        :key="entry.seq"
        class="entry"
        :data-tone="STATE_TONE[entry.state]"
      >
        <div class="row1">
          <span class="ts">{{ formatTime(entry.receivedAt) }}</span>
          <span class="state">{{ entry.state }}</span>
        </div>
        <div class="row2">
          <span class="oname">{{ entry.name }}</span>
          <span v-if="entry.previousState" class="prev">
            ← {{ entry.previousState }}
          </span>
          <span v-if="entry.order?.processingVehicle" class="veh">
            · 车 {{ entry.order.processingVehicle }}
          </span>
          <span v-if="entry.order === null" class="removed">已删除</span>
        </div>
      </li>
    </ol>
  </aside>
</template>

<style scoped>
.order-sidebar {
  display: flex;
  flex-direction: column;
  background: #fff;
  border: 1px solid #d0d7de;
  border-radius: 6px;
  width: 280px;
  max-height: 480px;
  font-size: 0.85rem;
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
.sse-pill {
  font-size: 0.75rem;
  padding: 0.1rem 0.45rem;
  border-radius: 999px;
  border: 1px solid #d0d7de;
  background: #f6f8fa;
}
.sse-pill[data-tone='ok'] {
  color: #1a7f37;
  border-color: #b4dbac;
  background: #dafbe1;
}
.sse-pill[data-tone='warn'] {
  color: #9a6700;
  border-color: #e8c570;
  background: #fff8c5;
}
.active-summary {
  padding: 0.25rem 0.75rem;
  color: #57606a;
  border-bottom: 1px solid #eaeef2;
}
.timeline {
  list-style: none;
  margin: 0;
  padding: 0;
  overflow-y: auto;
  flex: 1 1 auto;
}
.timeline .empty {
  padding: 1rem 0.75rem;
  color: #6e7781;
  text-align: center;
}
.entry {
  padding: 0.4rem 0.75rem;
  border-bottom: 1px solid #f0f3f6;
}
.entry:last-child {
  border-bottom: none;
}
.row1 {
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.row1 .ts {
  color: #6e7781;
  font-variant-numeric: tabular-nums;
}
.row1 .state {
  font-weight: 600;
}
.entry[data-tone='ok'] .row1 .state {
  color: #1a7f37;
}
.entry[data-tone='warn'] .row1 .state {
  color: #9a6700;
}
.entry[data-tone='bad'] .row1 .state {
  color: #cf222e;
}
.entry[data-tone='info'] .row1 .state {
  color: #0969da;
}
.row2 {
  display: flex;
  flex-wrap: wrap;
  gap: 0.35rem;
  color: #1f2328;
  margin-top: 0.15rem;
}
.row2 .oname {
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
}
.row2 .prev,
.row2 .veh {
  color: #6e7781;
}
.row2 .removed {
  color: #cf222e;
}
</style>
