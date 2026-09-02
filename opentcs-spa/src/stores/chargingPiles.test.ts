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
import { getDraft, listProjects, putDraft } from '@/api/endpoints/projects';
import { useLiveStatusStore } from '@/stores/liveStatus';
import { useProjectStore } from '@/stores/project';
import { useProjectsStore } from '@/stores/projects';
import { useChargingPilesStore } from './chargingPiles';

vi.mock('@/api/endpoints/charging', () => ({
  listChargingPiles: vi.fn(),
  createChargingPile: vi.fn(),
  updateChargingPile: vi.fn(),
  deleteChargingPile: vi.fn(),
}));

vi.mock('@/api/endpoints/projects', () => ({
  listProjects: vi.fn(),
  getDraft: vi.fn(),
  putDraft: vi.fn(),
}));

const listProjectsMock = vi.mocked(listProjects);
const getDraftMock = vi.mocked(getDraft);
const putDraftMock = vi.mocked(putDraft);

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

function draftPoint(name: string, pixelX: number, pixelY: number) {
  return {
    name,
    type: 'HALT_POSITION' as const,
    pose: {
      position: { x: pixelX * 100, y: pixelY * 100, z: 0 },
      orientationAngle: 0,
    },
    layout: { pixelX, pixelY },
    properties: {},
  };
}

function draftPayload(points = ['P-CHARGE-A01', 'P-CHARGE-B01']) {
  return {
    v: 2,
    points: points.map((name, index) => draftPoint(name, 100 + index * 40, 200)),
    paths: [],
    locationTypes: [],
    locations: [],
    blocks: [],
    vehicles: [],
    selection: null,
  };
}

describe('charging piles store', () => {
  beforeEach(() => {
    localStorage.clear();
    setActivePinia(createPinia());
    vi.restoreAllMocks();
    listProjectsMock.mockReset().mockResolvedValue([
      { id: 'project-hz27', name: 'HZ27', updatedAt: '2026-08-31 09:00:00', hasDraft: true },
    ]);
    getDraftMock.mockReset().mockResolvedValue({
      version: 1,
      payload: draftPayload(),
    });
    putDraftMock.mockReset().mockResolvedValue(undefined);
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

  it('projects live charge orders onto charging-pile occupancy', async () => {
    vi.mocked(listChargingPiles).mockResolvedValue([pile({ occupancyStatus: 'FREE' })]);
    const live = useLiveStatusStore();
    const store = useChargingPilesStore();

    await store.refresh();
    expect(store.piles[0]?.occupancyStatus).toBe('FREE');

    live.recordCreatedOrder({
      name: 'TO-CHARGE-01',
      type: '-',
      state: 'RAW',
      intendedVehicle: 'AGV-01',
      processingVehicle: null,
      destinations: [{ locationName: 'CP-A01', operation: 'CHARGE' }],
    });

    expect(store.piles[0]?.occupancyStatus).toBe('OCCUPIED');
    expect(store.piles[0]?.occupiedByVehicle).toBe('AGV-01');
    expect(store.piles[0]?.activeOrderName).toBe('TO-CHARGE-01');

    await store.refresh();
    expect(store.piles[0]?.occupancyStatus).toBe('OCCUPIED');
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
    expect(putDraftMock).toHaveBeenCalledWith(
      'project-hz27',
      expect.objectContaining({
        payload: expect.objectContaining({
          locationTypes: [
            expect.objectContaining({
              name: 'CHARGER',
              allowedOperations: ['CHARGE'],
            }),
          ],
          locations: [
            expect.objectContaining({
              name: 'CP-B01',
              typeName: 'CHARGER',
              locked: false,
              links: [{ pointName: 'P-CHARGE-B01', allowedOperations: ['CHARGE'] }],
            }),
          ],
          blocks: [
            expect.objectContaining({
              name: 'Block-CP-B01',
              type: 'SINGLE_VEHICLE_ONLY',
              memberNames: ['P-CHARGE-B01', 'CP-B01'],
            }),
          ],
        }),
      }),
      { toastOnError: false },
    );
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

  it('rejects a stale bound point from the latest server draft before creating', async () => {
    const projects = useProjectsStore();
    const projectStore = useProjectStore();
    projects.currentId = 'project-hz27';
    projectStore.hydrateDraftPayload(draftPayload(['Point-34']));
    getDraftMock.mockResolvedValueOnce({
      version: 1,
      payload: draftPayload(['P-OTHER']),
    });
    const store = useChargingPilesStore();

    await expect(
      store.create(
        form({
          name: 'CP-34',
          boundPointName: 'Point-34',
        }),
      ),
    ).rejects.toThrow('绑定点位 Point-34 不存在于工程 HZ27');

    expect(createChargingPile).not.toHaveBeenCalled();
    expect(putDraftMock).not.toHaveBeenCalled();
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
    expect(putDraftMock).toHaveBeenLastCalledWith(
      'project-hz27',
      expect.objectContaining({
        payload: expect.objectContaining({
          locations: [
            expect.objectContaining({
              name: 'CP-A01',
              locked: true,
            }),
          ],
        }),
      }),
      { toastOnError: false },
    );

    await store.remove('cp-001');
    expect(deleteChargingPile).toHaveBeenCalledWith('cp-001');
    expect(store.piles).toHaveLength(0);
  });
});
