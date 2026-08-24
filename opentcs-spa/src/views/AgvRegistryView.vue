<script setup lang="ts">
// SPDX-FileCopyrightText: The openTCS Authors
// SPDX-License-Identifier: MIT

import { computed, ref, watch } from 'vue';
import { RouterLink, useRoute, useRouter } from 'vue-router';

import { useCloudDraftSync } from '@/composables/useCloudDraftSync';
import type { DraftVehicle } from '@/domain/model/types';
import {
  AGV_REGIONS,
  AGV_VEHICLE_MODELS,
  BYD_AGV_PROPERTY_KEYS,
  VDA5050_PROPERTY_KEYS,
  agvRegistrationFromVehicle,
  buildAgvVehicleProperties,
  createEmptyAgvRegistrationForm,
  effectiveTopicPrefixForForm,
  normalizeAgvRegistrationForm,
  validateAgvRegistrationForm,
  type AgvRegistrationForm,
  type AgvRegistrationRecord,
  type ExistingAgvVehicle,
  type RegistrationValidationIssue,
} from '@/domain/vehicles/registration';
import { useProjectStore } from '@/stores/project';
import { useProjectsStore } from '@/stores/projects';
import { toastError, toastWarning } from '@/ui/toast/toastBus';

const ENVELOPE_VERSION = 1;
const ROUTE_COLORS = ['#0969da', '#1f883d', '#bf3989', '#bf8700', '#8250df', '#cf222e'];
const COMM_ADAPTER_OPTIONS = ['VDA5050'] as const;

const route = useRoute();
const router = useRouter();
const store = useProjectStore();
const projects = useProjectsStore();

useCloudDraftSync();

const loading = ref(true);
const formDialogOpen = ref(false);
const editingName = ref<string | null>(null);
const validationIssues = ref<RegistrationValidationIssue[]>([]);
const hasPendingPublish = ref(false);
const selectedCommAdapter = ref<(typeof COMM_ADAPTER_OPTIONS)[number]>('VDA5050');

const nameFilter = ref('');
const macFilter = ref('');
const modelFilter = ref('');
const statusFilter = ref<'all' | 'registered' | 'incomplete'>('all');

const form = ref<AgvRegistrationForm>(createEmptyAgvRegistrationForm(allEntityNames()));

const activeProjectId = computed(() => projects.currentId ?? '');
const projectTitle = computed(() => projects.currentMeta?.name ?? activeProjectId.value);
const effectiveTopicPreview = computed(() => effectiveTopicPrefixForForm(form.value));
const formDialogTitle = computed(() => (editingName.value ? '编辑车辆' : '新增车辆'));

const records = computed<AgvRegistrationRecord[]>(() =>
  store.vehicles.map((vehicle) => agvRegistrationFromVehicle(vehicle)),
);

const filteredRecords = computed(() => {
  const name = nameFilter.value.trim().toLowerCase();
  const mac = macFilter.value.trim().toLowerCase();
  return records.value.filter((record) => {
    if (name && !record.name.toLowerCase().includes(name)) return false;
    if (mac && !record.macAddress.toLowerCase().includes(mac)) return false;
    if (modelFilter.value && record.model !== modelFilter.value) return false;
    if (statusFilter.value === 'registered' && !record.registered) return false;
    if (statusFilter.value === 'incomplete' && record.registered) return false;
    return true;
  });
});

const registeredCount = computed(() => records.value.filter((record) => record.registered).length);

watch(
  () => route.params.projectId,
  () => void activateProjectFromRoute(),
  { immediate: true },
);

watch(
  form,
  () => {
    validationIssues.value = [];
  },
  { deep: true },
);

async function activateProjectFromRoute(): Promise<void> {
  loading.value = true;
  const routeProjectId =
    typeof route.params.projectId === 'string' ? route.params.projectId : undefined;
  const id = routeProjectId ?? projects.currentId ?? null;
  if (!id) {
    void router.replace({ name: 'projects' });
    return;
  }
  try {
    await projects.setCurrent(id);
    const env = await projects.loadCurrentDraft();
    store.hydrateDraftPayload(env?.payload ?? null);
    resetCreateForm();
    formDialogOpen.value = false;
  } catch {
    toastError('加载工程失败', 'AGV注册');
    void router.replace({ name: 'projects' });
  } finally {
    loading.value = false;
  }
}

function resetCreateForm(): void {
  editingName.value = null;
  validationIssues.value = [];
  form.value = createEmptyAgvRegistrationForm(allEntityNames());
}

function startCreate(): void {
  resetCreateForm();
  formDialogOpen.value = true;
}

