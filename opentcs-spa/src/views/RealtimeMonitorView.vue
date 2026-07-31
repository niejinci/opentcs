<script setup lang="ts">
// SPDX-FileCopyrightText: The openTCS Authors
// SPDX-License-Identifier: MIT

import { computed, onMounted, ref, useTemplateRef, watch } from 'vue';
import { RouterLink, useRoute, useRouter } from 'vue-router';

import MapStage from '@/components/canvas/MapStage.vue';
import PointLocationDetailWindow from '@/components/monitor/PointLocationDetailWindow.vue';
import TaskPoolStatusCard from '@/components/monitor/TaskPoolStatusCard.vue';
import VehicleDetailWindow from '@/components/monitor/VehicleDetailWindow.vue';
import VehicleFilterBar from '@/components/monitor/VehicleFilterBar.vue';
import VehicleListTable from '@/components/monitor/VehicleListTable.vue';
import VehicleStatusRail from '@/components/monitor/VehicleStatusRail.vue';
import { useBackgroundMap } from '@/composables/useBackgroundMap';
import { useLiveVehicleOverlay } from '@/composables/useLiveVehicleOverlay';
import { taskPoolCounts } from '@/domain/orders/taskPool';
import type { DraftLocation, DraftPoint } from '@/domain/model/types';
import {
  availableVehicleGroups,
  buildVehicleMonitorRows,
  filterVehicleMonitorRows,
  type VehicleMonitorCategoryId,
  vehicleMonitorCounts,
} from '@/domain/vehicles/monitor';
import { useLiveStatusStore } from '@/stores/liveStatus';
import { useProjectStore } from '@/stores/project';
import { useProjectsStore } from '@/stores/projects';
import { toastError, toastInfo, toastWarning } from '@/ui/toast/toastBus';

const route = useRoute();
const router = useRouter();
const live = useLiveStatusStore();
const project = useProjectStore();
const projects = useProjectsStore();
const { background, hasBackground } = useBackgroundMap();
const { overlay: vehicleOverlay } = useLiveVehicleOverlay();

const FLEET_PANEL_COLLAPSED_KEY = 'dd-opentcs.monitor.fleetPanel.collapsed';
const LABEL_DISPLAY_MODE_KEY = 'dd-opentcs.monitor.entityLabels.mode';
const LABEL_DISPLAY_MODE_OPTIONS = [
  { value: 'always', label: '始终显示' },
  { value: 'hidden', label: '隐藏名称' },
] as const;
type MonitorLabelDisplayMode = (typeof LABEL_DISPLAY_MODE_OPTIONS)[number]['value'];
type MonitorMapTargetRef = { kind: 'point' | 'location'; name: string };
type MonitorMapTargetDetail =
  | { kind: 'point'; point: DraftPoint }
  | { kind: 'location'; location: DraftLocation };

const projectName = ref('');
const loadingProject = ref(false);
const activeCategory = ref<VehicleMonitorCategoryId>('all');
const selectedGroup = ref('');
const searchQuery = ref('');
const selectedVehicleName = ref<string | null>(null);
const selectedMapTarget = ref<MonitorMapTargetRef | null>(null);
const fleetPanelCollapsed = ref(readFleetPanelCollapsed());
const labelDisplayMode = ref<MonitorLabelDisplayMode>(readLabelDisplayMode());
const mapStageRef = useTemplateRef<{
  resetView: () => void;
  focusPixel: (p: { x: number; y: number }, s?: number) => void;
} | null>('mapStageRef');

const projectId = computed(() => {
  const fromRoute = String(route.params.projectId ?? '').trim();
  return fromRoute || projects.currentId || '';
});

