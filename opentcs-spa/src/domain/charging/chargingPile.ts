import type {
  ChargingPile,
  ChargingPileOccupancyStatus,
  ChargingPileRuntimeStatus,
} from '@/api/types/bff';

export type ChargingPileEnabledFilter = 'all' | 'enabled' | 'disabled';

export const CHARGING_PILE_RUNTIME_STATUS_OPTIONS = [
  'UNKNOWN',
  'IDLE',
  'CHARGING',
  'FAULT',
  'OFFLINE',
] as const satisfies readonly ChargingPileRuntimeStatus[];

export const CHARGING_PILE_OCCUPANCY_STATUS_OPTIONS = [
  'FREE',
  'OCCUPIED',
  'DISABLED',
] as const satisfies readonly ChargingPileOccupancyStatus[];

export const DEFAULT_CHARGING_PILE_REGION = '深圳焊装';
export const DEFAULT_CHARGING_PILE_MAP = 'HZ27';
export const DEFAULT_CHARGING_PILE_LOCATION_TYPE = 'CHARGER';
export const DEFAULT_CHARGING_PILE_OPERATION = 'CHARGE';

export interface ChargingPileRecord {
  id: string;
  name: string;
  region: string;
  mapName: string;
  boundPointName: string;
  locationName: string;
  locationTypeName: string;
  operation: string;
  chargerType: string;
  sn: string;
  ip: string;
  enabled: boolean;
  runtimeStatus: ChargingPileRuntimeStatus;
  occupancyStatus: ChargingPileOccupancyStatus;
  occupiedByVehicle: string;
  activeOrderName: string;
  chargingSince: string;
  requiresPublish: boolean;
  updatedAt: string;
}

export interface ChargingPileFormData {
  name: string;
  region: string;
  mapName: string;
  boundPointName: string;
  chargerType: string;
  sn: string;
  ip: string;
  locationName: string;
  locationTypeName: string;
  operation: string;
  enabled: boolean;
}

export const DEFAULT_CHARGING_PILE_RECORD: ChargingPileRecord = Object.freeze({
  id: 'cp-001',
  name: 'CP-A01',
  region: DEFAULT_CHARGING_PILE_REGION,
  mapName: DEFAULT_CHARGING_PILE_MAP,
  boundPointName: 'P-CHARGE-A01',
  locationName: 'CP-A01',
  locationTypeName: DEFAULT_CHARGING_PILE_LOCATION_TYPE,
  operation: DEFAULT_CHARGING_PILE_OPERATION,
  chargerType: '直流快充',
  sn: 'CP-SN-001',
  ip: '192.168.10.11',
  enabled: true,
  runtimeStatus: 'UNKNOWN',
  occupancyStatus: 'FREE',
  occupiedByVehicle: '',
  activeOrderName: '',
  chargingSince: '',
  requiresPublish: false,
  updatedAt: '2026-08-31 10:00:00',
});

export function createEmptyChargingPileForm(): ChargingPileFormData {
  return {
    name: '',
    region: DEFAULT_CHARGING_PILE_REGION,
    mapName: DEFAULT_CHARGING_PILE_MAP,
    boundPointName: '',
    chargerType: '',
    sn: '',
    ip: '',
    locationName: '',
    locationTypeName: DEFAULT_CHARGING_PILE_LOCATION_TYPE,
    operation: DEFAULT_CHARGING_PILE_OPERATION,
    enabled: true,
  };
}

export function chargingPileFormFromRecord(record: ChargingPileRecord): ChargingPileFormData {
  return {
    name: record.name,
    region: record.region,
    mapName: record.mapName,
    boundPointName: record.boundPointName,
    chargerType: record.chargerType,
    sn: record.sn,
    ip: record.ip,
    locationName: record.locationName,
    locationTypeName: record.locationTypeName,
    operation: record.operation,
    enabled: record.enabled,
  };
}

export function chargingPileDtoToRecord(dto: ChargingPile): ChargingPileRecord {
  return {
    id: requireText(dto.id, 'id'),
    name: requireText(dto.name, 'name'),
    region: requireText(dto.region, 'region'),
    mapName: requireText(dto.mapName, 'mapName'),
    boundPointName: requireText(dto.boundPointName, 'boundPointName'),
    locationName: normalizeText(dto.locationName) || requireText(dto.name, 'name'),
    locationTypeName: normalizeText(dto.locationTypeName) || DEFAULT_CHARGING_PILE_LOCATION_TYPE,
    operation: normalizeText(dto.operation) || DEFAULT_CHARGING_PILE_OPERATION,
    chargerType: normalizeText(dto.chargerType),
    sn: normalizeText(dto.sn),
    ip: normalizeText(dto.ip),
    enabled: Boolean(dto.enabled),
    runtimeStatus: normalizeRuntimeStatus(dto.runtimeStatus),
    occupancyStatus: normalizeOccupancyStatus(dto.occupancyStatus),
    occupiedByVehicle: normalizeText(dto.occupiedByVehicle),
    activeOrderName: normalizeText(dto.activeOrderName),
    chargingSince: normalizeText(dto.chargingSince),
    requiresPublish: Boolean(dto.requiresPublish),
    updatedAt: normalizeText(dto.updatedAt),
  };
}

