// SPDX-FileCopyrightText: The openTCS Authors
// SPDX-License-Identifier: MIT

import type { DraftPoint } from '@/domain/model/types';

export type TargetInfo =
  | { kind: 'point' }
  | { kind: 'location'; allowedOps: readonly string[] };

export const POINT_ORDER_OPERATIONS: readonly string[] = Object.freeze(['MOVE', 'PARK']);
export const UNKNOWN_TARGET_OPERATIONS: readonly string[] = Object.freeze(['NOP', 'MOVE', 'PARK']);

type OperationListInput = readonly string[] | string | null | undefined;

function operationTokens(values: OperationListInput): string[] {
  if (typeof values === 'string') return values.split(',');
  if (Array.isArray(values)) return values.flatMap((value) => value.split(','));
  return [];
}

function uniqueOrdered(values: OperationListInput): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const value of operationTokens(values)) {
    const op = value.trim();
    if (!op || seen.has(op)) continue;
    seen.add(op);
    out.push(op);
  }
  return out;
}

interface LocationLinkOperationSource {
  pointName?: string;
  allowedOperations?: OperationListInput;
}

function locationAllowedOperations(
  location: { links?: readonly LocationLinkOperationSource[] },
  typeOps: OperationListInput,
): string[] {
  const base = uniqueOrdered(typeOps);
  const linkOps = uniqueOrdered(
    location.links?.flatMap((link) => operationTokens(link.allowedOperations)),
  );
  const ops = linkOps.length > 0 ? base.filter((op) => linkOps.includes(op)) : base;
  return uniqueOrdered(['NOP', ...ops]);
}

export function resolveOrderTargetInfos(payload: {
  points: readonly Pick<DraftPoint, 'name'>[];
  locationTypes: readonly { name: string; allowedOperations?: OperationListInput }[];
  locations: readonly {
    name: string;
    typeName: string;
    links?: readonly LocationLinkOperationSource[];
  }[];
}): { targetSuggestions: string[]; targetInfoByName: Map<string, TargetInfo> } {
  const names = new Set<string>();
  const info = new Map<string, TargetInfo>();
  const typeAllowedOps = new Map<string, string[]>();

  for (const type of payload.locationTypes) {
    if (!type.name) continue;
    typeAllowedOps.set(type.name, uniqueOrdered(type.allowedOperations));
  }

  for (const point of payload.points) {
    if (!point.name) continue;
    names.add(point.name);
    info.set(point.name, { kind: 'point' });
  }

  for (const location of payload.locations) {
    if (!location.name) continue;
    names.add(location.name);
    info.set(location.name, {
      kind: 'location',
      allowedOps: locationAllowedOperations(
        location,
        typeAllowedOps.get(location.typeName) ?? [],
      ),
    });
  }

  return {
    targetSuggestions: [...names].sort(),
    targetInfoByName: info,
  };
}

export function allowedOperationsForTarget(
  info: TargetInfo | undefined,
): readonly string[] {
  if (!info) return UNKNOWN_TARGET_OPERATIONS;
  if (info.kind === 'point') return POINT_ORDER_OPERATIONS;
  return info.allowedOps;
}