const transportOrderList = computed(() => Object.values(live.transportOrders));
const rows = computed(() => buildVehicleMonitorRows(live.vehicleList, transportOrderList.value));
const counts = computed(() => vehicleMonitorCounts(rows.value));
const taskPool = computed(() => taskPoolCounts(transportOrderList.value));
const groups = computed(() => availableVehicleGroups(rows.value));
const filteredRows = computed(() =>
  filterVehicleMonitorRows(
    rows.value,
    activeCategory.value,
    searchQuery.value,
    selectedGroup.value,
  ),
);
const selectedRow = computed(() =>
  selectedVehicleName.value
    ? (rows.value.find((row) => row.vehicle.name === selectedVehicleName.value) ?? null)
    : null,
);
const showEntityLabels = computed(() => labelDisplayMode.value === 'always');
const selectedMapTargetDetail = computed<MonitorMapTargetDetail | null>(() => {
  const selected = selectedMapTarget.value;
  if (!selected) return null;
  if (selected.kind === 'point') {
    const point = project.findPoint(selected.name);
    return point ? { kind: 'point', point } : null;
  }
  const location = project.findLocation(selected.name);
  return location ? { kind: 'location', location } : null;
});

function readFleetPanelCollapsed(): boolean {
  if (typeof localStorage === 'undefined') return false;
  try {
    return localStorage.getItem(FLEET_PANEL_COLLAPSED_KEY) === 'true';
  } catch {
    return false;
  }
}

function writeFleetPanelCollapsed(value: boolean): void {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(FLEET_PANEL_COLLAPSED_KEY, String(value));
  } catch {
    // The toggle remains usable even when browser storage is unavailable.
  }
}

function readLabelDisplayMode(): MonitorLabelDisplayMode {
  if (typeof localStorage === 'undefined') return 'always';
  try {
    const stored = localStorage.getItem(LABEL_DISPLAY_MODE_KEY);
    return stored === 'hidden' ? 'hidden' : 'always';
  } catch {
    return 'always';
  }
}

function writeLabelDisplayMode(value: MonitorLabelDisplayMode): void {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(LABEL_DISPLAY_MODE_KEY, value);
  } catch {
    // The label display mode remains usable even when persistence is unavailable.
  }
}

async function activateProject(): Promise<void> {
  if (!projectId.value) {
    projectName.value = '';
    return;
  }
  loadingProject.value = true;
  try {
    const meta = await projects.setCurrent(projectId.value);
    projectName.value = meta.name;
    const env = await projects.loadCurrentDraft();
    project.hydrateDraftPayload(env?.payload ?? null);
  } catch {
    toastError('加载实时监控工程失败', '实时监控');
  } finally {
    loadingProject.value = false;
  }
}

function vehiclePixel(name: string): { x: number; y: number } | null {
  const entry = vehicleOverlay.value.find((item) => item.name === name);
  if (entry) return { x: entry.pixelX, y: entry.pixelY };
  const draft = project.findVehicle(name);
  return draft ? { x: draft.layout.pixelX, y: draft.layout.pixelY } : null;
}

function openMapTargetDetail(target: MonitorMapTargetRef): void {
  selectedMapTarget.value = { ...target };
}

function selectVehicle(name: string, locate = true): void {
  selectedVehicleName.value = name;
  if (!locate) return;
  const pixel = vehiclePixel(name);
  if (!pixel) {
    toastWarning(`未能在当前工程地图中定位 ${name}`, '车辆定位');
    return;
  }
  mapStageRef.value?.focusPixel(pixel, 1.2);
}

function locateSelected(): void {
  if (selectedVehicleName.value) {
    selectVehicle(selectedVehicleName.value, true);
    return;
  }
  const first = filteredRows.value[0];
  if (first) selectVehicle(first.vehicle.name, true);
}

function openVehicleHome(url: string): void {
  window.open(url, '_blank', 'noopener,noreferrer');
}

function createOrderForVehicle(name: string): void {
  if (!projectId.value) {
    toastWarning('请先选择工程，再创建任务', '实时监控');
    return;
  }
  void router.push({
    name: 'project-create-task',
    params: { projectId: projectId.value },
    query: { vehicle: name },
  });
}

watch(
  () => route.params.projectId,
  () => void activateProject(),
  { immediate: true },
);

