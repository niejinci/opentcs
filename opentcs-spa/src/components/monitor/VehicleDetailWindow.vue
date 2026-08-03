<script setup lang="ts">
// SPDX-FileCopyrightText: The openTCS Authors
// SPDX-License-Identifier: MIT

import { computed, onBeforeUnmount, ref, watch } from 'vue';

import type { TransportOrder, Vehicle } from '@/api/types/bff';
import CopyableValue from '@/components/monitor/CopyableValue.vue';
import { vehicleHomeUrl } from '@/domain/vehicles/monitor';

const props = defineProps<{
  vehicle: Vehicle;
  activeOrder: TransportOrder | null;
}>();

const emit = defineEmits<{
  close: [];
  createOrder: [vehicleName: string];
  openHome: [url: string];
}>();

const tabs = ['基本信息', '任务信息', '点位信息', '属性'] as const;
type TabId = (typeof tabs)[number];

const activeTab = ref<TabId>('基本信息');
const position = ref({ x: 24, y: 24 });
const homeUrl = computed(() => vehicleHomeUrl(props.vehicle));

let dragStart: {
  pointerX: number;
  pointerY: number;
  x: number;
  y: number;
} | null = null;

watch(
  () => props.vehicle.name,
  () => {
    activeTab.value = '基本信息';
  },
);

function onHeaderPointerDown(e: PointerEvent): void {
  if (e.button !== 0) return;
  const target = e.target as HTMLElement;
  if (target.closest('button')) return;
  dragStart = {
    pointerX: e.clientX,
    pointerY: e.clientY,
    x: position.value.x,
    y: position.value.y,
  };
  window.addEventListener('pointermove', onPointerMove);
  window.addEventListener('pointerup', onPointerUp, { once: true });
  window.addEventListener('pointercancel', onPointerUp, { once: true });
}

function onPointerMove(e: PointerEvent): void {
  if (!dragStart) return;
  const nextX = dragStart.x + e.clientX - dragStart.pointerX;
  const nextY = dragStart.y + e.clientY - dragStart.pointerY;
  position.value = {
    x: Math.max(0, Math.min(nextX, window.innerWidth - 360)),
    y: Math.max(0, Math.min(nextY, window.innerHeight - 180)),
  };
}

function onPointerUp(): void {
  dragStart = null;
  window.removeEventListener('pointermove', onPointerMove);
  window.removeEventListener('pointerup', onPointerUp);
  window.removeEventListener('pointercancel', onPointerUp);
}

function openHome(): void {
  if (!homeUrl.value) return;
  emit('openHome', homeUrl.value);
}

function valueText(value: unknown): string {
  if (value === null || value === undefined || value === '') return '-';
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}

const propertyEntries = computed(() => Object.entries(props.vehicle.properties ?? {}));

onBeforeUnmount(() => {
  onPointerUp();
});
</script>

