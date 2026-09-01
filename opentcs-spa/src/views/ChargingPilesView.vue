<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';

import { HttpError } from '@/api/errors';
import { getDraft } from '@/api/endpoints/projects';
import {
  CHARGING_PILE_OCCUPANCY_STATUS_OPTIONS,
  createEmptyChargingPileForm,
  chargingPileFormFromRecord,
  formatChargingPileOccupancyStatus,
  formatChargingPileRuntimeStatus,
  type ChargingPileEnabledFilter,
  type ChargingPileFormData,
  type ChargingPileRecord,
} from '@/domain/charging/chargingPile';
import type { ChargingPileOccupancyStatus } from '@/api';
import { useChargingPilesStore } from '@/stores/chargingPiles';
import { useProjectsStore } from '@/stores/projects';
import { toastError, toastSuccess } from '@/ui/toast/toastBus';

type DialogMode = 'create' | 'edit';

const chargingPiles = useChargingPilesStore();
const projects = useProjectsStore();

const keyword = ref('');
const regionFilter = ref('');
const mapFilter = ref('');
const enabledFilter = ref<ChargingPileEnabledFilter>('all');
const occupancyFilter = ref<'all' | ChargingPileOccupancyStatus>('all');
const dialogMode = ref<DialogMode | null>(null);
const editingId = ref<string | null>(null);
const form = ref<ChargingPileFormData>(createEmptyChargingPileForm());
const pointOptions = ref<string[]>([]);
const pointOptionsLoading = ref(false);
const pointOptionsError = ref('');
let pointOptionsRequestId = 0;

const regionOptions = computed(() => uniqueSorted(chargingPiles.piles.map((item) => item.region)));
const mapOptions = computed(() => uniqueSorted(projects.list.map((item) => item.name)));
const selectedMapProject = computed(
  () => projects.list.find((project) => project.name === form.value.mapName) ?? null,
);
const mapPrompt = computed(() => {
  if (projects.status === 'loading' && mapOptions.value.length === 0) return '工程加载中…';
  if (mapOptions.value.length === 0) return '暂无工程可选';
  return '请选择工程';
});
const pointPrompt = computed(() => {
  if (!form.value.mapName) return '请先选择工程';
  if (pointOptionsLoading.value) return '点位加载中…';
  if (pointOptionsError.value) return '点位加载失败';
  if (pointOptions.value.length === 0) return '当前工程暂无点位';
  return '请选择点位';
});
const dialogTitle = computed(() =>
  dialogMode.value === 'create' ? '新增充电桩' : '修改充电桩',
);
const filteredPiles = computed(() => {
  const q = keyword.value.trim().toLowerCase();
  return chargingPiles.piles.filter((item) => {
    if (regionFilter.value && item.region !== regionFilter.value) return false;
    if (mapFilter.value && item.mapName !== mapFilter.value) return false;
    if (enabledFilter.value === 'enabled' && !item.enabled) return false;
    if (enabledFilter.value === 'disabled' && item.enabled) return false;
    if (occupancyFilter.value !== 'all' && item.occupancyStatus !== occupancyFilter.value) {
      return false;
    }
    if (!q) return true;
    return [
      item.name,
      item.region,
      item.mapName,
      item.boundPointName,
      item.chargerType,
      item.sn,
      item.ip,
      item.locationName,
      item.locationTypeName,
      item.operation,
      formatChargingPileRuntimeStatus(item.runtimeStatus),
      formatChargingPileOccupancyStatus(item.occupancyStatus),
    ]
      .join('\n')
      .toLowerCase()
      .includes(q);
  });
});

onMounted(() => {
  void refresh();
});

watch(
  () => selectedMapProject.value?.id ?? '',
  (projectId, previousProjectId) => {
    if (previousProjectId && previousProjectId !== projectId) {
      form.value.boundPointName = '';
    }
    void loadPointOptions(projectId);
  },
  { immediate: true },
);

