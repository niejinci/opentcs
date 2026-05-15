// SPDX-FileCopyrightText: The openTCS Authors
// SPDX-License-Identifier: MIT
import { apiClient } from '../client';
import type { Vehicle } from '../types/bff';

/** `GET /api/v1/vehicles` — list all vehicles known to the kernel. */
export function listVehicles(): Promise<Vehicle[]> {
  return apiClient.get<Vehicle[]>('/api/v1/vehicles');
}

/** `GET /api/v1/vehicles/{name}` — fetch a single vehicle by its name. */
export function getVehicleByName(name: string): Promise<Vehicle> {
  return apiClient.get<Vehicle>(`/api/v1/vehicles/${encodeURIComponent(name)}`);
}
