// SPDX-FileCopyrightText: The openTCS Authors
// SPDX-License-Identifier: MIT
//
// Path-related geometry helpers.
//
// The middle-state `DraftPath.length` is in millimeters (mirroring
// PathCreationTO.length). We compute it from the two endpoint Triples
// (`pose.position`, also mm) so default lengths stay consistent with
// world coordinates derived from the AffineMapping.

import type { Triple } from '@/domain/model/types';

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
