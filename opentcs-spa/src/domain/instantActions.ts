// SPDX-FileCopyrightText: The openTCS Authors
// SPDX-License-Identifier: MIT

import type {
  InstantAction,
  InstantActionParameter,
  InstantActionParameterValue,
  InstantActionsRequest,
  Vda5050BlockingType,
  Vehicle,
} from '@/api/types/bff';

export type InstantActionParamKind = 'string' | 'number' | 'boolean' | 'array';

export interface InstantActionParameterTemplate {
  key: string;
  description: string;
  defaultValue: InstantActionParameterValue;
  kind?: InstantActionParamKind;
  min?: number;
  max?: number;
  step?: number;
}

export interface InstantActionTemplate {
  templateId: string;
  actionType: string;
  actionDescription: string;
  blockingType: Vda5050BlockingType;
  parameters: InstantActionParameterTemplate[];
}

export interface InstantActionParameterFormRow {
  id: number;
  key: string;
  description: string;
  optional: boolean;
  kind: InstantActionParamKind;
  valueText: string;
  min?: number;
  max?: number;
  step?: number;
}

export interface InstantActionFormState {
  templateId: string;
  actionType: string;
  actionId: string;
  actionDescription: string;
  blockingType: Vda5050BlockingType;
  parameters: InstantActionParameterFormRow[];
}

export type Vda5050ActionStatus = 'WAITING' | 'INITIALIZING' | 'RUNNING' | 'FINISHED' | 'FAILED';

export type InstantActionLifecycleStatus = 'PENDING' | 'RUNNING' | 'SUCCESS' | 'FAILED' | 'TIMEOUT';

export interface Vda5050ActionState {
  actionId: string;
  actionType?: string | null;
  actionDescription?: string | null;
  actionStatus: Vda5050ActionStatus;
  resultDescription?: string | null;
}

export interface TrackedInstantAction {
  actionId: string;
  actionType: string;
  actionDescription?: string | null;
  sentAt: string;
}

export interface InstantActionStatusRow extends TrackedInstantAction {
  status: InstantActionLifecycleStatus;
  vehicleActionStatus?: Vda5050ActionStatus | null;
  resultDescription?: string | null;
}

export const VDA5050_ACTION_STATES_PROPERTY = 'vda5050:actionStates';
export const INSTANT_ACTION_ACK_TIMEOUT_MS = 30_000;
export const INSTANT_ACTION_TERMINAL_TIMEOUT_MS = 120_000;