export function chargingPileFormToDto(
  form: ChargingPileFormData,
  existing?: ChargingPileRecord,
  id?: string,
): ChargingPile {
  const name = requireText(form.name, 'name');
  const region = requireText(form.region, 'region');
  const mapName = requireText(form.mapName, 'mapName');
  const boundPointName = requireText(form.boundPointName, 'boundPointName');
  const locationName = normalizeText(form.locationName) || name;
  const locationTypeName = normalizeText(form.locationTypeName) || DEFAULT_CHARGING_PILE_LOCATION_TYPE;
  const operation = normalizeText(form.operation) || DEFAULT_CHARGING_PILE_OPERATION;

  return {
    id: normalizeText(id ?? existing?.id) || undefined,
    name,
    region,
    mapName,
    boundPointName,
    locationName,
    locationTypeName,
    operation,
    chargerType: normalizeText(form.chargerType),
    sn: normalizeText(form.sn),
    ip: normalizeText(form.ip),
    enabled: form.enabled,
    runtimeStatus: existing?.runtimeStatus ?? 'UNKNOWN',
    occupancyStatus: existing?.occupancyStatus ?? 'FREE',
    occupiedByVehicle: existing?.occupiedByVehicle ?? '',
    activeOrderName: existing?.activeOrderName ?? '',
    chargingSince: existing?.chargingSince ?? '',
    requiresPublish: existing?.requiresPublish ?? false,
    updatedAt: existing?.updatedAt ?? '',
  };
}

export function formatChargingPileRuntimeStatus(status: ChargingPileRuntimeStatus): string {
  switch (status) {
    case 'IDLE':
      return '空闲';
    case 'CHARGING':
      return '充电中';
    case 'FAULT':
      return '故障';
    case 'OFFLINE':
      return '离线';
    default:
      return '未知';
  }
}

export function formatChargingPileOccupancyStatus(
  status: ChargingPileOccupancyStatus,
): string {
  switch (status) {
    case 'OCCUPIED':
      return '占用中';
    case 'DISABLED':
      return '已禁用';
    default:
      return '空闲';
  }
}

export function isChargingPileNameUsed(
  records: readonly ChargingPileRecord[],
  name: string,
  exceptId?: string,
): boolean {
  const normalized = normalizeText(name).toLowerCase();
  return records.some(
    (record) => record.id !== exceptId && record.name.trim().toLowerCase() === normalized,
  );
}

export function isChargingPileBoundPointUsed(
  records: readonly ChargingPileRecord[],
  boundPointName: string,
  exceptId?: string,
): boolean {
  const normalized = normalizeText(boundPointName).toLowerCase();
  return records.some(
    (record) => record.id !== exceptId && record.boundPointName.trim().toLowerCase() === normalized,
  );
}

export function isChargingPileSnUsed(
  records: readonly ChargingPileRecord[],
  sn: string,
  exceptId?: string,
): boolean {
  const normalized = normalizeText(sn).toLowerCase();
  if (!normalized) return false;
  return records.some((record) => record.id !== exceptId && record.sn.trim().toLowerCase() === normalized);
}

export function isChargingPileIpUsed(
  records: readonly ChargingPileRecord[],
  ip: string,
  exceptId?: string,
): boolean {
  const normalized = normalizeText(ip).toLowerCase();
  if (!normalized) return false;
  return records.some((record) => record.id !== exceptId && record.ip.trim().toLowerCase() === normalized);
}

export function normalizeChargingPileForm(form: ChargingPileFormData): ChargingPileFormData {
  return {
    ...form,
    name: normalizeText(form.name),
    region: normalizeText(form.region),
    mapName: normalizeText(form.mapName),
    boundPointName: normalizeText(form.boundPointName),
    chargerType: normalizeText(form.chargerType),
    sn: normalizeText(form.sn),
    ip: normalizeText(form.ip),
    locationName: normalizeText(form.locationName),
    locationTypeName: normalizeText(form.locationTypeName),
    operation: normalizeText(form.operation),
  };
}

export function validateChargingPileForm(form: ChargingPileFormData): void {
  if (!form.name) throw new Error('名称不能为空');
  if (!form.region) throw new Error('所在区域不能为空');
  if (!form.mapName) throw new Error('所在地图不能为空');
  if (!form.boundPointName) throw new Error('绑定点位不能为空');
}

function requireText(value: string | undefined, field: string): string {
  const text = normalizeText(value);
  if (!text) {
    throw new Error(`Field '${field}' is required.`);
  }
  return text;
}

function normalizeText(value: string | undefined): string {
  return typeof value === 'string' ? value.trim() : '';
}

function normalizeRuntimeStatus(
  value: ChargingPileRuntimeStatus | undefined,
): ChargingPileRuntimeStatus {
  switch (value) {
    case 'IDLE':
    case 'CHARGING':
    case 'FAULT':
    case 'OFFLINE':
      return value;
    default:
      return 'UNKNOWN';
  }
}

function normalizeOccupancyStatus(
  value: ChargingPileOccupancyStatus | undefined,
): ChargingPileOccupancyStatus {
  switch (value) {
    case 'OCCUPIED':
    case 'DISABLED':
      return value;
    default:
      return 'FREE';
  }
}
