// SPDX-FileCopyrightText: The openTCS Authors
// SPDX-License-Identifier: MIT

import type { TransportOrder, Vehicle } from '@/api/types/bff';

export type VehicleMonitorCategoryId =
  | 'all'
  | 'working'
  | 'charging'
  | 'waiting'
  | 'confirming'
  | 'debugging'
  | 'paused'
  | 'transferring'
  | 'blocked'
  | 'error'
  | 'disabled'
  | 'offline';

export interface VehicleMonitorCategory {
  id: VehicleMonitorCategoryId;
  label: string;
}

export interface VehicleMonitorRow {
  vehicle: Vehicle;
  activeOrder: TransportOrder | null;
  categories: VehicleMonitorCategoryId[];
}

export const VEHICLE_MONITOR_CATEGORIES: readonly VehicleMonitorCategory[] = Object.freeze([
  { id: 'all', label: '全部' },
  { id: 'working', label: '作业' },
  { id: 'charging', label: '充电' },
  { id: 'waiting', label: '等待' },
  { id: 'confirming', label: '确认' },
  { id: 'debugging', label: '调试' },
  { id: 'paused', label: '暂停' },
  { id: 'transferring', label: '中转' },
  { id: 'blocked', label: '停障' },
  { id: 'error', label: '异常' },
  { id: 'disabled', label: '禁用' },
  { id: 'offline', label: '离线' },
]);

const ACTIVE_ORDER_STATES = new Set<TransportOrder['state']>([
  'RAW',
  'ACTIVE',
  'DISPATCHABLE',
  'BEING_PROCESSED',
]);

function isActiveOrder(order: TransportOrder): boolean {
  return ACTIVE_ORDER_STATES.has(order.state);
}

export function activeOrderForVehicle(
  vehicle: Vehicle,
  orders: readonly TransportOrder[],
): TransportOrder | null {
  return (
    orders.find(
      (order) =>
        isActiveOrder(order) &&
        (order.processingVehicle === vehicle.name || order.intendedVehicle === vehicle.name),
    ) ?? null
  );
}

function propertyFlag(vehicle: Vehicle, keys: readonly string[]): boolean {
  const props = vehicle.properties ?? {};
  return keys.some((key) => {
    const value = props[key];
    if (value === undefined) return false;
    const normalized = value.trim().toLowerCase();
    return (
      normalized === 'true' || normalized === '1' || normalized === 'yes' || normalized === key
    );
  });
}

export function categoriesForVehicle(
  vehicle: Vehicle,
  activeOrder: TransportOrder | null,
): VehicleMonitorCategoryId[] {
  const ids: VehicleMonitorCategoryId[] = ['all'];

  if (vehicle.state === 'UNAVAILABLE') ids.push('offline');
  if (vehicle.integrationLevel === 'TO_BE_IGNORED') ids.push('disabled');
  if (vehicle.state === 'ERROR') ids.push('error');
  if (vehicle.state === 'CHARGING') ids.push('charging');
  if (vehicle.paused) ids.push('paused');
  if (vehicle.state === 'EXECUTING' || vehicle.procState === 'PROCESSING_ORDER' || activeOrder) {
    ids.push('working');
  }
  if (vehicle.state === 'IDLE' && vehicle.procState !== 'PROCESSING_ORDER' && !activeOrder) {
    ids.push('waiting');
  }

  // These lanxin-style buckets do not have first-class fields in the current
  // BFF Vehicle DTO. Keep them deterministic by reading optional properties
  // only when adapters/projects provide them.
  if (propertyFlag(vehicle, ['monitor:confirming', 'confirming'])) ids.push('confirming');
  if (propertyFlag(vehicle, ['monitor:debugging', 'debugging'])) ids.push('debugging');
  if (propertyFlag(vehicle, ['monitor:transferring', 'transferring'])) ids.push('transferring');
  if (propertyFlag(vehicle, ['monitor:blocked', 'blocked', 'obstacleBlocked'])) ids.push('blocked');

  return ids;
}

export function buildVehicleMonitorRows(
  vehicles: readonly Vehicle[],
  orders: readonly TransportOrder[],
): VehicleMonitorRow[] {
  return vehicles
    .map((vehicle) => {
      const activeOrder = activeOrderForVehicle(vehicle, orders);
      return {
        vehicle,
        activeOrder,
        categories: categoriesForVehicle(vehicle, activeOrder),
      };
    })
    .sort((a, b) => a.vehicle.name.localeCompare(b.vehicle.name));
}

export function vehicleMonitorCounts(
  rows: readonly VehicleMonitorRow[],
): Record<VehicleMonitorCategoryId, number> {
  const counts = Object.fromEntries(
    VEHICLE_MONITOR_CATEGORIES.map((category) => [category.id, 0]),
  ) as Record<VehicleMonitorCategoryId, number>;
  for (const row of rows) {
    for (const category of row.categories) {
      counts[category] += 1;
    }
  }
  return counts;
}

export function filterVehicleMonitorRows(
  rows: readonly VehicleMonitorRow[],
  category: VehicleMonitorCategoryId,
  query: string,
  group: string,
): VehicleMonitorRow[] {
  const q = query.trim().toLowerCase();
  const g = group.trim();
  return rows.filter((row) => {
    if (!row.categories.includes(category)) return false;
    if (g && (row.vehicle.properties?.group ?? '') !== g) return false;
    if (!q) return true;
    return (
      row.vehicle.name.toLowerCase().includes(q) ||
      (row.vehicle.currentPosition ?? '').toLowerCase().includes(q)
    );
  });
}

export function availableVehicleGroups(rows: readonly VehicleMonitorRow[]): string[] {
  const groups = new Set<string>();
  for (const row of rows) {
    const group = row.vehicle.properties?.group?.trim();
    if (group) groups.add(group);
  }
  return [...groups].sort((a, b) => a.localeCompare(b));
}

export function vehicleHomeUrl(vehicle: Vehicle): string | null {
  const props = vehicle.properties ?? {};
  const direct = props.homepageUrl ?? props.vehicleHomeUrl ?? props.url;
  if (direct?.trim()) return direct.trim();
  const ip = props.ip ?? props.vehicleIp ?? props.host;
  if (!ip?.trim()) return null;
  const trimmed = ip.trim();
  return /^https?:\/\//i.test(trimmed) ? trimmed : `http://${trimmed}`;
}