async function refresh(): Promise<void> {
  const results = await Promise.allSettled([chargingPiles.refresh(), projects.refresh()]);
  for (const result of results) {
    if (result.status === 'rejected') {
      toastError(result.reason instanceof Error ? result.reason.message : String(result.reason), '充电桩管理');
    }
  }
  if (dialogMode.value === 'create') {
    seedCreateMapSelection();
  }
}

function openCreate(): void {
  dialogMode.value = 'create';
  editingId.value = null;
  form.value = createEmptyChargingPileForm();
  form.value.mapName = '';
  form.value.boundPointName = '';
  seedCreateMapSelection();
}

function openEdit(record: ChargingPileRecord): void {
  dialogMode.value = 'edit';
  editingId.value = record.id;
  form.value = chargingPileFormFromRecord(record);
}

function closeDialog(): void {
  dialogMode.value = null;
  editingId.value = null;
}

function seedCreateMapSelection(): void {
  if (dialogMode.value !== 'create') return;
  const preferredMap = projects.currentMeta?.name ?? mapOptions.value[0] ?? '';
  if (!preferredMap) return;
  if (!form.value.mapName.trim() || !mapOptions.value.includes(form.value.mapName)) {
    form.value.mapName = preferredMap;
  }
}

async function loadPointOptions(projectId: string): Promise<void> {
  const requestId = ++pointOptionsRequestId;
  pointOptionsError.value = '';

  if (!projectId) {
    pointOptions.value = [];
    pointOptionsLoading.value = false;
    return;
  }

  pointOptionsLoading.value = true;
  try {
    const draft = await getDraft(projectId, { toastOnError: false });
    if (requestId !== pointOptionsRequestId) return;
    const names = uniqueSorted(extractPointNames(draft.payload));
    pointOptions.value = names;
    if (form.value.boundPointName && !names.includes(form.value.boundPointName)) {
      form.value.boundPointName = '';
    }
  } catch (err) {
    if (requestId !== pointOptionsRequestId) return;
    pointOptions.value = [];
    if (err instanceof HttpError && err.status === 404) {
      pointOptionsError.value = '';
    } else {
      pointOptionsError.value = err instanceof Error ? err.message : String(err);
    }
  } finally {
    if (requestId === pointOptionsRequestId) {
      pointOptionsLoading.value = false;
    }
  }
}

async function submitDialog(): Promise<void> {
  if (!dialogMode.value) return;
  try {
    if (dialogMode.value === 'create') {
      await chargingPiles.create(form.value);
      toastSuccess('已新增充电桩', '充电桩管理');
    } else if (editingId.value) {
      await chargingPiles.update(editingId.value, form.value);
      toastSuccess('已修改充电桩', '充电桩管理');
    }
    closeDialog();
  } catch (err) {
    toastError(err instanceof Error ? err.message : String(err), '充电桩管理');
  }
}

async function toggleEnabled(record: ChargingPileRecord): Promise<void> {
  try {
    await chargingPiles.toggleEnabled(record.id, !record.enabled);
    toastSuccess(
      record.enabled ? '已禁用充电桩' : '已启用充电桩',
      '充电桩管理',
    );
  } catch (err) {
    toastError(err instanceof Error ? err.message : String(err), '充电桩管理');
  }
}

async function remove(record: ChargingPileRecord): Promise<void> {
  if (!window.confirm(`删除充电桩 "${record.name}"？`)) return;
  try {
    await chargingPiles.remove(record.id);
    toastSuccess('已删除充电桩', '充电桩管理');
  } catch (err) {
    toastError(err instanceof Error ? err.message : String(err), '充电桩管理');
  }
}

function uniqueSorted(values: string[]): string[] {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))].sort((a, b) =>
    a.localeCompare(b, 'zh-Hans-CN'),
  );
}

function occupancyLabel(value: ChargingPileOccupancyStatus): string {
  return formatChargingPileOccupancyStatus(value);
}

