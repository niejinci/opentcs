<script setup lang="ts">
// SPDX-FileCopyrightText: The openTCS Authors
// SPDX-License-Identifier: MIT

import { computed, onBeforeUnmount, ref } from 'vue';

import CopyableValue from '@/components/monitor/CopyableValue.vue';
import { pixelToWorld, type AffineMapping } from '@/domain/geometry/affine';
import type { DraftLocation, DraftPoint } from '@/domain/model/types';

type PointLocationDetailTarget =
  | { kind: 'point'; point: DraftPoint }
  | { kind: 'location'; location: DraftLocation };

const props = defineProps<{
  target: PointLocationDetailTarget;
  affine: AffineMapping;
}>();

const emit = defineEmits<{
  close: [];
}>();

const position = ref({ x: 16, y: 16 });

let dragStart: {
  pointerX: number;
  pointerY: number;
  x: number;
  y: number;
} | null = null;

const title = computed(() =>
  props.target.kind === 'point' ? props.target.point.name : props.target.location.name,
);
const subtitle = computed(() => (props.target.kind === 'point' ? 'Point 点位' : 'Location 站点'));
const pixel = computed(() => {
  if (props.target.kind === 'point') {
    return {
      x: props.target.point.layout.pixelX,
      y: props.target.point.layout.pixelY,
    };
  }
  return {
    x: props.target.location.layout.pixelX,
    y: props.target.location.layout.pixelY,
  };
});
const world = computed(() => pixelToWorld(props.affine, pixel.value));
const propertyEntries = computed(() => {
  const properties =
    props.target.kind === 'point' ? props.target.point.properties : props.target.location.properties;
  return Object.entries(properties ?? {});
});
const linkEntries = computed(() =>
  props.target.kind === 'location' ? props.target.location.links : [],
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
    x: Math.max(0, Math.min(nextX, window.innerWidth - 320)),
    y: Math.max(0, Math.min(nextY, window.innerHeight - 180)),
  };
}

function onPointerUp(): void {
  dragStart = null;
  window.removeEventListener('pointermove', onPointerMove);
  window.removeEventListener('pointerup', onPointerUp);
  window.removeEventListener('pointercancel', onPointerUp);
}

function valueText(value: unknown): string {
  if (value === null || value === undefined || value === '') return '-';
  if (typeof value === 'number' && Number.isNaN(value)) return '-';
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}

function operationsText(operations: readonly string[]): string {
  return operations.length > 0 ? operations.join(', ') : '继承 LocationType';
}

onBeforeUnmount(() => {
  onPointerUp();
});
</script>

