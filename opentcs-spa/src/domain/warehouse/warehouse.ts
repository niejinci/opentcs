import type { WarehouseRack, WarehouseType } from '@/api/types/bff';

export type WarehouseLoadActionType = '上料' | '高位上料' | '低位上料';
export type WarehouseUnloadActionType = '下料' | '高位下料' | '低位下料';
export type WarehouseKind = '货架' | '托盘';
export type WarehouseLockStatus = '未锁定' | '已锁定';
export type WarehouseEmptyStatus = '空' | '满';

const DEFAULT_REGION = '深圳焊装';
const DEFAULT_WAREHOUSE_KIND: WarehouseKind = '货架';
const DEFAULT_CONTAINER_TYPE = '深圳27焊装通用容器非精定';
const DEFAULT_RACK_SHAPE = '方形';
const DEFAULT_VEHICLE_MODELS = 'BYD-1500';
const DEFAULT_PICKUP_DIRECTION = '不指定方向';
const DEFAULT_ENTRY_DIRECTION = '长边进';

export interface WarehouseTypeRecord {
  id: string;
  code: string;
  name: string;
  region: string;
  warehouseKind: WarehouseKind;
  containerType: string;
  loadActionType: WarehouseLoadActionType;
  unloadActionType: WarehouseUnloadActionType;
  lengthMm: number;
  widthMm: number;
  heightMm: number;
  innerLengthMm: number;
  innerWidthMm: number;
  legHeightMm: number;
  legLengthMm: number;
  legWidthMm: number;
  rackShape: string;
  boundVehicleModels: string;
  loadSensorCheck: boolean;
  qrCodeCheck: boolean;
  pickupDirection: string;
  entryDirection: string;
  updatedAt: string;
  qrCenterLeft?: number | null;
  qrCenterBack?: number | null;
  qrCenterFront?: number | null;
}

export interface WarehouseRackRecord {
  id: string;
  name: string;
  code: string;
  carrierBottomCode: string;
  typeCode: string;
  typeName: string;
  warehouseKind: WarehouseKind;
  region: string;
  mapName: string;
  storageCode: string;
  locationName: string;
  lockStatus: WarehouseLockStatus;
  emptyStatus: WarehouseEmptyStatus;
  vehicleName: string;
  containerInfo: string;
  enabled: boolean;
  updatedAt: string;
}

export interface WarehouseTypeFormData {
  code: string;
  name: string;
  region: string;
  warehouseKind: WarehouseKind;
  containerType: string;
  loadActionType: WarehouseLoadActionType;
  unloadActionType: WarehouseUnloadActionType;
  lengthMm: number;
  widthMm: number;
  heightMm: number;
  innerLengthMm: number;
  innerWidthMm: number;
  legHeightMm: number;
  legLengthMm: number;
  legWidthMm: number;
  rackShape: string;
  boundVehicleModels: string;
  loadSensorCheck: boolean;
  qrCodeCheck: boolean;
  pickupDirection: string;
  entryDirection: string;
  qrCenterLeft?: number | null;
  qrCenterBack?: number | null;
  qrCenterFront?: number | null;
}

export interface WarehouseRackFormData {
  name: string;
  code: string;
  carrierBottomCode: string;
  typeCode: string;
  warehouseKind: WarehouseKind;
  region: string;
  mapName: string;
  storageCode: string;
  locationName: string;
  lockStatus: WarehouseLockStatus;
  emptyStatus: WarehouseEmptyStatus;
  vehicleName: string;
  containerInfo: string;
  enabled: boolean;
}

export const WAREHOUSE_LOAD_ACTION_OPTIONS: readonly WarehouseLoadActionType[] = [
  '上料',
  '高位上料',
  '低位上料',
];

export const WAREHOUSE_UNLOAD_ACTION_OPTIONS: readonly WarehouseUnloadActionType[] = [
  '下料',
  '高位下料',
  '低位下料',
];

export const DEFAULT_WAREHOUSE_TYPE: WarehouseTypeRecord = Object.freeze({
  id: '29',
  code: 'HJ27HDBMBZC',
  name: '后地板面板总成货架',
  region: DEFAULT_REGION,
  warehouseKind: DEFAULT_WAREHOUSE_KIND,
  containerType: DEFAULT_CONTAINER_TYPE,
  loadActionType: '上料',
  unloadActionType: '下料',
  lengthMm: 1950,
  widthMm: 1200,
  heightMm: 1000,
  innerLengthMm: 1000,
  innerWidthMm: 1000,
  legHeightMm: 100,
  legLengthMm: 100,
  legWidthMm: 100,
  rackShape: DEFAULT_RACK_SHAPE,
  boundVehicleModels: DEFAULT_VEHICLE_MODELS,
  loadSensorCheck: true,
  qrCodeCheck: true,
  pickupDirection: DEFAULT_PICKUP_DIRECTION,
  entryDirection: DEFAULT_ENTRY_DIRECTION,
  updatedAt: '2026-06-24 17:04:48',
});