function runtimeLabel(value: ChargingPileRecord['runtimeStatus']): string {
  return formatChargingPileRuntimeStatus(value);
}

function extractPointNames(payload: Record<string, unknown>): string[] {
  const rawPoints = Array.isArray(payload.points) ? payload.points : [];
  return rawPoints
    .map((point) => {
      if (!point || typeof point !== 'object') return '';
      const name = (point as { name?: unknown }).name;
      return typeof name === 'string' ? name.trim() : '';
    })
    .filter((name): name is string => Boolean(name));
}
</script>

<template>
  <section class="charging-page">
    <header class="page-header">
      <div>
        <h2>充电桩管理</h2>
        <p class="muted">维护充电桩基础信息、绑定点位和启用状态。</p>
      </div>
      <div class="header-actions">
        <button type="button" class="btn" @click="refresh">刷新</button>
        <button type="button" class="btn btn-primary" @click="openCreate">+ 新增充电桩</button>
      </div>
    </header>

    <form class="toolbar" @submit.prevent>
      <input
        v-model.trim="keyword"
        class="search-input"
        placeholder="名称 / 绑定点位 / SN / IP"
      />
      <select v-model="regionFilter" class="filter-select">
        <option value="">全部区域</option>
        <option v-for="region in regionOptions" :key="region" :value="region">
          {{ region }}
        </option>
      </select>
      <select v-model="mapFilter" class="filter-select">
        <option value="">全部地图</option>
        <option v-for="mapName in mapOptions" :key="mapName" :value="mapName">
          {{ mapName }}
        </option>
      </select>
      <select v-model="enabledFilter" class="filter-select">
        <option value="all">全部启用状态</option>
        <option value="enabled">仅启用</option>
        <option value="disabled">仅禁用</option>
      </select>
      <select v-model="occupancyFilter" class="filter-select">
        <option value="all">全部占用状态</option>
        <option v-for="status in CHARGING_PILE_OCCUPANCY_STATUS_OPTIONS" :key="status" :value="status">
          {{ occupancyLabel(status) }}
        </option>
      </select>
    </form>

    <p v-if="chargingPiles.loading" class="muted">加载中...</p>

    <div v-else class="table-panel">
      <table>
        <thead>
          <tr>
            <th>序号</th>
            <th>名称</th>
            <th>所在区域</th>
            <th>所在地图</th>
            <th>绑定点位</th>
            <th>充电桩类型</th>
            <th>SN</th>
            <th>IP</th>
            <th>运行状态</th>
            <th>占用状态</th>
            <th>启用</th>
            <th>更新时间</th>
            <th>操作</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="(item, index) in filteredPiles" :key="item.id">
            <td>{{ index + 1 }}</td>
            <td>{{ item.name }}</td>
            <td>{{ item.region }}</td>
            <td>{{ item.mapName }}</td>
            <td>{{ item.boundPointName }}</td>
            <td>{{ item.chargerType || '-' }}</td>
            <td>{{ item.sn || '-' }}</td>
            <td>{{ item.ip || '-' }}</td>
            <td>{{ runtimeLabel(item.runtimeStatus) }}</td>
            <td>{{ occupancyLabel(item.occupancyStatus) }}</td>
            <td>
              <button
                type="button"
                class="switch"
                :class="{ 'switch--on': item.enabled }"
                :aria-pressed="item.enabled"
                @click="toggleEnabled(item)"
              >
                <span></span>
              </button>
            </td>
            <td>{{ item.updatedAt || '-' }}</td>
            <td class="actions">
              <button type="button" class="link link-warn" @click="openEdit(item)">修改</button>
              <button type="button" class="link link-danger" @click="remove(item)">删除</button>
            </td>
          </tr>
          <tr v-if="filteredPiles.length === 0">
            <td colspan="13" class="empty">暂无充电桩</td>
          </tr>
        </tbody>
      </table>
    </div>

    <div v-if="dialogMode" class="dialog-backdrop" role="presentation">
      <section class="dialog" role="dialog" aria-modal="true" aria-labelledby="charging-title">
        <header class="dialog-header">
          <h3 id="charging-title">{{ dialogTitle }}</h3>
          <button type="button" class="close-button" aria-label="关闭" @click="closeDialog">
            ×
          </button>
        </header>

        <form class="dialog-body" @submit.prevent="submitDialog">
          <div class="form-grid">
            <label>
              <span><b>*</b> 名称</span>
              <input v-model.trim="form.name" required />
            </label>
            <label>
              <span><b>*</b> 所在区域</span>
              <input v-model.trim="form.region" required />
            </label>
            <label>
              <span><b>*</b> 所在地图</span>
              <select v-model="form.mapName" required>
                <option value="" disabled>{{ mapPrompt }}</option>
                <option v-if="form.mapName && !mapOptions.includes(form.mapName)" :value="form.mapName">
                  {{ form.mapName }}
                </option>
                <option v-for="mapName in mapOptions" :key="mapName" :value="mapName">
                  {{ mapName }}
                </option>
              </select>
            </label>
            <label>
              <span><b>*</b> 绑定点位</span>
              <select v-model="form.boundPointName" required>
                <option value="" disabled>{{ pointPrompt }}</option>
                <option
                  v-if="form.boundPointName && !pointOptions.includes(form.boundPointName)"
                  :value="form.boundPointName"
                >
                  {{ form.boundPointName }}
                </option>
                <option v-for="pointName in pointOptions" :key="pointName" :value="pointName">
                  {{ pointName }}
                </option>
              </select>
            </label>
            <label>
              <span>充电桩类型</span>
              <input v-model.trim="form.chargerType" />
            </label>
            <label>
              <span>充电桩SN</span>
              <input v-model.trim="form.sn" />
            </label>
            <label>
              <span>充电桩IP</span>
              <input v-model.trim="form.ip" />
            </label>
            <label>
              <span>Location 名称</span>
              <input v-model.trim="form.locationName" placeholder="留空则同名称" />
            </label>
            <label>
              <span>Location 类型</span>
              <input v-model.trim="form.locationTypeName" />
            </label>
            <label>
              <span>Location 操作</span>
              <input v-model.trim="form.operation" />
            </label>
            <label class="checkbox-field">
              <span>启用</span>
              <input v-model="form.enabled" type="checkbox" />
            </label>
          </div>

          <footer class="dialog-footer">
            <button type="button" class="btn" @click="closeDialog">取消</button>
            <button type="submit" class="btn btn-primary">确定</button>
          </footer>
        </form>
      </section>
    </div>
  </section>
