// SPDX-FileCopyrightText: The openTCS Authors
// SPDX-License-Identifier: MIT

import type { InstantActionsRequest } from '@/api/types/bff';
import type { DraftPoint } from '@/domain/model/types';

export const AGV_RELOCATION_ACTION_TYPE = 'initPosition';
export const DEFAULT_AGV_RELOCATION_MAP_DIR = 'pc';
export const AGV_RELOCATION_MAP_DIRS = ['pc', 'rcs'] as const;

export type AgvRelocationMapDir = (typeof AGV_RELOCATION_MAP_DIRS)[number];

export interface AgvRelocationTarget {
  mapId: string;
  x: number;
  y: number;
  theta: number;
  mapDir?: AgvRelocationMapDir | '';
}

export interface AgvRelocationValidationIssue {
  field: keyof AgvRelocationTarget;
  message: string;
}

export function relocationTargetFromPoint(
  point: DraftPoint,
  mapId: string,
  mapDir: AgvRelocationMapDir | '' = DEFAULT_AGV_RELOCATION_MAP_DIR,
): AgvRelocationTarget {
  return {
    mapId,
    x: point.pose.position.x / 1000,
    y: point.pose.position.y / 1000,
    theta: Number.isFinite(point.pose.orientationAngle)
      ? normalizeRadians((point.pose.orientationAngle * Math.PI) / 180)
      : 0,
    mapDir,
  };
}

export function validateAgvRelocationTarget(
  target: AgvRelocationTarget,
): AgvRelocationValidationIssue[] {
  const issues: AgvRelocationValidationIssue[] = [];

  if (!target.mapId.trim()) {
    issues.push({ field: 'mapId', message: '地图名称不能为空' });
  }
  if (!Number.isFinite(target.x)) {
    issues.push({ field: 'x', message: 'X 坐标必须是有效数字' });
  }
  if (!Number.isFinite(target.y)) {
    issues.push({ field: 'y', message: 'Y 坐标必须是有效数字' });
  }
  if (!Number.isFinite(target.theta)) {
    issues.push({ field: 'theta', message: '角度必须是有效数字' });
  } else if (target.theta < -Math.PI || target.theta > Math.PI) {
    issues.push({ field: 'theta', message: '角度 theta 必须在 [-π, π] 范围内' });
  }
  if (target.mapDir && !isAgvRelocationMapDir(target.mapDir)) {
    issues.push({ field: 'mapDir', message: '地图数据源只能是 pc 或 rcs' });
  }

  return issues;
}

export function buildAgvRelocationInstantActionsRequest(
  target: AgvRelocationTarget,
  actionId: string,
): InstantActionsRequest {
  const actionParameters = [
    { key: 'x', value: target.x },
    { key: 'y', value: target.y },
    { key: 'mapId', value: target.mapId.trim() },
    { key: 'theta', value: target.theta },
  ];

  if (target.mapDir) {
    actionParameters.push({ key: 'mapDir', value: target.mapDir });
  }

  return {
    actions: [
      {
        actionType: AGV_RELOCATION_ACTION_TYPE,
        actionId,
        actionDescription: 'AGV 手动重定位',
        blockingType: 'NONE',
        actionParameters,
      },
    ],
  };
}

function isAgvRelocationMapDir(value: string): value is AgvRelocationMapDir {
  return AGV_RELOCATION_MAP_DIRS.includes(value as AgvRelocationMapDir);
}

function normalizeRadians(value: number): number {
  const full = Math.PI * 2;
  return ((((value + Math.PI) % full) + full) % full) - Math.PI;
}
