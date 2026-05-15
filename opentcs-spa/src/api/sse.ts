// SPDX-FileCopyrightText: The openTCS Authors
// SPDX-License-Identifier: MIT
//
// SSE client wrapping the browser's native `EventSource`.
//
// Why not the raw `EventSource` directly?
//   1. The BFF's `/api/v1/sse` emits two named events (`/events/vehicles`
//      and `/events/transportOrders`), each with a JSON `data:` payload of
//      `SseEventEnvelope`. Callers want typed handlers, not raw strings.
//   2. The browser's `EventSource` automatically reconnects with a fixed
//      delay and gives no hooks for backoff or "max retries". We add an
//      explicit exponential backoff with jitter and a `STATE` machine.
//   3. `EventSource` cannot send custom headers, so the access-key would
//      have to travel via query string. The current BFF treats an empty
//      access-key as "auth disabled" (see ADR notes in roadmap §3.1) and
//      MVP dev runs with auth disabled — we therefore do NOT append a
//      query parameter today, but the code is structured so that adding
//      `?accessKey=...` later is a one-liner once the BFF supports it.
//
// Design:
//   - Construction does NOT auto-connect; call `.connect()` to start.
//   - `connect()` is idempotent.
//   - `close()` permanently stops the client (no further reconnects).
//   - Reconnection uses exponential backoff: 1s, 2s, 4s, 8s, 16s, 30s
//     (capped), with ±20% jitter so 100 SPAs don't dog-pile a restart.
//   - On every reconnect the connection is re-opened with the same query
//     params; the BFF's "list-on-connect" semantics give callers a fresh
//     snapshot (see openTCS Kernel SSE convention).
//   - State changes are surfaced via `onStateChange` so the UI can show
//     a connection indicator (DebugView uses this).

import { bffUrl } from '@/config/runtime';
import {
  SSE_EVENT_TRANSPORT_ORDERS,
  SSE_EVENT_VEHICLES,
  type SseEventEnvelope,
  type SseEventName,
  type TransportOrder,
  type Vehicle,
} from './types/bff';

export type SseConnectionState = 'idle' | 'connecting' | 'open' | 'reconnecting' | 'closed';

export interface SseClientOptions {
  /** Subscribe to `/events/vehicles`. */
  vehicles?: boolean;
  /** Subscribe to `/events/transportOrders`. */
  transportOrders?: boolean;
  /** Called for each `/events/vehicles` envelope. */
  onVehicleEvent?: (envelope: SseEventEnvelope<Vehicle>) => void;
  /** Called for each `/events/transportOrders` envelope. */
  onTransportOrderEvent?: (envelope: SseEventEnvelope<TransportOrder>) => void;
  /**
   * Called whenever the connection state changes. Useful for status pills
   * in debug / dashboard pages.
   */
  onStateChange?: (state: SseConnectionState) => void;
  /**
   * Called whenever an underlying `EventSource` error fires. Note this
   * does NOT mean "give up" — the client retries automatically. Errors
   * are surfaced so callers can log / toast.
   */
  onError?: (err: Event) => void;
  /** Override the default backoff schedule (mostly for tests). */
  backoff?: BackoffOptions;
}

export interface BackoffOptions {
  /** Initial delay in ms. Default 1000. */
  initialDelayMs?: number;
  /** Maximum delay in ms. Default 30000. */
  maxDelayMs?: number;
  /** Multiplier per failed attempt. Default 2. */
  factor?: number;
  /** Jitter ratio applied to each delay (0..1). Default 0.2. */
  jitter?: number;
}

const DEFAULT_BACKOFF: Required<BackoffOptions> = {
  initialDelayMs: 1000,
  maxDelayMs: 30000,
  factor: 2,
  jitter: 0.2,
};

function nextDelay(attempt: number, opts: Required<BackoffOptions>): number {
  const base = Math.min(opts.maxDelayMs, opts.initialDelayMs * Math.pow(opts.factor, attempt));
  const jitter = base * opts.jitter * (Math.random() * 2 - 1);
  return Math.max(0, Math.round(base + jitter));
}