</template>

<style scoped>
.charging-page {
  min-width: 0;
}

.page-header {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 1rem;
  flex-wrap: wrap;
  margin-bottom: 0.75rem;
}

.page-header h2 {
  margin: 0;
  font-size: 1.28rem;
}

.page-header p {
  margin: 0.25rem 0 0;
}

.header-actions {
  display: flex;
  gap: 0.65rem;
  flex-wrap: wrap;
}

.toolbar {
  display: flex;
  align-items: center;
  gap: 0.65rem;
  flex-wrap: wrap;
  padding: 0.75rem;
  border: 1px solid #e6ebf1;
  border-radius: 8px;
  background: #ffffff;
  margin-bottom: 0.75rem;
}

.search-input,
.filter-select,
select,
input {
  height: 2.45rem;
  min-width: 0;
  border: 1px solid #d8dee7;
  border-radius: 5px;
  background: #ffffff;
  color: #30363d;
  font: inherit;
  padding: 0 0.75rem;
}

.search-input {
  width: min(20rem, 100%);
}

.filter-select {
  width: 10rem;
}

input:disabled,
select:disabled {
  background: #f6f8fa;
  color: #8c959f;
}

.btn {
  height: 2.45rem;
  padding: 0 0.95rem;
  border: 1px solid #d8dee7;
  border-radius: 5px;
  background: #ffffff;
  color: #57606a;
  cursor: pointer;
  font: inherit;
}

