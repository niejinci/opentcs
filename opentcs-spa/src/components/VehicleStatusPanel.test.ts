// SPDX-FileCopyrightText: The openTCS Authors
// SPDX-License-Identifier: MIT
//
// Smoke tests for the new VehicleStatusPanel (PR3 / acceptance 3.4 + 3.8).
// Verifies the empty-state placeholder and that vehicles supplied through
// the live-status store render with all required columns.

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';

import type { Vehicle } from '@/api/types/bff';

vi.mock('@/api/endpoints/sseEvents', () => ({
  openLiveStatusStream: () => ({
    connect: () => {},
    close: () => {},
    getState: () => 'idle',
  }),
}));
vi.mock('@/api/endpoints/vehicles', () => ({
  listVehicles: () => Promise.resolve([]),
}));

import VehicleStatusPanel from '@/components/VehicleStatusPanel.vue';
import { useLiveStatusStore } from '@/stores/liveStatus';

function vehicle(overrides: Partial<Vehicle> = {}): Vehicle {
  return {
    name: 'V-1',
    state: 'IDLE',
    procState: 'IDLE',
    integrationLevel: 'TO_BE_RESPECTED',
    paused: false,
    energyLevel: 80,
    currentPosition: 'Point-1',
    ...overrides,
  };
}

describe('VehicleStatusPanel', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  it('renders the empty placeholder when no vehicles are known (3.8)', () => {
    const wrapper = mount(VehicleStatusPanel);
    expect(wrapper.text()).toContain('暂无车辆');
    expect(wrapper.find('table').exists()).toBe(false);
  });

  it('renders all required columns and reacts to store updates (3.4 / 3.5 / 3.6)', async () => {
    const store = useLiveStatusStore();
    const wrapper = mount(VehicleStatusPanel);

    // Seed two vehicles via the store (mimicking SSE having delivered them).
    store.vehicles = {
      'V-1': vehicle({ name: 'V-1', state: 'EXECUTING', currentPosition: 'Point-1' }),
      'V-2': vehicle({
        name: 'V-2',
        state: 'CHARGING',
        integrationLevel: 'TO_BE_UTILIZED',
        paused: true,
        energyLevel: 23,
        currentPosition: null,
      }),
    };
    await wrapper.vm.$nextTick();

    const headers = wrapper.findAll('thead th').map((th) => th.text());
    expect(headers).toEqual(['名称', '状态', '运行', '集成级别', '当前点位', '电量', '暂停']);

    const rows = wrapper.findAll('tbody tr');
    expect(rows).toHaveLength(2);
    expect(rows[0].text()).toContain('V-1');
    expect(rows[0].text()).toContain('EXECUTING');
    expect(rows[0].text()).toContain('Point-1');
    expect(rows[0].text()).toContain('80%');

    expect(rows[1].text()).toContain('V-2');
    expect(rows[1].text()).toContain('CHARGING');
    // currentPosition null → em-dash placeholder.
    expect(rows[1].text()).toContain('—');
    expect(rows[1].text()).toContain('23%');
    expect(rows[1].text()).toContain('是'); // paused == true

    // 3.6: position update should propagate without a manual refresh.
    store.vehicles = {
      ...store.vehicles,
      'V-1': vehicle({ name: 'V-1', state: 'EXECUTING', currentPosition: 'Point-9' }),
    };
    await wrapper.vm.$nextTick();
    expect(wrapper.findAll('tbody tr')[0].text()).toContain('Point-9');
  });
});
