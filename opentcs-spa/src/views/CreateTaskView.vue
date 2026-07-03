<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { RouterLink, useRoute, useRouter } from 'vue-router';

import { createTransportOrder } from '@/api/endpoints/transportOrders';
import { HttpError } from '@/api/errors';
import TaskDetailsTable from '@/components/task/TaskDetailsTable.vue';
import TaskMapPanel from '@/components/task/TaskMapPanel.vue';
import TaskParamDialog from '@/components/task/TaskParamDialog.vue';
import { useBackgroundMap } from '@/composables/useBackgroundMap';
import { allowedOperationsForTarget, resolveOrderTargetInfos } from '@/domain/model/orderTargets';
import {
  buildTransportOrderRequest,
  createTaskRow,
  operationForTask,
  validateTaskRows,
  type TargetOption,
  type TaskParams,
  type TaskRow,
} from '@/domain/tasks/createTask';
import { useLiveStatusStore } from '@/stores/liveStatus';
import { useProjectStore } from '@/stores/project';
import { useProjectsStore } from '@/stores/projects';
import { toastError, toastSuccess, toastWarning } from '@/ui/toast/toastBus';

const props = defineProps<{
  projectId?: string;
}>();

const route = useRoute();
const router = useRouter();
const live = useLiveStatusStore();
const project = useProjectStore();
const projects = useProjectsStore();
const { background } = useBackgroundMap();

const routeProjectId = computed(() =>
  String(props.projectId ?? route.params.projectId ?? projects.currentId ?? '').trim(),
);

const projectName = ref('');
const loadingProject = ref(false);
const submitting = ref(false);
const intendedVehicle = ref('');
const rows = ref<TaskRow[]>([createTaskRow(1, 'load')]);
const activeRowId = ref<number | null>(1);
const editingRowId = ref<number | null>(null);

const targetModel = computed(() =>
  resolveOrderTargetInfos({
    points: project.points,
    locationTypes: project.locationTypes,
    locations: project.locations,
  }),
);

const targetOptions = computed<TargetOption[]>(() => {
  const locations = project.locations
    .filter((location) => !location.locked)
    .map((location) => ({ name: location.name, kind: 'location' as const }));
  const points = project.points.map((point) => ({ name: point.name, kind: 'point' as const }));
  return [...locations, ...points].sort((a, b) => a.name.localeCompare(b.name));
});

const editingRow = computed(() =>
  editingRowId.value === null
    ? null
    : (rows.value.find((row) => row.id === editingRowId.value) ?? null),
);

const canSubmit = computed(() => {
  return !loadingProject.value && !submitting.value && rows.value.some((row) => row.targetName);
});

watch(
  () => route.query.vehicle,
  (value) => {
    intendedVehicle.value = typeof value === 'string' ? value.trim() : '';
  },
  { immediate: true },
);

watch(
  () => routeProjectId.value,
  () => void activateProject(),
  { immediate: true },
);

watch(
  () => rows.value.map((row) => row.id).join(','),
  () => {
    if (activeRowId.value !== null && rows.value.some((row) => row.id === activeRowId.value)) {
      return;
    }
    activeRowId.value = rows.value[0]?.id ?? null;
  },
);

async function activateProject(): Promise<void> {
  if (!routeProjectId.value) {
    toastWarning('请先选择工程，再创建任务', '创建任务');
    void router.replace({ name: 'projects' });
    return;
  }

  loadingProject.value = true;
  try {
    const meta = await projects.setCurrent(routeProjectId.value);
    projectName.value = meta.name;
    const env = await projects.loadCurrentDraft();
    project.hydrateDraftPayload(env?.payload ?? null);
  } catch {
    toastError('加载创建任务工程失败', '创建任务');
    void router.replace({ name: 'projects' });
  } finally {
    loadingProject.value = false;
  }
}

function openParamDialog(rowId: number): void {
  editingRowId.value = rowId;
}

function updateEditingParams(params: TaskParams): void {
  const rowId = editingRowId.value;
  if (rowId === null) return;
  rows.value = rows.value.map((row) => (row.id === rowId ? { ...row, params } : row));
}

function onMapTargetClick(target: { kind: 'point' | 'location'; name: string }): void {
  if (activeRowId.value === null) {
    toastWarning('请先选择要编辑的任务', '地图选点');
    return;
  }
  const active = rows.value.find((row) => row.id === activeRowId.value);
  if (!active) {
    toastWarning('请先选择要编辑的任务', '地图选点');
    return;
  }

  rows.value = rows.value.map((row) =>
    row.id === active.id ? { ...row, targetName: target.name, targetKind: target.kind } : row,
  );
  project.select({ kind: target.kind, name: target.name });
}

function operationSupportErrors(): string[] {
  const errors: string[] = [];
  rows.value.forEach((row, index) => {
    const targetName = row.targetName.trim();
    if (!targetName) return;
    const info = targetModel.value.targetInfoByName.get(targetName);
    if (!info) return;
    const operation = operationForTask(row);
    const allowed = allowedOperationsForTarget(info);
    if (!allowed.includes(operation)) {
      errors.push(
        `第 ${index + 1} 行 ${targetName} 不支持 ${operation}，可用操作：${
          allowed.length ? allowed.join('、') : '无'
        }`,
      );
    }
  });
  return errors;
}

