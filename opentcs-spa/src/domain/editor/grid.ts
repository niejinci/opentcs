// SPDX-FileCopyrightText: The openTCS Authors
// SPDX-License-Identifier: MIT
//
// Pure geometry helpers for the editor's grid-snap feature.
//
// All inputs/outputs are in **stage (= natural image pixel) coordinates**:
// the same coordinate frame that `MapStage` uses for child layers and that
// the `tool-fire` payload's `pixel` field carries. World-space conversion
// (mm/Triple) is layered on top by `pixelToWorld` in `domain/geometry/affine`.
//
// MVP rationale (S-roadmap PR2):
//   - "Snap to grid" is a 2-D nearest-grid-intersection rounding driven by
//     a single positive spacing. The grid origin is fixed at (0, 0) in
//     stage coords because `BackgroundLayer` is drawn at (0, 0) — that is
//     also the top-left pixel of the imported PNG. This is the only choice
//     consistent with the existing pixel/world conversion (see ADR-0001).
//   - Visual grid lines are computed lazily for the visible viewport only
//     (avoids drawing thousands of off-screen lines for very large maps).
//
// This module is intentionally Vue/DOM-free for trivial unit-testing.

/** Minimum legal grid spacing in pixels. Below this, snap is a no-op. */
export const MIN_GRID_SPACING_PX = 1;

/** Maximum legal grid spacing in pixels (sanity bound for the UI input). */
export const MAX_GRID_SPACING_PX = 1000;

/** Default spacing on first use; tuned to look reasonable on the warehouse demo map. */
export const DEFAULT_GRID_SPACING_PX = 20;

export interface Point2D {
  x: number;
  y: number;
}

/**
 * Round a single coordinate to the nearest multiple of `spacing`.
 *
 * - `spacing <= 0` or non-finite → returned unchanged (no snap).
 * - Negative coordinates round symmetrically (away from zero on .5 ties,
 *   matching `Math.round` semantics).
 */
export function snapCoordinate(value: number, spacing: number): number {
  if (!Number.isFinite(value)) return value;
  if (!Number.isFinite(spacing) || spacing < MIN_GRID_SPACING_PX) return value;
  // `+ 0` collapses the JS oddity `-0` (produced by `Math.round` for small
  // negatives) into a plain `0`, so callers can use strict equality and
  // `expect(...).toBe(0)` without surprises.
  return Math.round(value / spacing) * spacing + 0;
}

/**
 * Snap a 2-D pixel-space point to the nearest grid intersection.
 *
 * Returns a fresh object even if no rounding occurred, so callers can
 * always treat the result as their owned copy.
 */
export function snapToGrid(p: Point2D, spacing: number): Point2D {
  return {
    x: snapCoordinate(p.x, spacing),
    y: snapCoordinate(p.y, spacing),
  };
}

/**
 * Generate the X coordinates of every vertical grid line that falls inside
 * the half-open viewport `[x0, x1)`.
 *
 * - Lines are emitted in ascending order.
 * - `spacing <= 0` or `x0 >= x1` → empty array.
 */
export function gridLineXs(x0: number, x1: number, spacing: number): number[] {
  if (!Number.isFinite(spacing) || spacing < MIN_GRID_SPACING_PX) return [];
  if (!Number.isFinite(x0) || !Number.isFinite(x1) || x1 <= x0) return [];
  const start = Math.ceil(x0 / spacing) * spacing;
  const xs: number[] = [];
  for (let x = start; x < x1; x += spacing) xs.push(x);
  return xs;
}

/** Y-axis twin of {@link gridLineXs}. */
export function gridLineYs(y0: number, y1: number, spacing: number): number[] {
  return gridLineXs(y0, y1, spacing);
}

/**
 * Clamp a user-supplied spacing into `[MIN_GRID_SPACING_PX, MAX_GRID_SPACING_PX]`,
 * falling back to {@link DEFAULT_GRID_SPACING_PX} for non-finite input.
 */
export function clampGridSpacing(spacing: number): number {
  if (!Number.isFinite(spacing)) return DEFAULT_GRID_SPACING_PX;
  if (spacing < MIN_GRID_SPACING_PX) return MIN_GRID_SPACING_PX;
  if (spacing > MAX_GRID_SPACING_PX) return MAX_GRID_SPACING_PX;
  return Math.round(spacing);
}
