import type {
  DraftBlock,
  DraftLocation,
  DraftLocationType,
  DraftPoint,
  LocationRepresentation,
} from '@/domain/model/types';

import {
  DEFAULT_CHARGING_PILE_LOCATION_TYPE,
  DEFAULT_CHARGING_PILE_OPERATION,
  type ChargingPileRecord,
} from './chargingPile';

export const CHARGING_PILE_DRAFT_MANAGED_BY = 'opentcs-spa.charging-piles';
export const CHARGING_PILE_LOCATION_REPRESENTATION: LocationRepresentation = 'RECHARGE_GENERIC';
export const CHARGING_PILE_BLOCK_COLOR = '#ff6a3a';

export const CHARGING_PILE_DRAFT_PROPERTY_KEYS = Object.freeze({
  managedBy: 'opentcs-spa.managedBy',
  entityKind: 'opentcs-spa.entityKind',
  pileId: 'chargingPile.id',
  pileName: 'chargingPile.name',
  region: 'chargingPile.region',
  mapName: 'chargingPile.mapName',
  boundPointName: 'chargingPile.boundPointName',
  locationName: 'chargingPile.locationName',
  locationTypeName: 'chargingPile.locationTypeName',
  operation: 'chargingPile.operation',
  chargerType: 'chargingPile.chargerType',
  sn: 'chargingPile.sn',
  ip: 'chargingPile.ip',
  enabled: 'chargingPile.enabled',
});

type MutableDraftPayload = Record<string, unknown> & {
  points: DraftPoint[];
  locationTypes: DraftLocationType[];
  locations: DraftLocation[];
  blocks: DraftBlock[];
};

export function chargingPileLocationName(record: ChargingPileRecord): string {
  return record.locationName.trim() || record.name.trim();
}

export function chargingPileLocationTypeName(record: ChargingPileRecord): string {
  return record.locationTypeName.trim() || DEFAULT_CHARGING_PILE_LOCATION_TYPE;
}

export function chargingPileOperation(record: ChargingPileRecord): string {
  return record.operation.trim() || DEFAULT_CHARGING_PILE_OPERATION;
}

export function chargingPileBlockName(record: ChargingPileRecord): string {
  return `Block-${chargingPileLocationName(record)}`;
}

export function upsertChargingPileDraftArtifacts(
  payload: Record<string, unknown>,
  record: ChargingPileRecord,
  previous?: ChargingPileRecord,
): Record<string, unknown> {
  const next = copyDraftPayload(payload);

  if (previous) {
    removeChargingPileArtifactsInPlace(next, previous);
  }

  assertChargingPileDraftNames(record);

  const point = next.points.find((item) => item.name === record.boundPointName);
  if (!point) {
    throw new Error(`绑定点位 ${record.boundPointName} 不存在于工程 ${record.mapName}`);
  }

  ensureChargingPileLocationType(next, record);
  upsertChargingPileLocation(next, record, point);
  upsertChargingPileBlock(next, record);

  return next;
}

export function removeChargingPileDraftArtifacts(
  payload: Record<string, unknown>,
  record: ChargingPileRecord,
): Record<string, unknown> {
  const next = copyDraftPayload(payload);
  removeChargingPileArtifactsInPlace(next, record);
  return next;
}

function ensureChargingPileLocationType(
  payload: MutableDraftPayload,
  record: ChargingPileRecord,
): void {
  const typeName = chargingPileLocationTypeName(record);
  const operation = chargingPileOperation(record);
  const index = payload.locationTypes.findIndex((item) => item.name === typeName);
  const typeProperties = buildLocationTypeProperties(record);

  if (index < 0) {
    payload.locationTypes.push({
      name: typeName,
      allowedOperations: [operation],
      allowedPeripheralOperations: [],
      layout: {
        locationRepresentation: CHARGING_PILE_LOCATION_REPRESENTATION,
      },
      properties: typeProperties,
    });
    return;
  }

  const current = payload.locationTypes[index];
  payload.locationTypes[index] = {
    ...current,
    allowedOperations: uniqueStrings([...current.allowedOperations, operation]),
    allowedPeripheralOperations: [...current.allowedPeripheralOperations],
    layout: {
      ...current.layout,
      locationRepresentation:
        current.layout.locationRepresentation || CHARGING_PILE_LOCATION_REPRESENTATION,
    },
    properties: {
      ...current.properties,
      ...typeProperties,
    },
  };
}

