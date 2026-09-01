import { createPinia, setActivePinia } from 'pinia';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { ChargingPile } from '@/api/types/bff';
import {
  createEmptyChargingPileForm,
  type ChargingPileFormData,
} from '@/domain/charging/chargingPile';
import {
  createChargingPile,
  deleteChargingPile,
  listChargingPiles,
  updateChargingPile,
} from '@/api/endpoints/charging';
import { useChargingPilesStore } from './chargingPiles';

vi.mock('@/api/endpoints/charging', () => ({
  listChargingPiles: vi.fn(),
  createChargingPile: vi.fn(),
  updateChargingPile: vi.fn(),
  deleteChargingPile: vi.fn(),
}));

function pile(overrides: Partial<ChargingPile> = {}): ChargingPile {
  return {
    id: 'cp-001',
    name: 'CP-A01',
    region: '深圳焊装',
    mapName: 'HZ27',
    boundPointName: 'P-CHARGE-A01',
    locationName: 'CP-A01',
    locationTypeName: 'CHARGER',
    operation: 'CHARGE',
    chargerType: '直流快充',
    sn: 'SN-001',
    ip: '192.168.10.11',
    enabled: true,
    runtimeStatus: 'CHARGING',
    occupancyStatus: 'OCCUPIED',
    occupiedByVehicle: 'AGV-01',
    activeOrderName: 'TO-01',
    chargingSince: '2026-08-31 08:00:00',
    requiresPublish: true,
    updatedAt: '2026-08-31 10:00:00',
    ...overrides,
  };
}

function form(overrides: Partial<ChargingPileFormData> = {}): ChargingPileFormData {
  return {
    ...createEmptyChargingPileForm(),
    name: 'CP-B01',
    region: '深圳焊装',
    mapName: 'HZ27',
    boundPointName: 'P-CHARGE-B01',
    chargerType: '快充',
    sn: 'SN-002',
    ip: '192.168.10.12',
    ...overrides,
  };
}

describe('charging piles store', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.restoreAllMocks();
    vi.mocked(listChargingPiles).mockReset().mockResolvedValue([pile()]);
    vi.mocked(createChargingPile).mockReset().mockImplementation(async (payload) => ({
      ...payload,
      id: 'cp-002',
      updatedAt: '2026-08-31 11:00:00',
    }));
    vi.mocked(updateChargingPile).mockReset().mockImplementation(async (_id, payload) => ({
      ...payload,
      id: 'cp-001',
      occupancyStatus: payload.enabled ? 'FREE' : 'DISABLED',
      occupiedByVehicle: payload.enabled ? payload.occupiedByVehicle ?? '' : '',
      activeOrderName: payload.enabled ? payload.activeOrderName ?? '' : '',
      chargingSince: payload.enabled ? payload.chargingSince ?? '' : '',
      updatedAt: '2026-08-31 11:30:00',
    }));
    vi.mocked(deleteChargingPile).mockReset().mockResolvedValue(undefined);
  });

  it('loads charging piles from the BFF and exposes normalized records', async () => {
    const store = useChargingPilesStore();

    await store.refresh();

    expect(listChargingPiles).toHaveBeenCalledOnce();
    expect(store.piles[0]?.name).toBe('CP-A01');
    expect(store.piles[0]?.occupancyStatus).toBe('OCCUPIED');
    expect(store.enabledCount).toBe(1);
    expect(store.occupiedCount).toBe(1);
  });

  it('creates charging piles with local defaults and inserts the created record first', async () => {
    vi.mocked(listChargingPiles).mockResolvedValue([]);
    const store = useChargingPilesStore();

    const created = await store.create(form());

    expect(createChargingPile).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'CP-B01',
        region: '深圳焊装',
        mapName: 'HZ27',
        boundPointName: 'P-CHARGE-B01',
        locationName: 'CP-B01',
        locationTypeName: 'CHARGER',
        operation: 'CHARGE',
        enabled: true,
      }),
    );
    expect(created.id).toBe('cp-002');
    expect(store.piles[0]?.id).toBe('cp-002');
  });

  it('rejects duplicated names before calling the API', async () => {
    const store = useChargingPilesStore();
    await store.refresh();

    await expect(
      store.create(
        form({
          name: 'CP-A01',
          boundPointName: 'P-CHARGE-B02',
        }),
      ),
    ).rejects.toThrow('充电桩名称 CP-A01 已存在');
    expect(createChargingPile).not.toHaveBeenCalled();
  });

  it('toggles enabled state and deletes records through the API', async () => {
    const store = useChargingPilesStore();
    await store.refresh();

    await store.toggleEnabled('cp-001', false);
    expect(updateChargingPile).toHaveBeenCalledWith(
      'cp-001',
      expect.objectContaining({
        enabled: false,
        runtimeStatus: 'CHARGING',
        occupancyStatus: 'OCCUPIED',
        occupiedByVehicle: 'AGV-01',
      }),
    );
    expect(store.piles[0]?.enabled).toBe(false);
    expect(store.piles[0]?.occupancyStatus).toBe('DISABLED');

    await store.remove('cp-001');
    expect(deleteChargingPile).toHaveBeenCalledWith('cp-001');
    expect(store.piles).toHaveLength(0);
  });
});
