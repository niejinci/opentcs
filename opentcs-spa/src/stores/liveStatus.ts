// SPDX-FileCopyrightText: The openTCS Authors
// SPDX-License-Identifier: MIT
//
// useLiveStatusStore — single Pinia store that owns the app's *one*
// `SseClient` subscribed to vehicle + transport-order events.
//
// Why a store and not a per-view composable?
//   1. The task spec explicitly mandates "SSE 订阅生命周期挂到一个新
//      Pinia store，在 App.vue 或带 <RouterView> 的上层挂载/卸载；禁止
//      在多处组件各自 new"。
//   2. The user can navigate `editor ↔ orders ↔ projects ↔ editor` and
//      we want a continuous stream so the order-status sidebar (mounted
//      in `EditorView`) keeps scrolling regardless of view churn.
//   3. The reconnect state machine (in `SseClient`) prefers a single
//      long-lived instance — recreating it on every route change would
//      defeat the exponential-backoff schedule.
//
// Lifecycle:
//   - `App.vue` calls `store.start()` once on mount and `store.stop()`
//     on unmount (i.e. SPA tear-down). `start()` is idempotent.
//   - The store exposes reactive `vehicles` / `transportOrders` maps
//     plus an `sseState` indicator consumed by the order-status sidebar
//     for the "重连中…" pill required by the acceptance checks.

import { defineStore } from 'pinia';
import { computed, ref, shallowRef } from 'vue';

import { listVehicles } from '@/api/endpoints/vehicles';
import { openLiveStatusStream } from '@/api/endpoints/sseEvents';
import type { SseClient, SseConnectionState } from '@/api/sse';
import type {
  SseEventEnvelope,
  TransportOrder,
  TransportOrderState,
  Vehicle,
} from '@/api/types/bff';

/**
 * Order-status sidebar entries are surfaced as an ordered ring buffer
 * (newest first) so the UI can scroll like a console log. Each entry
 * keeps the full DTO plus a monotonic `seq` for keying and a Date for
 * "received at" display.
 */
export interface OrderTimelineEntry {
  seq: number;
  receivedAt: number;
  name: string;
  state: TransportOrderState;
  /** Snapshot of the latest payload. `null` once the order is removed. */
  order: TransportOrder | null;
  /** Convenience cache, mostly so tests don't have to re-derive it. */
  previousState: TransportOrderState | null;
}

const ORDER_TIMELINE_CAP = 200;

