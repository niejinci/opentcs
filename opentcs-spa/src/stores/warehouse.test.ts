import { createPinia, setActivePinia } from 'pinia';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  DEFAULT_WAREHOUSE_RACK,
  DEFAULT_WAREHOUSE_TYPE,
  createEmptyWarehouseRackForm,
  warehouseRackFormToDto,
  warehouseTypeFormFromRecord,
  warehouseTypeFormToDto,
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
import { useWarehouseStore } from './warehouse';

vi.mock('@/api/endpoints/warehouse', () => ({
  listWarehouseTypes: vi.fn(),
  createWarehouseType: vi.fn(),
  updateWarehouseType: vi.fn(),
  deleteWarehouseType: vi.fn(),
  listWarehouseRacks: vi.fn(),
  createWarehouseRack: vi.fn(),
  updateWarehouseRack: vi.fn(),
  deleteWarehouseRack: vi.fn(),
}));

const defaultTypeDto = warehouseTypeFormToDto(
  warehouseTypeFormFromRecord(DEFAULT_WAREHOUSE_TYPE),
  DEFAULT_WAREHOUSE_TYPE.id,
);
const defaultRackDto = warehouseRackFormToDto(
  createEmptyWarehouseRackForm(DEFAULT_WAREHOUSE_TYPE),
  DEFAULT_WAREHOUSE_TYPE,
  DEFAULT_WAREHOUSE_RACK.id,
);

describe('warehouse store', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.mocked(listWarehouseTypes).mockResolvedValue([defaultTypeDto]);
    vi.mocked(listWarehouseRacks).mockResolvedValue([
      {
        ...defaultRackDto,
        id: DEFAULT_WAREHOUSE_RACK.id,
        name: DEFAULT_WAREHOUSE_RACK.name,
        code: DEFAULT_WAREHOUSE_RACK.code,
        carrierBottomCode: DEFAULT_WAREHOUSE_RACK.carrierBottomCode,
        updatedAt: DEFAULT_WAREHOUSE_RACK.updatedAt,
      },
    ]);
    vi.mocked(createWarehouseType).mockImplementation(async (payload) => ({ ...payload, Id: '30' }));
    vi.mocked(updateWarehouseType).mockImplementation(async (_id, payload) => payload);
    vi.mocked(deleteWarehouseType).mockResolvedValue(undefined);
    vi.mocked(createWarehouseRack).mockImplementation(async (payload) => ({
      ...payload,
      id: 'wr-test',
      updatedAt: '2026-07-07 10:00:00',
    }));
    vi.mocked(updateWarehouseRack).mockImplementation(async (_id, payload) => payload);
    vi.mocked(deleteWarehouseRack).mockResolvedValue(undefined);
  });

  it('seeds the BYD sample warehouse type for task parameter dropdowns', () => {
    const store = useWarehouseStore();

    expect(store.typeOptions).toContainEqual({
      label: DEFAULT_WAREHOUSE_TYPE.name,
      value: DEFAULT_WAREHOUSE_TYPE.code,
    });
  });

  it('loads warehouse types and racks from BFF JSON endpoints', async () => {
    const store = useWarehouseStore();

    await store.ensureLoaded({ toastOnError: false });

    expect(listWarehouseTypes).toHaveBeenCalledOnce();
    expect(listWarehouseRacks).toHaveBeenCalledOnce();
    expect(store.types[0]?.code).toBe('HJ27HDBMBZC');
    expect(store.racks[0]?.code).toBe(DEFAULT_WAREHOUSE_RACK.code);
  });

  it('creates warehouse types through the BYD WaresType DTO shape and rejects duplicate codes', async () => {
    const store = useWarehouseStore();

    const created = await store.createType({
      ...warehouseTypeFormFromRecord(DEFAULT_WAREHOUSE_TYPE),
      code: 'NEW-TYPE',
      name: '新货架型号',
    });

    expect(created.id).toBe('30');
    expect(createWarehouseType).toHaveBeenCalledWith(
      expect.objectContaining({
        Name: 'NEW-TYPE',
        WareModel: '新货架型号',
        PutHeight: 730,
        PickHeight: 270,
      }),
    );
    await expect(
      store.createType({
        ...warehouseTypeFormFromRecord(DEFAULT_WAREHOUSE_TYPE),
        code: 'NEW-TYPE',
        name: '重复型号',
      }),
    ).rejects.toThrow('已存在');
  });

  it('creates racks through the separate rack instance endpoint', async () => {
    const store = useWarehouseStore();

    await store.createRack({
      ...createEmptyWarehouseRackForm(store.types[0]),
      name: '测试货架001',
      code: 'TEST-RACK-001',
      region: '手动填写区域',
    });

    const rack = store.racks.find((item) => item.code === 'TEST-RACK-001');
    expect(rack?.region).toBe(DEFAULT_WAREHOUSE_TYPE.region);
    expect(rack?.warehouseKind).toBe(DEFAULT_WAREHOUSE_TYPE.warehouseKind);
    expect(createWarehouseRack).toHaveBeenCalledWith(
      expect.objectContaining({
        code: 'TEST-RACK-001',
        typeCode: DEFAULT_WAREHOUSE_TYPE.code,
        typeName: DEFAULT_WAREHOUSE_TYPE.name,
      }),
    );
  });
});

