// SPDX-FileCopyrightText: The openTCS Authors
// SPDX-License-Identifier: MIT
//
// S9 — thin factory around `src/api/sse.ts` so the rest of the SPA never
// needs to `new SseClient()` (and, transitively, never reaches for the
// raw `EventSource`). Centralising this here keeps the "one SSE client
// per app" invariant local to `useLiveStatusStore`.
//
// Why a dedicated module rather than inline construction in the store?
// The task spec explicitly groups SSE alongside the other endpoint
// modules (`src/api/endpoints/{transportOrders,sseEvents}.ts`), and a
// separate file also gives integration tests a single place to monkey-
// patch when stubbing the server stream.

import { SseClient, type SseClientOptions } from '../sse';

/**
 * Opens an SSE connection subscribed to both vehicle and transport-order
 * events. Returns the (not-yet-connected) client; callers must call
 * `.connect()` exactly once and `.close()` on teardown.
 *
 * `liveStatus` store is the only intended caller; tests may instantiate
 * extra clients via this factory too, but production code goes through
 * the store.
 */
export function openLiveStatusStream(options: SseClientOptions): SseClient {
  return new SseClient({
    vehicles: true,
    transportOrders: true,
    ...options,
  });
}