export const INSTANT_ACTION_TEMPLATES: readonly InstantActionTemplate[] = Object.freeze([
  {
    templateId: 'initPosition',
    actionType: 'initPosition',
    actionDescription: '手动重定位',
    blockingType: 'NONE',
    parameters: [
      { key: 'x', description: '坐标，单位 m', defaultValue: 0.0 },
      { key: 'y', description: '坐标，单位 m', defaultValue: 0.0 },
      { key: 'mapId', description: '地图名称；同地图执行重定位，不同地图执行切换', defaultValue: 'HZ27' },
      { key: 'theta', description: '角度，取值范围 [-pi, pi]', defaultValue: 0.2 },
      { key: 'mapDir?', description: '重定位地图数据源，可选值 pc / rcs；默认 pc', defaultValue: 'pc' },
    ],
  },
  {
    templateId: 'translateAgv',
    actionType: 'translateAgv',
    actionDescription: '平动',
    blockingType: 'NONE',
    parameters: [
      { key: 'vx', description: 'X方向移动速度', defaultValue: 2.0 },
      { key: 'vy', description: 'Y方向移动速度', defaultValue: 0.0 },
      { key: 'mode', description: '0=定位模式，1=里程计；默认1', defaultValue: 1 },
      { key: 'dist', description: '移动距离，单位 m', defaultValue: 0.2 },
    ],
  },
  {
    templateId: 'rotateAgv',
    actionType: 'rotateAgv',
    actionDescription: '旋转 AGV',
    blockingType: 'NONE',
    parameters: [
      { key: 'vw', description: '旋转速度', defaultValue: 2.0 },
      { key: 'angle', description: '目标旋转角度', defaultValue: 0.0 },
    ],
  },
  {
    templateId: 'rotateLoad',
    actionType: 'rotateLoad',
    actionDescription: '旋转托盘',
    blockingType: 'NONE',
    parameters: [
      { key: 'mode', description: '0=增量式，1=绝对模式，默认绝对模式', defaultValue: 1 },
      { key: 'angle', description: '目标旋转角度', defaultValue: 0.0 },
    ],
  },
  {
    templateId: 'pickDrop',
    actionType: 'pick/drop',
    actionDescription: '托盘顶升/下降',
    blockingType: 'NONE',
    parameters: [{ key: 'height', description: '升降高度，单位 m', defaultValue: 0.06 }],
  },
  {
    templateId: 'cancelOrder',
    actionType: 'cancelOrder',
    actionDescription: '取消任务',
    blockingType: 'NONE',
    parameters: [
      { key: 'stop_right', description: '1=立即停车，0=行驶至下一路径节点再停车', defaultValue: 1 },
    ],
  },
  {
    templateId: 'startPause-pause',
    actionType: 'startPause',
    actionDescription: '暂停任务',
    blockingType: 'NONE',
    parameters: [],
  },
  {
    templateId: 'startPause-resume',
    actionType: 'startPause',
    actionDescription: '恢复任务',
    blockingType: 'NONE',
    parameters: [],
  },
  {
    templateId: 'cmd_vel',
    actionType: 'cmd_vel',
    actionDescription: '遥控小车',
    blockingType: 'NONE',
    parameters: [
      { key: 'linear_x', description: '纵向移动线速度，单位 m/s', defaultValue: 0.8 },
      { key: 'angular_z', description: '旋转角速度', defaultValue: 0.2 },
      { key: 'linear_x?', description: '横向移动速度，单位 m/s，可选参数', defaultValue: 0.2 },
    ],
  },
  {
    templateId: 'softEstop',
    actionType: 'softEstop',
    actionDescription: '软急停',
    blockingType: 'NONE',
    parameters: [
      { key: 'status', description: 'true=触发急停，false=解除急停恢复运行', defaultValue: true },
    ],
  },
  {
    templateId: 'stopCharging',
    actionType: 'stopCharging',
    actionDescription: '取消充电',
    blockingType: 'NONE',
    parameters: [
      { key: 'status', description: 'true=停止充电，false=恢复充电', defaultValue: true },
    ],
  },
  {
    templateId: 'clearErrors',
    actionType: 'clearErrors',
    actionDescription: '清除错误信息，直至故障再次上报',
    blockingType: 'NONE',
    parameters: [{ key: 'status', description: 'true=执行清除故障', defaultValue: true }],
  },
  {
    templateId: 'setDO',
    actionType: 'setDO',
    actionDescription: '设置数字输出',
    blockingType: 'NONE',
    parameters: [
      { key: 'index', description: '输出口索引，取值范围 0~23', defaultValue: 0, min: 0, max: 23, step: 1 },
      { key: 'value', description: '输出值，0/1', defaultValue: 1, min: 0, max: 1, step: 1 },
    ],
  },
]);

export function paramKeyWithoutOptionalMark(key: string): string {
  return key.endsWith('?') ? key.slice(0, -1) : key;
}

export function paramIsOptional(key: string): boolean {
  return key.endsWith('?');
}

export function inferParamKind(value: InstantActionParameterValue): InstantActionParamKind {
  if (Array.isArray(value)) return 'array';
  if (typeof value === 'number') return 'number';
  if (typeof value === 'boolean') return 'boolean';
  return 'string';
}

export function valueToInputText(value: InstantActionParameterValue): string {
  return Array.isArray(value) ? JSON.stringify(value) : String(value);
}

export function parseParameterValue(
  kind: InstantActionParamKind,
  valueText: string,
): InstantActionParameterValue {
  const text = String(valueText ?? '');
  if (kind === 'string') return text;

  if (kind === 'number') {
    const parsed = Number(text.trim());
    if (!Number.isFinite(parsed)) {
      throw new Error(`不是有效 number：${valueText}`);
    }
    return parsed;
  }

  if (kind === 'boolean') {
    if (text === 'true') return true;
    if (text === 'false') return false;
    throw new Error(`不是有效 boolean：${valueText}`);
  }

  const parsed = JSON.parse(text) as unknown;
  if (
    !Array.isArray(parsed) ||
    !parsed.every(
      (item) =>
        typeof item === 'string' || typeof item === 'number' || typeof item === 'boolean',
    )
  ) {
    throw new Error('array 参数必须是 string/number/boolean 数组');
  }
  return parsed;
}

export function templateToFormState(
  template: InstantActionTemplate,
  nextRowId: () => number,
): InstantActionFormState {
  return {
    templateId: template.templateId,
    actionType: template.actionType,
    actionId: crypto.randomUUID(),
    actionDescription: template.actionDescription,
    blockingType: template.blockingType,
    parameters: template.parameters.map((param) => ({
      id: nextRowId(),
      key: paramKeyWithoutOptionalMark(param.key),
      description: param.description,
      optional: paramIsOptional(param.key),
      kind: param.kind ?? inferParamKind(param.defaultValue),
      valueText: valueToInputText(param.defaultValue),
      min: param.min,
      max: param.max,
      step: param.step,
    })),
  };
}

