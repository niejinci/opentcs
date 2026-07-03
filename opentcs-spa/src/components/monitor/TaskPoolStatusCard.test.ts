import { mount } from '@vue/test-utils';
import { beforeEach, describe, expect, it } from 'vitest';

import type { TransportOrder } from '@/api/types/bff';
import TaskPoolStatusCard from './TaskPoolStatusCard.vue';

const counts = {
  active: 5,
  pending: 3,
  processing: 1,
  abnormal: 1,
  finished: 2,
  total: 7,
};

function order(patch: Partial<TransportOrder>): TransportOrder {
  return {
    name: 'order-1',
    type: 'test',
    state: 'FAILED',
    destinations: [],
    ...patch,
  };
}

describe('TaskPoolStatusCard', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('renders task pool health counts and abnormal order preview', () => {
    const wrapper = mount(TaskPoolStatusCard, {
      props: {
        counts,
        orders: [order({ name: 'failed-order', processingVehicle: 'AGV-1' })],
        sseState: 'open',
      },
    });

    expect(wrapper.text()).toContain('任务池健康');
    expect(wrapper.text()).toContain('需处理 · 实时');
    expect(wrapper.text()).toContain('活跃任务');
    expect(wrapper.text()).toContain('待执行');
    expect(wrapper.text()).toContain('执行中');
    expect(wrapper.text()).toContain('异常');
    expect(wrapper.text()).toContain('异常任务');
    expect(wrapper.text()).toContain('failed-order');
    expect(wrapper.text()).toContain('车辆 AGV-1');
  });

  it('drills into pending, processing, abnormal and active task lists', async () => {
    const wrapper = mount(TaskPoolStatusCard, {
      props: {
        counts: {
          active: 3,
          pending: 1,
          processing: 1,
          abnormal: 1,
          finished: 0,
          total: 3,
        },
        orders: [
          order({
            name: 'pending-order',
            state: 'RAW',
            destinations: [{ locationName: 'Location-1', operation: 'pick' }],
          }),
          order({
            name: 'processing-order',
            state: 'BEING_PROCESSED',
            processingVehicle: 'AGV-2',
            destinations: [
              { locationName: 'Location-2', operation: 'drop' },
              { locationName: 'Point-16', operation: 'MOVE' },
            ],
          }),
          order({ name: 'failed-order', state: 'FAILED' }),
        ],
        sseState: 'open',
      },
    });

    await wrapper.get('[data-testid="task-pool-metric-pending"]').trigger('click');
    expect(wrapper.text()).toContain('待执行任务');
    expect(wrapper.text()).toContain('pending-order');
    expect(wrapper.text()).toContain('Location-1 / pick');

    await wrapper.get('[data-testid="task-pool-metric-processing"]').trigger('click');
    expect(wrapper.text()).toContain('执行中任务');
    expect(wrapper.text()).toContain('processing-order');
    expect(wrapper.text()).toContain('车辆 AGV-2');
    expect(wrapper.text()).toContain('Location-2 / drop -> Point-16 / MOVE');

    await wrapper.get('[data-testid="task-pool-metric-active"]').trigger('click');
    expect(wrapper.text()).toContain('活跃任务');
    expect(wrapper.text()).toContain('failed-order');
    expect(wrapper.text()).toContain('processing-order');
    expect(wrapper.text()).toContain('pending-order');
  });

  it('collapses into a compact chip and persists the preference', async () => {
    const wrapper = mount(TaskPoolStatusCard, {
      props: {
        counts,
        orders: [],
        sseState: 'open',
      },
    });

    await wrapper.find('.collapse-button').trigger('click');

    expect(wrapper.find('.task-pool-card').exists()).toBe(false);
    expect(wrapper.find('.task-pool-chip').text()).toContain('任务池 5');
    expect(localStorage.getItem('dd-opentcs.monitor.taskPoolStatus.collapsed')).toBe('true');
  });
});