function closeFormDialog(): void {
  formDialogOpen.value = false;
  resetCreateForm();
}

function resetDialogForm(): void {
  if (editingName.value) {
    startEdit(editingName.value);
    return;
  }
  startCreate();
}

function startEdit(name: string): void {
  const vehicle = store.findVehicle(name);
  if (!vehicle) {
    toastError(`未找到车辆 ${name}`, 'AGV注册');
    return;
  }
  editingName.value = name;
  validationIssues.value = [];
  const record = agvRegistrationFromVehicle(vehicle);
  form.value = {
    name: record.name,
    model: record.model,
    region: record.region,
    macAddress: record.macAddress,
    topicPrefix: record.topicPrefix,
    interfaceName: record.interfaceName,
    manufacturer: record.manufacturer,
    serialNumber: record.serialNumber,
  };
  formDialogOpen.value = true;
}

function submit(): void {
  const normalized = normalizeAgvRegistrationForm(form.value);
  const issues = validateAgvRegistrationForm(normalized, existingVehicles(), editingName.value);
  validationIssues.value = issues;
  if (issues.length > 0) {
    toastError(issues[0]?.message ?? '表单校验失败', 'AGV注册');
    return;
  }

  const oldName = editingName.value;
  const existing = oldName ? store.findVehicle(oldName) : undefined;
  const vehicle = draftVehicleFromForm(normalized, existing);
  const res = oldName
    ? store.replaceVehicleDraft(oldName, vehicle)
    : store.addVehicleDraft(vehicle);
  if (!res.ok) {
    toastError(res.error ?? '保存失败', 'AGV注册');
    return;
  }

  markPendingPublish(oldName ? `已更新 ${vehicle.name}` : `已新增 ${vehicle.name}`);
  closeFormDialog();
}

function removeVehicle(name: string): void {
  if (!window.confirm(`从当前工程草稿删除车辆 "${name}"？`)) return;
  const res = store.deleteVehicleByName(name);
  if (!res.ok) {
    toastError(res.error ?? '删除失败', 'AGV注册');
    return;
  }
  if (editingName.value === name) closeFormDialog();
  markPendingPublish(`已删除 ${name}`);
}

function markPendingPublish(message: string): void {
  hasPendingPublish.value = true;
  toastWarning(`${message}。如需让车辆在 Kernel 中生效，请发布当前工程。`, '未发布变更');
}

async function saveDraftNow(): Promise<boolean> {
  if (!projects.currentId) return false;
  try {
    await projects.saveCurrentDraft({
      version: ENVELOPE_VERSION,
      savedAt: new Date().toISOString(),
      payload: store.serializeDraftPayload(),
    });
    return true;
  } catch {
    toastError('保存工程草稿失败，暂不能发布', 'AGV注册');
    return false;
  }
}

async function goPublish(): Promise<void> {
  if (!(await saveDraftNow())) return;
  hasPendingPublish.value = false;
  await router.push({ name: 'project-publish', params: { projectId: projects.currentId } });
}

function draftVehicleFromForm(input: AgvRegistrationForm, existing?: DraftVehicle): DraftVehicle {
  const idx = Math.max(0, store.vehicles.length);
  return {
    name: input.name,
    boundingBox: existing?.boundingBox
      ? { ...existing.boundingBox }
      : { length: 1000, width: 1000, height: 1000 },
    energyLevelThresholdSet: existing?.energyLevelThresholdSet
      ? { ...existing.energyLevelThresholdSet }
      : {
          energyLevelCritical: 30,
          energyLevelGood: 90,
          energyLevelSufficientlyRecharged: 30,
          energyLevelFullyRecharged: 90,
        },
    maxVelocity: existing?.maxVelocity ?? 1000,
    maxReverseVelocity: existing?.maxReverseVelocity ?? 1000,
    envelopeKey: existing?.envelopeKey ?? '',
    layout: existing?.layout
      ? { ...existing.layout }
      : {
          pixelX: 0,
          pixelY: 0,
          orientationDeg: 0,
          routeColorRgb: ROUTE_COLORS[idx % ROUTE_COLORS.length] ?? '#0969da',
        },
    properties: buildAgvVehicleProperties(input, existing?.properties),
  };
}

function existingVehicles(): ExistingAgvVehicle[] {
  return store.vehicles.map((vehicle) => ({
    name: vehicle.name,
    properties: vehicle.properties,
  }));
}

