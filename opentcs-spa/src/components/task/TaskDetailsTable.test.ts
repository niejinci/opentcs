import { mount } from '@vue/test-utils';
import { describe, expect, it } from 'vitest';

import TaskDetailsTable from './TaskDetailsTable.vue';
import { createTaskRow, type TargetOption, type TaskRow } from '@/domain/tasks/createTask';

const targets: TargetOption[] = [
  { name: 'Location-1', kind: 'location', allowedOperations: ['NOP', 'pick'] },
  { name: 'Location-3', kind: 'location', allowedOperations: ['NOP', 'drop'] },
  { name: 'Point-16', kind: 'point', allowedOperations: ['MOVE', 'PARK'] },
];

function row(patch: Partial<TaskRow> = {}): TaskRow {
  return {
    ...createTaskRow(1, 'load'),
    ...patch,
    params: {
      ...createTaskRow(1).params,
      ...patch.params,
    },
  };
}

describe('TaskDetailsTable', () => {
  it('shows only targets supported by the row operation', () => {
    const wrapper = mount(TaskDetailsTable, {
      props: {
        rows: [row()],
        activeRowId: 1,
        targets,
      },
    });

    const options = wrapper.findAll('select[aria-label="目标点位"] option');
    expect(options.map((option) => option.text())).toEqual(['请选择', 'Location-1（NOP / pick）']);
  });

  it('shows an immediate mismatch hint when the selected target does not support the row operation', () => {
    const wrapper = mount(TaskDetailsTable, {
      props: {
        rows: [row({ targetName: 'Location-3', targetKind: 'location' })],
        activeRowId: 1,
        targets,
      },
    });

    const options = wrapper.findAll('select[aria-label="目标点位"] option');
    expect(options.map((option) => option.text())).toEqual([
      '请选择',
      'Location-3（不支持 pick，NOP / drop）',
      'Location-1（NOP / pick）',
    ]);
    expect(wrapper.text()).toContain('Location-3 不支持 pick，可用操作：NOP、drop');
    expect(wrapper.find('select[aria-label="目标点位"]').classes()).toContain('select--invalid');
  });

  it('emits target updates only for supported targets', async () => {
    const wrapper = mount(TaskDetailsTable, {
      props: {
        rows: [row()],
        activeRowId: 1,
        targets,
      },
    });

    await wrapper.find('select[aria-label="目标点位"]').setValue('Location-1');

    expect(wrapper.emitted('update:rows')?.[0][0]).toMatchObject([
      { id: 1, targetName: 'Location-1', targetKind: 'location' },
    ]);
  });

  it('shows only available charging pile locations for charge rows', () => {
    const wrapper = mount(TaskDetailsTable, {
      props: {
        rows: [row({ type: 'charge' })],
        activeRowId: 1,
        targets: [
          { name: 'Work-1', kind: 'location', allowedOperations: ['NOP', 'CHARGE'] },
          {
            name: 'CP-A01',
            kind: 'location',
            allowedOperations: ['NOP', 'CHARGE'],
            isChargingPile: true,
          },
          {
            name: 'CP-A02',
            kind: 'location',
            allowedOperations: ['NOP', 'CHARGE'],
            isChargingPile: true,
            chargeUnavailableReason: '已被车辆 AGV-01 占用充电',
          },
          { name: 'Point-16', kind: 'point', allowedOperations: ['MOVE', 'PARK'] },
        ],
      },
    });

    const options = wrapper.findAll('select[aria-label="目标点位"] option');
    expect(options.map((option) => option.text())).toEqual(['请选择', 'CP-A01（NOP / CHARGE）']);
  });
});
