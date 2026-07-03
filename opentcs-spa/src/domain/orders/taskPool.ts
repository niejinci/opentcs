import type { TransportOrder, TransportOrderState } from '@/api/types/bff';

export type TaskPoolBucketId = 'active' | 'pending' | 'processing' | 'abnormal' | 'finished';
export type TaskPoolDrilldownId = Exclude<TaskPoolBucketId, 'finished'>;

export interface TaskPoolCounts {
  active: number;
  pending: number;
  processing: number;
  abnormal: number;
  finished: number;
  total: number;
}

export const PENDING_ORDER_STATES: ReadonlySet<TransportOrderState> = new Set([
  'RAW',
  'ACTIVE',
  'DISPATCHABLE',
]);
export const PROCESSING_ORDER_STATES: ReadonlySet<TransportOrderState> = new Set([
  'BEING_PROCESSED',
]);
export const ABNORMAL_ORDER_STATES: ReadonlySet<TransportOrderState> = new Set([
  'FAILED',
  'UNROUTABLE',
]);
export const FINISHED_ORDER_STATES: ReadonlySet<TransportOrderState> = new Set([
  'FINISHED',
  'WITHDRAWN',
]);

const ORDER_STATE_WEIGHT: Record<TransportOrderState, number> = {
  FAILED: 0,
  UNROUTABLE: 0,
  BEING_PROCESSED: 1,
  RAW: 2,
  ACTIVE: 2,
  DISPATCHABLE: 2,
  FINISHED: 3,
  WITHDRAWN: 3,
};

export function taskPoolBucketForState(state: TransportOrderState): TaskPoolBucketId {
  if (PENDING_ORDER_STATES.has(state)) return 'pending';
  if (PROCESSING_ORDER_STATES.has(state)) return 'processing';
  if (ABNORMAL_ORDER_STATES.has(state)) return 'abnormal';
  if (FINISHED_ORDER_STATES.has(state)) return 'finished';
  return 'active';
}

export function taskPoolCounts(orders: readonly TransportOrder[]): TaskPoolCounts {
  const counts: TaskPoolCounts = {
    active: 0,
    pending: 0,
    processing: 0,
    abnormal: 0,
    finished: 0,
    total: orders.length,
  };

  for (const order of orders) {
    const bucket = taskPoolBucketForState(order.state);
    if (bucket !== 'active') {
      counts[bucket] += 1;
    }
  }
  counts.active = counts.pending + counts.processing + counts.abnormal;
  return counts;
}

export function taskPoolOrdersForBucket(
  orders: readonly TransportOrder[],
  bucket: TaskPoolDrilldownId,
): TransportOrder[] {
  return orders
    .filter((order) => {
      const orderBucket = taskPoolBucketForState(order.state);
      if (bucket === 'active') {
        return (
          orderBucket === 'pending' || orderBucket === 'processing' || orderBucket === 'abnormal'
        );
      }
      return orderBucket === bucket;
    })
    .sort(
      (a, b) =>
        ORDER_STATE_WEIGHT[a.state] - ORDER_STATE_WEIGHT[b.state] || a.name.localeCompare(b.name),
    );
}

export function taskPoolAbnormalOrders(orders: readonly TransportOrder[]): TransportOrder[] {
  return taskPoolOrdersForBucket(orders, 'abnormal');
}
