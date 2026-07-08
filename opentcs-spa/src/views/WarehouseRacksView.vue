<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';

import {
  createEmptyWarehouseRackForm,
  warehouseRackFormFromRecord,
  type WarehouseRackFormData,
  type WarehouseRackRecord,
} from '@/domain/warehouse/warehouse';
import { useWarehouseStore } from '@/stores/warehouse';
import { toastError, toastSuccess } from '@/ui/toast/toastBus';

type DialogMode = 'create' | 'view' | 'edit';

const warehouse = useWarehouseStore();
const keyword = ref('');
const selectedTypeCode = ref('');
const selectedEmptyStatus = ref('');
const selectedLockStatus = ref('');
const dialogMode = ref<DialogMode | null>(null);
const editingId = ref<string | null>(null);
const form = ref<WarehouseRackFormData>(createEmptyWarehouseRackForm(warehouse.types[0]));

const readonlyMode = computed(() => dialogMode.value === 'view');
const dialogTitle = computed(() => {
  switch (dialogMode.value) {
    case 'create':
      return '新增货架';
    case 'view':
      return '查看货架';
    case 'edit':
      return '修改货架';
    default:
      return '';
  }
});

onMounted(() => {
  void warehouse.ensureLoaded().catch((err) => {
    toastError(err instanceof Error ? err.message : String(err), '货架列表');
  });
});

const filteredRacks = computed(() => {
  const q = keyword.value.trim().toLowerCase();
  return warehouse.racks.filter((item) => {
    if (selectedTypeCode.value && item.typeCode !== selectedTypeCode.value) return false;
    if (selectedEmptyStatus.value && item.emptyStatus !== selectedEmptyStatus.value) return false;
    if (selectedLockStatus.value && item.lockStatus !== selectedLockStatus.value) return false;
    if (!q) return true;
    return [item.name, item.code, item.carrierBottomCode, item.typeName, item.region, item.mapName]
      .join('\n')
      .toLowerCase()
      .includes(q);
  });
});

function selectedDefaultTypeCode(): string {
  return warehouse.typeOptions[0]?.value ?? '';
}

function openCreate(): void {
  dialogMode.value = 'create';
  editingId.value = null;
  const defaultType = warehouse.findTypeByCode(selectedDefaultTypeCode()) ?? undefined;
  form.value = createEmptyWarehouseRackForm(defaultType);
}

function openView(record: WarehouseRackRecord): void {
  dialogMode.value = 'view';
  editingId.value = record.id;
  form.value = warehouseRackFormFromRecord(record);
}

function openEdit(record: WarehouseRackRecord): void {
  dialogMode.value = 'edit';
  editingId.value = record.id;
  form.value = warehouseRackFormFromRecord(record);
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
      await warehouse.createRack(form.value);
      toastSuccess('已新增货架');
    } else if (dialogMode.value === 'edit' && editingId.value) {
      await warehouse.updateRack(editingId.value, form.value);
      toastSuccess('已修改货架');
    }
    closeDialog();
  } catch (err) {
    toastError(err instanceof Error ? err.message : String(err), '货架列表');
  }
}

async function remove(record: WarehouseRackRecord): Promise<void> {
  if (!window.confirm(`删除货架 "${record.name}"？`)) return;
  try {
    await warehouse.deleteRack(record.id);
    toastSuccess('已删除货架');
  } catch (err) {
    toastError(err instanceof Error ? err.message : String(err), '货架列表');
  }
}

async function toggleEnabled(record: WarehouseRackRecord): Promise<void> {
  try {
    await warehouse.updateRack(record.id, {
      ...warehouseRackFormFromRecord(record),
      enabled: !record.enabled,
    });
  } catch (err) {
    toastError(err instanceof Error ? err.message : String(err), '货架列表');
  }
}
</script>

