<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';

import {
  WAREHOUSE_LOAD_ACTION_OPTIONS,
  WAREHOUSE_UNLOAD_ACTION_OPTIONS,
  createEmptyWarehouseTypeForm,
  warehouseTypeFormFromRecord,
  type WarehouseTypeFormData,
  type WarehouseTypeRecord,
} from '@/domain/warehouse/warehouse';
import { useWarehouseStore } from '@/stores/warehouse';
import { toastError, toastSuccess } from '@/ui/toast/toastBus';

type DialogMode = 'create' | 'view' | 'edit';

const warehouse = useWarehouseStore();
const keyword = ref('');
const dialogMode = ref<DialogMode | null>(null);
const editingId = ref<string | null>(null);
const form = ref<WarehouseTypeFormData>(createEmptyWarehouseTypeForm());

const readonlyMode = computed(() => dialogMode.value === 'view');
const dialogTitle = computed(() => {
  switch (dialogMode.value) {
    case 'create':
      return '新增货架型号';
    case 'view':
      return '查看货架型号';
    case 'edit':
      return '修改货架型号';
    default:
      return '';
  }
});

onMounted(() => {
  void warehouse.ensureLoaded().catch((err) => {
    toastError(err instanceof Error ? err.message : String(err), '货架型号');
  });
});

const filteredTypes = computed(() => {
  const q = keyword.value.trim().toLowerCase();
  if (!q) return warehouse.types;
  return warehouse.types.filter((item) =>
    [
      item.code,
      item.name,
      item.region,
      item.containerType,
      item.loadActionType,
      item.unloadActionType,
    ]
      .join('\n')
      .toLowerCase()
      .includes(q),
  );
});

function openCreate(): void {
  dialogMode.value = 'create';
  editingId.value = null;
  form.value = createEmptyWarehouseTypeForm();
}

function openView(record: WarehouseTypeRecord): void {
  dialogMode.value = 'view';
  editingId.value = record.id;
  form.value = warehouseTypeFormFromRecord(record);
}

function openEdit(record: WarehouseTypeRecord): void {
  dialogMode.value = 'edit';
  editingId.value = record.id;
  form.value = warehouseTypeFormFromRecord(record);
}

function closeDialog(): void {
  dialogMode.value = null;
  editingId.value = null;
}

async function submitDialog(): Promise<void> {
  if (readonlyMode.value) {
    closeDialog();
    return;
  }

  try {
    if (dialogMode.value === 'create') {
      await warehouse.createType(form.value);
      toastSuccess('已新增货架型号');
    } else if (dialogMode.value === 'edit' && editingId.value) {
      await warehouse.updateType(editingId.value, form.value);
      toastSuccess('已修改货架型号');
    }
    closeDialog();
  } catch (err) {
    toastError(err instanceof Error ? err.message : String(err), '货架型号');
  }
}

async function remove(record: WarehouseTypeRecord): Promise<void> {
  if (!window.confirm(`删除货架型号 "${record.name}"？`)) return;
  try {
    await warehouse.deleteType(record.id);
    toastSuccess('已删除货架型号');
  } catch (err) {
    toastError(err instanceof Error ? err.message : String(err), '货架型号');
  }
}
</script>

