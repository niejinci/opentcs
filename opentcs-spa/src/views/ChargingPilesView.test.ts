import { flushPromises, mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { ChargingPile } from '@/api/types/bff';

vi.mock('@/api/endpoints/charging', () => ({
  listChargingPiles: vi.fn(),
  createChargingPile: vi.fn(),
  updateChargingPile: vi.fn(),
  deleteChargingPile: vi.fn(),
}));

vi.mock('@/api/endpoints/projects', () => ({
  listProjects: vi.fn(),
  getProject: vi.fn(),
  getDraft: vi.fn(),
}));

import {
  createChargingPile,
  deleteChargingPile,
  listChargingPiles,
  updateChargingPile,
} from '@/api/endpoints/charging';
import { getDraft, listProjects } from '@/api/endpoints/projects';
import ChargingPilesView from './ChargingPilesView.vue';

const listChargingPilesMock = vi.mocked(listChargingPiles);
const createChargingPileMock = vi.mocked(createChargingPile);
const updateChargingPileMock = vi.mocked(updateChargingPile);
const deleteChargingPileMock = vi.mocked(deleteChargingPile);
const listProjectsMock = vi.mocked(listProjects);
const getDraftMock = vi.mocked(getDraft);

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

describe('ChargingPilesView', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.restoreAllMocks();
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    listProjectsMock.mockReset().mockResolvedValue([
      { id: 'project-hz27', name: 'HZ27', updatedAt: '2026-08-31 09:00:00', hasDraft: true },
      { id: 'project-hz88', name: 'HZ88', updatedAt: '2026-08-31 09:30:00', hasDraft: true },
    ]);
    getDraftMock.mockReset().mockImplementation(async (id: string) => {
      if (id === 'project-hz88') {
        return {
          version: 1,
          payload: {
            points: [{ name: 'P-CHARGE-B01' }, { name: 'P-CHARGE-B02' }],
          },
        };
      }
      return {
        version: 1,
        payload: {
          points: [{ name: 'P-CHARGE-A01' }, { name: 'P-CHARGE-A02' }],
        },
      };
    });
    listChargingPilesMock.mockReset().mockResolvedValue([
      pile(),
      pile({
        id: 'cp-002',
        name: 'CP-A02',
        boundPointName: 'P-CHARGE-A02',
        sn: 'SN-002',
        ip: '192.168.10.12',
        enabled: false,
        runtimeStatus: 'IDLE',
        occupancyStatus: 'DISABLED',
        occupiedByVehicle: '',
        activeOrderName: '',
        chargingSince: '',
        updatedAt: '2026-08-31 11:00:00',
      }),
    ]);
    createChargingPileMock.mockReset().mockImplementation(async (payload) => ({
      ...payload,
      id: 'cp-003',
      updatedAt: '2026-08-31 12:00:00',
    }));
    updateChargingPileMock.mockReset().mockImplementation(async (_id, payload) => ({
      ...payload,
      id: 'cp-002',
      occupancyStatus: payload.enabled ? 'FREE' : 'DISABLED',
      occupiedByVehicle: payload.enabled ? payload.occupiedByVehicle ?? '' : '',
      activeOrderName: payload.enabled ? payload.activeOrderName ?? '' : '',
      chargingSince: payload.enabled ? payload.chargingSince ?? '' : '',
      updatedAt: '2026-08-31 12:10:00',
    }));
    deleteChargingPileMock.mockReset().mockResolvedValue(undefined);
  });

  it('renders rows, filters them, and toggles enabled state', async () => {
    const wrapper = mount(ChargingPilesView);
    await flushPromises();

    expect(wrapper.text()).toContain('CP-A01');
    expect(wrapper.text()).toContain('CP-A02');

    await wrapper
      .get('input[placeholder="名称 / 绑定点位 / SN / IP"]')
      .setValue('P-CHARGE-A02');
    await flushPromises();

    const rows = wrapper.findAll('tbody tr');
    expect(rows).toHaveLength(1);
    expect(rows[0].text()).toContain('CP-A02');

    const toggle = wrapper.get('tbody button.switch');
    await toggle.trigger('click');
    await flushPromises();

    expect(updateChargingPileMock).toHaveBeenCalledWith(
      'cp-002',
      expect.objectContaining({ enabled: true }),
    );
    expect(wrapper.get('tbody button.switch').classes()).toContain('switch--on');
  });

  it('opens the dialog and creates a charging pile', async () => {
    const wrapper = mount(ChargingPilesView);
    await flushPromises();

    await wrapper.get('button.btn.btn-primary').trigger('click');
    const dialog = wrapper.get('.dialog');
    const dialogSelects = dialog.findAll('select');
    const inputs = dialog.findAll('input');

    await inputs[0].setValue('CP-B01');
    await inputs[1].setValue('华东一区');
    await dialogSelects[0].setValue('HZ88');
    await flushPromises();
    expect(dialogSelects[1].text()).toContain('P-CHARGE-B01');
    expect(dialogSelects[1].text()).not.toContain('P-CHARGE-A01');
    await dialogSelects[1].setValue('P-CHARGE-B01');
    await inputs[2].setValue('直流快充');
    await inputs[3].setValue('SN-003');
    await inputs[4].setValue('192.168.10.13');

    await dialog.get('form').trigger('submit.prevent');
    await flushPromises();

    expect(createChargingPileMock).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'CP-B01',
        region: '华东一区',
        mapName: 'HZ88',
        boundPointName: 'P-CHARGE-B01',
        locationName: 'CP-B01',
        locationTypeName: 'CHARGER',
        operation: 'CHARGE',
        chargerType: '直流快充',
        sn: 'SN-003',
        ip: '192.168.10.13',
        enabled: true,
      }),
    );
    expect(wrapper.text()).toContain('CP-B01');
  });

  it('deletes a charging pile from the table', async () => {
    const wrapper = mount(ChargingPilesView);
    await flushPromises();

    await wrapper.findAll('tbody button.link-danger')[0].trigger('click');
    await flushPromises();

    expect(deleteChargingPileMock).toHaveBeenCalledWith('cp-001');
    expect(wrapper.text()).not.toContain('CP-A01');
  });
});
