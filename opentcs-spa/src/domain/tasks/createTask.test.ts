import { describe, expect, it } from 'vitest';

import {
  buildTransportOrderRequest,
  CHARGE_DURATION_PROPERTY_KEY,
  CHARGE_DURATION_VALIDATION_MESSAGE,
  createTaskRow,
  DESTINATION_ACTION_PROPERTY_PREFIX,
  destinationProperties,
  isValidChargeDurationMinutes,
  operationForTask,
  validateTaskRows,
  type TaskRow,
} from './createTask';

function row(patch: Partial<TaskRow>): TaskRow {
  return {
    ...createTaskRow(1),
    targetName: 'Goal-1',
    targetKind: 'location',
    ...patch,
    params: {
      ...createTaskRow(1).params,
      ...patch.params,
    },
  };
}

describe('create task order mapping', () => {
  it('maps fixed task types to kernel destination operations', () => {
    expect(operationForTask(row({ type: 'load' }))).toBe('pick');
    expect(operationForTask(row({ type: 'unload' }))).toBe('drop');
    expect(operationForTask(row({ type: 'charge' }))).toBe('startCharging');
    expect(operationForTask(row({ type: 'move' }))).toBe('MOVE');
  });

  it('builds VDA5050 destinationAction parameters for load/unload rows', () => {
    const props = destinationProperties(
      row({
        type: 'load',
        params: {
          loadId: 'RK-001',
          loadType: 'JJ27TY',
          height: '0.04',
          chargeDurationMinutes: '',
        },
      }),
    );

    expect(props).toEqual({
      [`${DESTINATION_ACTION_PROPERTY_PREFIX}.parameter.loadId`]: 'RK-001',
      [`${DESTINATION_ACTION_PROPERTY_PREFIX}.parameter.loadType`]: 'JJ27TY',
      [`${DESTINATION_ACTION_PROPERTY_PREFIX}.parameter.height`]: 'float:0.04',
    });
  });

  it('builds VDA5050 startCharging duration parameter for charge rows', () => {
    const props = destinationProperties(
      row({
        type: 'charge',
        params: {
          loadId: '',
          loadType: '',
          height: '',
          chargeDurationMinutes: '15',
        },
      }),
    );

    expect(props).toEqual({
      [CHARGE_DURATION_PROPERTY_KEY]: 'float:15',
    });
  });

  it('builds a transport order request with destination properties', () => {
    const request = buildTransportOrderRequest({
      intendedVehicle: 'NU0088',
      now: 123,
      rows: [
        row({
          id: 1,
          type: 'load',
          targetName: 'Goal_A',
          params: {
            loadId: 'L-1',
            loadType: 'Box',
            height: '0.03',
            chargeDurationMinutes: '',
          },
        }),
        row({
          id: 2,
          type: 'move',
          targetName: 'Point_B',
          targetKind: 'point',
        }),
      ],
    });

    expect(request.name).toBe('spa-create-task-123');
    expect(request.intendedVehicle).toBe('NU0088');
    expect(request.type).toBe('BYD_CREATE_TASK');
    expect(request.destinations).toEqual([
      {
        locationName: 'Goal_A',
        operation: 'pick',
        properties: {
          [`${DESTINATION_ACTION_PROPERTY_PREFIX}.parameter.loadId`]: 'L-1',
          [`${DESTINATION_ACTION_PROPERTY_PREFIX}.parameter.loadType`]: 'Box',
          [`${DESTINATION_ACTION_PROPERTY_PREFIX}.parameter.height`]: 'float:0.03',
        },
      },
      {
        locationName: 'Point_B',
        operation: 'MOVE',
        properties: null,
      },
    ]);
  });

  it('validates optional charge duration minute range', () => {
    expect(isValidChargeDurationMinutes('')).toBe(true);
    expect(isValidChargeDurationMinutes(' 15 ')).toBe(true);
    expect(isValidChargeDurationMinutes('1')).toBe(true);
    expect(isValidChargeDurationMinutes('480')).toBe(true);

    expect(isValidChargeDurationMinutes('0')).toBe(false);
    expect(isValidChargeDurationMinutes('481')).toBe(false);
    expect(isValidChargeDurationMinutes('1.5')).toBe(false);
    expect(isValidChargeDurationMinutes('-1')).toBe(false);
    expect(isValidChargeDurationMinutes('abc')).toBe(false);
  });

  it('validates invalid charge duration only on charge rows', () => {
    expect(
      validateTaskRows([
        row({
          type: 'charge',
          params: {
            loadId: '',
            loadType: '',
            height: '',
            chargeDurationMinutes: '481',
          },
        }),
      ]),
    ).toContain(`第 1 行 ${CHARGE_DURATION_VALIDATION_MESSAGE}`);

    expect(
      validateTaskRows([
        row({
          type: 'charge',
          params: {
            loadId: '',
            loadType: '',
            height: '',
            chargeDurationMinutes: '',
          },
        }),
      ]),
    ).not.toContain(`第 1 行 ${CHARGE_DURATION_VALIDATION_MESSAGE}`);

    expect(
      validateTaskRows([
        row({
          type: 'load',
          params: {
            loadId: '',
            loadType: '',
            height: '',
            chargeDurationMinutes: '481',
          },
        }),
      ]),
    ).not.toContain(`第 1 行 ${CHARGE_DURATION_VALIDATION_MESSAGE}`);
  });
  it('validates missing targets and operation tasks bound to point targets', () => {
    expect(validateTaskRows([])).toEqual(['请至少新增一条子任务']);
    expect(validateTaskRows([row({ targetName: '' })])).toContain('第 1 行 请选择目标点位');
    expect(validateTaskRows([row({ type: 'unload', targetKind: 'point' })])).toContain(
      '第 1 行 下料 任务请选择 Location 站点',
    );
  });
});
