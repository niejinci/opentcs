import { describe, expect, it } from 'vitest';

import type { TransportOrder } from '@/api/types/bff';
import {
  taskPoolAbnormalOrders,
  taskPoolBucketForState,
  taskPoolCounts,
  taskPoolOrdersForBucket,
} from './taskPool';

function order(name: string, state: TransportOrder['state']): TransportOrder {
  return {
    name,
    state,
    type: 'test',
    destinations: [],
  };
}

describe('taskPool', () => {
  it('classifies openTCS transport order states into task pool buckets', () => {
    expect(taskPoolBucketForState('RAW')).toBe('pending');
    expect(taskPoolBucketForState('ACTIVE')).toBe('pending');
    expect(taskPoolBucketForState('DISPATCHABLE')).toBe('pending');
    expect(taskPoolBucketForState('BEING_PROCESSED')).toBe('processing');
    expect(taskPoolBucketForState('FAILED')).toBe('abnormal');
    expect(taskPoolBucketForState('UNROUTABLE')).toBe('abnormal');
    expect(taskPoolBucketForState('FINISHED')).toBe('finished');
    expect(taskPoolBucketForState('WITHDRAWN')).toBe('finished');
  });

  it('counts active, pending, processing, abnormal and finished orders', () => {
    expect(
      taskPoolCounts([
        order('raw', 'RAW'),
        order('active', 'ACTIVE'),
        order('dispatchable', 'DISPATCHABLE'),
        order('processing', 'BEING_PROCESSED'),
        order('failed', 'FAILED'),
        order('unroutable', 'UNROUTABLE'),
        order('finished', 'FINISHED'),
        order('withdrawn', 'WITHDRAWN'),
      ]),
    ).toEqual({
      active: 6,
      pending: 3,
      processing: 1,
      abnormal: 2,
      finished: 2,
      total: 8,
    });
  });

  it('returns abnormal orders sorted by state priority and name', () => {
    expect(
      taskPoolAbnormalOrders([
        order('z-failed', 'FAILED'),
        order('normal', 'BEING_PROCESSED'),
        order('a-unroutable', 'UNROUTABLE'),
      ]).map((item) => item.name),
    ).toEqual(['a-unroutable', 'z-failed']);
  });

  it('returns drilldown orders for active buckets without finished orders', () => {
    const orders = [
      order('pending-order', 'RAW'),
      order('finished-order', 'FINISHED'),
      order('processing-order', 'BEING_PROCESSED'),
      order('failed-order', 'FAILED'),
    ];

    expect(taskPoolOrdersForBucket(orders, 'active').map((item) => item.name)).toEqual([
      'failed-order',
      'processing-order',
      'pending-order',
    ]);
    expect(taskPoolOrdersForBucket(orders, 'pending').map((item) => item.name)).toEqual([
      'pending-order',
    ]);
    expect(taskPoolOrdersForBucket(orders, 'processing').map((item) => item.name)).toEqual([
      'processing-order',
    ]);
  });
});