watch(fleetPanelCollapsed, writeFleetPanelCollapsed);
watch(labelDisplayMode, writeLabelDisplayMode);

watch(
  () => rows.value.map((row) => row.vehicle.name).join('\n'),
  () => {
    if (
      selectedVehicleName.value &&
      !rows.value.some((row) => row.vehicle.name === selectedVehicleName.value)
    ) {
      selectedVehicleName.value = null;
    }
  },
);

onMounted(() => {
  if (!projectId.value) {
    toastInfo('实时监控将使用最近打开的工程；也可从工程列表进入指定工程。');
  }
});
</script>

<template>
  <section class="monitor-page">
    <header class="monitor-header">
      <div>
        <h2>实时监控</h2>
        <p>
          工程：
          <code>{{ projectName || projectId || '未选择' }}</code>
          <span v-if="loadingProject"> · 加载中</span>
          <span> · SSE: {{ live.sseState }}</span>
        </p>
      </div>
      <nav>
        <RouterLink to="/projects">工程列表</RouterLink>
        <RouterLink v-if="projectId" :to="{ name: 'project-create-task', params: { projectId } }">
          创建任务
        </RouterLink>
      </nav>
    </header>

    <div class="monitor-shell" :data-fleet-collapsed="fleetPanelCollapsed">
      <main class="map-panel">
        <div v-if="!hasBackground" class="empty-map">
          <p>当前会话没有可渲染底图。</p>
          <RouterLink to="/import">导入地图</RouterLink>
        </div>
        <MapStage
          v-else-if="background"
          ref="mapStageRef"
          readonly
          :image="background.image"
          :image-width="background.width"
          :image-height="background.height"
          :affine="background.affine"
          tool="select"
          :selected-vehicle-name="selectedVehicleName"
          :show-entity-labels="showEntityLabels"
          @target-click="openMapTargetDetail"
          @vehicle-click="(name: string) => selectVehicle(name, true)"
        >
          <template #status="{ scale }">
            <footer class="monitor-statusbar">
              <span>车辆：{{ rows.length }} 台</span>
              <span>缩放：{{ (scale * 100).toFixed(0) }}%</span>
              <label class="label-mode-control">
                <span>名称</span>
                <select v-model="labelDisplayMode" aria-label="地图元素名称显示方式">
                  <option
                    v-for="option in LABEL_DISPLAY_MODE_OPTIONS"
                    :key="option.value"
                    :value="option.value"
                  >
                    {{ option.label }}
                  </option>
                </select>
              </label>
              <button type="button" @click="mapStageRef?.resetView()">重置视口</button>
            </footer>
          </template>
        </MapStage>
        <TaskPoolStatusCard
          :counts="taskPool"
          :orders="transportOrderList"
          :sse-state="live.sseState"
        />
        <PointLocationDetailWindow
          v-if="selectedMapTargetDetail && background"
          :target="selectedMapTargetDetail"
          :affine="background.affine"
          @close="selectedMapTarget = null"
        />
        <VehicleDetailWindow
          v-if="selectedRow"
          :vehicle="selectedRow.vehicle"
          :active-order="selectedRow.activeOrder"
          @close="selectedVehicleName = null"
          @open-home="openVehicleHome"
          @create-order="createOrderForVehicle"
        />
      </main>

      <aside class="fleet-panel" :data-collapsed="fleetPanelCollapsed" aria-label="车辆分类列表">
        <VehicleStatusRail
          :active="activeCategory"
          :counts="counts"
          :compact="fleetPanelCollapsed"
          @select="activeCategory = $event"
          @toggle-compact="fleetPanelCollapsed = !fleetPanelCollapsed"
        />
        <section v-show="!fleetPanelCollapsed" class="fleet-main">
          <div class="fleet-summary">
            <strong>{{ counts[activeCategory] }}</strong>
            <span>匹配车辆</span>
          </div>
          <VehicleFilterBar
            v-model:group="selectedGroup"
            v-model:query="searchQuery"
            :groups="groups"
            @locate="locateSelected"
          />
          <VehicleListTable
            :rows="filteredRows"
            :selected-vehicle-name="selectedVehicleName"
            @select="selectVehicle"
          />
        </section>
      </aside>
    </div>
  </section>