function buildSseUrl(opts: SseClientOptions): string {
  const params = new URLSearchParams();
  if (opts.vehicles) params.set('vehicles', 'true');
  if (opts.transportOrders) params.set('transportOrders', 'true');
  const qs = params.toString();
  return bffUrl(`/api/v1/sse${qs ? `?${qs}` : ''}`);
}

export class SseClient {
  private readonly options: SseClientOptions;
  private readonly backoff: Required<BackoffOptions>;
  private es: EventSource | null = null;
  private state: SseConnectionState = 'idle';
  private attempt = 0;
  private retryTimer: ReturnType<typeof setTimeout> | null = null;
  private closed = false;

  constructor(options: SseClientOptions) {
    this.options = options;
    this.backoff = { ...DEFAULT_BACKOFF, ...options.backoff };
  }

  /** Returns the current connection state. */
  getState(): SseConnectionState {
    return this.state;
  }

  /** Opens (or re-opens) the SSE stream. Idempotent. */
  connect(): void {
    if (this.closed) {
      throw new Error('SseClient: cannot reconnect a closed client; create a new one');
    }
    if (this.es) {
      return;
    }
    this.openOnce();
  }

  /** Permanently stops the client. No further reconnects will be scheduled. */
  close(): void {
    this.closed = true;
    if (this.retryTimer) {
      clearTimeout(this.retryTimer);
      this.retryTimer = null;
    }
    if (this.es) {
      this.es.close();
      this.es = null;
    }
    this.setState('closed');
  }

  private openOnce(): void {
    const url = buildSseUrl(this.options);
    this.setState(this.attempt === 0 ? 'connecting' : 'reconnecting');
    const es = new EventSource(url);
    this.es = es;

    es.addEventListener('open', () => {
      this.attempt = 0;
      this.setState('open');
    });

    es.addEventListener('error', (err) => {
      // EventSource auto-reconnects internally, but it does so with a fixed
      // delay and silently. We close the underlying object and run our own
      // backoff so the UI can show a "reconnecting in Ns" pill.
      if (this.closed) return;
      this.options.onError?.(err);
      es.close();
      this.es = null;
      this.scheduleReconnect();
    });

    if (this.options.vehicles && this.options.onVehicleEvent) {
      es.addEventListener(SSE_EVENT_VEHICLES, (event) => {
        this.dispatchVehicle(event as MessageEvent<string>);
      });
    }
    if (this.options.transportOrders && this.options.onTransportOrderEvent) {
      es.addEventListener(SSE_EVENT_TRANSPORT_ORDERS, (event) => {
        this.dispatchTransportOrder(event as MessageEvent<string>);
      });
    }
  }

  private scheduleReconnect(): void {
    const delay = nextDelay(this.attempt, this.backoff);
    this.attempt += 1;
    this.setState('reconnecting');
    this.retryTimer = setTimeout(() => {
      this.retryTimer = null;
      if (this.closed) return;
      this.openOnce();
    }, delay);
  }

  private setState(next: SseConnectionState): void {
    if (this.state === next) return;
    this.state = next;
    this.options.onStateChange?.(next);
  }

  private dispatchVehicle(event: MessageEvent<string>): void {
    const parsed = parseEnvelope<Vehicle>(event.data, SSE_EVENT_VEHICLES);
    if (parsed && this.options.onVehicleEvent) {
      this.options.onVehicleEvent(parsed);
    }
  }

  private dispatchTransportOrder(event: MessageEvent<string>): void {
    const parsed = parseEnvelope<TransportOrder>(event.data, SSE_EVENT_TRANSPORT_ORDERS);
    if (parsed && this.options.onTransportOrderEvent) {
      this.options.onTransportOrderEvent(parsed);
    }
  }
}

function parseEnvelope<T>(data: string, name: SseEventName): SseEventEnvelope<T> | null {
  try {
    const json = JSON.parse(data) as unknown;
    if (typeof json !== 'object' || json === null) {
      console.warn(`[sse] Discarding non-object payload for ${name}:`, data);
      return null;
    }
    // Trust the BFF to honour the schema; the type assertion is documented
    // by `SseEventEnvelope` itself (mirror of the OpenAPI schema).
    return json as SseEventEnvelope<T>;
  } catch (err) {
    console.warn(`[sse] Failed to parse JSON payload for ${name}:`, err, data);
    return null;
  }
}
