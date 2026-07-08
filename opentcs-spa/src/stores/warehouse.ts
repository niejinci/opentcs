import { defineStore } from 'pinia';
import { computed, ref } from 'vue';

import {
  DEFAULT_WAREHOUSE_RACK,
  DEFAULT_WAREHOUSE_TYPE,
  isWarehouseRackCodeUsed,
  isWarehouseTypeCodeUsed,
  warehouseRackDtoToRecord,
  warehouseRackFormToDto,
  warehouseTypeDtoToRecord,
  warehouseTypeFormToDto,
  type WarehouseRackFormData,
  type WarehouseRackRecord,
  type WarehouseTypeFormData,
  type WarehouseTypeRecord,
} from '@/domain/warehouse/warehouse';
import {
  createWarehouseRack,
  createWarehouseType,
  deleteWarehouseRack,
  deleteWarehouseType,
  listWarehouseRacks,
  listWarehouseTypes,
  updateWarehouseRack,
  updateWarehouseType,
} from '@/api/endpoints/warehouse';
import type { RequestOptions } from '@/api/client';

export interface WarehouseTypeOption {
  label: string;
  value: string;
}

function cloneDefaultTypes(): WarehouseTypeRecord[] {
  return [{ ...DEFAULT_WAREHOUSE_TYPE }];
}

function cloneDefaultRacks(): WarehouseRackRecord[] {
  return [{ ...DEFAULT_WAREHOUSE_RACK }];
}

function normalizeTypeForm(form: WarehouseTypeFormData): WarehouseTypeFormData {
  return {
    ...form,
    code: form.code.trim(),
    name: form.name.trim(),
    region: form.region.trim(),
    containerType: form.containerType.trim(),
    rackShape: form.rackShape.trim(),
    boundVehicleModels: form.boundVehicleModels.trim(),
    pickupDirection: form.pickupDirection.trim(),
    entryDirection: form.entryDirection.trim(),
  };
}

function normalizeRackForm(form: WarehouseRackFormData): WarehouseRackFormData {
  return {
    ...form,
    name: form.name.trim(),
    code: form.code.trim(),
    carrierBottomCode: form.carrierBottomCode.trim(),
    region: form.region.trim(),
    mapName: form.mapName.trim(),
    storageCode: form.storageCode.trim(),
    locationName: form.locationName.trim(),
    vehicleName: form.vehicleName.trim(),
    containerInfo: form.containerInfo.trim(),
  };
}

