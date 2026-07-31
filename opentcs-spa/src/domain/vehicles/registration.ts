// SPDX-FileCopyrightText: The openTCS Authors
// SPDX-License-Identifier: MIT

import type { DraftVehicle } from '@/domain/model/types';
import { isValidEntityName, nextAutoName } from '@/domain/model/naming';

export const AGV_VEHICLE_MODELS = ['BYD-1500', 'BYD-1500DP'] as const;
export type AgvVehicleModel = (typeof AGV_VEHICLE_MODELS)[number];

export const AGV_REGIONS = ['深圳焊装', '深圳总装'] as const;
export type AgvRegion = (typeof AGV_REGIONS)[number];

export const VDA5050_VERSION = '2.0';
export const VDA5050_COMM_ADAPTER_CLASS =
  'org.opentcs.commadapter.vehicle.vda5050.CommAdapterFactoryImpl';

export const TCS_PROPERTY_KEYS = Object.freeze({
  preferredAdapterClass: 'tcs:preferredAdapterClass',
});

export const VDA5050_PROPERTY_KEYS = Object.freeze({
  version: 'vda5050:version',
  topicPrefix: 'vda5050:topicPrefix',
  interfaceName: 'vda5050:interfaceName',
  manufacturer: 'vda5050:manufacturer',
  serialNumber: 'vda5050:serialNumber',
});

export const BYD_AGV_PROPERTY_KEYS = Object.freeze({
  model: 'byd:model',
  region: 'byd:region',
  macAddress: 'byd:macAddress',
  registrationSource: 'byd:registrationSource',
});

export const AGV_REGISTRATION_MANAGED_PROPERTY_KEYS = [
  TCS_PROPERTY_KEYS.preferredAdapterClass,
  VDA5050_PROPERTY_KEYS.version,
  VDA5050_PROPERTY_KEYS.topicPrefix,
  VDA5050_PROPERTY_KEYS.interfaceName,
  VDA5050_PROPERTY_KEYS.manufacturer,
  VDA5050_PROPERTY_KEYS.serialNumber,
  BYD_AGV_PROPERTY_KEYS.model,
  BYD_AGV_PROPERTY_KEYS.region,
  BYD_AGV_PROPERTY_KEYS.macAddress,
  BYD_AGV_PROPERTY_KEYS.registrationSource,
] as const;

export interface AgvRegistrationForm {
  name: string;
  model: AgvVehicleModel | '';
  region: AgvRegion | '';
  macAddress: string;
  topicPrefix: string;
  interfaceName: string;
  manufacturer: string;
  serialNumber: string;
}

export interface AgvRegistrationRecord extends AgvRegistrationForm {
  effectiveTopicPrefix: string;
  registered: boolean;
  missingFields: string[];
}

export interface ExistingAgvVehicle {
  name: string;
  properties: Record<string, string>;
}

export interface RegistrationValidationIssue {
  field: keyof AgvRegistrationForm | 'effectiveTopicPrefix';
  message: string;
}

export interface Vda5050PropertyValidationIssue {
  field: string;
  message: string;
}

const MAC_ADDRESS_RE = /^([0-9A-F]{2}:){5}[0-9A-F]{2}$/;
const TOPIC_SEGMENT_RE = /^[A-Za-z0-9_.-]+$/;

export function createEmptyAgvRegistrationForm(
  existingNames: Iterable<string>,
): AgvRegistrationForm {
  return {
    name: nextAutoName('AGV', existingNames),
    model: 'BYD-1500',
    region: '深圳焊装',
    macAddress: '',
    topicPrefix: '',
    interfaceName: 'VDA',
    manufacturer: 'BYD_11',
    serialNumber: '',
  };
}

export function normalizeAgvRegistrationForm(form: AgvRegistrationForm): AgvRegistrationForm {
  return {
    name: form.name.trim(),
    model: form.model,
    region: form.region,
    macAddress: normalizeMacAddress(form.macAddress),
    topicPrefix: form.topicPrefix.trim(),
    interfaceName: form.interfaceName.trim(),
    manufacturer: form.manufacturer.trim(),
    serialNumber: form.serialNumber.trim(),
  };
}

