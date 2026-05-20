// SPDX-FileCopyrightText: The openTCS Authors
// SPDX-License-Identifier: MIT
//
// Auto-name generation for editor entities. openTCS Point / Path names
// must be unique within a plant model, so we hand out monotonically
// increasing `Point-N` / `Path-N` slugs, skipping any N already taken
// (e.g. after a user manually renamed an entity).

/**
 * Compute the next unused `${prefix}-N` for a given collection of
 * existing names. N starts at 1.
 *
 * Examples (prefix='Point'):
 *   - [] → "Point-1"
 *   - ["Point-1", "Point-3"] → "Point-2"
 *   - ["Point-1", "Point-2", "Point-3"] → "Point-4"
 *   - ["Loading-A", "Point-1"] → "Point-2"   (unrelated names ignored)
 */
export function nextAutoName(prefix: string, existing: Iterable<string>): string {
  const taken = new Set<number>();
  const re = new RegExp(`^${prefix}-(\\d+)$`);
  for (const name of existing) {
    const m = re.exec(name);
    if (m) {
      const n = Number(m[1]);
      if (Number.isInteger(n) && n >= 1) taken.add(n);
    }
  }
  let n = 1;
  while (taken.has(n)) n += 1;
  return `${prefix}-${n}`;
}

/**
 * Validate a user-edited entity name. openTCS does not enforce a strict
 * regex on names, but for MVP we require non-empty + no whitespace + no
 * forward-slash (the BFF file-storage layer at S7 will use names as path
 * segments under `data/projects/{id}/`).
 */
export function isValidEntityName(name: string): boolean {
  if (!name || name.length === 0) return false;
  if (name.length > 128) return false;
  // Disallow whitespace, slash, backslash, and ASCII control chars.
  return !/[\s/\\\u0000-\u001f]/.test(name);
}
