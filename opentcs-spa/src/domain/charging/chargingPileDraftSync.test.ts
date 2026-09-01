import { describe, expect, it } from 'vitest';

import type {
  DraftBlock,
  DraftLocation,
  DraftLocationType,
  DraftPoint,
} from '@/domain/model/types';

import type { ChargingPileRecord } from './chargingPile';
import {
  CHARGING_PILE_DRAFT_MANAGED_BY,
  CHARGING_PILE_DRAFT_PROPERTY_KEYS,
  chargingPileBlockName,
  removeChargingPileDraftArtifacts,
  upsertChargingPileDraftArtifacts,
} from './chargingPileDraftSync';

function pile(overrides: Partial<ChargingPileRecord> = {}): ChargingPileRecord {
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
    runtimeStatus: 'IDLE',
    occupancyStatus: 'FREE',
    occupiedByVehicle: '',
    activeOrderName: '',
    chargingSince: '',
    requiresPublish: true,
    updatedAt: '2026-08-31 10:00:00',
    ...overrides,
  };
}

function point(name: string, pixelX: number, pixelY: number): DraftPoint {
  return {
    name,
    type: 'HALT_POSITION',
    pose: {
      position: { x: pixelX * 100, y: pixelY * 100, z: 0 },
      orientationAngle: 0,
    },
    layout: { pixelX, pixelY },
    properties: {},
  };
}

function draftPayload(overrides: Partial<Record<string, unknown>> = {}): Record<string, unknown> {
  return {
    v: 2,
    points: [point('P-CHARGE-A01', 120, 240), point('P-CHARGE-B01', 180, 260)],
    paths: [],
    locationTypes: [],
    locations: [],
    blocks: [],
    vehicles: [],
    selection: null,
    ...overrides,
  };
}

describe('charging pile draft sync', () => {
  it('creates a CHARGER LocationType, Location link and single-vehicle Block', () => {
    const next = upsertChargingPileDraftArtifacts(draftPayload(), pile());

    const locationTypes = next.locationTypes as DraftLocationType[];
    const locations = next.locations as DraftLocation[];
    const blocks = next.blocks as DraftBlock[];

    expect(locationTypes).toEqual([
      expect.objectContaining({
        name: 'CHARGER',
        allowedOperations: ['CHARGE'],
        allowedPeripheralOperations: [],
        layout: { locationRepresentation: 'RECHARGE_GENERIC' },
      }),
    ]);
    expect(locationTypes[0].properties).toMatchObject({
      [CHARGING_PILE_DRAFT_PROPERTY_KEYS.managedBy]: CHARGING_PILE_DRAFT_MANAGED_BY,
      [CHARGING_PILE_DRAFT_PROPERTY_KEYS.entityKind]: 'charging-pile-location-type',
    });
    expect(locations).toEqual([
      expect.objectContaining({
        name: 'CP-A01',
        typeName: 'CHARGER',
        position: { x: 12_000, y: 24_000, z: 0 },
        locked: false,
        links: [{ pointName: 'P-CHARGE-A01', allowedOperations: ['CHARGE'] }],
        layout: {
          pixelX: 120,
          pixelY: 240,
          locationRepresentation: 'RECHARGE_GENERIC',
        },
      }),
    ]);
    expect(locations[0].properties).toMatchObject({
      [CHARGING_PILE_DRAFT_PROPERTY_KEYS.pileId]: 'cp-001',
      [CHARGING_PILE_DRAFT_PROPERTY_KEYS.boundPointName]: 'P-CHARGE-A01',
      [CHARGING_PILE_DRAFT_PROPERTY_KEYS.enabled]: 'true',
    });
    expect(blocks).toEqual([
      expect.objectContaining({
        name: 'Block-CP-A01',
        type: 'SINGLE_VEHICLE_ONLY',
        memberNames: ['P-CHARGE-A01', 'CP-A01'],
      }),
    ]);
  });

  it('moves an existing managed Location and Block when the bound point changes', () => {
    const previous = pile();
    const initial = upsertChargingPileDraftArtifacts(draftPayload(), previous);
    const updated = pile({
      boundPointName: 'P-CHARGE-B01',
      locationName: 'CP-B01',
      enabled: false,
    });

    const next = upsertChargingPileDraftArtifacts(initial, updated, previous);
    const locations = next.locations as DraftLocation[];
    const blocks = next.blocks as DraftBlock[];

    expect(locations).toHaveLength(1);
    expect(locations[0]).toMatchObject({
      name: 'CP-B01',
      locked: true,
      position: { x: 18_000, y: 26_000, z: 0 },
      links: [{ pointName: 'P-CHARGE-B01', allowedOperations: ['CHARGE'] }],
    });
    expect(blocks).toEqual([
      expect.objectContaining({
        name: 'Block-CP-B01',
        memberNames: ['P-CHARGE-B01', 'CP-B01'],
      }),
    ]);
  });

  it('removes managed charging pile Location and Block but keeps the shared LocationType', () => {
    const record = pile();
    const initial = upsertChargingPileDraftArtifacts(draftPayload(), record);

    const next = removeChargingPileDraftArtifacts(initial, record);

    expect(next.locationTypes as DraftLocationType[]).toHaveLength(1);
    expect(next.locations as DraftLocation[]).toHaveLength(0);
    expect(next.blocks as DraftBlock[]).toHaveLength(0);
  });

  it('rejects missing points and unmanaged Location name conflicts', () => {
    expect(() =>
      upsertChargingPileDraftArtifacts(draftPayload({ points: [] }), pile()),
    ).toThrow('绑定点位 P-CHARGE-A01 不存在于工程 HZ27');

    expect(() =>
      upsertChargingPileDraftArtifacts(
        draftPayload({
          locations: [
            {
              name: 'CP-A01',
              typeName: 'WORK',
              position: { x: 0, y: 0, z: 0 },
              locked: false,
              links: [],
              layout: {
                pixelX: 0,
                pixelY: 0,
                locationRepresentation: 'DEFAULT',
              },
              properties: {},
            },
          ],
        }),
        pile(),
      ),
    ).toThrow('Location CP-A01 已存在');
  });

  it('derives deterministic Block names from Location names', () => {
    expect(chargingPileBlockName(pile({ locationName: 'CP-Z99' }))).toBe('Block-CP-Z99');
  });
});
