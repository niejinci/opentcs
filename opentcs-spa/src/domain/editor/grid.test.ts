// SPDX-FileCopyrightText: The openTCS Authors
// SPDX-License-Identifier: MIT

import { describe, expect, it } from 'vitest';

import {
  clampGridSpacing,
  DEFAULT_GRID_SPACING_PX,
  gridLineXs,
  gridLineYs,
  MAX_GRID_SPACING_PX,
  MIN_GRID_SPACING_PX,
  snapCoordinate,
  snapToGrid,
} from '@/domain/editor/grid';

describe('snapCoordinate', () => {
  it('rounds to the nearest multiple of spacing', () => {
    expect(snapCoordinate(0, 20)).toBe(0);
    expect(snapCoordinate(9, 20)).toBe(0);
    expect(snapCoordinate(10, 20)).toBe(20); // .5 ties round up via Math.round
    expect(snapCoordinate(11, 20)).toBe(20);
    expect(snapCoordinate(29, 20)).toBe(20);
    expect(snapCoordinate(31, 20)).toBe(40);
  });

  it('snaps negative coordinates symmetrically', () => {
    expect(snapCoordinate(-9, 20)).toBe(0);
    expect(snapCoordinate(-11, 20)).toBe(-20);
    expect(snapCoordinate(-31, 20)).toBe(-40);
  });

  it('passes through when spacing is below the minimum', () => {
    expect(snapCoordinate(123.456, 0)).toBe(123.456);
    expect(snapCoordinate(123.456, MIN_GRID_SPACING_PX - 0.5)).toBe(123.456);
  });

  it('passes through non-finite inputs without throwing', () => {
    expect(snapCoordinate(Number.NaN, 20)).toBeNaN();
    expect(snapCoordinate(Number.POSITIVE_INFINITY, 20)).toBe(Number.POSITIVE_INFINITY);
    expect(snapCoordinate(5, Number.NaN)).toBe(5);
  });
});

describe('snapToGrid', () => {
  it('snaps both axes independently', () => {
    expect(snapToGrid({ x: 11, y: 39 }, 20)).toEqual({ x: 20, y: 40 });
  });

  it('returns a fresh object even when no change occurs', () => {
    const input = { x: 0, y: 0 };
    const out = snapToGrid(input, 20);
    expect(out).toEqual(input);
    expect(out).not.toBe(input);
  });
});

describe('gridLineXs / gridLineYs', () => {
  it('emits ascending lines inside a half-open interval', () => {
    expect(gridLineXs(0, 100, 20)).toEqual([0, 20, 40, 60, 80]);
    expect(gridLineYs(5, 65, 20)).toEqual([20, 40, 60]);
  });

  it('returns empty for invalid spacings or empty intervals', () => {
    expect(gridLineXs(0, 100, 0)).toEqual([]);
    expect(gridLineXs(0, 100, -10)).toEqual([]);
    expect(gridLineXs(50, 50, 20)).toEqual([]);
    expect(gridLineXs(60, 50, 20)).toEqual([]);
  });

  it('handles negative starting bounds (panned-off-canvas case)', () => {
    expect(gridLineXs(-15, 25, 10)).toEqual([-10, 0, 10, 20]);
  });
});

describe('clampGridSpacing', () => {
  it('clamps into the legal range', () => {
    expect(clampGridSpacing(0)).toBe(MIN_GRID_SPACING_PX);
    expect(clampGridSpacing(-10)).toBe(MIN_GRID_SPACING_PX);
    expect(clampGridSpacing(MAX_GRID_SPACING_PX + 50)).toBe(MAX_GRID_SPACING_PX);
    expect(clampGridSpacing(15)).toBe(15);
  });

  it('falls back to the default for non-finite input', () => {
    expect(clampGridSpacing(Number.NaN)).toBe(DEFAULT_GRID_SPACING_PX);
    expect(clampGridSpacing(Number.POSITIVE_INFINITY)).toBe(DEFAULT_GRID_SPACING_PX);
  });

  it('rounds fractional values to integer pixels', () => {
    expect(clampGridSpacing(15.4)).toBe(15);
    expect(clampGridSpacing(15.6)).toBe(16);
  });
});