<template>
  <section class="warehouse-page">
    <form class="toolbar" @submit.prevent>
      <select v-model="selectedTypeCode" class="filter-select">
        <option value="">全部型号</option>
        <option v-for="option in warehouse.typeOptions" :key="option.value" :value="option.value">
          {{ option.label }}
        </option>
      </select>
      <select v-model="selectedEmptyStatus" class="filter-select">
        <option value="">空满状态</option>
        <option value="空">空</option>
        <option value="满">满</option>
      </select>
      <select v-model="selectedLockStatus" class="filter-select">
        <option value="">锁定状态</option>
        <option value="未锁定">未锁定</option>
        <option value="已锁定">已锁定</option>
      </select>
      <input v-model.trim="keyword" class="search-input" placeholder="货架编号 / 货架名称" />
      <button type="button" class="btn btn-primary" @click="openCreate">+ 新增货架</button>
    </form>

    <div class="table-panel">
      <table>
        <thead>
          <tr>
            <th>序号</th>
            <th>货架名称</th>
            <th>货架编号</th>
            <th>载具底码</th>
            <th>货架型号</th>
            <th>货架类型</th>
            <th>所属区域</th>
            <th>所在地图</th>
            <th>库位编号</th>
            <th>地图点位</th>
            <th>锁定状态</th>
            <th>空满状态</th>
            <th>所属车辆</th>
            <th>容器信息</th>
            <th>更新时间</th>
            <th>是否启用</th>
            <th>操作</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="(item, index) in filteredRacks" :key="item.id">
            <td>{{ index + 1 }}</td>
            <td>{{ item.name }}</td>
            <td>{{ item.code }}</td>
            <td>{{ item.carrierBottomCode || '-' }}</td>
            <td>{{ item.typeName }}</td>
            <td>{{ item.warehouseKind }}</td>
            <td>{{ item.region }}</td>
            <td>{{ item.mapName }}</td>
            <td>{{ item.storageCode || '-' }}</td>
            <td>{{ item.locationName || '-' }}</td>
            <td>{{ item.lockStatus }}</td>
            <td>{{ item.emptyStatus }}</td>
            <td>{{ item.vehicleName || '-' }}</td>
            <td>{{ item.containerInfo || '-' }}</td>
            <td>{{ item.updatedAt }}</td>
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
            <td class="actions">
              <button type="button" class="link" @click="openView(item)">查看</button>
              <button type="button" class="link link-warn" @click="openEdit(item)">修改</button>
              <button type="button" class="link link-danger" @click="remove(item)">删除</button>
            </td>
          </tr>
          <tr v-if="filteredRacks.length === 0">
            <td colspan="17" class="empty">暂无货架</td>
          </tr>
        </tbody>
      </table>
    </div>

    <div v-if="dialogMode" class="dialog-backdrop" role="presentation">
      <section class="dialog" role="dialog" aria-modal="true" aria-labelledby="rack-dialog-title">
        <header class="dialog-header">
          <h3 id="rack-dialog-title">{{ dialogTitle }}</h3>
          <button type="button" class="close-button" aria-label="关闭" @click="closeDialog">
            ×
          </button>
        </header>

        <form class="dialog-body" @submit.prevent="submitDialog">
          <div class="form-grid">
            <label>
              <span><b>*</b> 货架名称</span>
              <input v-model.trim="form.name" :disabled="readonlyMode" required />
            </label>
            <label>
              <span><b>*</b> 货架编号</span>
              <input v-model.trim="form.code" :disabled="readonlyMode" required />
            </label>
            <label>
              <span>载具底码</span>
              <input v-model.trim="form.carrierBottomCode" :disabled="readonlyMode" />
            </label>
            <label>
              <span><b>*</b> 货架型号</span>
              <select v-model="form.typeCode" :disabled="readonlyMode" required>
                <option value="">请选择</option>
                <option
                  v-for="option in warehouse.typeOptions"
                  :key="option.value"
                  :value="option.value"
                >
                  {{ option.label }}
                </option>
              </select>
            </label>
            <label>
              <span><b>*</b> 所在地图</span>
              <input v-model.trim="form.mapName" :disabled="readonlyMode" required />
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
.filter-select,
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
  width: min(16rem, 100%);
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
  min-width: 110rem;
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
  align-items: center;
  justify-content: center;
  background: rgba(246, 248, 250, 0.5);
}

.dialog {
  width: min(28rem, calc(100vw - 2rem));
  max-height: calc(100vh - 2rem);
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
  grid-template-columns: 1fr;
  gap: 0.9rem;
  padding: 0.5rem 2rem 1.5rem;
}

label {
  min-width: 0;
  display: grid;
  grid-template-columns: 6.5rem minmax(0, 1fr);
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
</style>


