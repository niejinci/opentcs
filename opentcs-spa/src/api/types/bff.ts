// SPDX-FileCopyrightText: The openTCS Authors
// SPDX-License-Identifier: MIT
//
// Hand-written TypeScript views of the BFF OpenAPI schemas used in S2.
//
// Source of truth: `opentcs-bff/src/main/resources/openapi/bff.yaml`.
// Field names / units / nullability MUST stay 1:1 with the YAML — when the
// BFF spec changes, edit this file in the same PR (or, from S3 onwards,
// regenerate via `openapi-typescript` once that dependency is introduced).
//
// We intentionally do NOT introduce `openapi-typescript` in S2 to keep the
// infra layer dependency-free; codegen lands when more endpoints are
// consumed (S6+).

/* ------------------------------------------------------------------ */
/* Errors                                                              */
/* ------------------------------------------------------------------ */

/** Mirrors `components.schemas.ErrorResponse` in `bff.yaml`. */
export interface BffErrorResponse {
  /** Machine-readable error code. */
  code: string;
  /** Human-readable error description. */
  message: string;
  /** Correlation id, also echoed in the `X-Trace-Id` response header. */
  traceId?: string | null;
  /** Optional pointer to the offending field (e.g. `paths[name=p1].sourcePoint`). */
  fieldPath?: string | null;
}

/* ------------------------------------------------------------------ */
/* Health                                                              */
/* ------------------------------------------------------------------ */

/** Body returned by `GET /health` (see `HealthHandler`). */
export interface HealthResponse {
  status: 'UP' | string;
}

/* ------------------------------------------------------------------ */
/* Vehicles                                                            */
/* ------------------------------------------------------------------ */

export type VehicleState = 'UNKNOWN' | 'UNAVAILABLE' | 'ERROR' | 'IDLE' | 'EXECUTING' | 'CHARGING';

export type VehicleProcState = 'IDLE' | 'AWAITING_ORDER' | 'PROCESSING_ORDER';

export type VehicleIntegrationLevel =
  | 'TO_BE_IGNORED'
  | 'TO_BE_NOTICED'
  | 'TO_BE_RESPECTED'
  | 'TO_BE_UTILIZED';

export type VehicleOperatingMode =
  | 'AUTOMATIC'
  | 'SEMIAUTOMATIC'
  | 'MANUAL'
  | 'SERVICE'
  | 'TEACHIN';

/** Mirrors `components.schemas.Triple`. Units = millimetres, integer. */
export interface BffTriple {
  x: number;
  y: number;
  z: number;
}

/** Mirrors `components.schemas.Vehicle`. */
export interface Vehicle {
  name: string;
  state: VehicleState;
  procState: VehicleProcState;
  integrationLevel: VehicleIntegrationLevel;
  operatingMode?: VehicleOperatingMode | null;
  /** ISO-8601 timestamp when the VDA5050 adapter last received a state message. */
  lastStateAt?: string | null;
  paused: boolean;
  energyLevel: number;
  currentPosition?: string | null;
  /**
   * Measured AGV pose position in millimetres, as reported by the comm-adapter.
   * Distinct from `currentPosition` (which is the kernel-resolved nearest Point name).
   * `null` when the adapter has not reported a precise pose yet.
   */
  precisePosition?: BffTriple | null;
  /**
   * Measured orientation in degrees in the range [-360, 360], as reported by the
   * comm-adapter. `null` when the adapter has not reported an orientation yet
   * (kernel `Double.NaN` is normalised to `null` by the BFF).
   */
  orientationAngle?: number | null;
  /** Optional key/value properties attached to the vehicle. */
  properties?: Record<string, string> | null;
}

export type Vda5050BlockingType = 'NONE' | 'SOFT' | 'HARD';

export type InstantActionParameterValue =
  | string
  | number
  | boolean
  | Array<string | number | boolean>;

export interface InstantActionParameter {
  key: string;
  value: InstantActionParameterValue;
}

export interface InstantAction {
  actionType: string;
  actionId: string;
  actionDescription?: string | null;
  blockingType: Vda5050BlockingType;
  actionParameters?: InstantActionParameter[] | null;
}

export interface InstantActionsRequest {
  actions: InstantAction[];
}

/* ------------------------------------------------------------------ */
/* Transport orders                                                    */
/* ------------------------------------------------------------------ */

/** Mirrors `components.schemas.Destination`. */
export interface Destination {
  locationName: string;
  operation: string;
  properties?: Record<string, string> | null;
}

/**
 * Mirrors `components.schemas.TransportOrderState` — verbatim copy of the
 * Kernel's `org.opentcs.data.order.TransportOrder.State` enum. Mid-life
 * states `DISPATCHABLE` / `WITHDRAWN` are forwarded as-is even though the
 * acceptance criteria only mention four happy-path states.
 */