export const DEFAULT_WAREHOUSE_RACK: WarehouseRackRecord = Object.freeze({
  id: '1',
  name: '后地板面板总成货架001',
  code: 'HJ27_HDBMBZC_001',
  carrierBottomCode: '257',
  typeCode: DEFAULT_WAREHOUSE_TYPE.code,
  typeName: DEFAULT_WAREHOUSE_TYPE.name,
  warehouseKind: DEFAULT_WAREHOUSE_KIND,
  region: DEFAULT_REGION,
  mapName: 'HZ27',
  storageCode: '',
  locationName: '-',
  lockStatus: '未锁定',
  emptyStatus: '空',
  vehicleName: '',
  containerInfo: '',
  enabled: true,
  updatedAt: '2026-06-24 17:05:23',
});

export function createEmptyWarehouseTypeForm(): WarehouseTypeFormData {
  return {
    code: '',
    name: '',
    region: DEFAULT_REGION,
    warehouseKind: DEFAULT_WAREHOUSE_KIND,
    containerType: '',
    loadActionType: '上料',
    unloadActionType: '下料',
    lengthMm: 0,
    widthMm: 0,
    heightMm: 0,
    innerLengthMm: 0,
    innerWidthMm: 0,
    legHeightMm: 0,
    legLengthMm: 0,
    legWidthMm: 0,
    rackShape: DEFAULT_RACK_SHAPE,
    boundVehicleModels: '',
    loadSensorCheck: true,
    qrCodeCheck: true,
    pickupDirection: DEFAULT_PICKUP_DIRECTION,
    entryDirection: DEFAULT_ENTRY_DIRECTION,
  };
}

export function warehouseTypeFormFromRecord(record: WarehouseTypeRecord): WarehouseTypeFormData {
  return {
    code: record.code,
    name: record.name,
    region: record.region,
    warehouseKind: record.warehouseKind,
    containerType: record.containerType,
    loadActionType: record.loadActionType,
    unloadActionType: record.unloadActionType,
    lengthMm: record.lengthMm,
    widthMm: record.widthMm,
    heightMm: record.heightMm,
    innerLengthMm: record.innerLengthMm,
    innerWidthMm: record.innerWidthMm,
    legHeightMm: record.legHeightMm,
    legLengthMm: record.legLengthMm,
    legWidthMm: record.legWidthMm,
    rackShape: record.rackShape,
    boundVehicleModels: record.boundVehicleModels,
    loadSensorCheck: record.loadSensorCheck,
    qrCodeCheck: record.qrCodeCheck,
    pickupDirection: record.pickupDirection,
    entryDirection: record.entryDirection,
    qrCenterLeft: record.qrCenterLeft,
    qrCenterBack: record.qrCenterBack,
    qrCenterFront: record.qrCenterFront,
  };
}

export function createEmptyWarehouseRackForm(
  defaultType?: WarehouseTypeRecord,
): WarehouseRackFormData {
  return {
    name: '',
    code: '',
    carrierBottomCode: '',
    typeCode: defaultType?.code ?? '',
    warehouseKind: DEFAULT_WAREHOUSE_KIND,
    region: defaultType?.region ?? DEFAULT_REGION,
    mapName: 'HZ27',
    storageCode: '',
    locationName: '-',
    lockStatus: '未锁定',
    emptyStatus: '空',
    vehicleName: '',
    containerInfo: '',
    enabled: true,
  };
}

export function warehouseRackFormFromRecord(record: WarehouseRackRecord): WarehouseRackFormData {
  return {
    name: record.name,
    code: record.code,
    carrierBottomCode: record.carrierBottomCode,
    typeCode: record.typeCode,
    warehouseKind: record.warehouseKind,
    region: record.region,
    mapName: record.mapName,
    storageCode: record.storageCode,
    locationName: record.locationName,
    lockStatus: record.lockStatus,
    emptyStatus: record.emptyStatus,
    vehicleName: record.vehicleName,
    containerInfo: record.containerInfo,
    enabled: record.enabled,
  };
}