export function createBlankInstantActionFormState(
  nextRowId: () => number,
): InstantActionFormState {
  return {
    templateId: '',
    actionType: '',
    actionId: crypto.randomUUID(),
    actionDescription: '',
    blockingType: 'NONE',
    parameters: [createBlankParameter(nextRowId())],
  };
}

export function createBlankParameter(id: number): InstantActionParameterFormRow {
  return {
    id,
    key: '',
    description: '',
    optional: false,
    kind: 'string',
    valueText: '',
    min: undefined,
    max: undefined,
    step: undefined,
  };
}

export function formStateToInstantActionsRequest(
  form: InstantActionFormState,
): InstantActionsRequest {
  const actionParameters: InstantActionParameter[] = form.parameters
    .filter((row) => row.key.trim().length > 0)
    .map((row) => ({
      key: row.key.trim(),
      value: parseParameterValue(row.kind, row.valueText),
    }));

  const action: InstantAction = {
    actionType: form.actionType.trim(),
    actionId: form.actionId.trim(),
    actionDescription: form.actionDescription.trim() || null,
    blockingType: form.blockingType,
    actionParameters: actionParameters.length > 0 ? actionParameters : null,
  };

  return { actions: [action] };
}

export function findInstantActionTemplate(templateId: string): InstantActionTemplate | null {
  return INSTANT_ACTION_TEMPLATES.find((template) => template.templateId === templateId) ?? null;
}

export function filterInstantActionTemplates(keyword: string): readonly InstantActionTemplate[] {
  const trimmed = keyword.trim().toLowerCase();
  if (!trimmed) return INSTANT_ACTION_TEMPLATES;

  return INSTANT_ACTION_TEMPLATES.filter((template) => {
    return (
      template.templateId.toLowerCase().includes(trimmed) ||
      template.actionType.toLowerCase().includes(trimmed) ||
      template.actionDescription.toLowerCase().includes(trimmed)
    );
  });
}

export function parseVehicleActionStates(vehicle: Vehicle | null): Vda5050ActionState[] {
  const raw = vehicle?.properties?.[VDA5050_ACTION_STATES_PROPERTY];
  if (!raw) return [];

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return [];
  }

  if (!Array.isArray(parsed)) return [];
  return parsed.filter(isVda5050ActionState);
}

export function resolveInstantActionStatusRows(
  trackedActions: readonly TrackedInstantAction[],
  vehicle: Vehicle | null,
  nowMs: number = Date.now(),
): InstantActionStatusRow[] {
  const actionStates = parseVehicleActionStates(vehicle);

  return trackedActions.slice(0, 5).map((tracked) => {
    const actionState = actionStates.find((item) => item.actionId === tracked.actionId);
    return {
      ...tracked,
      status: resolveInstantActionStatus(tracked, actionState, nowMs),
      vehicleActionStatus: actionState?.actionStatus ?? null,
      resultDescription: actionState?.resultDescription ?? null,
    };
  });
}

function resolveInstantActionStatus(
  tracked: TrackedInstantAction,
  actionState: Vda5050ActionState | undefined,
  nowMs: number,
): InstantActionLifecycleStatus {
  const elapsedMs = nowMs - new Date(tracked.sentAt).getTime();

  if (!actionState) {
    return elapsedMs > INSTANT_ACTION_ACK_TIMEOUT_MS ? 'TIMEOUT' : 'PENDING';
  }

  if (actionState.actionStatus === 'FINISHED') return 'SUCCESS';
  if (actionState.actionStatus === 'FAILED') return 'FAILED';
  return elapsedMs > INSTANT_ACTION_TERMINAL_TIMEOUT_MS ? 'TIMEOUT' : 'RUNNING';
}

function isVda5050ActionState(value: unknown): value is Vda5050ActionState {
  const candidate = value as Vda5050ActionState;
  return (
    typeof candidate === 'object' &&
    candidate !== null &&
    typeof candidate.actionId === 'string' &&
    isVda5050ActionStatus(candidate.actionStatus)
  );
}

function isVda5050ActionStatus(value: unknown): value is Vda5050ActionStatus {
  return (
    value === 'WAITING' ||
    value === 'INITIALIZING' ||
    value === 'RUNNING' ||
    value === 'FINISHED' ||
    value === 'FAILED'
  );
}
