// SPDX-FileCopyrightText: The openTCS Authors
// SPDX-License-Identifier: MIT

import { beforeEach, describe, expect, it } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';

import type { DraftPoint, DraftVehicle } from '@/domain/model/types';
import { useProjectStore } from '@/stores/project';

function point(name: string, x: number, y: number, z = 0): DraftPoint {
  return {
    name,
    type: 'HALT_POSITION',
    pose: { position: { x, y, z }, orientationAngle: Number.NaN },
    layout: { pixelX: x, pixelY: y },
    properties: {},
  };
}

function vehicle(name: string, pixelX: number, pixelY: number): DraftVehicle {
  return {
    name,
    boundingBox: { length: 1000, width: 1000, height: 1000 },
    energyLevelThresholdSet: {
      energyLevelCritical: 30,
      energyLevelGood: 90,
      energyLevelSufficientlyRecharged: 30,
      energyLevelFullyRecharged: 90,
    },
    maxVelocity: 1000,
    maxReverseVelocity: 1000,
    envelopeKey: '',
    layout: {
      pixelX,
      pixelY,
      orientationDeg: 0,
      routeColorRgb: '#0969da',
    },
    properties: {},
  };
}

function hydrateBase(): ReturnType<typeof useProjectStore> {
  const store = useProjectStore();
  store.hydrateDraftPayload({
    v: 2,
    points: [point('P-1', 0, 0), point('P-2', 1000, 0)],
    paths: [],
    locationTypes: [],
    locations: [],
    blocks: [],
    vehicles: [vehicle('V-1', 0, 0)],
    selection: null,
  });
  return store;
}

describe('project store history', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    localStorage.clear();
  });

  it('undoes and redoes path creation', () => {
    const store = hydrateBase();

    store.startPath('P-1');
    store.completePath('P-2');

    expect(store.paths).toHaveLength(1);
    expect(store.canUndo).toBe(true);
    expect(store.canRedo).toBe(false);

    expect(store.undo()).toBe(true);
    expect(store.paths).toHaveLength(0);
    expect(store.canRedo).toBe(true);

    expect(store.redo()).toBe(true);
    expect(store.paths.map((p) => p.name)).toEqual(['P-1 --- P-2']);
  });

  it('clears redo history after a new edit', () => {
    const store = hydrateBase();

    store.updatePointFields('P-1', { z: 1 });
    store.undo();
    expect(store.canRedo).toBe(true);

    store.updatePointFields('P-1', { z: 2 });

    expect(store.findPoint('P-1')?.pose.position.z).toBe(2);
    expect(store.canRedo).toBe(false);
  });

  it('keeps the most recent 50 undo entries', () => {
    const store = hydrateBase();

    for (let z = 1; z <= 51; z += 1) {
      store.updatePointFields('P-1', { z });
    }
    for (let i = 0; i < 50; i += 1) {
      expect(store.undo()).toBe(true);
    }

    expect(store.findPoint('P-1')?.pose.position.z).toBe(1);
    expect(store.canUndo).toBe(false);
  });

  it('records a drag transaction as a single undo entry', () => {
    const store = hydrateBase();

    store.beginHistoryTransaction('移动 Vehicle');
    store.moveVehicle('V-1', { x: 10, y: 0 });
    store.moveVehicle('V-1', { x: 20, y: 0 });
    store.commitHistoryTransaction();

    expect(store.findVehicle('V-1')?.layout.pixelX).toBe(20);
    expect(store.undo()).toBe(true);
    expect(store.findVehicle('V-1')?.layout.pixelX).toBe(0);
    expect(store.redo()).toBe(true);
    expect(store.findVehicle('V-1')?.layout.pixelX).toBe(20);
  });

  it('clears history when hydrating a project draft', () => {
    const store = hydrateBase();
    store.updatePointFields('P-1', { z: 1 });
    expect(store.canUndo).toBe(true);

    store.hydrateDraftPayload(null);

    expect(store.canUndo).toBe(false);
    expect(store.canRedo).toBe(false);
  });
});
