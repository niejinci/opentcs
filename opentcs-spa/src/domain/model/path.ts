// SPDX-FileCopyrightText: The openTCS Authors
// SPDX-License-Identifier: MIT
//
// Path-related geometry helpers.
//
// The middle-state `DraftPath.length` is in millimeters (mirroring
// PathCreationTO.length). We compute it from the two endpoint Triples
// (`pose.position`, also mm) so default lengths stay consistent with
// world coordinates derived from the AffineMapping.

import type { DraftPath, Triple } from '@/domain/model/types';

/**
 * Euclidean distance between two Triples, rounded to the nearest mm
 * (`PathCreationTO.length` is `long`, so integer mm).
 *
 * z is included for completeness, but in MVP all points sit at z=0.
 */
export function distanceMm(a: Triple, b: Triple): number {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  const dz = a.z - b.z;
  return Math.max(0, Math.round(Math.sqrt(dx * dx + dy * dy + dz * dz)));
}

/**
 * Internal delimiter used to encode `(src, dst)` pairs as a Map/Set key.
 * U+0001 (SOH) is forbidden in entity names by `isValidEntityName`, so
 * it can't collide with any user-chosen Point name.
 */
export const PATH_PAIR_KEY_DELIM = '\u0001';

export function directedPathKey(srcPointName: string, destPointName: string): string {
  return `${srcPointName}${PATH_PAIR_KEY_DELIM}${destPointName}`;
}

export function findDirectedPath<T extends Pick<DraftPath, 'srcPointName' | 'destPointName'>>(
  paths: T[],
  srcPointName: string,
  destPointName: string,
): T | undefined {
  return paths.find((p) => p.srcPointName === srcPointName && p.destPointName === destPointName);
}

export function uniqueDirectedPaths<T extends Pick<DraftPath, 'srcPointName' | 'destPointName'>>(
  paths: T[],
): T[] {
  const seen = new Set<string>();
  const out: T[] = [];
  for (const path of paths) {
    const key = directedPathKey(path.srcPointName, path.destPointName);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(path);
  }
  return out;
}

export interface PathArrowGeometry {
  /** SVG path data: `M sx sy Q cx cy dx dy` (or `M..L..` when straight). */
  pathData: string;
  /** Arrow-head triangle points, in stage-pixel coordinates (6-tuple). */
  arrowHeadPoints: number[];
}

interface CurvedPathGeometryInput {
  srcPointName: string;
  destPointName: string;
  sx: number;
  sy: number;
  dx: number;
  dy: number;
  curveSign: 1 | -1 | null;
  sagitta: number;
  arrowSize: number;
}

/**
 * Geometry helper for directed paths.
 *
 * Bidirectional paths must not share the same quadratic-Bézier control
 * point. The perpendicular normal is therefore derived from the unordered
 * pair's canonical direction (lexicographically smaller point name to
 * larger point name), while `curveSign` chooses one side of that fixed
 * line. This keeps A->B and B->A visibly separated instead of cancelling
 * the sign when the direction vector reverses.
 */
export function directedPathArrowGeometry(input: CurvedPathGeometryInput): PathArrowGeometry {
  const { srcPointName, destPointName, sx, sy, dx, dy, curveSign, sagitta, arrowSize } = input;
  if (curveSign === null) {
    const len = Math.hypot(dx - sx, dy - sy);
    if (len < 1e-6) return { pathData: `M ${sx} ${sy} L ${dx} ${dy}`, arrowHeadPoints: [] };
    return {
      pathData: `M ${sx} ${sy} L ${dx} ${dy}`,
      arrowHeadPoints: arrowHeadAt(dx, dy, (dx - sx) / len, (dy - sy) / len, arrowSize),
    };
  }

  const canonicalForward = srcPointName < destPointName;
  const ax = canonicalForward ? sx : dx;
  const ay = canonicalForward ? sy : dy;
  const bx = canonicalForward ? dx : sx;
  const by = canonicalForward ? dy : sy;
  const cdx = bx - ax;
  const cdy = by - ay;
  const len = Math.hypot(cdx, cdy);
  if (len < 1e-6) return { pathData: `M ${sx} ${sy} L ${dx} ${dy}`, arrowHeadPoints: [] };

  const nx = -cdy / len;
  const ny = cdx / len;
  const cx = (sx + dx) / 2 + nx * sagitta * curveSign;
  const cy = (sy + dy) / 2 + ny * sagitta * curveSign;

  let tx = dx - cx;
  let ty = dy - cy;
  const tlen = Math.hypot(tx, ty);
  if (tlen > 1e-6) {
    tx /= tlen;
    ty /= tlen;
  } else {
    tx = (dx - sx) / len;
    ty = (dy - sy) / len;
  }
  return {
    pathData: `M ${sx} ${sy} Q ${cx} ${cy} ${dx} ${dy}`,
    arrowHeadPoints: arrowHeadAt(dx, dy, tx, ty, arrowSize),
  };
}

/** Build a 3-vertex arrow head ending at (x,y) with tangent (tx,ty). */
export function arrowHeadAt(
  x: number,
  y: number,
  tx: number,
  ty: number,
  size: number,
): number[] {
  // Perpendicular to tangent.
  const px = -ty;
  const py = tx;
  const backX = x - tx * size;
  const backY = y - ty * size;
  return [
    x,
    y,
    backX + px * size * 0.55,
    backY + py * size * 0.55,
    backX - px * size * 0.55,
    backY - py * size * 0.55,
  ];
}
