import { describe, expect, it } from 'vitest';

import type { TransportOrder, Vehicle } from '@/api/types/bff';

import {
  DEFAULT_CHARGING_PILE_RECORD,
  projectChargingPileRecord,
  type ChargingPileRecord,
} from './chargingPile';

function chargingPileRecord(overrides: Partial<ChargingPileRecord> = {}): ChargingPileRecord {
  return {
    ...DEFAULT_CHARGING_PILE_RECORD,
    id: 'cp-001',
    name: 'CP-A01',
    region: '深圳焊装',
    mapName: 'HZ27',
    boundPointName: 'Point-1',
    locationName: 'CP-A01',
    runtimeStatus: 'UNKNOWN',
    occupancyStatus: 'FREE',
    occupiedByVehicle: '',
    activeOrderName: '',
    chargingSince: '',
    requiresPublish: false,
    updatedAt: '2026-09-01 10:00:00',
    ...overrides,
  };
}

function chargeOrder(overrides: Partial<TransportOrder> = {}): TransportOrder {
  return {
    name: 'TO-01',
    type: 'BYD_CREATE_TASK',
    state: 'ACTIVE',
    intendedVehicle: 'AGV-01',
    processingVehicle: null,
    destinations: [{ locationName: 'CP-A01', operation: 'CHARGE' }],
    ...overrides,
  };
}

function chargingVehicle(overrides: Partial<Vehicle> = {}): Vehicle {
  return {
    name: 'AGV-01',
    state: 'CHARGING',
    procState: 'PROCESSING_ORDER',
    integrationLevel: 'TO_BE_UTILIZED',
    paused: false,
    energyLevel: 80,
    currentPosition: 'Point-1',
    ...overrides,
  };
}

describe('chargingPile runtime projection', () => {
  it('projects occupancy and runtime transitions from live kernel state', () => {
    const base = chargingPileRecord();

    const occupied = projectChargingPileRecord(base, [chargeOrder()], []);
    expect(occupied.occupancyStatus).toBe('OCCUPIED');
    expect(occupied.runtimeStatus).toBe('IDLE');
    expect(occupied.occupiedByVehicle).toBe('AGV-01');
    expect(occupied.activeOrderName).toBe('TO-01');
    expect(occupied.chargingSince).not.toBe('');

    const charging = projectChargingPileRecord(occupied, [chargeOrder()], [chargingVehicle()]);
    expect(charging.occupancyStatus).toBe('OCCUPIED');
    expect(charging.runtimeStatus).toBe('CHARGING');
    expect(charging.chargingSince).toBe(occupied.chargingSince);

    const releasedWhileVehicleStillPresent = projectChargingPileRecord(
        charging,
        [],
        [chargingVehicle()]
    );
    expect(releasedWhileVehicleStillPresent.occupancyStatus).toBe('OCCUPIED');
    expect(releasedWhileVehicleStillPresent.runtimeStatus).toBe('CHARGING');
    expect(releasedWhileVehicleStillPresent.activeOrderName).toBe('TO-01');

    const released = projectChargingPileRecord(releasedWhileVehicleStillPresent, [], []);
    expect(released).toEqual(releasedWhileVehicleStillPresent);
  });

  it('keeps untouched free records unchanged', () => {
    const base = chargingPileRecord();

    expect(projectChargingPileRecord(base, [], [])).toEqual(base);
  });
});