export function agvRegistrationFromVehicle(vehicle: DraftVehicle): AgvRegistrationRecord {
  const props = vehicle.properties ?? {};
  const model = props[BYD_AGV_PROPERTY_KEYS.model];
  const region = props[BYD_AGV_PROPERTY_KEYS.region];
  const form = normalizeAgvRegistrationForm({
    name: vehicle.name,
    model: isAgvVehicleModel(model) ? model : '',
    region: isAgvRegion(region) ? region : '',
    macAddress: props[BYD_AGV_PROPERTY_KEYS.macAddress] ?? '',
    topicPrefix: props[VDA5050_PROPERTY_KEYS.topicPrefix] ?? '',
    interfaceName: props[VDA5050_PROPERTY_KEYS.interfaceName] ?? '',
    manufacturer: props[VDA5050_PROPERTY_KEYS.manufacturer] ?? '',
    serialNumber: props[VDA5050_PROPERTY_KEYS.serialNumber] ?? '',
  });
  const missingFields = missingVda5050Fields(props);
  return {
    ...form,
    effectiveTopicPrefix: effectiveTopicPrefixForForm(form),
    registered: missingFields.length === 0,
    missingFields,
  };
}

export function validateAgvRegistrationForm(
  input: AgvRegistrationForm,
  existingVehicles: readonly ExistingAgvVehicle[],
  originalName?: string | null,
): RegistrationValidationIssue[] {
  const form = normalizeAgvRegistrationForm(input);
  const issues: RegistrationValidationIssue[] = [];

  if (!isValidEntityName(form.name)) {
    issues.push({ field: 'name', message: '车辆名称不能为空，且不能包含空白、/ 或 \\' });
  }
  if (!form.model || !isAgvVehicleModel(form.model)) {
    issues.push({ field: 'model', message: '请选择有效车型' });
  }
  if (!form.region || !isAgvRegion(form.region)) {
    issues.push({ field: 'region', message: '请选择所属区域' });
  }
  if (form.macAddress && !MAC_ADDRESS_RE.test(form.macAddress)) {
    issues.push({ field: 'macAddress', message: 'MAC 地址格式应为 00:11:22:33:44:55' });
  }
  if (!form.manufacturer) {
    issues.push({ field: 'manufacturer', message: 'vda5050:manufacturer 必填' });
  } else if (!isTopicSegment(form.manufacturer)) {
    issues.push({ field: 'manufacturer', message: 'manufacturer 只能包含字母、数字、_、-、.' });
  }
  if (!form.serialNumber) {
    issues.push({ field: 'serialNumber', message: 'vda5050:serialNumber 必填' });
  } else if (!isTopicSegment(form.serialNumber)) {
    issues.push({ field: 'serialNumber', message: 'serialNumber 只能包含字母、数字、_、-、.' });
  }
  if (!form.topicPrefix && !form.interfaceName) {
    issues.push({
      field: 'effectiveTopicPrefix',
      message: 'topicPrefix 和 interfaceName 至少填写一项',
    });
  }
  if (form.topicPrefix && !isValidTopicPrefix(form.topicPrefix)) {
    issues.push({
      field: 'topicPrefix',
      message: 'topicPrefix 不能以 / 开头或结尾，不能包含空白、+、# 或连续 //',
    });
  }
  if (form.interfaceName && !isTopicSegment(form.interfaceName)) {
    issues.push({ field: 'interfaceName', message: 'interfaceName 只能包含字母、数字、_、-、.' });
  }

  const otherVehicles = existingVehicles.filter((vehicle) => vehicle.name !== originalName);
  if (otherVehicles.some((vehicle) => vehicle.name === form.name)) {
    issues.push({ field: 'name', message: `车辆名称 '${form.name}' 已存在` });
  }

  if (
    form.macAddress &&
    otherVehicles.some(
      (vehicle) =>
        normalizeMacAddress(vehicle.properties[BYD_AGV_PROPERTY_KEYS.macAddress] ?? '') ===
        form.macAddress,
    )
  ) {
    issues.push({ field: 'macAddress', message: `MAC 地址 '${form.macAddress}' 已被使用` });
  }

  const effectiveTopicPrefix = effectiveTopicPrefixForForm(form);
  if (
    effectiveTopicPrefix &&
    otherVehicles.some(
      (vehicle) => effectiveTopicPrefixFromProperties(vehicle.properties) === effectiveTopicPrefix,
    )
  ) {
    issues.push({
      field: 'effectiveTopicPrefix',
      message: `MQTT topic 前缀 '${effectiveTopicPrefix}' 已被使用`,
    });
  }

  const identity = `${form.manufacturer}/${form.serialNumber}`;
  if (
    form.manufacturer &&
    form.serialNumber &&
    otherVehicles.some((vehicle) => {
      const manufacturer = (vehicle.properties[VDA5050_PROPERTY_KEYS.manufacturer] ?? '').trim();
      const serialNumber = (vehicle.properties[VDA5050_PROPERTY_KEYS.serialNumber] ?? '').trim();
      return `${manufacturer}/${serialNumber}` === identity;
    })
  ) {
    issues.push({
      field: 'serialNumber',
      message: `manufacturer + serialNumber '${identity}' 已被使用`,
    });
  }

  return issues;
}

