// SPDX-FileCopyrightText: The openTCS Authors
// SPDX-License-Identifier: MIT

import { apiClient, type RequestOptions } from '../client';
import type { WarehouseRack, WarehouseType } from '../types/bff';

const BASE = '/api/v1/warehouse';

export function listWarehouseTypes(options?: RequestOptions): Promise<WarehouseType[]> {
  return apiClient.get<WarehouseType[]>(`${BASE}/types`, options);
}

export function createWarehouseType(
  payload: WarehouseType,
  options?: RequestOptions,
): Promise<WarehouseType> {
  return apiClient.post<WarehouseType>(`${BASE}/types`, payload, options);
}

export function updateWarehouseType(
  id: string,
  payload: WarehouseType,
  options?: RequestOptions,
): Promise<WarehouseType> {
  return apiClient.put<WarehouseType>(
    `${BASE}/types/${encodeURIComponent(id)}`,
    payload,
    options,
  );
}

export function deleteWarehouseType(id: string, options?: RequestOptions): Promise<void> {
  return apiClient.delete<void>(`${BASE}/types/${encodeURIComponent(id)}`, options);
}

export function listWarehouseRacks(options?: RequestOptions): Promise<WarehouseRack[]> {
  return apiClient.get<WarehouseRack[]>(`${BASE}/racks`, options);
}

export function createWarehouseRack(
  payload: WarehouseRack,
  options?: RequestOptions,
): Promise<WarehouseRack> {
  return apiClient.post<WarehouseRack>(`${BASE}/racks`, payload, options);
}

export function updateWarehouseRack(
  id: string,
  payload: WarehouseRack,
  options?: RequestOptions,
): Promise<WarehouseRack> {
  return apiClient.put<WarehouseRack>(
    `${BASE}/racks/${encodeURIComponent(id)}`,
    payload,
    options,
  );
}

export function deleteWarehouseRack(id: string, options?: RequestOptions): Promise<void> {
  return apiClient.delete<void>(`${BASE}/racks/${encodeURIComponent(id)}`, options);
}