function allEntityNames(): string[] {
  return [
    ...store.points.map((entity) => entity.name),
    ...store.paths.map((entity) => entity.name),
    ...store.locationTypes.map((entity) => entity.name),
    ...store.locations.map((entity) => entity.name),
    ...store.blocks.map((entity) => entity.name),
    ...store.vehicles.map((entity) => entity.name),
  ];
}
</script>

<template>
  <section class="registry-view">
    <header class="registry-header">
      <div>
        <h2>AGV注册管理</h2>
        <p class="muted">{{ projectTitle || '未选择工程' }}</p>
      </div>
      <div class="header-actions">
        <RouterLink
          v-if="activeProjectId"
          class="btn"
          :to="{ name: 'editor', params: { projectId: activeProjectId } }"
        >
          画布编辑器
        </RouterLink>
        <button type="button" class="btn primary" :disabled="!activeProjectId" @click="goPublish">
          发布到 Kernel
        </button>
      </div>
    </header>

    <p v-if="loading" class="muted">加载中...</p>

    <template v-else>
      <div v-if="hasPendingPublish" class="publish-banner">
        <span>当前工程草稿有 AGV 注册变更，发布后才会写入 Kernel PlantModel。</span>
        <button type="button" class="btn primary" @click="goPublish">发布</button>
      </div>

      <section class="summary-strip" aria-label="AGV 注册摘要">
        <strong>{{ records.length }}</strong>
        <span>车辆总数</span>
        <strong>{{ registeredCount }}</strong>
        <span>VDA5050已配置</span>
        <strong>{{ records.length - registeredCount }}</strong>
        <span>待补齐</span>
      </section>

      <form class="filters" @submit.prevent>
        <input v-model="nameFilter" type="search" placeholder="车辆名称" />
        <input v-model="macFilter" type="search" placeholder="MAC地址" />
        <select v-model="modelFilter" aria-label="车型过滤">
          <option value="">全部车型</option>
          <option v-for="model in AGV_VEHICLE_MODELS" :key="model" :value="model">
            {{ model }}
          </option>
        </select>
        <select v-model="statusFilter" aria-label="状态过滤">
          <option value="all">全部状态</option>
          <option value="registered">VDA5050已配置</option>
          <option value="incomplete">待补齐</option>
        </select>
        <button type="button" class="btn" @click="startCreate">新增车辆</button>
      </form>

      <div class="registry-layout">
        <section class="table-panel">
          <table class="registry-table">
            <thead>
              <tr>
                <th>车辆名称</th>
                <th>车型</th>
                <th>所属区域</th>
                <th>MAC地址</th>
                <th>VDA5050</th>
                <th>Topic前缀</th>
                <th class="actions">操作</th>
              </tr>
            </thead>
            <tbody>
              <tr v-if="filteredRecords.length === 0">
                <td colspan="7" class="empty">暂无匹配车辆</td>
              </tr>
              <tr
                v-for="record in filteredRecords"
                :key="record.name"
                :class="{ selected: editingName === record.name }"
              >
                <td>
                  <code>{{ record.name }}</code>
                </td>
                <td>{{ record.model || '-' }}</td>
                <td>{{ record.region || '-' }}</td>
                <td>{{ record.macAddress || '-' }}</td>
                <td>
                  <span class="status" :class="{ ok: record.registered }">
                    {{ record.registered ? '已配置' : '待补齐' }}
                  </span>
                </td>
                <td class="topic">{{ record.effectiveTopicPrefix || '-' }}</td>
                <td class="actions">
                  <button type="button" class="link-btn" @click="startEdit(record.name)">
                    编辑
                  </button>
                  <button type="button" class="link-btn danger" @click="removeVehicle(record.name)">
                    删除
                  </button>
                </td>
              </tr>
            </tbody>
          </table>
        </section>
      </div>

      <div v-if="formDialogOpen" class="dialog-backdrop" role="presentation">
        <section
          class="vehicle-dialog"
          role="dialog"
          aria-modal="true"
          aria-labelledby="agv-registration-dialog-title"
        >
          <header class="dialog-header">
            <h3 id="agv-registration-dialog-title">{{ formDialogTitle }}</h3>
            <div class="dialog-actions">
              <button v-if="editingName" type="button" class="link-btn" @click="startCreate">
                取消编辑
              </button>
              <button type="button" class="close-button" aria-label="关闭" @click="closeFormDialog">
                ×
              </button>
            </div>
          </header>

          <div class="dialog-body">
            <form class="registration-form" @submit.prevent="submit">
              <label>
                <span>车辆名称 *</span>
                <input v-model="form.name" type="text" required />
              </label>
              <label>
                <span>车型 *</span>
                <select v-model="form.model" required>
                  <option value="" disabled>请选择</option>
                  <option v-for="model in AGV_VEHICLE_MODELS" :key="model" :value="model">
                    {{ model }}
                  </option>
                </select>
              </label>
              <label>
                <span>所属区域 *</span>
                <select v-model="form.region" required>
                  <option value="" disabled>请选择</option>
                  <option v-for="region in AGV_REGIONS" :key="region" :value="region">
                    {{ region }}
                  </option>
                </select>
              </label>
              <label>
                <span>MAC地址</span>
                <input v-model="form.macAddress" type="text" placeholder="00:11:22:33:44:55" />
              </label>
              <label>
                <span>通信适配器</span>
                <select v-model="selectedCommAdapter" required>
                  <option v-for="adapter in COMM_ADAPTER_OPTIONS" :key="adapter" :value="adapter">
                    {{ adapter }}
                  </option>
                </select>
              </label>
              <label>
                <span>{{ VDA5050_PROPERTY_KEYS.topicPrefix }}</span>
                <input
                  v-model="form.topicPrefix"
                  type="text"
                  placeholder="VDA/V2.0.0/BYD_11/DP0055"
                />
              </label>
              <label>
                <span>{{ VDA5050_PROPERTY_KEYS.interfaceName }}</span>
                <input v-model="form.interfaceName" type="text" placeholder="VDA" />
              </label>
              <label>
                <span>{{ VDA5050_PROPERTY_KEYS.manufacturer }} *</span>
                <input v-model="form.manufacturer" type="text" required placeholder="BYD_11" />
              </label>
              <label>
                <span>{{ VDA5050_PROPERTY_KEYS.serialNumber }} *</span>
                <input v-model="form.serialNumber" type="text" required placeholder="DP0055" />
              </label>
              <label class="wide">
                <span>当前生效 Topic 前缀</span>
                <input :value="effectiveTopicPreview || '-'" type="text" disabled />
              </label>

              <ul v-if="validationIssues.length > 0" class="issues">
                <li v-for="issue in validationIssues" :key="`${issue.field}:${issue.message}`">
                  {{ issue.message }}
                </li>
              </ul>

              <div class="form-actions">
                <button type="button" class="btn" @click="resetDialogForm">重置</button>
                <button type="submit" class="btn primary">
                  {{ editingName ? '保存修改' : '确定新增' }}
                </button>
              </div>
            </form>

            <dl class="managed-props">
              <dt>业务属性</dt>
              <dd>{{ BYD_AGV_PROPERTY_KEYS.model }} / {{ BYD_AGV_PROPERTY_KEYS.region }}</dd>
              <dt>VDA5050版本</dt>
              <dd>{{ VDA5050_PROPERTY_KEYS.version }} = 2.0</dd>
            </dl>
          </div>
        </section>
      </div>
    </template>
  </section>