function upsertChargingPileLocation(
  payload: MutableDraftPayload,
  record: ChargingPileRecord,
  point: DraftPoint,
): void {
  const locationName = chargingPileLocationName(record);
  const existingIndex = payload.locations.findIndex((item) => item.name === locationName);
  const current = existingIndex >= 0 ? payload.locations[existingIndex] : undefined;

  if (current && !matchesChargingPileRecord(current.properties, record)) {
    throw new Error(`Location ${locationName} 已存在，无法同步充电桩模型`);
  }

  const location: DraftLocation = {
    name: locationName,
    typeName: chargingPileLocationTypeName(record),
    position: {
      ...point.pose.position,
    },
    locked: !record.enabled,
    links: [
      {
        pointName: record.boundPointName,
        allowedOperations: [chargingPileOperation(record)],
      },
    ],
    layout: {
      pixelX: point.layout.pixelX,
      pixelY: point.layout.pixelY,
      locationRepresentation: CHARGING_PILE_LOCATION_REPRESENTATION,
    },
    properties: buildChargingPileProperties(record),
  };

  if (existingIndex >= 0) {
    payload.locations[existingIndex] = location;
  } else {
    payload.locations.push(location);
  }
}

function upsertChargingPileBlock(payload: MutableDraftPayload, record: ChargingPileRecord): void {
  const blockName = chargingPileBlockName(record);
  const existingIndex = payload.blocks.findIndex((item) => item.name === blockName);
  const current = existingIndex >= 0 ? payload.blocks[existingIndex] : undefined;

  if (current && !matchesChargingPileRecord(current.properties, record)) {
    throw new Error(`Block ${blockName} 已存在，无法同步充电桩模型`);
  }

  const block: DraftBlock = {
    name: blockName,
    type: 'SINGLE_VEHICLE_ONLY',
    memberNames: [record.boundPointName, chargingPileLocationName(record)],
    layout: {
      colorRgb: CHARGING_PILE_BLOCK_COLOR,
    },
    properties: buildChargingPileProperties(record),
  };

  if (existingIndex >= 0) {
    payload.blocks[existingIndex] = block;
  } else {
    payload.blocks.push(block);
  }
}

function removeChargingPileArtifactsInPlace(
  payload: MutableDraftPayload,
  record: ChargingPileRecord,
): void {
  const blockName = chargingPileBlockName(record);

  payload.locations = payload.locations.filter(
    (location) => !matchesChargingPileRecord(location.properties, record),
  );
  payload.blocks = payload.blocks.filter(
    (block) =>
      !matchesChargingPileRecord(block.properties, record) &&
      !(block.name === blockName && isManagedChargingPileEntity(block.properties)),
  );
}

function assertChargingPileDraftNames(record: ChargingPileRecord): void {
  assertDraftEntityName(chargingPileLocationName(record), 'Location');
  assertDraftEntityName(chargingPileLocationTypeName(record), 'LocationType');
  assertDraftEntityName(chargingPileBlockName(record), 'Block');
}

function assertDraftEntityName(value: string, label: string): void {
  if (!value || /[\s/\\]/.test(value)) {
    throw new Error(`${label} ${value || '<empty>'} 不能包含空白、/ 或 \\`);
  }
}

function buildChargingPileProperties(record: ChargingPileRecord): Record<string, string> {
  const properties: Record<string, string> = {
    [CHARGING_PILE_DRAFT_PROPERTY_KEYS.managedBy]: CHARGING_PILE_DRAFT_MANAGED_BY,
    [CHARGING_PILE_DRAFT_PROPERTY_KEYS.entityKind]: 'charging-pile',
    [CHARGING_PILE_DRAFT_PROPERTY_KEYS.pileId]: record.id,
    [CHARGING_PILE_DRAFT_PROPERTY_KEYS.pileName]: record.name,
    [CHARGING_PILE_DRAFT_PROPERTY_KEYS.region]: record.region,
    [CHARGING_PILE_DRAFT_PROPERTY_KEYS.mapName]: record.mapName,
    [CHARGING_PILE_DRAFT_PROPERTY_KEYS.boundPointName]: record.boundPointName,
    [CHARGING_PILE_DRAFT_PROPERTY_KEYS.locationName]: chargingPileLocationName(record),
    [CHARGING_PILE_DRAFT_PROPERTY_KEYS.locationTypeName]: chargingPileLocationTypeName(record),
    [CHARGING_PILE_DRAFT_PROPERTY_KEYS.operation]: chargingPileOperation(record),
    [CHARGING_PILE_DRAFT_PROPERTY_KEYS.chargerType]: record.chargerType,
    [CHARGING_PILE_DRAFT_PROPERTY_KEYS.sn]: record.sn,
    [CHARGING_PILE_DRAFT_PROPERTY_KEYS.ip]: record.ip,
    [CHARGING_PILE_DRAFT_PROPERTY_KEYS.enabled]: String(record.enabled),
  };

  return properties;
}

