<script setup lang="ts">
// SPDX-FileCopyrightText: The openTCS Authors
// SPDX-License-Identifier: MIT

import { computed, ref, watch } from 'vue';

import { sendInstantActions } from '@/api/endpoints/vehicles';
import { HttpError } from '@/api/errors';
import type { Vehicle } from '@/api/types/bff';
import MapStage from '@/components/canvas/MapStage.vue';
import type { DraftPoint, PointType } from '@/domain/model/types';
import {
  AGV_RELOCATION_MAP_DIRS,
  DEFAULT_AGV_RELOCATION_MAP_DIR,
  buildAgvRelocationInstantActionsRequest,
  relocationTargetFromPoint,
  validateAgvRelocationTarget,
  type AgvRelocationMapDir,
  type AgvRelocationTarget,
} from '@/domain/vehicles/relocation';
import { useLiveStatusStore } from '@/stores/liveStatus';
import type { BackgroundMapState } from '@/stores/project';
import { toastError, toastSuccess } from '@/ui/toast/toastBus';

type RelocationMode = 'point' | 'manual';
type PointTypeFilter = 'all' | PointType;

const props = defineProps<{
  vehicleName: string;
  points: readonly DraftPoint[];
  mapId: string;
  background: BackgroundMapState | null;
}>();

const emit = defineEmits<{
  close: [];
  relocated: [target: AgvRelocationTarget];
}>();

const live = useLiveStatusStore();

const mode = ref<RelocationMode>('point');
const pointTypeFilter = ref<PointTypeFilter>('all');
const selectedPointName = ref('');
const mapIdText = ref('');
const xText = ref('');
const yText = ref('');
const thetaText = ref('0');
const mapDir = ref<AgvRelocationMapDir | ''>(DEFAULT_AGV_RELOCATION_MAP_DIR);
const submitting = ref(false);

const liveVehicle = computed<Vehicle | null>(() => live.vehicles[props.vehicleName] ?? null);
const selectedPoint = computed(
  () => props.points.find((point) => point.name === selectedPointName.value) ?? null,
);
const filteredPoints = computed(() => {
  if (pointTypeFilter.value === 'all') return props.points;
  return props.points.filter((point) => point.type === pointTypeFilter.value);
});
const selectedPointSummary = computed(() => {
  const point = selectedPoint.value;
  if (!point) return '未选择点位';
  return `${point.name} · x=${xText.value || '-'}m, y=${yText.value || '-'}m, theta=${
    thetaText.value || '-'
  }`;
});
const busyReason = computed(() => {
  const vehicle = liveVehicle.value;
  if (!vehicle) return '';
  if (vehicle.procState === 'PROCESSING_ORDER') return '车辆正在执行订单，不能重定位';
  if (vehicle.state === 'EXECUTING') return '车辆处于执行状态，不能重定位';
  return '';
});

watch(
  () => props.vehicleName,
  () => reset(),
  { immediate: true },
);

watch(selectedPointName, (name) => {
  if (!name) return;
  const point = props.points.find((item) => item.name === name);
  if (point) applyPoint(point);
});

function reset(): void {
  mode.value = 'point';
  pointTypeFilter.value = 'all';
  selectedPointName.value = '';
  mapIdText.value = props.mapId || '';
  xText.value = '';
  yText.value = '';
  thetaText.value = '0';
  mapDir.value = DEFAULT_AGV_RELOCATION_MAP_DIR;
  submitting.value = false;
}

function applyPoint(point: DraftPoint): void {
  const target = relocationTargetFromPoint(point, mapIdText.value || props.mapId, mapDir.value);
  xText.value = formatCoordinate(target.x);
  yText.value = formatCoordinate(target.y);
  thetaText.value = formatTheta(target.theta);
}

function onMapTargetClick(target: { kind: 'point' | 'location'; name: string }): void {
  if (target.kind !== 'point') return;
  selectedPointName.value = target.name;
}

function targetFromForm(): AgvRelocationTarget {
  return {
    mapId: mapIdText.value,
    x: Number(xText.value),
    y: Number(yText.value),
    theta: Number(thetaText.value),
    mapDir: mapDir.value,
  };
}

