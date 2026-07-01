// SPDX-FileCopyrightText: The openTCS Authors
// SPDX-License-Identifier: MIT

import { describe, expect, it } from 'vitest';

import type { TransportOrder, Vehicle } from '@/api/types/bff';
import {
  activeOrderForVehicle,
  availableVehicleGroups,
  buildVehicleMonitorRows,
  categoriesForVehicle,
  filterVehicleMonitorRows,
  vehicleHomeUrl,
  vehicleMonitorCounts,
} from '@/domain/vehicles/monitor';

function vehicle(overrides: Partial<Vehicle> = {}): Vehicle {
  return {
    name: 'DP001',
    state: 'IDLE',
    procState: 'IDLE',
    integrationLevel: 'TO_BE_UTILIZED',
    paused: false,
    energyLevel: 80,
    currentPosition: 'P1',
    properties: {},
    ...overrides,
  };
}

function order(overrides: Partial<TransportOrder> = {}): TransportOrder {
  return {
    name: 'order-1',
    type: '-',
    state: 'BEING_PROCESSED',
    intendedVehicle: null,
    processingVehicle: 'DP001',
    destinations: [],
    ...overrides,
  };
}

describe('vehicle monitor domain helpers', () => {
  it('maps BFF DTO fields into monitor categories without inventing unavailable states', () => {
    expect(categoriesForVehicle(vehicle({ state: 'CHARGING' }), null)).toContain('charging');
    expect(categoriesForVehicle(vehicle({ paused: true }), null)).toContain('paused');
    expect(categoriesForVehicle(vehicle({ state: 'ERROR' }), null)).toContain('error');
    expect(categoriesForVehicle(vehicle({ state: 'UNAVAILABLE' }), null)).toContain('offline');
    expect(categoriesForVehicle(vehicle({ integrationLevel: 'TO_BE_IGNORED' }), null)).toContain(
      'disabled',
    );
    expect(categoriesForVehicle(vehicle({ state: 'IDLE', procState: 'IDLE' }), null)).toContain(
      'waiting',
    );

    const plain = categoriesForVehicle(vehicle(), null);
    expect(plain).not.toContain('confirming');
    expect(plain).not.toContain('debugging');
    expect(plain).not.toContain('transferring');
    expect(plain).not.toContain('blocked');
  });

  it('uses active transport orders when classifying working vehicles', () => {
    const v = vehicle({ name: 'DP002', state: 'IDLE', procState: 'IDLE' });
    const active = order({ processingVehicle: 'DP002', state: 'BEING_PROCESSED' });
    const finished = order({ name: 'done', processingVehicle: 'DP002', state: 'FINISHED' });

    expect(activeOrderForVehicle(v, [finished])).toBeNull();
    expect(activeOrderForVehicle(v, [finished, active])).toBe(active);
    expect(categoriesForVehicle(v, active)).toContain('working');
    expect(categoriesForVehicle(v, active)).not.toContain('waiting');
  });

  it('counts and filters rows by category, group, name and position', () => {
    const rows = buildVehicleMonitorRows(
      [
        vehicle({ name: 'DP001', state: 'CHARGING', properties: { group: 'A' } }),
        vehicle({ name: 'DP002', state: 'ERROR', properties: { group: 'B' } }),
        vehicle({ name: 'CAR-3', currentPosition: 'Dock-9', properties: { group: 'A' } }),
      ],
      [],
    );

    expect(vehicleMonitorCounts(rows).all).toBe(3);
    expect(vehicleMonitorCounts(rows).charging).toBe(1);
    expect(vehicleMonitorCounts(rows).error).toBe(1);
    expect(availableVehicleGroups(rows)).toEqual(['A', 'B']);
    expect(
      filterVehicleMonitorRows(rows, 'all', 'dock', '').map((row) => row.vehicle.name),
    ).toEqual(['CAR-3']);
    expect(filterVehicleMonitorRows(rows, 'all', '', 'A').map((row) => row.vehicle.name)).toEqual([
      'CAR-3',
      'DP001',
    ]);
  });

  it('resolves vehicle homepage URL from existing properties', () => {
    expect(vehicleHomeUrl(vehicle())).toBeNull();
    expect(vehicleHomeUrl(vehicle({ properties: { ip: '10.0.0.8' } }))).toBe('http://10.0.0.8');
    expect(vehicleHomeUrl(vehicle({ properties: { homepageUrl: 'https://agv.local' } }))).toBe(
      'https://agv.local',
    );
  });
});
