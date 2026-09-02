<script setup lang="ts">
import {
  createTaskRow,
  operationForTask,
  TASK_TYPE_OPTIONS,
  taskTypeLabel,
  targetSupportsTask,
  type CreateTaskType,
  type TargetOption,
  type TaskRow,
} from '@/domain/tasks/createTask';

const props = defineProps<{
  rows: TaskRow[];
  activeRowId: number | null;
  targets: TargetOption[];
}>();

const emit = defineEmits<{
  'update:rows': [rows: TaskRow[]];
  'update:activeRowId': [id: number | null];
  'edit-params': [rowId: number];
}>();

interface RowTargetOption extends TargetOption {
  optionLabel: string;
  title: string;
}

interface TargetSupportState {
  level: 'ok' | 'error';
  text: string;
}

function nextRowId(): number {
  return Math.max(0, ...props.rows.map((row) => row.id)) + 1;
}

function emitRows(rows: TaskRow[]): void {
  emit('update:rows', rows);
}

function updateRow(id: number, patch: Partial<TaskRow>): void {
  emitRows(props.rows.map((row) => (row.id === id ? { ...row, ...patch } : row)));
}

function selectRow(id: number): void {
  emit('update:activeRowId', id);
}

function clearSelection(): void {
  emit('update:activeRowId', null);
}

function addRow(): void {
  const created = createTaskRow(nextRowId(), 'load');
  emitRows([...props.rows, created]);
  emit('update:activeRowId', created.id);
}

function removeRow(id: number): void {
  if (props.rows.length <= 1) return;
  const next = props.rows.filter((row) => row.id !== id);
  emitRows(next);
  if (props.activeRowId === id) {
    emit('update:activeRowId', next.at(-1)?.id ?? null);
  }
}

function removeActiveRow(): void {
  if (props.activeRowId === null) return;
  removeRow(props.activeRowId);
}

function onTypeChange(row: TaskRow, value: string): void {
  updateRow(row.id, { type: value as CreateTaskType });
}

function onTargetChange(row: TaskRow, value: string): void {
  if (!value) {
    updateRow(row.id, { targetName: '', targetKind: '' });
    return;
  }

  const target = props.targets.find((item) => item.name === value);
  if (!target || !targetSupportsRow(row, target)) return;
  updateRow(row.id, {
    targetName: value,
    targetKind: target.kind,
  });
}

function targetKindText(kind: TargetOption['kind']): string {
  return kind === 'location' ? 'Location' : 'Point';
}

function operationsText(operations: readonly string[], separator = ' / '): string {
  return operations.length ? operations.join(separator) : '无';
}

function targetSupportsRow(row: TaskRow, target: TargetOption): boolean {
  return targetSupportsTask(row, target);
}

function unsupportedText(row: TaskRow, target: TargetOption): string {
  if (row.type === 'charge') {
    const displayName = target.chargingPileName || target.name;
    if (target.kind !== 'location' || !target.isChargingPile) {
      return `${target.name} 不是可用充电桩`;
    }
    if (target.chargeUnavailableReason) {
      return `${displayName} ${target.chargeUnavailableReason}`;
    }
  }

  return `${target.name} 不支持 ${operationForTask(row)}，可用操作：${operationsText(
    target.allowedOperations,
    '、',
  )}`;
}

function toRowTargetOption(target: TargetOption, row: TaskRow): RowTargetOption {
  const operationLabel = operationsText(target.allowedOperations);
  const supported = targetSupportsRow(row, target);
  return {
    ...target,
    optionLabel: supported
      ? `${target.name}（${operationLabel}）`
      : `${target.name}（不支持 ${operationForTask(row)}，${operationLabel}）`,
    title: supported
      ? `${targetKindText(target.kind)} 支持：${operationLabel}`
      : unsupportedText(row, target),
  };
}

function rowTargetOptions(row: TaskRow): RowTargetOption[] {
  const supportedTargets = props.targets.filter((target) => targetSupportsRow(row, target));
  const selected = selectedTarget(row);
  const selectedUnsupported = selected && !targetSupportsRow(row, selected) ? [selected] : [];
  return [...selectedUnsupported, ...supportedTargets].map((target) =>
    toRowTargetOption(target, row),
  );
}

function selectedTarget(row: TaskRow): TargetOption | null {
  if (!row.targetName) return null;
  return props.targets.find((target) => target.name === row.targetName) ?? null;
}

function targetSupportState(row: TaskRow): TargetSupportState | null {
  const target = selectedTarget(row);
  if (!row.targetName) return null;
  if (!target) {
    return { level: 'error', text: `未找到点位 ${row.targetName}` };
  }

  const operation = operationForTask(row);
  if (targetSupportsRow(row, target)) {
    return { level: 'ok', text: `支持 ${operation}` };
  }
  return { level: 'error', text: unsupportedText(row, target) };
}
</script>

