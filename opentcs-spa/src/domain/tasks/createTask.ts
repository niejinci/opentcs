import type { Destination, TransportOrderRequest } from '@/api/types/bff';

export type CreateTaskType = 'charge' | 'unload' | 'load' | 'move';
export type TargetKind = 'point' | 'location' | '';

export interface TaskTypeOption {
  id: CreateTaskType;
  label: string;
}

export interface TaskParams {
  loadId: string;
  loadType: string;
  height: string;
  chargeDurationMinutes: string;
}

export interface TaskRow {
  id: number;
  type: CreateTaskType;
  targetName: string;
  targetKind: TargetKind;
  params: TaskParams;
}

export interface TargetOption {
  name: string;
  kind: Exclude<TargetKind, ''>;
  allowedOperations: readonly string[];
}

export const TASK_TYPE_OPTIONS: readonly TaskTypeOption[] = Object.freeze([
  { id: 'charge', label: '充电' },
  { id: 'unload', label: '下料' },
  { id: 'load', label: '上料' },
  { id: 'move', label: '移动任务' },
]);

export const DESTINATION_ACTION_PROPERTY_PREFIX = 'vda5050:destinationAction';
export const CHARGE_OPERATION = 'startCharging';
export const CHARGE_DURATION_PROPERTY_KEY = `${DESTINATION_ACTION_PROPERTY_PREFIX}.parameter.time`;
export const MIN_CHARGE_DURATION_MINUTES = 1;
export const MAX_CHARGE_DURATION_MINUTES = 480;
export const CHARGE_DURATION_VALIDATION_MESSAGE = `充电时长请输入 ${MIN_CHARGE_DURATION_MINUTES}-${MAX_CHARGE_DURATION_MINUTES} 的整数分钟`;

export function createEmptyTaskParams(): TaskParams {
  return {
    loadId: '',
    loadType: '',
    height: '',
    chargeDurationMinutes: '',
  };
}

export function createTaskRow(id: number, type: CreateTaskType = 'load'): TaskRow {
  return {
    id,
    type,
    targetName: '',
    targetKind: '',
    params: createEmptyTaskParams(),
  };
}

export function taskTypeLabel(type: CreateTaskType): string {
  return TASK_TYPE_OPTIONS.find((option) => option.id === type)?.label ?? type;
}

export function operationForTask(row: Pick<TaskRow, 'type'>): string {
  switch (row.type) {
    case 'charge':
      return CHARGE_OPERATION;
    case 'unload':
      return 'drop';
    case 'load':
      return 'pick';
    case 'move':
      return 'MOVE';
    default:
      return 'MOVE';
  }
}

export function taskRequiresLocation(type: CreateTaskType): boolean {
  return type === 'charge' || type === 'unload' || type === 'load';
}

function destinationActionParameterKey(parameter: string): string {
  return `${DESTINATION_ACTION_PROPERTY_PREFIX}.parameter.${parameter}`;
}

function putTrimmed(
  target: Record<string, string>,
  key: string,
  value: string | number | null | undefined,
  transform: (value: string) => string = (v) => v,
): void {
  const trimmed = String(value ?? '').trim();
  if (!trimmed) return;
  target[key] = transform(trimmed);
}

export function destinationProperties(row: TaskRow): Record<string, string> | null {
  const props: Record<string, string> = {};

  if (row.type === 'load' || row.type === 'unload') {
    putTrimmed(props, destinationActionParameterKey('loadType'), row.params.loadType);
    putTrimmed(props, destinationActionParameterKey('loadId'), row.params.loadId);
    putTrimmed(
      props,
      destinationActionParameterKey('height'),
      row.params.height,
      (value) => `float:${value}`,
    );
  }

  if (row.type === 'charge') {
    putTrimmed(
      props,
      CHARGE_DURATION_PROPERTY_KEY,
      row.params.chargeDurationMinutes,
      (value) => `float:${value}`,
    );
  }

  return Object.keys(props).length > 0 ? props : null;
}

export function isValidChargeDurationMinutes(value: string | number | null | undefined): boolean {
  const trimmed = String(value ?? '').trim();
  if (!trimmed) return true;
  if (!/^\d+$/.test(trimmed)) return false;

  const minutes = Number(trimmed);
  return minutes >= MIN_CHARGE_DURATION_MINUTES && minutes <= MAX_CHARGE_DURATION_MINUTES;
}

export function destinationForTask(row: TaskRow): Destination {
  return {
    locationName: row.targetName.trim(),
    operation: operationForTask(row),
    properties: destinationProperties(row),
  };
}

export function validateTaskRows(rows: readonly TaskRow[]): string[] {
  const errors: string[] = [];
  if (rows.length === 0) {
    errors.push('请至少新增一条子任务');
    return errors;
  }

  rows.forEach((row, index) => {
    const label = `第 ${index + 1} 行`;
    if (!row.targetName.trim()) {
      errors.push(`${label} 请选择目标点位`);
    }
    if (taskRequiresLocation(row.type) && row.targetKind === 'point') {
      errors.push(`${label} ${taskTypeLabel(row.type)} 任务请选择 Location 站点`);
    }
    if (row.type === 'charge' && !isValidChargeDurationMinutes(row.params.chargeDurationMinutes)) {
      errors.push(`${label} ${CHARGE_DURATION_VALIDATION_MESSAGE}`);
    }
  });

  return errors;
}

export function buildTransportOrderRequest(input: {
  rows: readonly TaskRow[];
  intendedVehicle?: string | null;
  now?: number;
}): TransportOrderRequest {
  const now = input.now ?? Date.now();
  return {
    name: `spa-create-task-${now}`,
    incompleteName: true,
    intendedVehicle: input.intendedVehicle?.trim() || null,
    type: 'BYD_CREATE_TASK',
    destinations: input.rows.map(destinationForTask),
    properties: {
      source: 'opentcs-spa-create-task',
    },
  };
}
