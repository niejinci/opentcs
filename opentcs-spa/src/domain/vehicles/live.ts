// SPDX-FileCopyrightText: The openTCS Authors
// SPDX-License-Identifier: MIT

import type { Vehicle, VehicleState } from '@/api/types/bff';

const NON_REALTIME_STATES = new Set<VehicleState>(['UNAVAILABLE', 'UNKNOWN']);

export function isVehicleRealtimeState(state: VehicleState | null | undefined): boolean {
  return state !== null && state !== undefined && !NON_REALTIME_STATES.has(state);
}

export function isVehicleRealtime(vehicle: Pick<Vehicle, 'state'> | null | undefined): boolean {
  return isVehicleRealtimeState(vehicle?.state);
}