async function submit(): Promise<void> {
  if (submitting.value) return;
  if (mode.value === 'point' && !selectedPoint.value) {
    toastError('请先选择重定位点位', 'AGV重定位');
    return;
  }
  if (busyReason.value) {
    toastError(busyReason.value, 'AGV重定位');
    return;
  }

  const target = targetFromForm();
  const issues = validateAgvRelocationTarget(target);
  if (issues.length > 0) {
    toastError(issues[0]?.message ?? '重定位参数错误', 'AGV重定位');
    return;
  }

  const request = buildAgvRelocationInstantActionsRequest(target, crypto.randomUUID());
  submitting.value = true;
  try {
    await sendInstantActions(props.vehicleName, request, { toastOnError: false });
    toastSuccess(`已下发车辆 ${props.vehicleName} 重定位`, 'AGV重定位');
    emit('relocated', target);
    emit('close');
  } catch (err) {
    if (err instanceof HttpError) {
      const code = err.payload?.code ?? `HTTP_${err.status}`;
      const msg = err.payload?.message ?? err.statusText;
      toastError(`${code}: ${msg}`, '重定位下发失败');
    } else {
      toastError('重定位下发失败，请检查网络或后端服务', 'AGV重定位');
    }
  } finally {
    submitting.value = false;
  }
}

function formatCoordinate(value: number): string {
  return Number(value.toFixed(3)).toString();
}

function formatTheta(value: number): string {
  return Number(value.toFixed(6)).toString();
}
</script>

<template>
  <div class="relocation-backdrop" role="presentation">
    <section
      class="relocation-dialog"
      role="dialog"
      aria-modal="true"
      aria-labelledby="agv-relocation-title"
    >
      <header class="dialog-header">
        <div>
          <p>车辆重定位</p>
          <h3 id="agv-relocation-title">{{ vehicleName }}</h3>
        </div>
        <button
          type="button"
          class="close-button"
          aria-label="关闭重定位弹窗"
          @click="emit('close')"
        >
          ×
        </button>
      </header>

      <div class="mode-tabs" role="tablist" aria-label="重定位方式">
        <button
          type="button"
          role="tab"
          :aria-selected="mode === 'point'"
          :class="{ active: mode === 'point' }"
          @click="mode = 'point'"
        >
          点击地图选择
        </button>
        <button
          type="button"
          role="tab"
          :aria-selected="mode === 'manual'"
          :class="{ active: mode === 'manual' }"
          @click="mode = 'manual'"
        >
          手动输入坐标
        </button>
      </div>

      <div class="dialog-body">
        <div class="form-row">
          <label>
            <span>所在地图 *</span>
            <input v-model.trim="mapIdText" type="text" required />
          </label>
          <label>
            <span>地图数据源</span>
            <select v-model="mapDir">
              <option value="">默认</option>
              <option v-for="dir in AGV_RELOCATION_MAP_DIRS" :key="dir" :value="dir">
                {{ dir }}
              </option>
            </select>
          </label>
          <p v-if="busyReason" class="state-warning">{{ busyReason }}</p>
        </div>

        <section v-show="mode === 'point'" class="point-mode">
          <div class="point-controls">
            <label>
              <span>点位类型</span>
              <select v-model="pointTypeFilter">
                <option value="all">全部点位</option>
                <option value="HALT_POSITION">路径点</option>
                <option value="PARK_POSITION">停车点</option>
              </select>
            </label>
            <label>
              <span>绑定点位 *</span>
              <select v-model="selectedPointName">
                <option value="">请选择点位</option>
                <option v-for="point in filteredPoints" :key="point.name" :value="point.name">
                  {{ point.name }}
                </option>
              </select>
            </label>
            <output>{{ selectedPointSummary }}</output>
          </div>

          <div class="map-pane">
            <MapStage
              v-if="background"
              readonly
              :image="background.image"
              :image-width="background.width"
              :image-height="background.height"
              :affine="background.affine"
              tool="select"
              :selected-point-name="selectedPointName"
              show-entity-labels
              @target-click="onMapTargetClick"
            />
            <div v-else class="empty-map">当前工程没有可用底图，请使用手动坐标模式。</div>
          </div>
        </section>

        <section v-show="mode === 'manual'" class="manual-mode">
          <label>
            <span>X 轴 (m) *</span>
            <input v-model.trim="xText" type="number" step="0.001" placeholder="请输入 X 轴（m）" />
          </label>
          <label>
            <span>Y 轴 (m) *</span>
            <input v-model.trim="yText" type="number" step="0.001" placeholder="请输入 Y 轴（m）" />
          </label>
          <label>
            <span>角度 theta (rad) *</span>
            <input
              v-model.trim="thetaText"
              type="number"
              step="0.000001"
              placeholder="请输入 [-π, π]（rad）"
            />
            <small class="field-hint">单位：rad，范围 [-π, π]</small>
          </label>
        </section>
      </div>

      <footer class="dialog-footer">
        <button type="button" class="btn" @click="emit('close')">取消</button>
        <button type="button" class="btn primary" :disabled="submitting" @click="submit">
          {{ submitting ? '下发中...' : '确认重定位' }}
        </button>
      </footer>
    </section>
  </div>
