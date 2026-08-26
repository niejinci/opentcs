import { describe, expect, it } from 'vitest';

import type { DraftPoint } from '@/domain/model/types';

import {
  buildAgvRelocationInstantActionsRequest,
  relocationTargetFromPoint,
  validateAgvRelocationTarget,
} from './relocation';

function point(overrides: Partial<DraftPoint> = {}): DraftPoint {
  return {
    name: 'P-1',
    type: 'HALT_POSITION',
    pose: {
      position: { x: 1234, y: -5678, z: 0 },
      orientationAngle: 90,
    },
    layout: { pixelX: 10, pixelY: 20 },
    properties: {},
    ...overrides,
  };
}

describe('AGV relocation', () => {
  it('uses point pose in meters and radians for initPosition', () => {
    const target = relocationTargetFromPoint(point(), 'HZ27', 'pc');

    expect(target).toEqual({
      mapId: 'HZ27',
      x: 1.234,
      y: -5.678,
      theta: Math.PI / 2,
      mapDir: 'pc',
    });
  });

  it('falls back to theta 0 when point orientation is unset', () => {
    const target = relocationTargetFromPoint(
      point({ pose: { position: { x: 0, y: 0, z: 0 }, orientationAngle: Number.NaN } }),
      'HZ27',
    );

    expect(target.theta).toBe(0);
  });

  it('validates map id, finite coordinates, theta range and mapDir', () => {
    const issues = validateAgvRelocationTarget({
      mapId: '',
      x: Number.NaN,
      y: 1,
      theta: Math.PI + 0.01,
      mapDir: 'bad' as 'pc',
    });

    expect(issues.map((issue) => issue.field)).toEqual(['mapId', 'x', 'theta', 'mapDir']);
  });

  it('builds a VDA5050 initPosition instant action request', () => {
    expect(
      buildAgvRelocationInstantActionsRequest(
        { mapId: 'HZ27', x: 1, y: 2, theta: 0.2, mapDir: 'pc' },
        'relocate-1',
      ),
    ).toEqual({
      actions: [
        {
          actionType: 'initPosition',
          actionId: 'relocate-1',
          actionDescription: 'AGV 手动重定位',
          blockingType: 'NONE',
          actionParameters: [
            { key: 'x', value: 1 },
            { key: 'y', value: 2 },
            { key: 'mapId', value: 'HZ27' },
            { key: 'theta', value: 0.2 },
            { key: 'mapDir', value: 'pc' },
          ],
        },
      ],
    });
  });
});