<template>
  <section
    class="target-detail-window"
    :style="{ transform: `translate(${position.x}px, ${position.y}px)` }"
    aria-label="点位详情"
  >
    <header class="detail-header" @pointerdown="onHeaderPointerDown">
      <div>
        <p>{{ subtitle }}</p>
        <h3>{{ title }}</h3>
      </div>
      <button type="button" aria-label="关闭点位详情" @click="emit('close')">×</button>
    </header>

    <div class="detail-body">
      <dl v-if="target.kind === 'point'" class="kv">
        <dt>名称</dt>
        <CopyableValue label="名称" :value="target.point.name" />
        <dt>类型</dt>
        <CopyableValue label="类型" :value="target.point.type" />
        <dt>像素坐标</dt>
        <CopyableValue label="像素坐标" :value="pixel.x.toFixed(1) + ', ' + pixel.y.toFixed(1)" />
        <dt>世界坐标</dt>
        <CopyableValue
          label="世界坐标"
          :value="world.x.toFixed(3) + ' m, ' + world.y.toFixed(3) + ' m'"
        />
        <dt>openTCS X</dt>
        <CopyableValue label="openTCS X" :value="valueText(target.point.pose.position.x) + ' mm'" />
        <dt>openTCS Y</dt>
        <CopyableValue label="openTCS Y" :value="valueText(target.point.pose.position.y) + ' mm'" />
        <dt>openTCS Z</dt>
        <CopyableValue label="openTCS Z" :value="valueText(target.point.pose.position.z) + ' mm'" />
        <dt>方向角</dt>
        <CopyableValue label="方向角" :value="valueText(target.point.pose.orientationAngle)" />
      </dl>

      <dl v-else class="kv">
        <dt>名称</dt>
        <CopyableValue label="名称" :value="target.location.name" />
        <dt>类型</dt>
        <CopyableValue label="类型" :value="target.location.typeName" />
        <dt>锁定</dt>
        <CopyableValue label="锁定" :value="target.location.locked ? '是' : '否'" />
        <dt>表现形式</dt>
        <CopyableValue label="表现形式" :value="target.location.layout.locationRepresentation" />
        <dt>像素坐标</dt>
        <CopyableValue label="像素坐标" :value="pixel.x.toFixed(1) + ', ' + pixel.y.toFixed(1)" />
        <dt>世界坐标</dt>
        <CopyableValue
          label="世界坐标"
          :value="world.x.toFixed(3) + ' m, ' + world.y.toFixed(3) + ' m'"
        />
        <dt>openTCS X</dt>
        <CopyableValue label="openTCS X" :value="valueText(target.location.position.x) + ' mm'" />
        <dt>openTCS Y</dt>
        <CopyableValue label="openTCS Y" :value="valueText(target.location.position.y) + ' mm'" />
        <dt>openTCS Z</dt>
        <CopyableValue label="openTCS Z" :value="valueText(target.location.position.z) + ' mm'" />
      </dl>

      <section v-if="target.kind === 'location'" class="subsection">
        <h4>关联 Point</h4>
        <p v-if="linkEntries.length === 0" class="empty">暂无关联 Point</p>
        <ul v-else class="links">
          <li v-for="link in linkEntries" :key="link.pointName">
            <strong>{{ link.pointName }}</strong>
            <span>{{ operationsText(link.allowedOperations) }}</span>
          </li>
        </ul>
      </section>

      <section class="subsection">
        <h4>扩展属性</h4>
        <p v-if="propertyEntries.length === 0" class="empty">暂无扩展属性</p>
        <dl v-else class="kv properties">
          <template v-for="[key, value] in propertyEntries" :key="key">
            <dt>{{ key }}</dt>
            <CopyableValue :label="key" :value="valueText(value)" />
          </template>
        </dl>
      </section>
    </div>
  </section>
</template>

<style scoped>
.target-detail-window {
  position: absolute;
  left: 0;
  top: 0;
  z-index: 24;
  width: min(27rem, calc(100vw - 2rem));
  max-height: min(34rem, calc(100vh - 2rem));
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
.detail-header p {
  margin: 0;
  color: #6e7781;
  font-size: 0.76rem;
}
h3 {
  margin: 0.1rem 0 0;
  font-size: 1.1rem;
}
.detail-header button {
  width: 1.8rem;
  height: 1.8rem;
  border: 1px solid #d0d7de;
  border-radius: 5px;
  background: #f6f8fa;
  color: #cf222e;
  cursor: pointer;
  font: inherit;
  font-size: 1.1rem;
  line-height: 1;
}
.detail-body {
  min-height: 0;
  overflow: auto;
  padding: 0.75rem 0.85rem 0.9rem;
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
.subsection {
  margin-top: 0.9rem;
  padding-top: 0.75rem;
  border-top: 1px solid #eaeef2;
}
h4 {
  margin: 0 0 0.5rem;
  color: #57606a;
  font-size: 0.86rem;
}
.empty {
  margin: 0;
  color: #6e7781;
  font-size: 0.86rem;
}
.links {
  display: grid;
  gap: 0.35rem;
  margin: 0;
  padding: 0;
  list-style: none;
}
.links li {
  display: grid;
  grid-template-columns: minmax(7rem, 0.45fr) minmax(0, 1fr);
  gap: 0.5rem;
  padding: 0.35rem 0;
  border-bottom: 1px solid #f0f3f6;
  font-size: 0.86rem;
}
.links strong {
  min-width: 0;
  overflow-wrap: anywhere;
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
}
.links span {
  min-width: 0;
  color: #57606a;
  overflow-wrap: anywhere;
}
.properties {
  grid-template-columns: minmax(9rem, 0.42fr) minmax(0, 1fr);
  row-gap: 0;
}
.properties dt,
.properties :deep(dd) {
  min-height: 1.75rem;
  padding: 0.3rem 0;
  border-bottom: 1px solid #f0f3f6;
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 0.82rem;
}
.properties dt {
  padding-right: 0.65rem;
}
</style>