</template>

<style scoped>
.registry-view {
  max-width: 1180px;
  margin: 1rem auto;
  padding: 1rem;
}
.registry-header,
.header-actions,
.form-actions,
.dialog-header,
.dialog-actions {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}
.registry-header {
  justify-content: space-between;
  margin-bottom: 1rem;
}
.registry-header h2,
.dialog-header h3 {
  margin: 0;
}
.muted {
  color: #57606a;
  margin: 0.2rem 0 0;
}
.publish-banner,
.summary-strip,
.filters,
.table-panel {
  border: 1px solid #d0d7de;
  background: #ffffff;
}
.publish-banner {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 0.75rem;
  padding: 0.75rem 1rem;
  border-color: #d4a72c;
  background: #fff8c5;
  border-radius: 6px;
  margin-bottom: 0.75rem;
}
.summary-strip {
  display: grid;
  grid-template-columns: repeat(3, auto 1fr);
  gap: 0.35rem 0.6rem;
  align-items: baseline;
  padding: 0.65rem 0.9rem;
  border-radius: 6px;
  margin-bottom: 0.75rem;
}
.summary-strip strong {
  font-size: 1.2rem;
}
.summary-strip span {
  color: #57606a;
}
.filters {
  display: grid;
  grid-template-columns: minmax(9rem, 1fr) minmax(9rem, 1fr) 10rem 10rem auto;
  gap: 0.5rem;
  padding: 0.75rem;
  border-radius: 6px;
  margin-bottom: 0.75rem;
}
input,
select {
  min-width: 0;
  padding: 0.42rem 0.55rem;
  border: 1px solid #d0d7de;
  border-radius: 5px;
  background: #ffffff;
  color: #1f2328;
  font: inherit;
}
input:disabled,
select:disabled {
  background: #f6f8fa;
  color: #57606a;
}
.registry-layout {
  min-width: 0;
}
.table-panel {
  border-radius: 6px;
}
.table-panel {
  overflow-x: auto;
}
.registry-table {
  width: 100%;
  border-collapse: collapse;
  min-width: 760px;
}
.registry-table th,
.registry-table td {
  padding: 0.55rem 0.65rem;
  border-bottom: 1px solid #eaeef2;
  text-align: left;
  vertical-align: middle;
}
.registry-table th {
  background: #f6f8fa;
  color: #57606a;
  font-weight: 600;
}
.registry-table tr.selected td {
  background: #ddf4ff;
}
.registry-table code {
  background: #f6f8fa;
  border: 1px solid #eaeef2;
  border-radius: 3px;
  padding: 0.05rem 0.25rem;
}
.topic {
  max-width: 16rem;
  word-break: break-all;
}
.empty {
  color: #57606a;
  text-align: center;
}
.status {
  display: inline-flex;
  align-items: center;
  min-height: 1.45rem;
  padding: 0 0.45rem;
  border-radius: 999px;
  background: #ffebe9;
  color: #cf222e;
  font-size: 0.82rem;
  white-space: nowrap;
}
.status.ok {
  background: #dafbe1;
  color: #1a7f37;
}
.actions {
  white-space: nowrap;
}
.dialog-backdrop {
  position: fixed;
  inset: 0;
  z-index: 60;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 1rem;
  background: rgba(246, 248, 250, 0.62);
}
.vehicle-dialog {
  width: min(52rem, calc(100vw - 2rem));
  max-height: calc(100vh - 2rem);
  display: grid;
  grid-template-rows: auto minmax(0, 1fr);
  border: 1px solid #d0d7de;
  border-radius: 6px;
  background: #ffffff;
  box-shadow: 0 18px 46px rgba(31, 35, 40, 0.18);
}
.dialog-header {
  justify-content: space-between;
  padding: 0.9rem 1rem;
  border-bottom: 1px solid #eaeef2;
}
.dialog-header h3 {
  color: #1f2328;
  font-size: 1.05rem;
  font-weight: 650;
}
.dialog-actions {
  justify-content: flex-end;
}
.close-button {
  border: 0;
  background: transparent;
  color: #57606a;
  cursor: pointer;
  font-size: 1.7rem;
  line-height: 1;
  padding: 0 0.15rem;
}
.close-button:hover {
  color: #1f2328;
}
.dialog-body {
  min-height: 0;
  overflow: auto;
  padding: 0.9rem 1rem 1rem;
}
.registration-form {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0.65rem;
}
.registration-form label {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  min-width: 0;
}
.registration-form label span {
  color: #57606a;
  font-size: 0.82rem;
}
.registration-form .wide,
.issues,
.form-actions {
  grid-column: 1 / -1;
}
.issues {
  margin: 0;
  padding: 0.55rem 0.75rem 0.55rem 1.4rem;
  border: 1px solid #ff8182;
  border-radius: 6px;
  background: #ffebe9;
  color: #cf222e;
}
.form-actions {
  justify-content: flex-end;
  margin-top: 0.25rem;
}
.btn {
  padding: 0.42rem 0.75rem;
  border: 1px solid #d0d7de;
  border-radius: 5px;
  background: #ffffff;
  color: #1f2328;
  cursor: pointer;
  font: inherit;
  text-decoration: none;
}
.btn:hover {
  background: #f3f4f6;
}
.btn.primary {
  background: #0969da;
  border-color: #0969da;
  color: #ffffff;
}
.btn.primary:hover {
  background: #0a5cb6;
}
.btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}
.link-btn {
  border: none;
  background: transparent;
  color: #0969da;
  cursor: pointer;
  font: inherit;
  padding: 0.1rem 0.3rem;
}
.link-btn:hover {
  text-decoration: underline;
}
.link-btn.danger {
  color: #cf222e;
}
.managed-props {
  display: grid;
  grid-template-columns: 6.5rem 1fr;
  gap: 0.25rem 0.5rem;
  margin: 0.9rem 0 0;
  padding-top: 0.75rem;
  border-top: 1px solid #eaeef2;
  color: #57606a;
  font-size: 0.8rem;
}
.managed-props dt {
  font-weight: 600;
}
.managed-props dd {
  margin: 0;
  word-break: break-all;
}
@media (max-width: 980px) {
  .filters,
  .registration-form {
    grid-template-columns: 1fr;
  }
  .summary-strip {
    grid-template-columns: auto 1fr;
  }
}
</style>