function buildLocationTypeProperties(record: ChargingPileRecord): Record<string, string> {
  return {
    [CHARGING_PILE_DRAFT_PROPERTY_KEYS.managedBy]: CHARGING_PILE_DRAFT_MANAGED_BY,
    [CHARGING_PILE_DRAFT_PROPERTY_KEYS.entityKind]: 'charging-pile-location-type',
    [CHARGING_PILE_DRAFT_PROPERTY_KEYS.locationTypeName]: chargingPileLocationTypeName(record),
    [CHARGING_PILE_DRAFT_PROPERTY_KEYS.operation]: chargingPileOperation(record),
  };
}

function matchesChargingPileRecord(
  properties: Record<string, string> | undefined,
  record: ChargingPileRecord,
): boolean {
  if (!isManagedChargingPileEntity(properties)) {
    return false;
  }

  const propertyId = properties[CHARGING_PILE_DRAFT_PROPERTY_KEYS.pileId];
  if (propertyId && record.id && propertyId === record.id) {
    return true;
  }

  const propertyName = properties[CHARGING_PILE_DRAFT_PROPERTY_KEYS.pileName];
  const propertyLocationName = properties[CHARGING_PILE_DRAFT_PROPERTY_KEYS.locationName];

  return (
    propertyName === record.name || propertyLocationName === chargingPileLocationName(record)
  );
}

function isManagedChargingPileEntity(
  properties: Record<string, string> | undefined,
): properties is Record<string, string> {
  return (
    properties?.[CHARGING_PILE_DRAFT_PROPERTY_KEYS.managedBy] ===
      CHARGING_PILE_DRAFT_MANAGED_BY &&
    properties?.[CHARGING_PILE_DRAFT_PROPERTY_KEYS.entityKind] === 'charging-pile'
  );
}

function copyDraftPayload(payload: Record<string, unknown>): MutableDraftPayload {
  return {
    ...payload,
    points: readArray<DraftPoint>(payload.points).map(copyPoint),
    locationTypes: readArray<DraftLocationType>(payload.locationTypes).map(copyLocationType),
    locations: readArray<DraftLocation>(payload.locations).map(copyLocation),
    blocks: readArray<DraftBlock>(payload.blocks).map(copyBlock),
  };
}

function copyPoint(point: DraftPoint): DraftPoint {
  return {
    ...point,
    pose: {
      ...point.pose,
      position: {
        ...point.pose.position,
      },
    },
    layout: {
      ...point.layout,
    },
    properties: {
      ...point.properties,
    },
  };
}

function copyLocationType(locationType: DraftLocationType): DraftLocationType {
  return {
    ...locationType,
    allowedOperations: [...locationType.allowedOperations],
    allowedPeripheralOperations: [...locationType.allowedPeripheralOperations],
    layout: {
      ...locationType.layout,
    },
    properties: {
      ...locationType.properties,
    },
  };
}

function copyLocation(location: DraftLocation): DraftLocation {
  return {
    ...location,
    position: {
      ...location.position,
    },
    links: location.links.map((link) => ({
      ...link,
      allowedOperations: [...link.allowedOperations],
    })),
    layout: {
      ...location.layout,
    },
    properties: {
      ...location.properties,
    },
  };
}

function copyBlock(block: DraftBlock): DraftBlock {
  return {
    ...block,
    memberNames: [...block.memberNames],
    layout: {
      ...block.layout,
    },
    properties: {
      ...block.properties,
    },
  };
}

function readArray<T>(value: unknown): T[] {
  return Array.isArray(value) ? [...(value as T[])] : [];
}

function uniqueStrings(values: string[]): string[] {
  return [...new Set(values.filter(Boolean))];
}
