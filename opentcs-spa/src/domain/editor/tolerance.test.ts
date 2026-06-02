// SPDX-FileCopyrightText: The openTCS Authors
// SPDX-License-Identifier: MIT

import { describe, expect, it } from 'vitest';

import type { DraftPoint } from '@/domain/model/types';

import {
  clampToleranceMm,
  DEFAULT_TOLERANCE_MM,
  MAX_TOLERANCE_MM,
  MIN_TOLERANCE_MM,
  readToleranceOverrideMm,
  resolveToleranceMm,
  TOLERANCE_PROPERTY_KEY,
  toleranceMmToStagePx,
} from './tolerance';

function makePoint(props: Record<string, string> = {}): DraftPoint {
  return {
    name: 'P1',
    type: 'HALT_POSITION',
    pose: { position: { x: 0, y: 0, z: 0 }, orientationAngle: Number.NaN },
    layout: { pixelX: 0, pixelY: 0 },
    properties: props,
  };
}

describe('clampToleranceMm', () => {
  it('falls back to default for non-finite input', () => {
    expect(clampToleranceMm(Number.NaN)).toBe(DEFAULT_TOLERANCE_MM);
    expect(clampToleranceMm(Number.POSITIVE_INFINITY)).toBe(DEFAULT_TOLERANCE_MM);
    expect(clampToleranceMm(Number.NEGATIVE_INFINITY)).toBe(DEFAULT_TOLERANCE_MM);
  });

  it('clamps below the minimum to MIN_TOLERANCE_MM', () => {
    expect(clampToleranceMm(0)).toBe(MIN_TOLERANCE_MM);
    expect(clampToleranceMm(-100)).toBe(MIN_TOLERANCE_MM);
    expect(clampToleranceMm(0.4)).toBe(MIN_TOLERANCE_MM);
  });

  it('clamps above the maximum to MAX_TOLERANCE_MM', () => {
    expect(clampToleranceMm(MAX_TOLERANCE_MM + 1)).toBe(MAX_TOLERANCE_MM);
    expect(clampToleranceMm(1e9)).toBe(MAX_TOLERANCE_MM);
  });

  it('rounds in-range values to integer mm', () => {
    expect(clampToleranceMm(199.4)).toBe(199);
    expect(clampToleranceMm(199.5)).toBe(200);
    expect(clampToleranceMm(200)).toBe(200);
  });
});

describe('readToleranceOverrideMm', () => {
  it('returns null when the property is missing or blank', () => {
    expect(readToleranceOverrideMm(makePoint())).toBeNull();
    expect(readToleranceOverrideMm(makePoint({ [TOLERANCE_PROPERTY_KEY]: '' }))).toBeNull();
    expect(readToleranceOverrideMm(makePoint({ [TOLERANCE_PROPERTY_KEY]: '   ' }))).toBeNull();
  });

  it('returns null when the value cannot be parsed as a finite positive number', () => {
    expect(readToleranceOverrideMm(makePoint({ [TOLERANCE_PROPERTY_KEY]: 'abc' }))).toBeNull();
    expect(readToleranceOverrideMm(makePoint({ [TOLERANCE_PROPERTY_KEY]: 'Infinity' }))).toBeNull();
    expect(readToleranceOverrideMm(makePoint({ [TOLERANCE_PROPERTY_KEY]: '-5' }))).toBeNull();
    // 0 is below MIN_TOLERANCE_MM so it is rejected as an override.
    expect(readToleranceOverrideMm(makePoint({ [TOLERANCE_PROPERTY_KEY]: '0' }))).toBeNull();
  });

  it('parses a valid override and clamps it', () => {
    expect(readToleranceOverrideMm(makePoint({ [TOLERANCE_PROPERTY_KEY]: '500' }))).toBe(500);
    expect(readToleranceOverrideMm(makePoint({ [TOLERANCE_PROPERTY_KEY]: '  750.6  ' }))).toBe(751);
    expect(readToleranceOverrideMm(makePoint({ [TOLERANCE_PROPERTY_KEY]: '999999999' }))).toBe(
      MAX_TOLERANCE_MM,
    );
  });
});

describe('resolveToleranceMm', () => {
  it('uses the override when present', () => {
    expect(resolveToleranceMm(makePoint({ [TOLERANCE_PROPERTY_KEY]: '750' }), 200)).toBe(750);
  });

  it('falls back to the (clamped) default otherwise', () => {
    expect(resolveToleranceMm(makePoint(), 250)).toBe(250);
    expect(resolveToleranceMm(makePoint({ [TOLERANCE_PROPERTY_KEY]: 'bad' }), 250)).toBe(250);
    expect(resolveToleranceMm(makePoint(), Number.NaN)).toBe(DEFAULT_TOLERANCE_MM);
  });
});

describe('toleranceMmToStagePx', () => {
  it('converts mm to stage pixels using the resolution (m/px)', () => {
    // 200 mm at 0.05 m/px = 0.2 / 0.05 = 4 px
    expect(toleranceMmToStagePx(200, 0.05)).toBeCloseTo(4, 6);
    // 1000 mm at 0.1 m/px = 1 / 0.1 = 10 px
    expect(toleranceMmToStagePx(1000, 0.1)).toBeCloseTo(10, 6);
  });

  it('returns null for an invalid resolution or radius', () => {
    expect(toleranceMmToStagePx(200, 0)).toBeNull();
    expect(toleranceMmToStagePx(200, -0.05)).toBeNull();
    expect(toleranceMmToStagePx(200, Number.NaN)).toBeNull();
    expect(toleranceMmToStagePx(0, 0.05)).toBeNull();
    expect(toleranceMmToStagePx(Number.NaN, 0.05)).toBeNull();
  });
});