export const useLiveStatusStore = defineStore('liveStatus', () => {
  /* ----------------------------- State -------------------------------- */

  /** Last-seen vehicle DTO per name. Plain object keyed by name. */
  const vehicles = ref<Record<string, Vehicle>>({});

  /** Last-seen transport-order DTO per name. */
  const transportOrders = ref<Record<string, TransportOrder>>({});

  /** Append-only timeline of order state changes (newest first). */
  const orderTimeline = ref<OrderTimelineEntry[]>([]);

  /** SSE client state — surfaced for the "重连中…" pill. */
  const sseState = ref<SseConnectionState>('idle');

  /**
   * Increments every time the SSE underlying EventSource fires `error`.
   * The sidebar uses this purely to flash a warning toast at most once
   * per disconnect (the SSE client already retries internally).
   */
  const errorCount = ref(0);

  /** Vehicle list pulled via REST when the store starts; useful for
   *  populating the order-form dropdown immediately rather than waiting
   *  for the first SSE snapshot tick. */
  const initialVehiclesLoaded = ref(false);

  /* ----------------------------- Client ------------------------------- */

  const client = shallowRef<SseClient | null>(null);
  let nextSeq = 1;
  let started = false;

  function applyVehicleEnvelope(env: SseEventEnvelope<Vehicle>): void {
    const cur = env.currentObjectState;
    const prev = env.previousObjectState;
    if (cur) {
      vehicles.value = { ...vehicles.value, [cur.name]: cur };
    } else if (prev) {
      const next = { ...vehicles.value };
      delete next[prev.name];
      vehicles.value = next;
    }
  }

  function applyTransportOrderEnvelope(env: SseEventEnvelope<TransportOrder>): void {
    const cur = env.currentObjectState;
    const prev = env.previousObjectState;
    if (cur) {
      const existing = transportOrders.value[cur.name];
      transportOrders.value = { ...transportOrders.value, [cur.name]: cur };
      const previousState = prev?.state ?? existing?.state ?? null;
      // Only append an entry when the state actually changed. The kernel
      // emits an event for every property change (deadline, properties…)
      // and we don't want to spam the sidebar.
      if (!prev || prev.state !== cur.state) {
        pushTimelineEntry({
          seq: nextSeq++,
          receivedAt: Date.now(),
          name: cur.name,
          state: cur.state,
          order: cur,
          previousState: previousState === cur.state ? null : previousState,
        });
      }
    } else if (prev) {
      const next = { ...transportOrders.value };
      delete next[prev.name];
      transportOrders.value = next;
      pushTimelineEntry({
        seq: nextSeq++,
        receivedAt: Date.now(),
        name: prev.name,
        state: prev.state,
        order: null,
        previousState: prev.state,
      });
    }
  }

  function pushTimelineEntry(entry: OrderTimelineEntry): void {
    // Dedupe: skip if the most recent timeline entry for this same order
    // already represents the same `state` and the same "removed" status
    // (`order === null`). This collapses three otherwise-redundant pairs:
    //
    //   1. (PR3 / 3.1) `recordCreatedOrder()` pushes RAW from the POST
    //      response, then SSE delivers the same order with prev=null →
    //      another RAW would otherwise be appended.
    //   2. (PR3 / 3.2) Some kernels emit multiple TCSObjectEvents for the
    //      same logical state transition (e.g. ACTIVE_CHANGED followed by
    //      a property tick that flips state==state). The (!prev) guard
    //      below isn't enough on its own when prev is missing entirely.
    //   3. (PR3 / 3.3) On SSE reconnect the bridge re-delivers the
    //      "current" state of every still-existing order; without this
    //      guard the timeline would gain a phantom row for every active
    //      order each reconnect.
    //
    // We compare against the most recent entry *for this order* rather
    // than the global head, since orders interleave on the timeline.
    const lastForOrder = orderTimeline.value.find((e) => e.name === entry.name);
    if (
      lastForOrder
      && lastForOrder.state === entry.state
      && (lastForOrder.order === null) === (entry.order === null)
    ) {
      return;
    }
    const list = [entry, ...orderTimeline.value];
    if (list.length > ORDER_TIMELINE_CAP) {
      list.length = ORDER_TIMELINE_CAP;
    }
    orderTimeline.value = list;
  }

  /* ----------------------------- Lifecycle ---------------------------- */

  /** Idempotent. Opens the SSE stream + best-effort REST vehicle prime. */
  function start(): void {
    if (started) return;
    started = true;

    // Best-effort REST snapshot so the order form's vehicle dropdown is
    // populated even before the kernel sends its first SSE tick. Failures
    // (e.g. BFF unreachable) are swallowed; the SSE client will surface
    // them via `onError` / state changes anyway, and the form will simply
    // show an empty dropdown until the first SSE tick arrives.
    listVehicles({ toastOnError: false })
      .then((list) => {
        const map: Record<string, Vehicle> = {};
        for (const v of list) {
          map[v.name] = v;
        }
        // Merge rather than overwrite, in case SSE got there first.
        vehicles.value = { ...map, ...vehicles.value };
        initialVehiclesLoaded.value = true;
      })
      .catch(() => {
        // Toast is suppressed on this best-effort prime; SSE state pill
        // is the canonical "BFF is down" indicator.
      });

    const c = openLiveStatusStream({
      vehicles: true,
      transportOrders: true,
      onStateChange: (state) => {
        sseState.value = state;
      },
      onError: () => {
        errorCount.value += 1;
      },
      onVehicleEvent: (env) => {
        applyVehicleEnvelope(env);
      },
      onTransportOrderEvent: (env) => {
        applyTransportOrderEnvelope(env);
      },
    });
    client.value = c;
    c.connect();
  }

  /** Stops the SSE client and clears state. Safe to call when not started. */
  function stop(): void {
    if (!started) return;
    started = false;
    if (client.value) {
      client.value.close();
      client.value = null;
    }
    vehicles.value = {};
    transportOrders.value = {};
    orderTimeline.value = [];
    sseState.value = 'idle';
    errorCount.value = 0;
    initialVehiclesLoaded.value = false;
  }

  /** Manually insert an order returned by `POST /transport-orders` so the
   *  sidebar shows it immediately, even if the SSE tick is delayed. */
  function recordCreatedOrder(order: TransportOrder): void {
    transportOrders.value = { ...transportOrders.value, [order.name]: order };
    pushTimelineEntry({
      seq: nextSeq++,
      receivedAt: Date.now(),
      name: order.name,
      state: order.state,
      order,
      previousState: null,
    });
  }

  /* ----------------------------- Getters ------------------------------ */

  const vehicleList = computed<Vehicle[]>(() =>
    Object.values(vehicles.value).sort((a, b) => a.name.localeCompare(b.name)),
  );

  const activeOrders = computed<TransportOrder[]>(() =>
    Object.values(transportOrders.value)
      .filter((o) => o.state !== 'FINISHED' && o.state !== 'FAILED' && o.state !== 'UNROUTABLE')
      .sort((a, b) => a.name.localeCompare(b.name)),
  );

  const isReconnecting = computed(() => sseState.value === 'reconnecting');
  const isConnected = computed(() => sseState.value === 'open');

  return {
    // state
    vehicles,
    transportOrders,
    orderTimeline,
    sseState,
    errorCount,
    initialVehiclesLoaded,
    // getters
    vehicleList,
    activeOrders,
    isReconnecting,
    isConnected,
    // actions
    start,
    stop,
    recordCreatedOrder,
  };
});
