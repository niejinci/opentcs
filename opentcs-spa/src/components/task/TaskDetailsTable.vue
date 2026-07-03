<script setup lang="ts">
import {
  createTaskRow,
  TASK_TYPE_OPTIONS,
  taskTypeLabel,
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
  const target = props.targets.find((item) => item.name === value);
  updateRow(row.id, {
    targetName: value,
    targetKind: target?.kind ?? '',
  });
}

function targetKindText(kind: TargetOption['kind']): string {
  return kind === 'location' ? 'Location' : 'Point';
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
              <select
                :value="row.targetName"
                aria-label="目标点位"
                @change="onTargetChange(row, ($event.target as HTMLSelectElement).value)"
                @focus="selectRow(row.id)"
              >
                <option value="">请选择</option>
                <option
                  v-for="target in targets"
                  :key="`${target.kind}:${target.name}`"
                  :value="target.name"
                  :title="targetKindText(target.kind)"
                  :disabled="target.disabled"
                >
                  {{ target.name }}
                </option>
              </select>
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