export type TransportOrderState =
  | 'RAW'
  | 'ACTIVE'
  | 'DISPATCHABLE'
  | 'BEING_PROCESSED'
  | 'WITHDRAWN'
  | 'FINISHED'
  | 'FAILED'
  | 'UNROUTABLE';

/** Mirrors `components.schemas.TransportOrder`. */
export interface TransportOrder {
  name: string;
  type: string;
  state: TransportOrderState;
  intendedVehicle?: string | null;
  processingVehicle?: string | null;
  destinations: Destination[];
}

/** Mirrors `components.schemas.TransportOrderRequest`. */
export interface TransportOrderRequest {
  name: string;
  incompleteName?: boolean;
  dispensable?: boolean;
  intendedVehicle?: string | null;
  type?: string | null;
  deadline?: string | null;
  destinations: Destination[];
  dependencies?: string[] | null;
  wrappingSequence?: string | null;
  peripheralReservationToken?: string | null;
  properties?: Record<string, string> | null;
}

/**
 * Standard point-destination operations exposed by the SPA. Location
 * destinations are model-driven and may use arbitrary strings from the
 * referenced LocationType's allowedOperations.
 */
export const TRANSPORT_ORDER_OPERATIONS = ['NOP', 'MOVE', 'PARK'] as const;
export type TransportOrderOperation = (typeof TRANSPORT_ORDER_OPERATIONS)[number];


/* ------------------------------------------------------------------ */
/* Warehouse                                                           */
/* ------------------------------------------------------------------ */

export interface WarehouseLoadDetect {
  MinLoadingHeight: number;
  LoadSensor: boolean;
  LoadDetectType: number;
  QrCodeSensor: boolean;
  QrCodeMin: number;
  QrCodeMax: number;
}

/** Mirrors one entry under the BFF on-disk `{ "WaresType": [...] }` JSON envelope. */
export interface WarehouseType {
  QrCenterLeft?: number | null;
  LoadDetect: WarehouseLoadDetect;
  QrCenterBack?: number | null;
  WareModel: string;
  LegLength: number;
  PutHeight: number;
  LegInnerWidth: number;
  CollisionAvoidanceAreaType: number;
  LegInnerLength: number;
  Name: string;
  QrCenterFront?: number | null;
  LegHeight: number;
  QrCodeRectifyType: string;
  Length: number;
  LegWidth: number;
  AllowRotate: boolean;
  PickHeight: number;
  Height: number;
  Id: string;
  DefaultOrientationType: string;
  Width: number;
  Manageable: boolean;
}

export interface WarehouseRack {
  id: string;
  name: string;
  code: string;
  carrierBottomCode: string;
  typeCode: string;
  typeName: string;
  warehouseKind: string;
  region: string;
  mapName: string;
  storageCode: string;
  locationName: string;
  lockStatus: string;
  emptyStatus: string;
  vehicleName: string;
  containerInfo: string;
  enabled: boolean;
  updatedAt: string;
}

export type ChargingPileRuntimeStatus = 'UNKNOWN' | 'IDLE' | 'CHARGING' | 'FAULT' | 'OFFLINE';

export type ChargingPileOccupancyStatus = 'FREE' | 'OCCUPIED' | 'DISABLED';

export interface ChargingPile {
  id?: string;
  name: string;
  region: string;
  mapName: string;
  boundPointName: string;
  locationName?: string;
  locationTypeName?: string;
  operation?: string;
  chargerType?: string;
  sn?: string;
  ip?: string;
  enabled: boolean;
  runtimeStatus?: ChargingPileRuntimeStatus;
  occupancyStatus?: ChargingPileOccupancyStatus;
  occupiedByVehicle?: string;
  activeOrderName?: string;
  chargingSince?: string;
  requiresPublish?: boolean;
  updatedAt?: string;
}

/* ------------------------------------------------------------------ */
/* SSE                                                                 */
/* ------------------------------------------------------------------ */

/**
 * The two SSE event names the BFF emits on `/api/v1/sse`. Mirrors the
 * description of the `streamEvents` operation in `bff.yaml`.
 */
export const SSE_EVENT_VEHICLES = '/events/vehicles' as const;
export const SSE_EVENT_TRANSPORT_ORDERS = '/events/transportOrders' as const;
export type SseEventName = typeof SSE_EVENT_VEHICLES | typeof SSE_EVENT_TRANSPORT_ORDERS;

/**
 * Mirrors `components.schemas.SseEventEnvelope`. `currentObjectState` is
 * `null` for object-removed events; `previousObjectState` is `null` for
 * object-created events. The concrete object type depends on the event
 * name (see `SseEventName`).
 */
export interface SseEventEnvelope<T = Vehicle | TransportOrder> {
  currentObjectState: T | null;
  previousObjectState: T | null;
}

