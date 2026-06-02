// SPDX-FileCopyrightText: The openTCS Authors
// SPDX-License-Identifier: MIT
//
// Unit tests for the timeline-dedup behaviour added in PR3 (acceptance
// items 3.1 / 3.2 / 3.3). Each test exercises one of the previously
// duplicating code paths through the public store API:
//
//   - 3.1: POST response immediately followed by a kernel SSE event for
//          the same RAW order must produce a single timeline entry.
//   - 3.2: Multiple kernel events for the same logical state transition
//          (e.g. property tick followed by a real state change) must
//          collapse to one entry per distinct state.
//   - 3.3: An SSE reconnect that re-delivers the "current" state of an
//          order we already have must not push a phantom timeline row.
//
// We bypass the real SSE client by stubbing `openLiveStatusStream` and
// `listVehicles` so the store's `start()` is a no-op for vehicles and
// the test can synthesize SSE callbacks at will.

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';

import type { TransportOrder, Vehicle, SseEventEnvelope } from '@/api/types/bff';

// Capture the most recent options block handed to `openLiveStatusStream`
// so each test can synthesise SSE deliveries. `connect`/`close` are no-ops
// because the store only stashes the client and never reads its state.
let lastOptions: {
  onVehicleEvent?: (e: SseEventEnvelope<Vehicle>) => void;
  onTransportOrderEvent?: (e: SseEventEnvelope<TransportOrder>) => void;
  onStateChange?: (s: string) => void;
  onError?: () => void;
} = {};

vi.mock('@/api/endpoints/sseEvents', () => ({
  openLiveStatusStream: (opts: typeof lastOptions) => {
    lastOptions = opts;
    return {
      connect: () => {},
      close: () => {},
      getState: () => 'idle',
    };
  },
}));

vi.mock('@/api/endpoints/vehicles', () => ({
  listVehicles: () => Promise.resolve([]),
}));

import { useLiveStatusStore } from '@/stores/liveStatus';

function makeOrder(name: string, state: TransportOrder['state']): TransportOrder {
  return {
    name,
    type: '-',
    state,
    intendedVehicle: null,
    processingVehicle: null,
    destinations: [],
  };
}

describe('liveStatus timeline dedup', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    lastOptions = {};
  });

  it('3.1: POST response + first SSE event for the same order yield a single RAW entry', () => {
    const store = useLiveStatusStore();
    store.start();
    expect(lastOptions.onTransportOrderEvent).toBeDefined();

    const order = makeOrder('order-1', 'RAW');
    // Simulate POST /transport-orders returning the RAW order.
    store.recordCreatedOrder(order);
    // SSE delivers the same object freshly created (prev=null).
    lastOptions.onTransportOrderEvent!({
      currentObjectState: order,
      previousObjectState: null,
    });

    const entries = store.orderTimeline.filter((e) => e.name === 'order-1');
    expect(entries).toHaveLength(1);
    expect(entries[0].state).toBe('RAW');
  });

  it('3.2: each distinct state transition is recorded exactly once', () => {
    const store = useLiveStatusStore();
    store.start();
    const cb = lastOptions.onTransportOrderEvent!;

    // Created.
    cb({ currentObjectState: makeOrder('o', 'RAW'), previousObjectState: null });
    // Kernel emits a property tick (state unchanged) — must be ignored.
    cb({
      currentObjectState: makeOrder('o', 'RAW'),
      previousObjectState: makeOrder('o', 'RAW'),
    });
    // Real transition.
    cb({
      currentObjectState: makeOrder('o', 'DISPATCHABLE'),
      previousObjectState: makeOrder('o', 'RAW'),
    });
    // Duplicate same-transition event (some kernels emit two).
    cb({
      currentObjectState: makeOrder('o', 'DISPATCHABLE'),
      previousObjectState: makeOrder('o', 'RAW'),
    });
    cb({
      currentObjectState: makeOrder('o', 'BEING_PROCESSED'),
      previousObjectState: makeOrder('o', 'DISPATCHABLE'),
    });
    cb({
      currentObjectState: makeOrder('o', 'FINISHED'),
      previousObjectState: makeOrder('o', 'BEING_PROCESSED'),
    });

    // newest-first; recover chronological order with reverse.
    const states = store.orderTimeline
      .filter((e) => e.name === 'o')
      .map((e) => e.state)
      .reverse();
    expect(states).toEqual(['RAW', 'DISPATCHABLE', 'BEING_PROCESSED', 'FINISHED']);
  });

  it('3.3: SSE reconnect re-delivering the same current state is a no-op', () => {
    const store = useLiveStatusStore();
    store.start();
    const cb = lastOptions.onTransportOrderEvent!;

    cb({ currentObjectState: makeOrder('o', 'RAW'), previousObjectState: null });
    cb({
      currentObjectState: makeOrder('o', 'DISPATCHABLE'),
      previousObjectState: makeOrder('o', 'RAW'),
    });
    // After reconnect the bridge re-delivers DISPATCHABLE with prev=null
    // (it has no replay context).
    cb({ currentObjectState: makeOrder('o', 'DISPATCHABLE'), previousObjectState: null });

    const states = store.orderTimeline
      .filter((e) => e.name === 'o')
      .map((e) => e.state);
    expect(states).toEqual(['DISPATCHABLE', 'RAW']); // newest-first, no third entry.
  });

  it('different orders interleave correctly without cross-dedup', () => {
    const store = useLiveStatusStore();
    store.start();
    const cb = lastOptions.onTransportOrderEvent!;

    cb({ currentObjectState: makeOrder('a', 'RAW'), previousObjectState: null });
    cb({ currentObjectState: makeOrder('b', 'RAW'), previousObjectState: null });
    // Repeat 'a' RAW — should be deduped because the most recent entry
    // *for order a* is RAW, even though the global head is now 'b' RAW.
    cb({ currentObjectState: makeOrder('a', 'RAW'), previousObjectState: null });

    expect(store.orderTimeline.filter((e) => e.name === 'a')).toHaveLength(1);
    expect(store.orderTimeline.filter((e) => e.name === 'b')).toHaveLength(1);
  });

  it('removal of an order is recorded even when state matches the last entry', () => {
    const store = useLiveStatusStore();
    store.start();
    const cb = lastOptions.onTransportOrderEvent!;

    cb({
      currentObjectState: makeOrder('o', 'FINISHED'),
      previousObjectState: makeOrder('o', 'BEING_PROCESSED'),
    });
    // Removal: prev set, current null. Same `state` (FINISHED) but
    // `order: null`, so it must still be appended.
    cb({ currentObjectState: null, previousObjectState: makeOrder('o', 'FINISHED') });

    const entries = store.orderTimeline.filter((e) => e.name === 'o');
    expect(entries).toHaveLength(2);
    expect(entries[0].order).toBeNull();
    expect(entries[1].order).not.toBeNull();
  });
});
