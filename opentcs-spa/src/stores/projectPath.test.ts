// SPDX-FileCopyrightText: The openTCS Authors
// SPDX-License-Identifier: MIT

import { beforeEach, describe, expect, it } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';

import type { DraftPoint } from '@/domain/model/types';
import { useProjectStore } from '@/stores/project';

const VDA5050_PATH_ORIENTATION_TYPE_FORWARD = 'vda5050:orientationType.forward';

function point(name: string, x: number, y: number): DraftPoint {
  return {
    name,
    type: 'HALT_POSITION',
    pose: { position: { x, y, z: 0 }, orientationAngle: Number.NaN },
    layout: { pixelX: x, pixelY: y },
    properties: {},
  };
}

describe('project store path creation', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    localStorage.clear();
  });

  it('rejects duplicate paths with the same directed endpoints', () => {
    const store = useProjectStore();
    store.points.push(point('Point-5', 0, 0), point('Point-6', 1000, 0));

    store.startPath('Point-5');
    const first = store.completePath('Point-6');
    expect(first.path?.name).toBe('Point-5 --- Point-6');
    expect(first.error).toBeUndefined();

    store.startPath('Point-5');
    const duplicate = store.completePath('Point-6');
    expect(duplicate.path).toBeNull();
    expect(duplicate.error).toContain('Point-5 -> Point-6');
    expect(store.paths).toHaveLength(1);
    expect(store.selection).toEqual({ kind: 'path', name: 'Point-5 --- Point-6' });
  });

  it('sets the default forward orientation type when creating a path', () => {
    const store = useProjectStore();
    store.points.push(point('Point-5', 0, 0), point('Point-6', 1000, 0));

    store.startPath('Point-5');
    const created = store.completePath('Point-6');

    expect(created.path?.properties[VDA5050_PATH_ORIENTATION_TYPE_FORWARD]).toBe('GLOBAL');
  });

  it('allows one reverse path for the same unordered point pair', () => {
    const store = useProjectStore();
    store.points.push(point('Point-5', 0, 0), point('Point-6', 1000, 0));

    store.startPath('Point-5');
    const outbound = store.completePath('Point-6');
    store.startPath('Point-6');
    const inbound = store.completePath('Point-5');

    expect(outbound.path?.srcPointName).toBe('Point-5');
    expect(inbound.path?.srcPointName).toBe('Point-6');
    expect(inbound.error).toBeUndefined();
    expect(store.paths.map((p) => `${p.srcPointName}->${p.destPointName}`)).toEqual([
      'Point-5->Point-6',
      'Point-6->Point-5',
    ]);
  });

  it('deduplicates legacy hydrated drafts by directed endpoints', () => {
    const store = useProjectStore();

    store.hydrateDraftPayload({
      v: 2,
      points: [point('Point-5', 0, 0), point('Point-6', 1000, 0)],
      paths: [
        {
          name: 'Point-5 --- Point-6',
          srcPointName: 'Point-5',
          destPointName: 'Point-6',
          length: 1000,
          maxVelocity: 1000,
          maxReverseVelocity: 0,
          locked: false,
          properties: {},
        },
        {
          name: 'Point-5 --- Point-6-2',
          srcPointName: 'Point-5',
          destPointName: 'Point-6',
          length: 1000,
          maxVelocity: 1000,
          maxReverseVelocity: 0,
          locked: false,
          properties: {},
        },
        {
          name: 'Point-6 --- Point-5',
          srcPointName: 'Point-6',
          destPointName: 'Point-5',
          length: 1000,
          maxVelocity: 1000,
          maxReverseVelocity: 0,
          locked: false,
          properties: {},
        },
      ],
      locationTypes: [],
      locations: [],
      blocks: [],
      vehicles: [],
      selection: null,
    });

    expect(store.paths.map((p) => p.name)).toEqual([
      'Point-5 --- Point-6',
      'Point-6 --- Point-5',
    ]);
  });

  it('backfills the default forward orientation type on hydrated paths', () => {
    const store = useProjectStore();

    store.hydrateDraftPayload({
      v: 2,
      points: [point('Point-5', 0, 0), point('Point-6', 1000, 0)],
      paths: [
        {
          name: 'Point-5 --- Point-6',
          srcPointName: 'Point-5',
          destPointName: 'Point-6',
          length: 1000,
          maxVelocity: 1000,
          maxReverseVelocity: 0,
          locked: false,
          properties: {},
        },
      ],
      locationTypes: [],
      locations: [],
      blocks: [],
      vehicles: [],
      selection: null,
    });

    expect(store.findPath('Point-5 --- Point-6')?.properties).toMatchObject({
      [VDA5050_PATH_ORIENTATION_TYPE_FORWARD]: 'GLOBAL',
    });
  });

  it('keeps an existing forward orientation type when hydrating paths', () => {
    const store = useProjectStore();

    store.hydrateDraftPayload({
      v: 2,
      points: [point('Point-5', 0, 0), point('Point-6', 1000, 0)],
      paths: [
        {
          name: 'Point-5 --- Point-6',
          srcPointName: 'Point-5',
          destPointName: 'Point-6',
          length: 1000,
          maxVelocity: 1000,
          maxReverseVelocity: 0,
          locked: false,
          properties: { [VDA5050_PATH_ORIENTATION_TYPE_FORWARD]: 'LOCAL' },
        },
      ],
      locationTypes: [],
      locations: [],
      blocks: [],
      vehicles: [],
      selection: null,
    });

    expect(store.findPath('Point-5 --- Point-6')?.properties).toMatchObject({
      [VDA5050_PATH_ORIENTATION_TYPE_FORWARD]: 'LOCAL',
    });
  });

  it('defaults reverse speed when a path is configured for backward VDA driving', () => {
    const store = useProjectStore();
    store.points.push(point('Point-8', 0, 0), point('Point-7', 1000, 0));

    store.startPath('Point-8');
    const created = store.completePath('Point-7');
    expect(created.path?.maxReverseVelocity).toBe(0);

    const result = store.setEntityProperty(
      'path',
      'Point-8 --- Point-7',
      'vda5050:vehicleOrientation',
      'BACKWARD',
    );

    expect(result.ok).toBe(true);
    expect(store.findPath('Point-8 --- Point-7')?.maxReverseVelocity).toBe(500);
  });

  it('keeps backward VDA paths from being saved with zero reverse speed', () => {
    const store = useProjectStore();
    store.points.push(point('Point-8', 0, 0), point('Point-7', 1000, 0));

    store.startPath('Point-8');
    store.completePath('Point-7');
    store.setEntityProperty(
      'path',
      'Point-8 --- Point-7',
      'vda5050:vehicleOrientation',
      'BACKWARD',
    );

    store.updatePathFields('Point-8 --- Point-7', { maxReverseVelocity: 0 });

    expect(store.findPath('Point-8 --- Point-7')?.maxReverseVelocity).toBe(500);
  });

  it('normalizes existing hydrated backward VDA paths with zero reverse speed', () => {
    const store = useProjectStore();

    store.hydrateDraftPayload({
      v: 2,
      points: [point('Point-8', 0, 0), point('Point-7', 1000, 0)],
      paths: [
        {
          name: 'Point-8 --- Point-7',
          srcPointName: 'Point-8',
          destPointName: 'Point-7',
          length: 1000,
          maxVelocity: 1000,
          maxReverseVelocity: 0,
          locked: false,
          properties: { 'vda5050:vehicleOrientation': 'BACKWARD' },
        },
      ],
      locationTypes: [],
      locations: [],
      blocks: [],
      vehicles: [],
      selection: null,
    });

    expect(store.findPath('Point-8 --- Point-7')?.maxReverseVelocity).toBe(500);
  });
});