function validationErrors(): string[] {
  return [...validateTaskRows(rows.value), ...operationSupportErrors()];
}

function goBack(): void {
  if (routeProjectId.value) {
    void router.push({ name: 'realtime-monitor', params: { projectId: routeProjectId.value } });
  } else {
    void router.push({ name: 'projects' });
  }
}

function orderFailureMessage(err: unknown): string {
  if (err instanceof HttpError) {
    const code = err.payload?.code ?? `HTTP_${err.status}`;
    const msg = err.payload?.message ?? err.statusText;
    const field = err.payload?.fieldPath ? `\n字段：${err.payload.fieldPath}` : '';
    return `${code}: ${msg}${field}`;
  }
  return err instanceof Error ? err.message : '订单创建失败，请检查网络';
}

async function submit(): Promise<void> {
  const errors = validationErrors();
  if (errors.length > 0) {
    toastError(errors.slice(0, 4).join('\n'), '创建任务校验失败');
    return;
  }

  submitting.value = true;
  const request = buildTransportOrderRequest({
    rows: rows.value,
    intendedVehicle: intendedVehicle.value,
  });

  try {
    const order = await createTransportOrder(request, { toastOnError: false });
    live.recordCreatedOrder(order);
    toastSuccess(`已创建任务 ${order.name}`, '创建任务');
    goBack();
  } catch (err) {
    toastError(orderFailureMessage(err), '创建任务失败');
  } finally {
    submitting.value = false;
  }
}
</script>

<template>
  <section class="create-task-page">
    <header class="create-task-header">
      <div class="title-group">
        <RouterLink
          class="back-link"
          :to="{ name: 'realtime-monitor', params: { projectId: routeProjectId } }"
        >
          ← 返回
        </RouterLink>
        <span class="title-divider" aria-hidden="true"></span>
        <h1>创建任务</h1>
      </div>

      <div class="header-actions">
        <span v-if="projectName" class="project-chip">{{ projectName }}</span>
        <span v-if="intendedVehicle" class="project-chip">AMR {{ intendedVehicle }}</span>
        <button type="button" class="plain-button" @click="goBack">取消</button>
        <button type="button" class="primary-button" :disabled="!canSubmit" @click="submit">
          {{ submitting ? '提交中' : '确定' }}
        </button>
      </div>
    </header>

    <main class="create-task-main">
      <aside class="task-list-pane">
        <TaskDetailsTable
          v-model:rows="rows"
          v-model:active-row-id="activeRowId"
          :targets="targetOptions"
          @edit-params="openParamDialog"
        />
      </aside>

      <TaskMapPanel class="map-pane" :background="background" @target-click="onMapTargetClick" />
    </main>

    <TaskParamDialog
      v-if="editingRow"
      :model-value="editingRow.params"
      @update:model-value="updateEditingParams"
      @close="editingRowId = null"
    />
  </section>
</template>

<style scoped>
.create-task-page {
  min-height: calc(100vh - 5.5rem);
  display: grid;
  grid-template-rows: auto minmax(0, 1fr);
  background: #f0f2f5;
  color: #24292f;
}

.create-task-header {
  min-height: 4.1rem;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  padding: 0 1rem;
  border-bottom: 1px solid #edf0f3;
  background: #ffffff;
}

.title-group {
  min-width: 0;
  display: flex;
  align-items: center;
  gap: 1rem;
}

.back-link {
  color: #225fae;
  text-decoration: none;
  font-size: 1rem;
  white-space: nowrap;
}

.title-divider {
  width: 1px;
  height: 1.5rem;
  background: #e4e8ee;
}

h1 {
  margin: 0;
  color: #333940;
  font-size: 1.18rem;
  font-weight: 650;
  white-space: nowrap;
}

.header-actions {
  min-width: 0;
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 0.65rem;
}

.project-chip {
  max-width: 14rem;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: #69717c;
  background: #f6f8fa;
  border: 1px solid #d8dee7;
  border-radius: 4px;
  padding: 0.35rem 0.55rem;
  font-size: 0.85rem;
}

.plain-button,
.primary-button {
  min-width: 4.5rem;
  height: 2.35rem;
  border-radius: 4px;
  font: inherit;
  font-weight: 600;
  cursor: pointer;
}

.plain-button {
  border: 1px solid #d8dee7;
  background: #ffffff;
  color: #5f6670;
}

.primary-button {
  border: 1px solid #ff5a1f;
  background: #ff5a1f;
  color: #ffffff;
}

.primary-button:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}

.create-task-main {
  min-height: 0;
  display: grid;
  grid-template-columns: minmax(28rem, 40rem) minmax(0, 1fr);
  gap: 0.75rem;
  padding: 0.75rem;
}

.task-list-pane,
.map-pane {
  min-width: 0;
  min-height: 0;
}

.map-pane {
  border: 1px solid #d8dee7;
  border-radius: 4px;
}

@media (max-width: 1080px) {
  .create-task-main {
    grid-template-columns: 1fr;
    grid-template-rows: minmax(22rem, 0.48fr) minmax(30rem, 1fr);
  }

  .create-task-header {
    align-items: flex-start;
    flex-direction: column;
    padding: 0.75rem 1rem;
  }

  .header-actions {
    width: 100%;
    justify-content: flex-start;
    flex-wrap: wrap;
  }
}
</style>
