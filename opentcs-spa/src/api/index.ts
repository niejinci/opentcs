// SPDX-FileCopyrightText: The openTCS Authors
// SPDX-License-Identifier: MIT
//
// Public re-exports for the API layer. Components MUST import from `@/api`
// (or `@/api/endpoints/*`), never call `fetch` directly.
export { apiClient } from './client';
export type { ApiClient, RequestOptions } from './client';
export { ApiError, HttpError, NetworkError, ParseError, isApiError } from './errors';
export { SseClient } from './sse';
export type { BackoffOptions, SseClientOptions, SseConnectionState } from './sse';
export type {
  BffErrorResponse,
  Destination,
  HealthResponse,
  SseEventEnvelope,
  SseEventName,
  TransportOrder,
  Vehicle,
  VehicleIntegrationLevel,
  VehicleProcState,
  VehicleState,
} from './types/bff';
export { SSE_EVENT_TRANSPORT_ORDERS, SSE_EVENT_VEHICLES } from './types/bff';

export * as endpoints from './endpoints';
