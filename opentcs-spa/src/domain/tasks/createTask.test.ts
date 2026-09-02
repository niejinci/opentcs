import { describe, expect, it } from 'vitest';

import {
  buildTransportOrderRequest,
  CHARGE_DURATION_PROPERTY_KEY,
  CHARGE_DURATION_VALIDATION_MESSAGE,
  CHARGE_OPERATION,
  createTaskRow,
  DESTINATION_ACTION_PROPERTY_PREFIX,
  destinationProperties,
  isValidChargeDurationMinutes,
  operationForTask,
  targetSupportsTask,
  validateChargeTaskTargets,
  validateTaskRows,
  type TargetOption,
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
    expect(operationForTask(row({ type: 'charge' }))).toBe(CHARGE_OPERATION);
    expect(CHARGE_OPERATION).toBe('CHARGE');
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

  it('builds VDA5050 CHARGE duration parameter for charge rows', () => {
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

  it('allows charge tasks only on available charging pile Location targets', () => {
    const targets: TargetOption[] = [
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
      { name: 'Point-1', kind: 'point', allowedOperations: ['MOVE', 'PARK'] },
    ];

    const chargeRow = row({ type: 'charge' });

    expect(targetSupportsTask(chargeRow, targets[0])).toBe(false);
    expect(targetSupportsTask(chargeRow, targets[1])).toBe(true);
    expect(targetSupportsTask(chargeRow, targets[2])).toBe(false);
    expect(targetSupportsTask(chargeRow, targets[3])).toBe(false);
  });

  it('validates charge task target occupancy before creating orders', () => {
    expect(
      validateChargeTaskTargets(
        [
          row({ id: 1, type: 'charge', targetName: 'CP-A01' }),
          row({ id: 2, type: 'charge', targetName: 'CP-A02' }),
          row({ id: 3, type: 'charge', targetName: 'CP-A03' }),
        ],
        [
          {
            id: 'cp-001',
            name: '充电桩-A01',
            region: '深圳焊装',
            mapName: 'HZ27',
            boundPointName: 'Point-1',
            locationName: 'CP-A01',
            locationTypeName: 'CHARGER',
            operation: 'CHARGE',
            chargerType: '',
            sn: '',
            ip: '',
            enabled: true,
            runtimeStatus: 'CHARGING',
            occupancyStatus: 'OCCUPIED',
            occupiedByVehicle: 'AGV-01',
            activeOrderName: 'TO-01',
            chargingSince: '',
            requiresPublish: false,
            updatedAt: '',
          },
          {
            id: 'cp-002',
            name: '充电桩-A02',
            region: '深圳焊装',
            mapName: 'HZ27',
            boundPointName: 'Point-2',
            locationName: 'CP-A02',
            locationTypeName: 'CHARGER',
            operation: 'CHARGE',
            chargerType: '',
            sn: '',
            ip: '',
            enabled: false,
            runtimeStatus: 'IDLE',
            occupancyStatus: 'DISABLED',
            occupiedByVehicle: '',
            activeOrderName: '',
            chargingSince: '',
            requiresPublish: false,
            updatedAt: '',
          },
        ],
      ),
    ).toEqual([
      '第 1 行 充电桩-A01 已被车辆 AGV-01 占用充电（订单 TO-01）',
      '第 2 行 充电桩-A02 已禁用',
      '第 3 行 CP-A03 不是已登记充电桩',
    ]);
  });
});