<template>
  <section class="task-details-card">
    <header class="task-details-header">
      <h2>任务详情</h2>
      <div class="task-tools" aria-label="任务操作">
        <button
          type="button"
          class="round-tool"
          title="删除当前任务"
          :disabled="rows.length <= 1 || activeRowId === null"
          @click="removeActiveRow"
        >
          −
        </button>
        <button type="button" class="round-tool" title="新增任务" @click="addRow">+</button>
      </div>
    </header>

    <div class="task-table-wrap" @click.self="clearSelection">
      <table class="task-table">
        <thead>
          <tr>
            <th>类型</th>
            <th>地图</th>
            <th>目标点</th>
            <th>参数</th>
            <th>操作</th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="row in rows"
            :key="row.id"
            :class="{ active: row.id === activeRowId }"
            @click="selectRow(row.id)"
          >
            <td>
              <select
                :value="row.type"
                :aria-label="`任务类型 ${taskTypeLabel(row.type)}`"
                @change="onTypeChange(row, ($event.target as HTMLSelectElement).value)"
                @focus="selectRow(row.id)"
              >
                <option v-for="option in TASK_TYPE_OPTIONS" :key="option.id" :value="option.id">
                  {{ option.label }}
                </option>
              </select>
            </td>
            <td class="map-name">HZ27</td>
            <td>
              <div class="target-field">
                <select
                  :value="row.targetName"
                  aria-label="目标点位"
                  :class="{ 'select--invalid': targetSupportState(row)?.level === 'error' }"
                  @change="onTargetChange(row, ($event.target as HTMLSelectElement).value)"
                  @focus="selectRow(row.id)"
                >
                  <option value="">请选择</option>
                  <option
                    v-for="target in rowTargetOptions(row)"
                    :key="`${target.kind}:${target.name}`"
                    :value="target.name"
                    :title="target.title"
                  >
                    {{ target.optionLabel }}
                  </option>
                </select>
                <p
                  v-if="targetSupportState(row)"
                  class="target-hint"
                  :class="`target-hint--${targetSupportState(row)?.level}`"
                >
                  {{ targetSupportState(row)?.text }}
                </p>
              </div>
            </td>
            <td>
              <button type="button" class="param-button" @click.stop="emit('edit-params', row.id)">
                编辑
              </button>
            </td>
            <td>
              <button
                type="button"
                class="delete-button"
                title="删除"
                :disabled="rows.length <= 1"
                @click.stop="removeRow(row.id)"
              >
                ×
              </button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </section>
</template>

<style scoped>
.task-details-card {
  min-width: 0;
  min-height: 0;
  background: #ffffff;
  border: 1px solid #e6ebf1;
  border-radius: 6px;
  box-shadow: 0 6px 18px rgba(31, 35, 40, 0.06);
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.task-details-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 1rem 1rem 0.85rem;
}

.task-details-header h2 {
  margin: 0;
  color: #2f353d;
  font-size: 1.08rem;
  font-weight: 650;
}

.task-tools {
  display: flex;
  gap: 0.75rem;
}

.round-tool {
  width: 1.45rem;
  height: 1.45rem;
  border: 0;
  border-radius: 50%;
  background: #ff5a1f;
  color: #ffffff;
  font-size: 1.15rem;
  font-weight: 700;
  line-height: 1;
  cursor: pointer;
}

.round-tool:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}

.task-table-wrap {
  flex: 1 1 auto;
  min-height: 0;
  overflow: auto;
  padding: 0 1rem 1rem;
}

.task-table {
  width: 100%;
  border-collapse: collapse;
  table-layout: fixed;
  color: #5f6670;
  font-size: 0.95rem;
}

.task-table th {
  height: 2.6rem;
  background: #e9eef3;
  color: #8a929c;
  font-weight: 650;
  border: 1px solid #eef2f6;
}

.task-table td {
  height: 3.1rem;
  padding: 0.35rem 0.5rem;
  border: 1px solid #eef2f6;
  text-align: center;
  background: #ffffff;
}

.task-table tr.active td {
  background: #f1f4f8;
}

.task-table th:nth-child(1),
.task-table th:nth-child(3) {
  width: 28%;
}

.task-table th:nth-child(2),
.task-table th:nth-child(4),
.task-table th:nth-child(5) {
  width: 14.6%;
}

select {
  width: 100%;
  min-width: 0;
  height: 2.3rem;
  padding: 0 1.8rem 0 0.75rem;
  border: 1px solid #d8dee7;
  border-radius: 4px;
  background: #ffffff;
  color: #5f6670;
  font: inherit;
}

select:focus {
  border-color: #ff6a3a;
  outline: none;
}

.select--invalid,
.select--invalid:focus {
  border-color: #ff4d1d;
  background: #fff7f5;
}

.target-field {
  min-width: 0;
}

.target-hint {
  margin: 0.35rem 0 0;
  overflow: hidden;
  text-align: left;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 0.78rem;
  font-weight: 650;
  line-height: 1.2;
}

.target-hint--ok {
  color: #2da44e;
}

.target-hint--error {
  color: #ff4d1d;
}

.map-name {
  color: #6b727c;
  font-weight: 600;
}

.param-button {
  min-width: 4.2rem;
  height: 2.25rem;
  border: 1px solid #ffc7b3;
  border-radius: 4px;
  background: #fff1eb;
  color: #ff5a1f;
  font-weight: 650;
  cursor: pointer;
}

.delete-button {
  border: 0;
  background: transparent;
  color: #8a929c;
  font-size: 1.25rem;
  line-height: 1;
  cursor: pointer;
}

.delete-button:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}
</style>
