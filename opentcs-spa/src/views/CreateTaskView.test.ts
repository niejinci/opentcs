import { flushPromises, mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { ChargingPile, TransportOrder } from '@/api/types/bff';

const routerMocks = vi.hoisted(() => ({
  push: vi.fn(),
  replace: vi.fn(),
}));

vi.mock('vue-router', () => ({
  RouterLink: {
    name: 'RouterLink',
    props: ['to'],
    template: '<a><slot /></a>',
  },
  useRoute: () => ({ params: {}, query: {} }),
  useRouter: () => routerMocks,
}));

vi.mock('@/api/endpoints/projects', () => ({
  listProjects: vi.fn(),
  createProject: vi.fn(),
  getProject: vi.fn(),
  renameProject: vi.fn(),
  deleteProject: vi.fn(),
  copyProject: vi.fn(),
  getDraft: vi.fn(),
  putDraft: vi.fn(),
}));

vi.mock('@/api/endpoints/charging', () => ({
  listChargingPiles: vi.fn(),
  createChargingPile: vi.fn(),
  updateChargingPile: vi.fn(),
  deleteChargingPile: vi.fn(),
}));

vi.mock('@/api/endpoints/transportOrders', () => ({
  createTransportOrder: vi.fn(),
}));

vi.mock('@/ui/toast/toastBus', () => ({
  toastError: vi.fn(),
  toastSuccess: vi.fn(),
  toastWarning: vi.fn(),
}));

import { listChargingPiles } from '@/api/endpoints/charging';
import { getDraft, getProject } from '@/api/endpoints/projects';
import { createTransportOrder } from '@/api/endpoints/transportOrders';
import { toastError } from '@/ui/toast/toastBus';
import CreateTaskView from './CreateTaskView.vue';

const listChargingPilesMock = vi.mocked(listChargingPiles);
const getProjectMock = vi.mocked(getProject);
const getDraftMock = vi.mocked(getDraft);
const createTransportOrderMock = vi.mocked(createTransportOrder);
const toastErrorMock = vi.mocked(toastError);

function chargingPile(overrides: Partial<ChargingPile> = {}): ChargingPile {
  return {
    id: 'cp-001',
    name: '充电桩-A01',
    region: '深圳焊装',
    mapName: 'HZ27',
    boundPointName: 'Point-1',
    locationName: 'CP-A01',
    locationTypeName: 'CHARGER',
    operation: 'CHARGE',
    chargerType: '',
    sn: '',
    ip: '',
    enabled: true,
    runtimeStatus: 'IDLE',
    occupancyStatus: 'FREE',
    occupiedByVehicle: '',
    activeOrderName: '',
    chargingSince: '',
    requiresPublish: false,
    updatedAt: '',
    ...overrides,
  };
}

function draftPayload() {
  return {
    v: 2,
    points: [
      {
        name: 'Point-1',
        type: 'HALT_POSITION',
        pose: { position: { x: 0, y: 0, z: 0 }, orientationAngle: 0 },
        layout: { pixelX: 0, pixelY: 0 },
        properties: {},
      },
    ],
    paths: [],
    locationTypes: [
      {
        name: 'CHARGER',
        allowedOperations: ['CHARGE'],
        allowedPeripheralOperations: [],
        layout: { locationRepresentation: 'RECHARGE_GENERIC' },
        properties: {},
      },
      {
        name: 'WORK',
        allowedOperations: ['CHARGE'],
        allowedPeripheralOperations: [],
        layout: { locationRepresentation: 'DEFAULT' },
        properties: {},
      },
    ],
    locations: [
      {
        name: 'CP-A01',
        typeName: 'CHARGER',
        position: { x: 0, y: 0, z: 0 },
        locked: false,
        links: [{ pointName: 'Point-1', allowedOperations: ['CHARGE'] }],
        layout: { pixelX: 0, pixelY: 0, locationRepresentation: 'RECHARGE_GENERIC' },
        properties: {},
      },
      {
        name: 'Work-1',
        typeName: 'WORK',
        position: { x: 0, y: 0, z: 0 },
        locked: false,
        links: [{ pointName: 'Point-1', allowedOperations: ['CHARGE'] }],
        layout: { pixelX: 0, pixelY: 0, locationRepresentation: 'DEFAULT' },
        properties: {},
      },
    ],
    blocks: [],
    vehicles: [],
    selection: null,
  };
}

async function mountView() {
  const pinia = createPinia();
  setActivePinia(pinia);
  const wrapper = mount(CreateTaskView, {
    props: { projectId: 'project-hz27' },
    global: {
      plugins: [pinia],
      stubs: {
        TaskMapPanel: true,
        TaskParamDialog: true,
      },
    },
  });
  await flushPromises();
  return wrapper;
}

async function selectChargeTaskTarget(wrapper: Awaited<ReturnType<typeof mountView>>): Promise<void> {
  await wrapper.find('select[aria-label^="任务类型"]').setValue('charge');
  await flushPromises();
  const targetOptions = wrapper.findAll('select[aria-label="目标点位"] option');
  expect(targetOptions.map((option) => option.text())).toEqual([
    '请选择',
    'CP-A01（NOP / CHARGE）',
  ]);
  await wrapper.find('select[aria-label="目标点位"]').setValue('CP-A01');
  await flushPromises();
}

describe('CreateTaskView charging task guards', () => {
  beforeEach(() => {
    localStorage.clear();
    setActivePinia(createPinia());
    vi.clearAllMocks();
    routerMocks.push.mockReset();
    routerMocks.replace.mockReset();
    getProjectMock.mockResolvedValue({
      id: 'project-hz27',
      name: 'HZ27',
      createdAt: '2026-09-01T00:00:00Z',
      updatedAt: '2026-09-01T00:00:00Z',
      hasDraft: true,
      assets: [],
      lastPublishedAt: '2026-09-01T00:00:00Z',
    });
    getDraftMock.mockResolvedValue({
      version: 1,
      payload: draftPayload(),
    });
    createTransportOrderMock.mockResolvedValue({
      name: 'order-1',
      type: 'BYD_CREATE_TASK',
      state: 'RAW',
      intendedVehicle: null,
      processingVehicle: null,
      destinations: [],
    } satisfies TransportOrder);
  });

  it('creates charge orders with the unified CHARGE operation', async () => {
    listChargingPilesMock.mockResolvedValue([chargingPile({ requiresPublish: true })]);
    const wrapper = await mountView();

    await selectChargeTaskTarget(wrapper);
    await wrapper.get('button.primary-button').trigger('click');
    await flushPromises();

    expect(createTransportOrderMock).toHaveBeenCalledWith(
      expect.objectContaining({
        destinations: [
          expect.objectContaining({
            locationName: 'CP-A01',
            operation: 'CHARGE',
          }),
        ],
      }),
      { toastOnError: false },
    );
  });

  it('refreshes charging pile occupancy before submit and blocks occupied targets', async () => {
    listChargingPilesMock
      .mockResolvedValueOnce([chargingPile()])
      .mockResolvedValueOnce([
        chargingPile({
          runtimeStatus: 'CHARGING',
          occupancyStatus: 'OCCUPIED',
          occupiedByVehicle: 'AGV-01',
          activeOrderName: 'TO-01',
        }),
      ]);
    const wrapper = await mountView();

    await selectChargeTaskTarget(wrapper);
    await wrapper.get('button.primary-button').trigger('click');
    await flushPromises();

    expect(createTransportOrderMock).not.toHaveBeenCalled();
    expect(toastErrorMock).toHaveBeenCalledWith(
      expect.stringContaining('充电桩-A01 已被车辆 AGV-01 占用充电（订单 TO-01）'),
      '创建任务校验失败',
    );
  });

  it('blocks charge orders when the project has not been published yet', async () => {
    getProjectMock.mockResolvedValue({
      id: 'project-hz27',
      name: 'HZ27',
      createdAt: '2026-09-01T00:00:00Z',
      updatedAt: '2026-09-01T00:00:00Z',
      hasDraft: true,
      assets: [],
    });
    listChargingPilesMock.mockResolvedValue([chargingPile()]);
    const wrapper = await mountView();

    await selectChargeTaskTarget(wrapper);
    await wrapper.get('button.primary-button').trigger('click');
    await flushPromises();

    expect(createTransportOrderMock).not.toHaveBeenCalled();
    expect(toastErrorMock).toHaveBeenCalledWith(
      expect.stringContaining('充电桩-A01 尚未发布到 Kernel，请先发布工程模型'),
      '创建任务校验失败',
    );
  });
});