export function hasVda5050RegistrationProperties(properties: Record<string, string>): boolean {
  return (
    (properties[TCS_PROPERTY_KEYS.preferredAdapterClass] ?? '').trim() ===
      VDA5050_COMM_ADAPTER_CLASS ||
    Object.values(VDA5050_PROPERTY_KEYS).some((key) => (properties[key] ?? '').trim() !== '')
  );
}

export function validateVda5050VehicleProperties(
  vehicleName: string,
  properties: Record<string, string>,
  existingVehicles: readonly ExistingAgvVehicle[] = [],
  originalName: string | null = vehicleName,
): Vda5050PropertyValidationIssue[] {
  if (!hasVda5050RegistrationProperties(properties)) return [];

  const issues: Vda5050PropertyValidationIssue[] = [];
  const preferredAdapter = (properties[TCS_PROPERTY_KEYS.preferredAdapterClass] ?? '').trim();
  const version = (properties[VDA5050_PROPERTY_KEYS.version] ?? '').trim();
  const topicPrefix = (properties[VDA5050_PROPERTY_KEYS.topicPrefix] ?? '').trim();
  const interfaceName = (properties[VDA5050_PROPERTY_KEYS.interfaceName] ?? '').trim();
  const manufacturer = (properties[VDA5050_PROPERTY_KEYS.manufacturer] ?? '').trim();
  const serialNumber = (properties[VDA5050_PROPERTY_KEYS.serialNumber] ?? '').trim();

  if (preferredAdapter !== VDA5050_COMM_ADAPTER_CLASS) {
    issues.push({
      field: TCS_PROPERTY_KEYS.preferredAdapterClass,
      message: `${TCS_PROPERTY_KEYS.preferredAdapterClass} 必须为 ${VDA5050_COMM_ADAPTER_CLASS}`,
    });
  }
  if (version !== VDA5050_VERSION) {
    issues.push({
      field: VDA5050_PROPERTY_KEYS.version,
      message: `${VDA5050_PROPERTY_KEYS.version} 必须为 ${VDA5050_VERSION}`,
    });
  }
  if (!manufacturer) {
    issues.push({ field: VDA5050_PROPERTY_KEYS.manufacturer, message: 'manufacturer 必填' });
  } else if (!isTopicSegment(manufacturer)) {
    issues.push({
      field: VDA5050_PROPERTY_KEYS.manufacturer,
      message: 'manufacturer 只能包含字母、数字、_、-、.',
    });
  }
  if (!serialNumber) {
    issues.push({ field: VDA5050_PROPERTY_KEYS.serialNumber, message: 'serialNumber 必填' });
  } else if (!isTopicSegment(serialNumber)) {
    issues.push({
      field: VDA5050_PROPERTY_KEYS.serialNumber,
      message: 'serialNumber 只能包含字母、数字、_、-、.',
    });
  }
  if (!topicPrefix && !interfaceName) {
    issues.push({
      field: 'effectiveTopicPrefix',
      message: 'topicPrefix 和 interfaceName 至少填写一项',
    });
  }
  if (topicPrefix && !isValidTopicPrefix(topicPrefix)) {
    issues.push({
      field: VDA5050_PROPERTY_KEYS.topicPrefix,
      message: 'topicPrefix 不能以 / 开头或结尾，不能包含空白、+、# 或连续 //',
    });
  }
  if (interfaceName && !isTopicSegment(interfaceName)) {
    issues.push({
      field: VDA5050_PROPERTY_KEYS.interfaceName,
      message: 'interfaceName 只能包含字母、数字、_、-、.',
    });
  }

  const form = normalizeAgvRegistrationForm({
    name: vehicleName,
    model: '',
    region: '',
    macAddress: '',
    topicPrefix,
    interfaceName,
    manufacturer,
    serialNumber,
  });
  const effectiveTopicPrefix = effectiveTopicPrefixForForm(form);
  const otherVehicles = existingVehicles.filter((vehicle) => vehicle.name !== originalName);
  if (
    effectiveTopicPrefix &&
    otherVehicles.some(
      (vehicle) => effectiveTopicPrefixFromProperties(vehicle.properties) === effectiveTopicPrefix,
    )
  ) {
    issues.push({
      field: 'effectiveTopicPrefix',
      message: `MQTT topic 前缀 '${effectiveTopicPrefix}' 已被使用`,
    });
  }

  const identity = `${manufacturer}/${serialNumber}`;
  if (
    manufacturer &&
    serialNumber &&
    otherVehicles.some((vehicle) => {
      const otherManufacturer = (
        vehicle.properties[VDA5050_PROPERTY_KEYS.manufacturer] ?? ''
      ).trim();
      const otherSerial = (vehicle.properties[VDA5050_PROPERTY_KEYS.serialNumber] ?? '').trim();
      return `${otherManufacturer}/${otherSerial}` === identity;
    })
  ) {
    issues.push({
      field: VDA5050_PROPERTY_KEYS.serialNumber,
      message: `manufacturer + serialNumber '${identity}' 已被使用`,
    });
  }

  return issues;
}
export function buildAgvVehicleProperties(
  input: AgvRegistrationForm,
  base: Record<string, string> = {},
): Record<string, string> {
  const form = normalizeAgvRegistrationForm(input);
  const next = { ...base };
  for (const key of AGV_REGISTRATION_MANAGED_PROPERTY_KEYS) {
    delete next[key];
  }

  next[TCS_PROPERTY_KEYS.preferredAdapterClass] = VDA5050_COMM_ADAPTER_CLASS;
  next[VDA5050_PROPERTY_KEYS.version] = VDA5050_VERSION;
  next[VDA5050_PROPERTY_KEYS.manufacturer] = form.manufacturer;
  next[VDA5050_PROPERTY_KEYS.serialNumber] = form.serialNumber;
  next[BYD_AGV_PROPERTY_KEYS.model] = form.model;
  next[BYD_AGV_PROPERTY_KEYS.region] = form.region;
  next[BYD_AGV_PROPERTY_KEYS.registrationSource] = 'agv-registry';

  if (form.topicPrefix) {
    next[VDA5050_PROPERTY_KEYS.topicPrefix] = form.topicPrefix;
  }
  if (form.interfaceName) {
    next[VDA5050_PROPERTY_KEYS.interfaceName] = form.interfaceName;
  }
  if (form.macAddress) {
    next[BYD_AGV_PROPERTY_KEYS.macAddress] = form.macAddress;
  }

  return next;
}