export const useWarehouseStore = defineStore('warehouse', () => {
  const types = ref<WarehouseTypeRecord[]>(cloneDefaultTypes());
  const racks = ref<WarehouseRackRecord[]>(cloneDefaultRacks());
  const loading = ref(false);
  const loaded = ref(false);
  const lastError = ref<string | null>(null);

  const typeOptions = computed<WarehouseTypeOption[]>(() =>
    [...types.value]
      .sort((a, b) => a.name.localeCompare(b.name))
      .map((item) => ({ label: item.name, value: item.code })),
  );

  function findTypeByCode(code: string): WarehouseTypeRecord | null {
    const normalized = code.trim().toLowerCase();
    return types.value.find((item) => item.code.trim().toLowerCase() === normalized) ?? null;
  }

  function typeNameByCode(code: string): string {
    return findTypeByCode(code)?.name ?? '';
  }

  async function refreshTypes(options?: RequestOptions): Promise<void> {
    loading.value = true;
    try {
      const response = await listWarehouseTypes(options);
      types.value = response.map(warehouseTypeDtoToRecord);
      lastError.value = null;
    } catch (err) {
      lastError.value = err instanceof Error ? err.message : String(err);
      throw err;
    } finally {
      loading.value = false;
    }
  }

  async function refreshRacks(options?: RequestOptions): Promise<void> {
    loading.value = true;
    try {
      const response = await listWarehouseRacks(options);
      racks.value = response.map(warehouseRackDtoToRecord);
      lastError.value = null;
    } catch (err) {
      lastError.value = err instanceof Error ? err.message : String(err);
      throw err;
    } finally {
      loading.value = false;
    }
  }

  async function ensureLoaded(options?: RequestOptions): Promise<void> {
    if (loaded.value) return;
    await Promise.all([refreshTypes(options), refreshRacks(options)]);
    loaded.value = true;
  }

  async function createType(form: WarehouseTypeFormData): Promise<WarehouseTypeRecord> {
    const normalized = normalizeTypeForm(form);
    validateTypeForm(normalized);
    if (isWarehouseTypeCodeUsed(types.value, normalized.code)) {
      throw new Error(`型号编号 ${normalized.code} 已存在`);
    }
    const created = warehouseTypeDtoToRecord(
      await createWarehouseType(warehouseTypeFormToDto(normalized)),
    );
    types.value = [created, ...types.value];
    return created;
  }

  async function updateType(id: string, form: WarehouseTypeFormData): Promise<WarehouseTypeRecord> {
    const current = types.value.find((item) => item.id === id);
    if (!current) throw new Error('货架型号不存在');
    const normalized = normalizeTypeForm(form);
    validateTypeForm(normalized);
    if (isWarehouseTypeCodeUsed(types.value, normalized.code, id)) {
      throw new Error(`型号编号 ${normalized.code} 已存在`);
    }
    const updated = warehouseTypeDtoToRecord(
      await updateWarehouseType(id, warehouseTypeFormToDto(normalized, id)),
    );
    types.value = types.value.map((item) => (item.id === id ? updated : item));
    racks.value = racks.value.map((item) =>
      item.typeCode === current.code
        ? {
            ...item,
            typeCode: updated.code,
            typeName: updated.name,
            warehouseKind: updated.warehouseKind,
            region: updated.region,
          }
        : item,
    );
    return updated;
  }

  async function deleteType(id: string): Promise<void> {
    const current = types.value.find((item) => item.id === id);
    if (!current) return;
    if (racks.value.some((item) => item.typeCode === current.code)) {
      throw new Error('该货架型号已被货架列表引用，不能删除');
    }
    await deleteWarehouseType(id);
    types.value = types.value.filter((item) => item.id !== id);
  }

  async function createRack(form: WarehouseRackFormData): Promise<WarehouseRackRecord> {
    const normalized = normalizeRackForm(form);
    validateRackForm(normalized);
    if (isWarehouseRackCodeUsed(racks.value, normalized.code)) {
      throw new Error(`货架编号 ${normalized.code} 已存在`);
    }
    const type = findTypeByCode(normalized.typeCode);
    if (!type) throw new Error('请选择有效的货架型号');
    const created = warehouseRackDtoToRecord(
      await createWarehouseRack(warehouseRackFormToDto(normalized, type)),
    );
    racks.value = [created, ...racks.value];
    return created;
  }

  async function updateRack(id: string, form: WarehouseRackFormData): Promise<WarehouseRackRecord> {
    if (!racks.value.some((item) => item.id === id)) throw new Error('货架不存在');
    const normalized = normalizeRackForm(form);
    validateRackForm(normalized);
    if (isWarehouseRackCodeUsed(racks.value, normalized.code, id)) {
      throw new Error(`货架编号 ${normalized.code} 已存在`);
    }
    const type = findTypeByCode(normalized.typeCode);
    if (!type) throw new Error('请选择有效的货架型号');
    const updated = warehouseRackDtoToRecord(
      await updateWarehouseRack(id, warehouseRackFormToDto(normalized, type, id)),
    );
    racks.value = racks.value.map((item) => (item.id === id ? updated : item));
    return updated;
  }

  async function deleteRack(id: string): Promise<void> {
    await deleteWarehouseRack(id);
    racks.value = racks.value.filter((item) => item.id !== id);
  }

  function resetDefaults(): void {
    types.value = cloneDefaultTypes();
    racks.value = cloneDefaultRacks();
    loaded.value = false;
    lastError.value = null;
  }

  function validateTypeForm(form: WarehouseTypeFormData): void {
    if (!form.code || !form.name) {
      throw new Error('型号编号和型号名称不能为空');
    }
    const dimensions = [
      form.lengthMm,
      form.widthMm,
      form.heightMm,
      form.innerLengthMm,
      form.innerWidthMm,
      form.legHeightMm,
      form.legLengthMm,
      form.legWidthMm,
    ];
    if (dimensions.some((value) => !Number.isFinite(Number(value)) || Number(value) <= 0)) {
      throw new Error('货架尺寸参数必须为大于 0 的数字');
    }
  }

  function validateRackForm(form: WarehouseRackFormData): void {
    if (!form.code || !form.name) {
      throw new Error('货架编号和货架名称不能为空');
    }
    if (!form.mapName) {
      throw new Error('所在地图不能为空');
    }
  }

  return {
    types,
    racks,
    loading,
    loaded,
    lastError,
    typeOptions,
    findTypeByCode,
    typeNameByCode,
    refreshTypes,
    refreshRacks,
    ensureLoaded,
    createType,
    updateType,
    deleteType,
    createRack,
    updateRack,
    deleteRack,
    resetDefaults,
  };
});