.btn-primary {
  border-color: #ff9b7f;
  background: #fff1ed;
  color: #ff4d1d;
  font-weight: 700;
}

.table-panel {
  overflow: auto;
  border: 1px solid #e6ebf1;
  border-radius: 8px;
  background: #ffffff;
}

table {
  width: 100%;
  min-width: 92rem;
  border-collapse: collapse;
  table-layout: fixed;
}

th,
td {
  border-bottom: 1px solid #edf1f5;
  border-right: 1px solid #edf1f5;
  padding: 0.78rem 0.5rem;
  color: #30363d;
  font-size: 0.86rem;
  text-align: center;
  vertical-align: middle;
  word-break: break-word;
}

th {
  background: #eef2f6;
  color: #69717c;
  font-weight: 700;
}

.actions {
  white-space: nowrap;
}

.link {
  border: 0;
  background: transparent;
  color: #0969da;
  cursor: pointer;
  font: inherit;
  padding: 0 0.22rem;
}

.link-warn {
  color: #ff4d1d;
}

.link-danger {
  color: #cf222e;
}

.empty {
  padding: 2rem;
  color: #8c959f;
}

.switch {
  width: 2.5rem;
  height: 1.35rem;
  padding: 0.12rem;
  border: 0;
  border-radius: 999px;
  background: #d8dee7;
  cursor: pointer;
}

.switch span {
  display: block;
  width: 1.1rem;
  height: 1.1rem;
  border-radius: 50%;
  background: #ffffff;
  transition: transform 0.16s ease;
}

.switch--on {
  background: #ff6a3a;
}

.switch--on span {
  transform: translateX(1.05rem);
}

.dialog-backdrop {
  position: fixed;
  inset: 0;
  z-index: 60;
  display: flex;
  align-items: stretch;
  justify-content: center;
  background: rgba(246, 248, 250, 0.5);
}

.dialog {
  width: min(52rem, calc(100vw - 2rem));
  max-height: calc(100vh - 2rem);
  margin-top: 1rem;
  display: grid;
  grid-template-rows: auto minmax(0, 1fr);
  border: 1px solid #d8dee7;
  border-radius: 5px;
  background: #ffffff;
  box-shadow: 0 18px 46px rgba(31, 35, 40, 0.18);
}

.dialog-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1rem 1.1rem;
}

.dialog-header h3 {
  margin: 0;
  color: #ff4d1d;
  font-size: 1.15rem;
  font-weight: 600;
}

.close-button {
  border: 0;
  background: transparent;
  color: #6e7781;
  cursor: pointer;
  font-size: 1.8rem;
  line-height: 1;
}

.dialog-body {
  min-height: 0;
  overflow: auto;
  display: grid;
  grid-template-rows: minmax(0, 1fr) auto;
}

.form-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.9rem 1.4rem;
  padding: 0.5rem 1.5rem 1.4rem;
}

label {
  min-width: 0;
  display: grid;
  grid-template-columns: 6.8rem minmax(0, 1fr);
  align-items: center;
  gap: 0.75rem;
}

label span {
  text-align: right;
  color: #5f6670;
  font-weight: 650;
}

label b {
  color: #ff4d1d;
}

.checkbox-field {
  grid-template-columns: 6.8rem auto;
}

.checkbox-field input {
  justify-self: start;
  width: 1rem;
  height: 1rem;
}

.dialog-footer {
  display: flex;
  justify-content: flex-end;
  gap: 0.8rem;
  padding: 1rem 1.3rem;
  border-top: 1px solid #edf1f5;
}

@media (max-width: 980px) {
  .form-grid {
    grid-template-columns: 1fr;
  }
}
</style>
