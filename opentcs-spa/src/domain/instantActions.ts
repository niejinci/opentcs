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
export const VDA5050_OPERATING_MODE_PROPERTY = 'vda5050:operatingMode';
export const VDA5050_LAST_STATE_AT_PROPERTY = 'vda5050:lastStateAt';
export const OPERATING_MODE_STALE_AFTER_MS = 10_000;
export const INSTANT_ACTION_ACK_TIMEOUT_MS = 30_000;
export const INSTANT_ACTION_TERMINAL_TIMEOUT_MS = 120_000;

export const INSTANT_ACTION_TEMPLATES: readonly InstantActionTemplate[] = Object.freeze([
  {
    templateId: 'controlMode',
    actionType: 'controlMode',
    actionDescription: '设置小车操作模式',
    blockingType: 'HARD',
    parameters: [
      {
        key: 'mode',
        description: 'AUTOMATIC / SEMIAUTOMATIC / MANUAL / SERVICE / TEACHIN',
        defaultValue: 'MANUAL',
      },
    ],
  },
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
    templateId: 'pick',
    actionType: 'pick',
    actionDescription: '托盘顶升',
    blockingType: 'NONE',
    parameters: [{ key: 'height?', description: '顶升高度，单位 m', defaultValue: 0.06 },
      { key: 'loadType', description: '负载类型，对应货架参数里面的 Name', defaultValue: '' },
      { key: 'type?', description: '扫码类型:依赖载具类型|进出站台纠偏|站台内原地旋转纠偏', defaultValue: '' },
    ],
  },
  {
    templateId: 'drop',
    actionType: 'drop',
    actionDescription: '托盘下降',
    blockingType: 'NONE',
    parameters: [{ key: 'height?', description: '下降高度，单位 m', defaultValue: 0.06 }],
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
  {
    templateId: 'dualArmEnable',
    actionType: 'dualArmEnable',
    actionDescription: '使能机器人',
    blockingType: 'HARD',
    parameters: [
      {
        key: 'enable',
        description: '0=关闭使能，1=开启使能',
        defaultValue: 1,
        min: 0,
        max: 1,
        step: 1,
      },
    ],
  },
  {
    templateId: 'dualArmSwitchFrame',
    actionType: 'dualArmSwitchFrame',
    actionDescription: '切换机器人的坐标系',
    blockingType: 'HARD',
    parameters: [
      {
        key: 'type',
        description: '坐标系：0=关节，1=机器人，2=工具，3=工件',
        defaultValue: 0,
        min: 0,
        max: 3,
        step: 1,
      },
      {
        key: 'arm_type',
        description: '手臂：0=左臂，1=右臂，2=左右臂',
        defaultValue: 1,
        min: 0,
        max: 2,
        step: 1,
      },
      {
        key: 'frame_id',
        description: '坐标系号，工具坐标系或用户坐标系需设置对应 id，范围 0~32',
        defaultValue: 1,
        min: 0,
        max: 32,
        step: 1,
      },
    ],
  },
  {
    templateId: 'dualArmSwitchTool',
    actionType: 'dualArmSwitchTool',
    actionDescription: '切换机器人的工具',
    blockingType: 'HARD',
    parameters: [
      { key: 'type', description: '0=左臂，1=右臂', defaultValue: 0, min: 0, max: 1, step: 1 },
      {
        key: 'num',
        description: '工具号，取值范围 0~15',
        defaultValue: 1,
        min: 0,
        max: 15,
        step: 1,
      },
    ],
  },
  {
    templateId: 'dualArmManualControl',
    actionType: 'dualArmManualControl',
    actionDescription: '单轴点动',
    blockingType: 'HARD',
    parameters: [
      {
        key: 'is_jogging',
        description: '是否进入手动模式：0=退出手动模式，1=进入手动模式',
        defaultValue: 0,
        min: 0,
        max: 1,
        step: 1,
      },
      {
        key: 'type',
        description: '类型：0=关节运动，1=笛卡尔坐标系运动，2=双臂笛卡尔坐标系运动',
        defaultValue: 1,
        min: 0,
        max: 2,
        step: 1,
      },
      {
        key: 'index',
        description:
          '轴：关节运动 0~18(19个关节)；笛卡尔右臂 0~5(x,y,z,rx,ry,rz)，左臂 6~11(x,y,z,rx,ry,rz)；双臂笛卡尔 0~2(x,y,z)',
        defaultValue: 1,
        min: 0,
        max: 18,
        step: 1,
      },
      {
        key: 'positive',
        description: '正反转，取值 0/1',
        defaultValue: 1,
        min: 0,
        max: 1,
        step: 1,
      },
      {
        key: 'speed',
        description: '速度百分比，取值范围 0~100',
        defaultValue: 21,
        min: 0,
        max: 100,
        step: 1,
      },
    ],
  },
  {
    templateId: 'ONE_CLICK_HOMING',
    actionType: 'ONE_CLICK_HOMING',
    actionDescription: '一键回原点',
    blockingType: 'HARD',
    parameters: [
      {
        key: 'max_vel?',
        description: '最大速度，可选，取值范围 0~1',
        defaultValue: 0.1,
        min: 0,
        max: 1,
      },
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
  const seenKeys = new Set<string>();
  const actionParameters: InstantActionParameter[] = [];
  const parsedParameters = new Map<string, InstantActionParameterValue>();
  const actionType = form.actionType.trim();

  for (const row of form.parameters) {
    const key = row.key.trim();
    const valueText = String(row.valueText ?? '');
    const isBlank = key.length === 0 && valueText.trim().length === 0;

    if (isBlank) continue;
    if (!key) {
      throw new Error('参数 key 不能为空');
    }
    if (seenKeys.has(key)) {
      throw new Error(`参数 key 重复：${key}`);
    }

    seenKeys.add(key);
    const value = parseParameterValue(row.kind, row.valueText);
    parsedParameters.set(key, value);
    actionParameters.push({
      key,
      value,
    });
  }

  validateInstantActionParameters(actionType, parsedParameters);

  const action: InstantAction = {
    actionType,
    actionId: form.actionId.trim(),
    actionDescription: form.actionDescription.trim() || null,
    blockingType: form.blockingType,
    actionParameters: actionParameters.length > 0 ? actionParameters : null,
  };

  return { actions: [action] };
}

function validateInstantActionParameters(
  actionType: string,
  parameters: ReadonlyMap<string, InstantActionParameterValue>,
): void {
  if (actionType !== 'dualArmManualControl') return;

  const type = requireIntegerParameter(actionType, parameters, 'type');
  const index = requireIntegerParameter(actionType, parameters, 'index');

  if (type < 0 || type > 2) {
    throw new Error('dualArmManualControl 参数 type 必须是整数 0、1 或 2');
  }

  const indexRule =
    type === 0
      ? { min: 0, max: 18, description: '关节运动范围为 0~18(19个关节)' }
      : type === 1
        ? { min: 0, max: 11, description: '笛卡尔坐标系运动范围为 0~11' }
        : { min: 0, max: 2, description: '双臂笛卡尔坐标系运动范围为 0~2(x,y,z)' };

  if (index < indexRule.min || index > indexRule.max) {
    throw new Error(
      `dualArmManualControl 参数 index 与 type=${type} 不匹配：${indexRule.description}`,
    );
  }
}

function requireIntegerParameter(
  actionType: string,
  parameters: ReadonlyMap<string, InstantActionParameterValue>,
  key: string,
): number {
  const value = parameters.get(key);
  if (typeof value !== 'number' || !Number.isInteger(value)) {
    throw new Error(`${actionType} 参数 ${key} 必须是整数`);
  }
  return value;
}

export function findInstantActionTemplate(templateId: string): InstantActionTemplate | null {
  return INSTANT_ACTION_TEMPLATES.find((template) => template.templateId === templateId) ?? null;
}

export function findInstantActionTemplatesByActionType(
  actionType: string,
): readonly InstantActionTemplate[] {
  const trimmed = actionType.trim();
  if (!trimmed) return [];
  return INSTANT_ACTION_TEMPLATES.filter((template) => template.actionType === trimmed);
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

export function vehicleOperatingMode(vehicle: Vehicle | null): string | null {
  return vehicle?.operatingMode ?? vehicle?.properties?.[VDA5050_OPERATING_MODE_PROPERTY] ?? null;
}

export function vehicleLastStateAt(vehicle: Vehicle | null): string | null {
  return vehicle?.lastStateAt ?? vehicle?.properties?.[VDA5050_LAST_STATE_AT_PROPERTY] ?? null;
}

export function vehicleStateAgeMs(vehicle: Vehicle | null, nowMs: number = Date.now()): number | null {
  const raw = vehicleLastStateAt(vehicle);
  if (!raw) return null;

  const ts = new Date(raw).getTime();
  if (!Number.isFinite(ts)) return null;
  return Math.max(0, nowMs - ts);
}

export function isVehicleStateStale(
  vehicle: Vehicle | null,
  nowMs: number = Date.now(),
  staleAfterMs: number = OPERATING_MODE_STALE_AFTER_MS,
): boolean {
  const ageMs = vehicleStateAgeMs(vehicle, nowMs);
  return ageMs === null || ageMs > staleAfterMs;
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
