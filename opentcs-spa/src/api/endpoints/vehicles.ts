// SPDX-FileCopyrightText: The openTCS Authors
// SPDX-License-Identifier: MIT
import { apiClient, type RequestOptions } from '../client';
import type { Vehicle, VehicleIntegrationLevel } from '../types/bff';

/** `GET /api/v1/vehicles` — list all vehicles known to the kernel. */
export function listVehicles(options?: RequestOptions): Promise<Vehicle[]> {
  return apiClient.get<Vehicle[]>('/api/v1/vehicles', options);
}

/** `GET /api/v1/vehicles/{name}` — fetch a single vehicle by its name. */
export function getVehicleByName(name: string, options?: RequestOptions): Promise<Vehicle> {
  return apiClient.get<Vehicle>(`/api/v1/vehicles/${encodeURIComponent(name)}`, options);
}

/**
 * `PUT /api/v1/vehicles/{name}/integrationLevel` — update a vehicle's integration level.
 *
 * The BFF forwards the change to the kernel via the RMI vehicle service and returns the
 * refreshed vehicle. Use this to bring a vehicle online (`TO_BE_UTILIZED`) before dispatching
 * transport orders, or to take it offline again for maintenance (`TO_BE_IGNORED`).
 */
export function updateVehicleIntegrationLevel(
  name: string,
  integrationLevel: VehicleIntegrationLevel,
  options?: RequestOptions,
): Promise<Vehicle> {
  return apiClient.put<Vehicle>(
    `/api/v1/vehicles/${encodeURIComponent(name)}/integrationLevel`,
    { integrationLevel },
    options,
  );
}
