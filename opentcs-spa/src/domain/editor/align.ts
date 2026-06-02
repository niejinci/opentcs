// SPDX-FileCopyrightText: The openTCS Authors
// SPDX-License-Identifier: MIT
//
// Pure helpers for the editor's multi-select alignment / distribution
// toolbar (PR3). All functions take and return arrays of bare anchors
// `{name, x, y}` in **stage-pixel coordinates** (== `layout.pixelX/Y`).
// Callers (the project store) translate the result back into per-entity
// `move*` mutations.
//
// Conventions:
//   - Inputs with `< 2` anchors (or `< 3` for distribute*) are returned
//     unchanged. The caller is expected to disable the corresponding
//     toolbar button when the count is too low; this is just defence in
//     depth.
//   - Output anchor objects are FRESH copies so mutating them cannot
//     accidentally write back into the input set.
//   - All coordinates are rounded to integer pixels before returning so
//     the underlying `layout.pixel*` fields keep their integer invariant
//     (matching the existing `addPoint` / `addLocation` / `addVehicle`
//     factories which all round on creation).

export interface AlignAnchor {
  name: string;
  x: number;
  y: number;
}

/** All actions exposed by the toolbar. Stable string ids; UI-bound only. */
export type AlignAction =
  | 'left'
  | 'right'
  | 'top'
  | 'bottom'
  | 'centerX'
  | 'centerY'
  | 'distributeX'
  | 'distributeY';

/** Minimum count below which an `align*` op is a no-op. */
export const ALIGN_MIN_COUNT = 2;

/** Minimum count below which a `distribute*` op is a no-op. */
export const DISTRIBUTE_MIN_COUNT = 3;

function roundAnchor(a: AlignAnchor, x: number, y: number): AlignAnchor {
  return { name: a.name, x: Math.round(x), y: Math.round(y) };
}

function copy(anchors: readonly AlignAnchor[]): AlignAnchor[] {
  return anchors.map((a) => ({ name: a.name, x: a.x, y: a.y }));
}

function alignToConstantX(anchors: readonly AlignAnchor[], x: number): AlignAnchor[] {
  return anchors.map((a) => roundAnchor(a, x, a.y));
}

function alignToConstantY(anchors: readonly AlignAnchor[], y: number): AlignAnchor[] {
  return anchors.map((a) => roundAnchor(a, a.x, y));
}

/** Align all anchors' X to the smallest X in the set (= "left edge"). */
export function alignLeft(anchors: readonly AlignAnchor[]): AlignAnchor[] {
  if (anchors.length < ALIGN_MIN_COUNT) return copy(anchors);
  const x = Math.min(...anchors.map((a) => a.x));
  return alignToConstantX(anchors, x);
}

/** Align all anchors' X to the largest X in the set. */
export function alignRight(anchors: readonly AlignAnchor[]): AlignAnchor[] {
  if (anchors.length < ALIGN_MIN_COUNT) return copy(anchors);
  const x = Math.max(...anchors.map((a) => a.x));
  return alignToConstantX(anchors, x);
}

/** Align all anchors' Y to the smallest Y (= "top edge"; image-y grows downward). */
export function alignTop(anchors: readonly AlignAnchor[]): AlignAnchor[] {
  if (anchors.length < ALIGN_MIN_COUNT) return copy(anchors);
  const y = Math.min(...anchors.map((a) => a.y));
  return alignToConstantY(anchors, y);
}

/** Align all anchors' Y to the largest Y. */
export function alignBottom(anchors: readonly AlignAnchor[]): AlignAnchor[] {
  if (anchors.length < ALIGN_MIN_COUNT) return copy(anchors);
  const y = Math.max(...anchors.map((a) => a.y));
  return alignToConstantY(anchors, y);
}

/**
 * Align horizontally on the centre of the bounding box (X = (min+max)/2).
 * Half-pixel midpoints are rounded toward +∞ via {@link Math.round}.
 */
export function alignCenterX(anchors: readonly AlignAnchor[]): AlignAnchor[] {
  if (anchors.length < ALIGN_MIN_COUNT) return copy(anchors);
  const xs = anchors.map((a) => a.x);
  const mid = (Math.min(...xs) + Math.max(...xs)) / 2;
  return alignToConstantX(anchors, mid);
}

/** Vertical twin of {@link alignCenterX}. */
export function alignCenterY(anchors: readonly AlignAnchor[]): AlignAnchor[] {
  if (anchors.length < ALIGN_MIN_COUNT) return copy(anchors);
  const ys = anchors.map((a) => a.y);
  const mid = (Math.min(...ys) + Math.max(...ys)) / 2;
  return alignToConstantY(anchors, mid);
}

/**
 * Distribute the anchors evenly along X: keep the leftmost and rightmost
 * anchors fixed, and place every interior anchor at equal X intervals.
 *
 * - Anchors are sorted by their current X (then by name as a stable
 *   tiebreaker) before the redistribution; their original Y is preserved.
 * - The returned array preserves the *input* iteration order (so callers
 *   can zip it with the original selection without re-keying).
 */
export function distributeX(anchors: readonly AlignAnchor[]): AlignAnchor[] {
  if (anchors.length < DISTRIBUTE_MIN_COUNT) return copy(anchors);
  const sorted = [...anchors].sort((a, b) => a.x - b.x || a.name.localeCompare(b.name));
  const minX = sorted[0].x;
  const maxX = sorted[sorted.length - 1].x;
  const step = (maxX - minX) / (sorted.length - 1);
  const newXByName = new Map<string, number>();
  sorted.forEach((a, i) => newXByName.set(a.name, minX + step * i));
  return anchors.map((a) => {
    const x = newXByName.get(a.name);
    return roundAnchor(a, x !== undefined ? x : a.x, a.y);
  });
}

/** Vertical twin of {@link distributeX}. */
export function distributeY(anchors: readonly AlignAnchor[]): AlignAnchor[] {
  if (anchors.length < DISTRIBUTE_MIN_COUNT) return copy(anchors);
  const sorted = [...anchors].sort((a, b) => a.y - b.y || a.name.localeCompare(b.name));
  const minY = sorted[0].y;
  const maxY = sorted[sorted.length - 1].y;
  const step = (maxY - minY) / (sorted.length - 1);
  const newYByName = new Map<string, number>();
  sorted.forEach((a, i) => newYByName.set(a.name, minY + step * i));
  return anchors.map((a) => {
    const y = newYByName.get(a.name);
    return roundAnchor(a, a.x, y !== undefined ? y : a.y);
  });
}

/** Dispatch table — single entry-point for the toolbar / store. */
export function applyAlignAction(
  action: AlignAction,
  anchors: readonly AlignAnchor[],
): AlignAnchor[] {
  switch (action) {
    case 'left':
      return alignLeft(anchors);
    case 'right':
      return alignRight(anchors);
    case 'top':
      return alignTop(anchors);
    case 'bottom':
      return alignBottom(anchors);
    case 'centerX':
      return alignCenterX(anchors);
    case 'centerY':
      return alignCenterY(anchors);
    case 'distributeX':
      return distributeX(anchors);
    case 'distributeY':
      return distributeY(anchors);
  }
}