<template>
  <section class="warehouse-page">
    <form class="toolbar" @submit.prevent>
      <input v-model.trim="keyword" class="search-input" placeholder="型号编号 / 型号名称 / 区域" />
      <button type="button" class="btn btn-primary" @click="openCreate">+ 新增型号</button>
    </form>

    <div class="table-panel">
      <table>
        <thead>
          <tr>
            <th>序号</th>
            <th>型号编号</th>
            <th>型号名称</th>
            <th>所属区域</th>
            <th>货架类型</th>
            <th>容器类型</th>
            <th>上料动作类型</th>
            <th>下料动作类型</th>
            <th>更新时间</th>
            <th>操作</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="(item, index) in filteredTypes" :key="item.id">
            <td>{{ index + 1 }}</td>
            <td>{{ item.code }}</td>
            <td>{{ item.name }}</td>
            <td>{{ item.region }}</td>
            <td>{{ item.warehouseKind }}</td>
            <td>{{ item.containerType || '-' }}</td>
            <td>{{ item.loadActionType }}</td>
            <td>{{ item.unloadActionType }}</td>
            <td>{{ item.updatedAt }}</td>
            <td class="actions">
              <button type="button" class="link" @click="openView(item)">查看</button>
              <button type="button" class="link link-warn" @click="openEdit(item)">修改</button>
              <button type="button" class="link link-danger" @click="remove(item)">删除</button>
            </td>
          </tr>
          <tr v-if="filteredTypes.length === 0">
            <td colspan="10" class="empty">暂无货架型号</td>
          </tr>
        </tbody>
      </table>
    </div>

    <div v-if="dialogMode" class="dialog-backdrop" role="presentation">
      <section class="dialog" role="dialog" aria-modal="true" aria-labelledby="type-dialog-title">
        <header class="dialog-header">
          <h3 id="type-dialog-title">{{ dialogTitle }}</h3>
          <button type="button" class="close-button" aria-label="关闭" @click="closeDialog">
            ×
          </button>
        </header>

        <form class="dialog-body" @submit.prevent="submitDialog">
          <div class="form-grid">
            <label>
              <span><b>*</b> 型号编号</span>
              <input v-model.trim="form.code" :disabled="readonlyMode" required />
            </label>
            <label>
              <span><b>*</b> 型号名称</span>
              <input v-model.trim="form.name" :disabled="readonlyMode" required />
            </label>
            <label>
              <span><b>*</b> 所属区域</span>
              <input v-model.trim="form.region" :disabled="readonlyMode" required />
            </label>
            <label>
              <span>容器类型</span>
              <input v-model.trim="form.containerType" :disabled="readonlyMode" />
            </label>
            <label>
              <span><b>*</b> 上料动作类型</span>
              <select v-model="form.loadActionType" :disabled="readonlyMode">
                <option
                  v-for="option in WAREHOUSE_LOAD_ACTION_OPTIONS"
                  :key="option"
                  :value="option"
                >
                  {{ option }}
                </option>
              </select>
            </label>
            <label>
              <span><b>*</b> 下料动作类型</span>
              <select v-model="form.unloadActionType" :disabled="readonlyMode">
                <option
                  v-for="option in WAREHOUSE_UNLOAD_ACTION_OPTIONS"
                  :key="option"
                  :value="option"
                >
                  {{ option }}
                </option>
              </select>
            </label>
            <label>
              <span>L(mm)</span>
              <input
                v-model.number="form.lengthMm"
                type="number"
                min="0"
                :disabled="readonlyMode"
              />
            </label>
            <label>
              <span>W(mm)</span>
              <input v-model.number="form.widthMm" type="number" min="0" :disabled="readonlyMode" />
            </label>
            <label>
              <span>H(mm)</span>
              <input
                v-model.number="form.heightMm"
                type="number"
                min="0"
                :disabled="readonlyMode"
              />
            </label>
            <label>
              <span>L1(mm)</span>
              <input
                v-model.number="form.innerLengthMm"
                type="number"
                min="0"
                :disabled="readonlyMode"
              />
            </label>
            <label>
              <span>W1(mm)</span>
              <input
                v-model.number="form.innerWidthMm"
                type="number"
                min="0"
                :disabled="readonlyMode"
              />
            </label>
            <label>
              <span>H1(mm)</span>
              <input
                v-model.number="form.legHeightMm"
                type="number"
                min="0"
                :disabled="readonlyMode"
              />
            </label>
            <label>
              <span>L2(mm)</span>
              <input
                v-model.number="form.legLengthMm"
                type="number"
                min="0"
                :disabled="readonlyMode"
              />
            </label>
            <label>
              <span>W2(mm)</span>
              <input
                v-model.number="form.legWidthMm"
                type="number"
                min="0"
                :disabled="readonlyMode"
              />
            </label>
            <label>
              <span>货架图形</span>
              <input v-model.trim="form.rackShape" :disabled="readonlyMode" />
            </label>
            <label>
              <span>绑定车型</span>
              <input v-model.trim="form.boundVehicleModels" :disabled="readonlyMode" />
            </label>
            <label>
              <span>取货方向</span>
              <input v-model.trim="form.pickupDirection" :disabled="readonlyMode" />
            </label>
            <label>
              <span>进入方向</span>
              <input v-model.trim="form.entryDirection" :disabled="readonlyMode" />
            </label>
            <label>
              <span>载货传感器检测</span>
              <select v-model="form.loadSensorCheck" :disabled="readonlyMode">
                <option :value="true">是</option>
                <option :value="false">否</option>
              </select>
            </label>
            <label>
              <span>二维码信息校验</span>
              <select v-model="form.qrCodeCheck" :disabled="readonlyMode">
                <option :value="true">是</option>
                <option :value="false">否</option>
              </select>
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
.warehouse-page {
  min-width: 0;
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
input,
select {
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
  width: min(22rem, 100%);
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
  min-width: 72rem;
  border-collapse: collapse;
  table-layout: fixed;
}

th,
td {
  border-bottom: 1px solid #edf1f5;
  border-right: 1px solid #edf1f5;
  padding: 0.85rem 0.6rem;
  color: #30363d;
  font-size: 0.9rem;
  text-align: center;
  vertical-align: middle;
  word-break: break-word;
}

th {
  background: #eef2f6;
  color: #69717c;
  font-weight: 700;
}

tbody tr:nth-child(odd) {
  background: #fff1ed;
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
  padding: 0 0.25rem;
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
  width: min(86rem, calc(100vw - 2rem));
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
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 1rem 2rem;
  padding: 0.5rem 2rem 1.5rem;
}

label {
  min-width: 0;
  display: grid;
  grid-template-columns: 8.5rem minmax(0, 1fr);
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

