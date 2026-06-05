// SPDX-FileCopyrightText: The openTCS Authors
// SPDX-License-Identifier: MIT

import { describe, expect, it } from 'vitest';

import {
  allowedOperationsForTarget,
  resolveOrderTargetInfos,
} from '@/domain/model/orderTargets';

describe('order target operation candidates', () => {
  it('uses the selected Location type allowedOperations', () => {
    const resolved = resolveOrderTargetInfos({
      points: [{ name: 'Point-1' }],
      locationTypes: [
        { name: 'LocType-1', allowedOperations: ['pick'] },
        { name: 'LocType-2', allowedOperations: ['drop'] },
      ],
      locations: [
        {
          name: 'Location-1',
          typeName: 'LocType-1',
          links: [{ pointName: 'Point-2', allowedOperations: [] }],
        },
        {
          name: 'Location-2',
          typeName: 'LocType-2',
          links: [{ pointName: 'Point-3', allowedOperations: [] }],
        },
      ],
    });

    expect(allowedOperationsForTarget(resolved.targetInfoByName.get('Point-1'))).toEqual([
      'MOVE',
      'PARK',
    ]);
    expect(allowedOperationsForTarget(resolved.targetInfoByName.get('Location-1'))).toEqual([
      'NOP',
      'pick',
    ]);
    expect(allowedOperationsForTarget(resolved.targetInfoByName.get('Location-2'))).toEqual([
      'NOP',
      'drop',
    ]);
  });

  it('splits comma-separated allowedOperations from persisted or BFF payloads', () => {
    const resolved = resolveOrderTargetInfos({
      points: [],
      locationTypes: [
        { name: 'LocType-1', allowedOperations: ['pick, chacha'] },
        { name: 'LocType-2', allowedOperations: 'drop, inspect' },
      ],
      locations: [
        { name: 'Location-1', typeName: 'LocType-1', links: [] },
        { name: 'Location-2', typeName: 'LocType-2', links: [] },
      ],
    });

    expect(allowedOperationsForTarget(resolved.targetInfoByName.get('Location-1'))).toEqual([
      'NOP',
      'pick',
      'chacha',
    ]);
    expect(allowedOperationsForTarget(resolved.targetInfoByName.get('Location-2'))).toEqual([
      'NOP',
      'drop',
      'inspect',
    ]);
  });

  it('intersects LocationType operations with non-empty Location link operations', () => {
    const resolved = resolveOrderTargetInfos({
      points: [],
      locationTypes: [{ name: 'LocType', allowedOperations: ['pick', 'drop'] }],
      locations: [
        {
          name: 'Location',
          typeName: 'LocType',
          links: [{ pointName: 'Point-1', allowedOperations: ['drop'] }],
        },
      ],
    });

    expect(allowedOperationsForTarget(resolved.targetInfoByName.get('Location'))).toEqual([
      'NOP',
      'drop',
    ]);
  });
});
