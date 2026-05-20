// SPDX-FileCopyrightText: The openTCS Authors
// SPDX-License-Identifier: MIT
//
// Pure parser for the ROS map_server `map.yaml` metadata format
// (see https://wiki.ros.org/map_server#YAML_format).
//
// This module is intentionally Vue/DOM-free so it can be unit-tested in
// isolation (S10 adds Vitest); callers in `views/` / `components/` pass in
// the raw text from a `<input type="file">` / `File.text()`.
//
// MVP support matrix:
//   - resolution: required, positive number (meters per pixel)
//   - origin:     required, [x, y, theta] in meters/radians; theta MVP-only
//                 supported as 0 (any non-zero value yields a soft warning;
//                 the affine helper still treats it as 0 — rotated maps are
//                 deferred to v2, see ADR-0001 trade-offs).
//   - image:      required, string filename relative to the yaml; SPA uses
//                 it only for sanity-checking against the uploaded .pgm/.png
//                 filename, never for fetching (SPA never reads from disk).
//   - negate, occupied_thresh, free_thresh: optional, parsed but unused at S3.
//
// Compatibility note for SS27-style yaml (see `SS27/SS27.yaml` at the repo
// root): the file begins with the non-standard directive `%YAML:1.0`
// (OpenCV / ROS legacy emitter), which js-yaml 4 rejects with
// "expected a comment or a line break" because the spec requires a space
// after `%YAML`. We strip any such directive line before handing the text
// to js-yaml — strictly safe because YAML directives do not affect the
// document semantics that map_server consumes.

import yaml from 'js-yaml';

export interface RosMapOrigin {
  /** World x of the image's lower-left corner, in meters. */
  x: number;
  /** World y of the image's lower-left corner, in meters. */
  y: number;
  /** Yaw rotation of the image, in radians. MVP only supports 0. */
  theta: number;
}

export interface RosMapMetadata {
  /** Filename of the raster (e.g. `SS27.pgm`); not used for IO. */
  image: string;
  /** Meters per pixel. Must be > 0. */
  resolution: number;
  origin: RosMapOrigin;
  /** Optional, defaults to 0. */
  negate: number;
  /** Optional, defaults to 0.65 per map_server. */
  occupiedThresh: number;
  /** Optional, defaults to 0.196 per map_server. */
  freeThresh: number;
  /**
   * Non-fatal warnings (e.g. non-zero theta, unknown extra keys) the UI
   * should surface to the user. Empty when the file is fully MVP-compliant.
   */
  warnings: string[];
}

export class RosMapYamlError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'RosMapYamlError';
  }
}

/**
 * Strip a leading `%YAML:x.y` legacy directive (no space after `%YAML`)
 * which js-yaml 4 rejects as malformed. Standard `%YAML 1.1` / `%YAML 1.2`
 * directives are left untouched.
 */
function stripLegacyYamlDirective(text: string): string {
  // Match only at the very start of the file, optionally preceded by BOM.
  return text.replace(/^\uFEFF?%YAML:[^\r\n]*\r?\n?/, '');
}

function asPositiveNumber(value: unknown, field: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) {
    throw new RosMapYamlError(`Field '${field}' must be a positive number, got: ${String(value)}`);
  }
  return value;
}

function asNumber(value: unknown, field: string, fallback?: number): number {
  if (value === undefined || value === null) {
    if (fallback !== undefined) return fallback;
    throw new RosMapYamlError(`Field '${field}' is required.`);
  }
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new RosMapYamlError(`Field '${field}' must be a finite number, got: ${String(value)}`);
  }
  return value;
}

function asString(value: unknown, field: string): string {
  if (typeof value !== 'string' || value.length === 0) {
    throw new RosMapYamlError(`Field '${field}' must be a non-empty string.`);
  }
  return value;
}

/**
 * Parse a ROS map_server `map.yaml` file content.
 *
 * @throws {RosMapYamlError} If the content is not a valid YAML mapping or any
 *   required field is missing / malformed.
 */
export function parseRosMapYaml(text: string): RosMapMetadata {
  let doc: unknown;
  try {
    doc = yaml.load(stripLegacyYamlDirective(text));
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new RosMapYamlError(`YAML syntax error: ${msg}`);
  }

  if (doc === null || typeof doc !== 'object' || Array.isArray(doc)) {
    throw new RosMapYamlError('Expected a YAML mapping at the document root.');
  }
  const obj = doc as Record<string, unknown>;

  const image = asString(obj.image, 'image');
  const resolution = asPositiveNumber(obj.resolution, 'resolution');

  if (!Array.isArray(obj.origin) || obj.origin.length < 2) {
    throw new RosMapYamlError(
      "Field 'origin' must be an array of [x, y, theta] (theta optional, defaults to 0).",
    );
  }
  const origin: RosMapOrigin = {
    x: asNumber(obj.origin[0], 'origin[0]'),
    y: asNumber(obj.origin[1], 'origin[1]'),
    theta: obj.origin.length >= 3 ? asNumber(obj.origin[2], 'origin[2]', 0) : 0,
  };

  const warnings: string[] = [];
  if (Math.abs(origin.theta) > 1e-9) {
    warnings.push(
      `origin theta=${origin.theta} rad is not supported in MVP; pixel↔meter mapping will assume theta=0 (axis-aligned).`,
    );
  }

  const knownKeys = new Set([
    'image',
    'resolution',
    'origin',
    'negate',
    'occupied_thresh',
    'free_thresh',
    'mode',
  ]);
  for (const key of Object.keys(obj)) {
    if (!knownKeys.has(key)) {
      warnings.push(`Unknown key '${key}' in yaml is ignored.`);
    }
  }

  return {
    image,
    resolution,
    origin,
    negate: asNumber(obj.negate, 'negate', 0),
    occupiedThresh: asNumber(obj.occupied_thresh, 'occupied_thresh', 0.65),
    freeThresh: asNumber(obj.free_thresh, 'free_thresh', 0.196),
    warnings,
  };
}