export function effectiveTopicPrefixForForm(input: AgvRegistrationForm): string {
  const form = normalizeAgvRegistrationForm(input);
  if (form.topicPrefix) return form.topicPrefix;
  if (!form.interfaceName || !form.manufacturer || !form.serialNumber) return '';
  return `${form.interfaceName}/v2/${form.manufacturer}/${form.serialNumber}`;
}

export function effectiveTopicPrefixFromProperties(properties: Record<string, string>): string {
  return effectiveTopicPrefixForForm({
    name: '',
    model: '',
    region: '',
    macAddress: '',
    topicPrefix: properties[VDA5050_PROPERTY_KEYS.topicPrefix] ?? '',
    interfaceName: properties[VDA5050_PROPERTY_KEYS.interfaceName] ?? '',
    manufacturer: properties[VDA5050_PROPERTY_KEYS.manufacturer] ?? '',
    serialNumber: properties[VDA5050_PROPERTY_KEYS.serialNumber] ?? '',
  });
}

export function missingVda5050Fields(properties: Record<string, string>): string[] {
  const missing: string[] = [];
  if (
    (properties[TCS_PROPERTY_KEYS.preferredAdapterClass] ?? '').trim() !==
    VDA5050_COMM_ADAPTER_CLASS
  ) {
    missing.push(TCS_PROPERTY_KEYS.preferredAdapterClass);
  }
  if ((properties[VDA5050_PROPERTY_KEYS.version] ?? '').trim() !== VDA5050_VERSION) {
    missing.push(VDA5050_PROPERTY_KEYS.version);
  }
  if (!(properties[VDA5050_PROPERTY_KEYS.manufacturer] ?? '').trim()) {
    missing.push(VDA5050_PROPERTY_KEYS.manufacturer);
  }
  if (!(properties[VDA5050_PROPERTY_KEYS.serialNumber] ?? '').trim()) {
    missing.push(VDA5050_PROPERTY_KEYS.serialNumber);
  }
  if (
    !(properties[VDA5050_PROPERTY_KEYS.topicPrefix] ?? '').trim() &&
    !(properties[VDA5050_PROPERTY_KEYS.interfaceName] ?? '').trim()
  ) {
    missing.push('vda5050:topicPrefix|vda5050:interfaceName');
  }
  return missing;
}

function normalizeMacAddress(input: string): string {
  return input.trim().toUpperCase();
}

function isAgvVehicleModel(input: string | undefined): input is AgvVehicleModel {
  return AGV_VEHICLE_MODELS.includes(input as AgvVehicleModel);
}

function isAgvRegion(input: string | undefined): input is AgvRegion {
  return AGV_REGIONS.includes(input as AgvRegion);
}

function isTopicSegment(input: string): boolean {
  return TOPIC_SEGMENT_RE.test(input);
}

function isValidTopicPrefix(input: string): boolean {
  return (
    input.length > 0 &&
    !input.startsWith('/') &&
    !input.endsWith('/') &&
    !input.includes('//') &&
    !/[\s#+]/.test(input)
  );
}