</template>

<style scoped>
.monitor-page {
  display: flex;
  flex-direction: column;
  min-height: calc(100vh - 5.5rem);
  padding: 0.75rem;
  gap: 0.75rem;
}
.monitor-header {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 1rem;
  flex-wrap: wrap;
}
.monitor-header h2 {
  margin: 0;
  font-size: 1.25rem;
}
.monitor-header p {
  margin: 0.2rem 0 0;
  color: #57606a;
  font-size: 0.88rem;
}
.monitor-header nav {
  display: flex;
  gap: 0.5rem;
}
.monitor-header a {
  border: 1px solid #d0d7de;
  border-radius: 6px;
  background: #ffffff;
  color: #0969da;
  padding: 0.35rem 0.7rem;
  text-decoration: none;
  font-size: 0.88rem;
}
.monitor-shell {
  flex: 1 1 auto;
  min-height: 42rem;
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(24rem, 34rem);
  gap: 0.75rem;
}
.monitor-shell[data-fleet-collapsed='true'] {
  grid-template-columns: minmax(0, 1fr) 3.25rem;
}
.map-panel {
  position: relative;
  min-width: 0;
  min-height: 0;
  border: 1px solid #d0d7de;
  border-radius: 8px;
  overflow: hidden;
  background: #ffffff;
}
.empty-map {
  height: 100%;
  min-height: 30rem;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.65rem;
  color: #57606a;
}
.empty-map p {
  margin: 0;
}
.empty-map a {
  color: #0969da;
}
.monitor-statusbar {
  display: flex;
  align-items: center;
  gap: 1rem;
  padding: 0.45rem 0.65rem;
  border-top: 1px solid #eaeef2;
  background: #f6f8fa;
  font-size: 0.84rem;
  color: #57606a;
}
.label-mode-control {
  margin-left: auto;
  display: flex;
  align-items: center;
  gap: 0.35rem;
}
.label-mode-control select {
  height: 1.75rem;
  min-width: 6.5rem;
  border: 1px solid #d0d7de;
  border-radius: 5px;
  background: #ffffff;
  color: #1f2328;
  font: inherit;
  padding: 0 0.45rem;
}
.monitor-statusbar button {
  margin-left: 0;
  border: 1px solid #d0d7de;
  border-radius: 5px;
  background: #ffffff;
  cursor: pointer;
  font: inherit;
  padding: 0.2rem 0.55rem;
}
.fleet-panel {
  min-width: 0;
  min-height: 0;
  display: grid;
  grid-template-columns: auto minmax(0, 1fr);
  border: 1px solid #d0d7de;
  border-radius: 8px;
  overflow: hidden;
  background: #ffffff;
}
.fleet-panel[data-collapsed='true'] {
  grid-template-columns: minmax(0, 1fr);
}
.fleet-main {
  min-width: 0;
  min-height: 0;
  display: grid;
  grid-template-rows: auto auto minmax(0, 1fr);
}
.fleet-summary {
  display: flex;
  align-items: baseline;
  gap: 0.35rem;
  padding: 0.65rem 0.7rem;
  border-bottom: 1px solid #d8dee4;
}
.fleet-summary strong {
  font-size: 1.25rem;
  font-variant-numeric: tabular-nums;
}
.fleet-summary span {
  color: #57606a;
  font-size: 0.85rem;
}
@media (max-width: 1080px) {
  .monitor-shell,
  .monitor-shell[data-fleet-collapsed='true'] {
    grid-template-columns: 1fr;
    grid-template-rows: minmax(30rem, 1fr) minmax(24rem, 0.75fr);
  }
  .monitor-shell[data-fleet-collapsed='true'] {
    grid-template-rows: minmax(30rem, 1fr) auto;
  }
}
</style>
