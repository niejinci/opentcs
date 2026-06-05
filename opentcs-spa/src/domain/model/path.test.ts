// SPDX-FileCopyrightText: The openTCS Authors
// SPDX-License-Identifier: MIT

import { describe, expect, it } from 'vitest';

import { directedPathArrowGeometry } from '@/domain/model/path';

function controlPoint(pathData: string): { x: number; y: number } {
  const match = /^M\s+\S+\s+\S+\s+Q\s+(\S+)\s+(\S+)\s+\S+\s+\S+$/.exec(pathData);
  if (!match) throw new Error(`Expected quadratic path data, got: ${pathData}`);
  return { x: Number(match[1]), y: Number(match[2]) };
}

describe('directed path geometry', () => {
  it('separates reverse paths onto opposite sides of the same endpoint pair', () => {
    const forward = directedPathArrowGeometry({
      srcPointName: 'Point-5',
      destPointName: 'Point-6',
      sx: 0,
      sy: 0,
      dx: 100,
      dy: 0,
      curveSign: 1,
      sagitta: 16,
      arrowSize: 8,
    });
    const reverse = directedPathArrowGeometry({
      srcPointName: 'Point-6',
      destPointName: 'Point-5',
      sx: 100,
      sy: 0,
      dx: 0,
      dy: 0,
      curveSign: -1,
      sagitta: 16,
      arrowSize: 8,
    });

    expect(controlPoint(forward.pathData)).toEqual({ x: 50, y: 16 });
    expect(controlPoint(reverse.pathData)).toEqual({ x: 50, y: -16 });
  });

  it('keeps single-direction paths straight', () => {
    const geom = directedPathArrowGeometry({
      srcPointName: 'A',
      destPointName: 'B',
      sx: 0,
      sy: 0,
      dx: 100,
      dy: 0,
      curveSign: null,
      sagitta: 16,
      arrowSize: 8,
    });

    expect(geom.pathData).toBe('M 0 0 L 100 0');
    expect(geom.arrowHeadPoints).toHaveLength(6);
  });
});
