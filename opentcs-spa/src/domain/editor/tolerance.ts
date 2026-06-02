// SPDX-FileCopyrightText: The openTCS Authors
// SPDX-License-Identifier: MIT
//
// Pure helpers for the editor's "Point tolerance circle" feature (PR3).
//
// A Point's positioning tolerance is purely a visual / metadata concern —
// it lives in `DraftPoint.properties` under the well-known key below so it
// rides through to `PointCreationTO.properties` at S8 publish without any
// schema change. When unset on a particular point, the global default
// (kept in `useEditorSettingsStore.tolerance.defaultRadiusMm`) is used.
//
// This module is intentionally Vue/Konva-free for trivial unit-testing.

import type { DraftPoint } from '@/domain/model/types';

/** Free-form `properties` key carrying a single Point's override radius (mm). */
export const TOLERANCE_PROPERTY_KEY = 'tcs:positioningTolerance';

/** Minimum legal tolerance radius in millimetres. 0 / negative is meaningless. */
export const MIN_TOLERANCE_MM = 1;

/** Upper bound (100 m). Big enough for any warehouse, small enough to keep the UI sane. */
export const MAX_TOLERANCE_MM = 100_000;

/** Default radius applied to every point when no per-point override is set. */
export const DEFAULT_TOLERANCE_MM = 200;

/**
 * Clamp a user-supplied tolerance radius into `[MIN, MAX]` millimetres.
 *
 * - Non-finite input (NaN / ±∞) → {@link DEFAULT_TOLERANCE_MM}.
 * - Result is rounded to an integer mm (the underlying `properties` value
 *   is a string and Kernel `Triple` coordinates are integer mm — keeping
 *   the radius integer too avoids surprising float drift in the UI).
 */
export function clampToleranceMm(radiusMm: number): number {
  if (!Number.isFinite(radiusMm)) return DEFAULT_TOLERANCE_MM;
  if (radiusMm < MIN_TOLERANCE_MM) return MIN_TOLERANCE_MM;
  if (radiusMm > MAX_TOLERANCE_MM) return MAX_TOLERANCE_MM;
  return Math.round(radiusMm);
}

/**
 * Read a Point's positioning-tolerance override from its free-form
 * `properties` map. Returns `null` when the property is absent, blank, or
 * cannot be parsed as a finite positive number — callers should then use
 * the global default.
 */
export function readToleranceOverrideMm(point: DraftPoint): number | null {
  const raw = point.properties?.[TOLERANCE_PROPERTY_KEY];
  if (typeof raw !== 'string') return null;
  const trimmed = raw.trim();
  if (trimmed.length === 0) return null;
  const n = Number(trimmed);
  if (!Number.isFinite(n) || n < MIN_TOLERANCE_MM) return null;
  return clampToleranceMm(n);
}

/**
 * Resolve the tolerance radius (mm) used to render a single Point's
 * tolerance circle: per-point override if valid, otherwise the global
 * default (which the caller has already clamped via the editor store).
 */
export function resolveToleranceMm(point: DraftPoint, defaultMm: number): number {
  const override = readToleranceOverrideMm(point);
  if (override !== null) return override;
  return clampToleranceMm(defaultMm);
}

/**
 * Convert a tolerance radius from millimetres into stage-pixel units, given
 * the resolution (metres per pixel) attached to the imported background.
 *
 * `resolutionMPerPx <= 0` or non-finite → `null` (caller should skip the
 * circle until a valid background is loaded).
 */
export function toleranceMmToStagePx(radiusMm: number, resolutionMPerPx: number): number | null {
  if (!Number.isFinite(resolutionMPerPx) || resolutionMPerPx <= 0) return null;
  if (!Number.isFinite(radiusMm) || radiusMm <= 0) return null;
  // mm → m → px. Stay in floats; the renderer uses sub-pixel radii.
  return radiusMm / 1000 / resolutionMPerPx;
}