export function warehouseTypeDtoToRecord(dto: WarehouseType): WarehouseTypeRecord {
  return {
    id: dto.Id,
    code: dto.Name,
    name: dto.WareModel,
    region: DEFAULT_REGION,
    warehouseKind: DEFAULT_WAREHOUSE_KIND,
    containerType: DEFAULT_CONTAINER_TYPE,
    loadActionType: '上料',
    unloadActionType: '下料',
    lengthMm: dto.Length,
    widthMm: dto.Width,
    heightMm: dto.Height,
    innerLengthMm: dto.LegInnerLength,
    innerWidthMm: dto.LegInnerWidth,
    legHeightMm: dto.LegHeight,
    legLengthMm: dto.LegLength,
    legWidthMm: dto.LegWidth,
    rackShape: DEFAULT_RACK_SHAPE,
    boundVehicleModels: DEFAULT_VEHICLE_MODELS,
    loadSensorCheck: dto.LoadDetect.LoadSensor,
    qrCodeCheck: dto.LoadDetect.QrCodeSensor,
    pickupDirection: DEFAULT_PICKUP_DIRECTION,
    entryDirection: DEFAULT_ENTRY_DIRECTION,
    updatedAt: '',
    qrCenterLeft: dto.QrCenterLeft,
    qrCenterBack: dto.QrCenterBack,
    qrCenterFront: dto.QrCenterFront,
  };
}

export function warehouseTypeFormToDto(form: WarehouseTypeFormData, id = ''): WarehouseType {
  return {
    QrCenterLeft: form.qrCenterLeft ?? undefined,
    LoadDetect: {
      MinLoadingHeight: 25,
      LoadSensor: form.loadSensorCheck,
      LoadDetectType: -1,
      QrCodeSensor: form.qrCodeCheck,
      QrCodeMin: 0,
      QrCodeMax: 99999999,
    },
    QrCenterBack: form.qrCenterBack ?? undefined,
    WareModel: form.name.trim(),
    LegLength: Number(form.legLengthMm),
    PutHeight: 730,
    LegInnerWidth: Number(form.innerWidthMm),
    CollisionAvoidanceAreaType: 0,
    LegInnerLength: Number(form.innerLengthMm),
    Name: form.code.trim(),
    QrCenterFront: form.qrCenterFront ?? undefined,
    LegHeight: Number(form.legHeightMm),
    QrCodeRectifyType: 'NoRectify',
    Length: Number(form.lengthMm),
    LegWidth: Number(form.legWidthMm),
    AllowRotate: false,
    PickHeight: 270,
    Height: Number(form.heightMm),
    Id: id,
    DefaultOrientationType: 'Front',
    Width: Number(form.widthMm),
    Manageable: false,
  };
}

export function warehouseRackDtoToRecord(dto: WarehouseRack): WarehouseRackRecord {
  return {
    id: dto.id,
    name: dto.name,
    code: dto.code,
    carrierBottomCode: dto.carrierBottomCode,
    typeCode: dto.typeCode,
    typeName: dto.typeName,
    warehouseKind: asWarehouseKind(dto.warehouseKind),
    region: dto.region,
    mapName: dto.mapName,
    storageCode: dto.storageCode,
    locationName: dto.locationName,
    lockStatus: asLockStatus(dto.lockStatus),
    emptyStatus: asEmptyStatus(dto.emptyStatus),
    vehicleName: dto.vehicleName,
    containerInfo: dto.containerInfo,
    enabled: dto.enabled,
    updatedAt: dto.updatedAt,
  };
}

export function warehouseRackFormToDto(
  form: WarehouseRackFormData,
  type: WarehouseTypeRecord,
  id = '',
): WarehouseRack {
  return {
    id,
    name: form.name.trim(),
    code: form.code.trim(),
    carrierBottomCode: form.carrierBottomCode.trim(),
    typeCode: type.code,
    typeName: type.name,
    warehouseKind: type.warehouseKind,
    region: type.region,
    mapName: form.mapName.trim(),
    storageCode: form.storageCode.trim(),
    locationName: form.locationName.trim() || '-',
    lockStatus: form.lockStatus,
    emptyStatus: form.emptyStatus,
    vehicleName: form.vehicleName.trim(),
    containerInfo: form.containerInfo.trim(),
    enabled: form.enabled,
    updatedAt: '',
  };
}

export function formatWarehouseTimestamp(date = new Date()): string {
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(
    date.getHours(),
  )}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
}

export function nextWarehouseId(prefix = ''): string {
  return `${prefix}${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;
}

export function isWarehouseTypeCodeUsed(
  records: readonly WarehouseTypeRecord[],
  code: string,
  exceptId?: string,
): boolean {
  const normalized = code.trim().toLowerCase();
  return records.some(
    (record) => record.id !== exceptId && record.code.trim().toLowerCase() === normalized,
  );
}

export function isWarehouseRackCodeUsed(
  records: readonly WarehouseRackRecord[],
  code: string,
  exceptId?: string,
): boolean {
  const normalized = code.trim().toLowerCase();
  return records.some(
    (record) => record.id !== exceptId && record.code.trim().toLowerCase() === normalized,
  );
}

function asWarehouseKind(value: string): WarehouseKind {
  return value === '托盘' ? '托盘' : '货架';
}

function asLockStatus(value: string): WarehouseLockStatus {
  return value === '已锁定' ? '已锁定' : '未锁定';
}

function asEmptyStatus(value: string): WarehouseEmptyStatus {
  return value === '满' ? '满' : '空';
}
