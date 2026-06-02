// SPDX-FileCopyrightText: The openTCS Authors
// SPDX-License-Identifier: MIT

import { describe, expect, it } from 'vitest';

import {
  alignBottom,
  alignCenterX,
  alignCenterY,
  alignLeft,
  alignRight,
  alignTop,
  applyAlignAction,
  distributeX,
  distributeY,
  type AlignAnchor,
} from './align';

const A: AlignAnchor = { name: 'a', x: 10, y: 20 };
const B: AlignAnchor = { name: 'b', x: 50, y: 200 };
const C: AlignAnchor = { name: 'c', x: 90, y: 110 };

function byName(arr: AlignAnchor[]): Record<string, AlignAnchor> {
  return Object.fromEntries(arr.map((a) => [a.name, a]));
}

describe('align ops — guards', () => {
  it('returns a copy unchanged for fewer than 2 anchors', () => {
    expect(alignLeft([])).toEqual([]);
    expect(alignLeft([A])).toEqual([A]);
    // Result is a fresh copy: mutating it doesn't mutate the input.
    const out = alignLeft([A]);
    out[0].x = 999;
    expect(A.x).toBe(10);
  });

  it('distribute returns a copy unchanged for fewer than 3 anchors', () => {
    expect(distributeX([A, B])).toEqual([A, B]);
    expect(distributeY([A, B])).toEqual([A, B]);
  });
});

describe('alignLeft / alignRight / alignTop / alignBottom', () => {
  it('alignLeft pulls every X to the smallest X', () => {
    const out = byName(alignLeft([A, B, C]));
    expect(out.a.x).toBe(10);
    expect(out.b.x).toBe(10);
    expect(out.c.x).toBe(10);
    // Y untouched.
    expect(out.a.y).toBe(20);
    expect(out.b.y).toBe(200);
    expect(out.c.y).toBe(110);
  });

  it('alignRight pulls every X to the largest X', () => {
    const out = byName(alignRight([A, B, C]));
    expect(out.a.x).toBe(90);
    expect(out.b.x).toBe(90);
    expect(out.c.x).toBe(90);
  });

  it('alignTop pulls every Y to the smallest Y', () => {
    const out = byName(alignTop([A, B, C]));
    expect(out.a.y).toBe(20);
    expect(out.b.y).toBe(20);
    expect(out.c.y).toBe(20);
  });

  it('alignBottom pulls every Y to the largest Y', () => {
    const out = byName(alignBottom([A, B, C]));
    expect(out.a.y).toBe(200);
    expect(out.b.y).toBe(200);
    expect(out.c.y).toBe(200);
  });
});

describe('alignCenterX / alignCenterY', () => {
  it('alignCenterX puts every X at (min+max)/2 (rounded)', () => {
    // min=10 max=90 → 50
    const out = byName(alignCenterX([A, B, C]));
    expect(out.a.x).toBe(50);
    expect(out.b.x).toBe(50);
    expect(out.c.x).toBe(50);
  });

  it('alignCenterY puts every Y at (min+max)/2 (rounded)', () => {
    // min=20 max=200 → 110
    const out = byName(alignCenterY([A, B, C]));
    expect(out.a.y).toBe(110);
    expect(out.b.y).toBe(110);
    expect(out.c.y).toBe(110);
  });

  it('rounds half-pixel midpoints', () => {
    const out = byName(
      alignCenterX([
        { name: 'p', x: 0, y: 0 },
        { name: 'q', x: 5, y: 0 }, // midpoint = 2.5 → 3 (Math.round)
      ]),
    );
    expect(out.p.x).toBe(3);
    expect(out.q.x).toBe(3);
  });
});

describe('distributeX / distributeY', () => {
  it('distributeX keeps the extreme anchors and places interior ones evenly', () => {
    // Three anchors at x = 10, 50, 90 → already evenly spaced.
    const out = byName(distributeX([A, B, C]));
    expect(out.a.x).toBe(10);
    expect(out.b.x).toBe(50);
    expect(out.c.x).toBe(90);
  });

  it('distributeX redistributes a misaligned interior anchor', () => {
    const a: AlignAnchor = { name: 'a', x: 0, y: 0 };
    const b: AlignAnchor = { name: 'b', x: 10, y: 5 }; // should land at 50
    const c: AlignAnchor = { name: 'c', x: 100, y: 9 };
    const out = byName(distributeX([a, b, c]));
    expect(out.a.x).toBe(0);
    expect(out.b.x).toBe(50);
    expect(out.c.x).toBe(100);
    // Y values are preserved.
    expect(out.a.y).toBe(0);
    expect(out.b.y).toBe(5);
    expect(out.c.y).toBe(9);
  });

  it('distributeY redistributes by Y axis', () => {
    const a: AlignAnchor = { name: 'a', x: 1, y: 0 };
    const b: AlignAnchor = { name: 'b', x: 2, y: 80 };
    const c: AlignAnchor = { name: 'c', x: 3, y: 200 };
    // Step = 100 → 'b' should be 100.
    const out = byName(distributeY([a, b, c]));
    expect(out.a.y).toBe(0);
    expect(out.b.y).toBe(100);
    expect(out.c.y).toBe(200);
    expect(out.b.x).toBe(2);
  });

  it('handles 5 unsorted anchors deterministically', () => {
    const xs = [
      { name: 'e', x: 100, y: 0 },
      { name: 'a', x: 0, y: 0 },
      { name: 'd', x: 33, y: 0 },
      { name: 'b', x: 7, y: 0 },
      { name: 'c', x: 80, y: 0 },
    ];
    // Sort by x then name → a(0), b(7), c(80), d(33)? d=33 c=80 sort by x: a,b,d,c,e.
    // min=0 max=100 step=25 → a:0, b:25, d:50, c:75, e:100.
    const out = byName(distributeX(xs));
    expect(out.a.x).toBe(0);
    expect(out.b.x).toBe(25);
    expect(out.d.x).toBe(50);
    expect(out.c.x).toBe(75);
    expect(out.e.x).toBe(100);
  });

  it('preserves the input iteration order in the result', () => {
    const order = distributeX([C, A, B]).map((a) => a.name);
    expect(order).toEqual(['c', 'a', 'b']);
  });
});

describe('applyAlignAction', () => {
  it('dispatches to the right primitive', () => {
    expect(applyAlignAction('left', [A, B])).toEqual(alignLeft([A, B]));
    expect(applyAlignAction('right', [A, B])).toEqual(alignRight([A, B]));
    expect(applyAlignAction('top', [A, B])).toEqual(alignTop([A, B]));
    expect(applyAlignAction('bottom', [A, B])).toEqual(alignBottom([A, B]));
    expect(applyAlignAction('centerX', [A, B])).toEqual(alignCenterX([A, B]));
    expect(applyAlignAction('centerY', [A, B])).toEqual(alignCenterY([A, B]));
    expect(applyAlignAction('distributeX', [A, B, C])).toEqual(distributeX([A, B, C]));
    expect(applyAlignAction('distributeY', [A, B, C])).toEqual(distributeY([A, B, C]));
  });
});