<template>
  <section
    class="detail-window"
    :style="{ transform: `translate(${position.x}px, ${position.y}px)` }"
    aria-label="车辆详情"
  >
    <header class="detail-header" @pointerdown="onHeaderPointerDown">
      <div>
        <p class="eyebrow">车辆详情</p>
        <h3>{{ vehicle.name }}</h3>
      </div>
      <div class="header-actions">
        <button type="button" :disabled="!homeUrl" title="跳转车载主页" @click="openHome">
          车载主页
        </button>
        <button type="button" title="跳转创建任务页" @click="emit('createOrder', vehicle.name)">
          新建任务
        </button>
        <button type="button" class="icon" aria-label="关闭车辆详情" @click="emit('close')">
          ×
        </button>
      </div>
    </header>

    <nav class="tabs" aria-label="车辆详情标签">
      <button
        v-for="tab in tabs"
        :key="tab"
        type="button"
        :class="{ active: activeTab === tab }"
        @click="activeTab = tab"
      >
        {{ tab }}
      </button>
    </nav>

    <div class="detail-body">
      <dl v-if="activeTab === '基本信息'" class="kv">
        <dt>状态</dt>
        <CopyableValue label="状态" :value="vehicle.state" />
        <dt>运行</dt>
        <CopyableValue label="运行" :value="vehicle.procState" />
        <dt>集成级别</dt>
        <CopyableValue label="集成级别" :value="vehicle.integrationLevel" />
        <dt>操作模式</dt>
        <CopyableValue label="操作模式" :value="valueText(vehicle.operatingMode)" />
        <dt>电量</dt>
        <CopyableValue label="电量" :value="Math.round(vehicle.energyLevel) + '%'" />
        <dt>暂停</dt>
        <CopyableValue label="暂停" :value="vehicle.paused ? '是' : '否'" />
        <dt>最后状态</dt>
        <CopyableValue label="最后状态" :value="valueText(vehicle.lastStateAt)" />
      </dl>

      <dl v-else-if="activeTab === '任务信息'" class="kv">
        <dt>活跃订单</dt>
        <CopyableValue label="活跃订单" :value="activeOrder?.name ?? '-'" />
        <dt>订单状态</dt>
        <CopyableValue label="订单状态" :value="activeOrder?.state ?? '-'" />
        <dt>意向车辆</dt>
        <CopyableValue label="意向车辆" :value="activeOrder?.intendedVehicle ?? '-'" />
        <dt>执行车辆</dt>
        <CopyableValue label="执行车辆" :value="activeOrder?.processingVehicle ?? '-'" />
        <dt>目的地数</dt>
        <CopyableValue label="目的地数" :value="activeOrder?.destinations.length ?? 0" />
      </dl>

      <dl v-else-if="activeTab === '点位信息'" class="kv">
        <dt>当前点位</dt>
        <CopyableValue label="当前点位" :value="vehicle.currentPosition ?? '-'" />
        <dt>精确坐标 X</dt>
        <CopyableValue label="精确坐标 X" :value="valueText(vehicle.precisePosition?.x)" />
        <dt>精确坐标 Y</dt>
        <CopyableValue label="精确坐标 Y" :value="valueText(vehicle.precisePosition?.y)" />
        <dt>精确坐标 Z</dt>
        <CopyableValue label="精确坐标 Z" :value="valueText(vehicle.precisePosition?.z)" />
        <dt>方向角</dt>
        <CopyableValue label="方向角" :value="valueText(vehicle.orientationAngle)" />
      </dl>

      <div v-else class="properties">
        <p v-if="propertyEntries.length === 0" class="empty">暂无扩展属性</p>
        <dl v-else class="kv kv--properties">
          <template v-for="[key, value] in propertyEntries" :key="key">
            <dt>{{ key }}</dt>
            <CopyableValue :label="key" :value="valueText(value)" />
          </template>
        </dl>
      </div>
    </div>
  </section>
</template>

<style scoped>
.detail-window {
  position: absolute;
  left: 0;
  top: 0;
  z-index: 20;
  width: min(36rem, calc(100vw - 2rem));
  max-height: min(30rem, calc(100vh - 2rem));
  display: flex;
  flex-direction: column;
  border: 1px solid #d0d7de;
  border-radius: 8px;
  background: #ffffff;
  box-shadow: 0 16px 40px rgba(27, 31, 36, 0.18);
  overflow: hidden;
}
.detail-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  padding: 0.75rem 0.85rem;
  border-bottom: 1px solid #d8dee4;
  cursor: move;
  touch-action: none;
}
.eyebrow {
  margin: 0;
  color: #6e7781;
  font-size: 0.76rem;
}
h3 {
  margin: 0.1rem 0 0;
  font-size: 1.1rem;
}
.header-actions {
  display: flex;
  align-items: center;
  gap: 0.4rem;
}
.header-actions button,
.tabs button {
  border: 1px solid #d0d7de;
  border-radius: 5px;
  background: #f6f8fa;
  color: #1f2328;
  cursor: pointer;
  font: inherit;
  font-size: 0.82rem;
  padding: 0.25rem 0.55rem;
}
.header-actions button:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}
.header-actions .icon {
  width: 1.8rem;
  padding: 0.25rem 0;
  color: #cf222e;
}
.tabs {
  display: flex;
  gap: 0.35rem;
  padding: 0.55rem 0.65rem 0;
  background: #ffffff;
}
.tabs button {
  border-color: transparent;
  background: transparent;
  color: #57606a;
}
.tabs button.active {
  border-color: #d0d7de;
  background: #f6f8fa;
  color: #1f2328;
  font-weight: 600;
}
.detail-body {
  min-height: 0;
  overflow: auto;
  padding: 0.65rem 0.85rem 0.85rem;
}
.kv {
  display: grid;
  grid-template-columns: 6.5rem minmax(0, 1fr);
  gap: 0.45rem 0.75rem;
  margin: 0;
  font-size: 0.88rem;
}
.kv dt {
  min-width: 0;
  color: #6e7781;
  overflow-wrap: anywhere;
}
.kv--properties {
  grid-template-columns: minmax(11rem, 0.42fr) minmax(0, 1fr);
  align-items: start;
  row-gap: 0;
}
.kv--properties dt,
.kv--properties :deep(dd) {
  min-height: 1.8rem;
  padding: 0.3rem 0;
  border-bottom: 1px solid #f0f3f6;
  line-height: 1.35;
}
.kv--properties dt {
  padding-right: 0.75rem;
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 0.82rem;
}
.kv--properties :deep(dd) {
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 0.82rem;
}
.empty {
  margin: 0;
  color: #6e7781;
  font-size: 0.88rem;
}
</style>