</template>

<style scoped>
.relocation-backdrop {
  position: fixed;
  inset: 0;
  z-index: 70;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 1rem;
  background: rgba(246, 248, 250, 0.68);
}
.relocation-dialog {
  width: min(72rem, calc(100vw - 2rem));
  max-height: calc(100vh - 2rem);
  display: grid;
  grid-template-rows: auto auto minmax(0, 1fr) auto;
  border: 1px solid #d0d7de;
  border-radius: 6px;
  background: #ffffff;
  box-shadow: 0 18px 46px rgba(31, 35, 40, 0.18);
}
.dialog-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  padding: 0.9rem 1rem;
  border-bottom: 1px solid #eaeef2;
}
.dialog-header p,
.dialog-header h3 {
  margin: 0;
}
.dialog-header p {
  color: #cf222e;
  font-size: 0.82rem;
  font-weight: 650;
}
.dialog-header h3 {
  margin-top: 0.15rem;
  font-size: 1.08rem;
}
.close-button {
  border: 0;
  background: transparent;
  color: #57606a;
  cursor: pointer;
  font-size: 1.8rem;
  line-height: 1;
}
.mode-tabs {
  display: flex;
  justify-content: center;
  padding: 0.75rem 1rem 0;
}
.mode-tabs button {
  min-width: 9rem;
  padding: 0.45rem 0.85rem;
  border: 1px solid #d0d7de;
  background: #ffffff;
  color: #57606a;
  cursor: pointer;
  font: inherit;
}
.mode-tabs button:first-child {
  border-radius: 5px 0 0 5px;
}
.mode-tabs button:last-child {
  border-radius: 0 5px 5px 0;
}
.mode-tabs button.active {
  border-color: #0969da;
  background: #0969da;
  color: #ffffff;
}
.dialog-body {
  min-height: 0;
  overflow: auto;
  padding: 0.9rem 1rem;
}
.form-row,
.point-controls,
.manual-mode {
  display: grid;
  grid-template-columns: minmax(12rem, 18rem) minmax(12rem, 18rem) minmax(0, 1fr);
  gap: 0.75rem;
  align-items: end;
}
label {
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 0.28rem;
}
label span {
  color: #57606a;
  font-size: 0.82rem;
  font-weight: 600;
}
.field-hint {
  color: #8c959f;
  font-size: 0.76rem;
  line-height: 1.2;
}
input,
select {
  min-width: 0;
  height: 2.25rem;
  padding: 0.42rem 0.55rem;
  border: 1px solid #d0d7de;
  border-radius: 5px;
  background: #ffffff;
  color: #1f2328;
  font: inherit;
}
.state-warning {
  margin: 0;
  padding: 0.48rem 0.65rem;
  border: 1px solid #ff8182;
  border-radius: 5px;
  background: #ffebe9;
  color: #cf222e;
  font-size: 0.84rem;
}
.point-mode,
.manual-mode {
  margin-top: 0.85rem;
}
.point-controls {
  margin-bottom: 0.75rem;
}
output {
  min-width: 0;
  color: #57606a;
  font-size: 0.86rem;
  overflow-wrap: anywhere;
}
.map-pane {
  height: min(56vh, 34rem);
  min-height: 24rem;
  border: 1px solid #d0d7de;
  border-radius: 6px;
  overflow: hidden;
  background: #f6f8fa;
}
.empty-map {
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #57606a;
  font-size: 0.9rem;
}
.dialog-footer {
  display: flex;
  justify-content: flex-end;
  gap: 0.65rem;
  padding: 0.8rem 1rem;
  border-top: 1px solid #eaeef2;
}
.btn {
  padding: 0.42rem 0.75rem;
  border: 1px solid #d0d7de;
  border-radius: 5px;
  background: #ffffff;
  color: #1f2328;
  cursor: pointer;
  font: inherit;
}
.btn.primary {
  background: #0969da;
  border-color: #0969da;
  color: #ffffff;
}
.btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}
@media (max-width: 860px) {
  .form-row,
  .point-controls,
  .manual-mode {
    grid-template-columns: 1fr;
  }
  .mode-tabs {
    justify-content: stretch;
  }
  .mode-tabs button {
    min-width: 0;
    flex: 1;
  }
}
</style>
