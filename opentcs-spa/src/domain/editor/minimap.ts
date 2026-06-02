// SPDX-FileCopyrightText: The openTCS Authors
// SPDX-License-Identifier: MIT
//
// Pure helpers for the editor's mini-map overlay.
//
// The mini-map renders a fixed-size HTML `<canvas>` thumbnail of the
// imported background image plus a translucent rectangle showing the part
// of the image currently visible in the main `MapStage`. Clicking the
// mini-map recenters the main stage on the clicked point.
//
// All math here is plain numbers so the component can be trivially tested.

import { snapCoordinate } from './grid';

export interface MiniMapBox {
  /** Top-left corner of the thumbnail in mini-map CSS px (always 0 for now). */
  x: number;
  y: number;
  /** Thumbnail width in mini-map CSS px. */
  width: number;
  /** Thumbnail height in mini-map CSS px. */
  height: number;
  /** Scaling factor: mini-map px per stage (== natural image) px. */
  scale: number;
}

/**
 * Compute the largest letterboxed thumbnail of an image of size
 * (imageWidth × imageHeight) that fits inside (boxWidth × boxHeight),
 * preserving aspect ratio. Returns the thumbnail rect (centred in the box)
 * and the px-per-stage-px scale.
 */
export function fitThumbnail(
  imageWidth: number,
  imageHeight: number,
  boxWidth: number,
  boxHeight: number,
): MiniMapBox {
  if (imageWidth <= 0 || imageHeight <= 0 || boxWidth <= 0 || boxHeight <= 0) {
    return { x: 0, y: 0, width: 0, height: 0, scale: 0 };
  }
  const sx = boxWidth / imageWidth;
  const sy = boxHeight / imageHeight;
  const scale = Math.min(sx, sy);
  const width = imageWidth * scale;
  const height = imageHeight * scale;
  const x = (boxWidth - width) / 2;
  const y = (boxHeight - height) / 2;
  return { x, y, width, height, scale };
}

export interface ViewportRect {
  /** Mini-map CSS px of the viewport rect's top-left corner. */
  x: number;
  y: number;
  /** Width / height in mini-map CSS px (clamped to thumbnail bounds). */
  width: number;
  height: number;
}

/**
 * Project the part of the image visible in the main stage (= the chunk of
 * stage-space that maps to screen-space `[0, stageWidth) × [0, stageHeight)`)
 * onto mini-map CSS coordinates.
 *
 * - The main-stage transform is `screen = stage * scale + (stageX, stageY)`,
 *   so the visible stage-space rect is
 *     `x = -stageX/scale`, `width = stageWidth/scale` (analogous for y).
 * - We then intersect with the image bounds `[0, imageWidth) × [0, imageHeight)`
 *   and remap into the thumbnail rect via `thumbnail.scale`.
 *
 * Returns `null` if there is no overlap with the image (e.g. user panned
 * the image entirely off-screen).
 */
export function viewportRectOnThumbnail(
  thumbnail: MiniMapBox,
  imageWidth: number,
  imageHeight: number,
  stageScale: number,
  stageX: number,
  stageY: number,
  stageWidth: number,
  stageHeight: number,
): ViewportRect | null {
  if (thumbnail.scale <= 0 || stageScale <= 0) return null;
  const vx0 = Math.max(0, (0 - stageX) / stageScale);
  const vx1 = Math.min(imageWidth, (stageWidth - stageX) / stageScale);
  const vy0 = Math.max(0, (0 - stageY) / stageScale);
  const vy1 = Math.min(imageHeight, (stageHeight - stageY) / stageScale);
  if (vx1 <= vx0 || vy1 <= vy0) return null;
  return {
    x: thumbnail.x + vx0 * thumbnail.scale,
    y: thumbnail.y + vy0 * thumbnail.scale,
    width: (vx1 - vx0) * thumbnail.scale,
    height: (vy1 - vy0) * thumbnail.scale,
  };
}

/**
 * Translate a click on the mini-map into the stage-space pixel that should
 * become the new viewport centre. Returns `null` if the click landed in
 * the letterbox area outside the actual thumbnail.
 *
 * `clientX` / `clientY` are mini-map-local CSS coords (e.g. as produced by
 * `event.offsetX/Y` or by subtracting `getBoundingClientRect()`).
 */
export function thumbnailPointToStage(
  thumbnail: MiniMapBox,
  clientX: number,
  clientY: number,
): { x: number; y: number } | null {
  if (thumbnail.scale <= 0) return null;
  const tx = clientX - thumbnail.x;
  const ty = clientY - thumbnail.y;
  if (tx < 0 || ty < 0 || tx > thumbnail.width || ty > thumbnail.height) return null;
  return { x: tx / thumbnail.scale, y: ty / thumbnail.scale };
}

/**
 * Compute the new (stageX, stageY) that recenters the main viewport on the
 * given stage-space point, optionally snapped to whole pixels for jitter
 * resistance. Pure helper so the calling component stays declarative.
 */
export function panToStagePoint(
  stagePoint: { x: number; y: number },
  stageScale: number,
  stageWidth: number,
  stageHeight: number,
): { stageX: number; stageY: number } {
  const stageX = stageWidth / 2 - stagePoint.x * stageScale;
  const stageY = stageHeight / 2 - stagePoint.y * stageScale;
  // Use the existing snapCoordinate helper (with spacing 1) just to drop
  // sub-pixel jitter in the persisted refs — purely cosmetic.
  return {
    stageX: snapCoordinate(stageX, 1),
    stageY: snapCoordinate(stageY, 1),
  };
}
