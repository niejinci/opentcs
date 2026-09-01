// SPDX-FileCopyrightText: The openTCS Authors
// SPDX-License-Identifier: MIT

import { apiClient, type RequestOptions } from '../client';
import type { ChargingPile } from '../types/bff';

const BASE = '/api/v1/charging-piles';

export function listChargingPiles(options?: RequestOptions): Promise<ChargingPile[]> {
  return apiClient.get<ChargingPile[]>(BASE, options);
}

export function createChargingPile(
  payload: ChargingPile,
  options?: RequestOptions,
): Promise<ChargingPile> {
  return apiClient.post<ChargingPile>(BASE, payload, options);
}

export function updateChargingPile(
  id: string,
  payload: ChargingPile,
  options?: RequestOptions,
): Promise<ChargingPile> {
  return apiClient.put<ChargingPile>(`${BASE}/${encodeURIComponent(id)}`, payload, options);
}

export function deleteChargingPile(id: string, options?: RequestOptions): Promise<void> {
  return apiClient.delete<void>(`${BASE}/${encodeURIComponent(id)}`, options);
}
