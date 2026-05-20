// SPDX-FileCopyrightText: The openTCS Authors
// SPDX-License-Identifier: MIT
//
// 2-D affine mapping between image pixel coordinates and ROS-world meter
// coordinates, derived from a `map.yaml` (resolution + origin) and the
// raster's pixel dimensions.
//
// Pixel coordinate frame (matches HTML <canvas> / DOM):
//   - origin at the top-left of the image
//   - +x to the right, +y downwards
//
// World coordinate frame (matches ROS map_server / openTCS xy-plane):
//   - origin at the lower-left of the image (the `origin` field of the yaml
//     is the world position of this lower-left corner, in meters)
//   - +x to the right, +y upwards
//
// Therefore for a pixel (px, py) on an image of height H pixels, with
// per-pixel size `r` meters:
//   world_x = origin.x + px         * r
//   world_y = origin.y + (H - py)   * r
//
// MVP simplification: we treat origin.theta as 0 (any non-zero value is
// warned about in the yaml parser; supporting rotated maps is a v2 item,
// see ADR-0001 trade-offs).
//
// This module is intentionally Vue/DOM-free: it only consumes plain
// numbers, so it is trivially unit-testable (Vitest scaffold lands in S10).

export interface AffineMapping {
  /** Meters per pixel; must be > 0. */
  resolution: number;
  /** Pixel width of the source raster; must be > 0. */
  imageWidth: number;
  /** Pixel height of the source raster; must be > 0. */
  imageHeight: number;
  /** World x of the image's lower-left corner, in meters. */
  originX: number;
  /** World y of the image's lower-left corner, in meters. */
  originY: number;
}

export interface WorldPoint {
  /** World x coordinate, in meters. */
  x: number;
  /** World y coordinate, in meters. */
  y: number;
}

export interface PixelPoint {
  /** Pixel x coordinate (column), top-left origin. */
  x: number;
  /** Pixel y coordinate (row), top-left origin. */
  y: number;
}

function assertValid(m: AffineMapping): void {
  if (!(m.resolution > 0) || !Number.isFinite(m.resolution)) {
    throw new Error(`AffineMapping.resolution must be > 0, got ${m.resolution}`);
  }
  if (!(m.imageWidth > 0) || !Number.isInteger(m.imageWidth)) {
    throw new Error(`AffineMapping.imageWidth must be a positive integer, got ${m.imageWidth}`);
  }
  if (!(m.imageHeight > 0) || !Number.isInteger(m.imageHeight)) {
    throw new Error(`AffineMapping.imageHeight must be a positive integer, got ${m.imageHeight}`);
  }
}

/**
 * Convert a pixel coordinate (top-left origin, y down) to world meters.
 *
 * Fractional pixel inputs are allowed (and recommended for hover-mapping a
 * floating-point mouse position).
 */
export function pixelToWorld(m: AffineMapping, p: PixelPoint): WorldPoint {
  assertValid(m);
  return {
    x: m.originX + p.x * m.resolution,
    y: m.originY + (m.imageHeight - p.y) * m.resolution,
  };
}

/**
 * Convert a world coordinate (meters) to image pixels (top-left origin,
 * y down). Output may fall outside `[0, imageWidth) × [0, imageHeight)` if
 * the point is off the map — callers decide whether to clip.
 */
export function worldToPixel(m: AffineMapping, w: WorldPoint): PixelPoint {
  assertValid(m);
  return {
    x: (w.x - m.originX) / m.resolution,
    y: m.imageHeight - (w.y - m.originY) / m.resolution,
  };
}

/**
 * Convenience for building an AffineMapping from a parsed RosMapMetadata
 * (see `domain/yaml/parseRosMapYaml.ts`) and the actually-loaded image
 * dimensions (which the yaml does not contain).
 */
export function buildAffine(args: {
  resolution: number;
  originX: number;
  originY: number;
  imageWidth: number;
  imageHeight: number;
}): AffineMapping {
  const m: AffineMapping = { ...args };
  assertValid(m);
  return m;
}
