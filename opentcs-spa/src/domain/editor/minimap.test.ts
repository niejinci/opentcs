// SPDX-FileCopyrightText: The openTCS Authors
// SPDX-License-Identifier: MIT

import { describe, expect, it } from 'vitest';

import {
  fitThumbnail,
  panToStagePoint,
  thumbnailPointToStage,
  viewportRectOnThumbnail,
} from '@/domain/editor/minimap';

describe('fitThumbnail', () => {
  it('letterboxes a wide image inside a square box', () => {
    const t = fitThumbnail(200, 100, 160, 120);
    // Width-bound: scale = 160/200 = 0.8, so thumb = 160 × 80, centred vertically.
    expect(t).toEqual({ x: 0, y: 20, width: 160, height: 80, scale: 0.8 });
  });

  it('letterboxes a tall image inside a wide box', () => {
    const t = fitThumbnail(100, 200, 160, 120);
    // Height-bound: scale = 120/200 = 0.6, thumb = 60 × 120, centred horizontally.
    expect(t).toEqual({ x: 50, y: 0, width: 60, height: 120, scale: 0.6 });
  });

  it('returns a zero-size box for degenerate inputs', () => {
    expect(fitThumbnail(0, 100, 160, 120)).toEqual({ x: 0, y: 0, width: 0, height: 0, scale: 0 });
    expect(fitThumbnail(100, 100, 0, 120)).toEqual({ x: 0, y: 0, width: 0, height: 0, scale: 0 });
  });
});

describe('viewportRectOnThumbnail', () => {
  const thumb = fitThumbnail(200, 100, 160, 120); // scale 0.8, x=0, y=20

  it('projects the visible chunk of stage-space onto the thumbnail', () => {
    // Main-stage scale 2, translation (0,0), 100×50 stage = visible
    // image rect (0..50, 0..25) in stage coords.
    const r = viewportRectOnThumbnail(thumb, 200, 100, 2, 0, 0, 100, 50);
    expect(r).toEqual({ x: 0, y: 20, width: 50 * 0.8, height: 25 * 0.8 });
  });

  it('clamps to image bounds when the canvas is panned off the edge', () => {
    // Pan so stage coord (-50, -25) is at screen origin, viewport
    // 100×50 → visible image rect (-50..50)×(-25..25), clamped to (0..50)×(0..25).
    const r = viewportRectOnThumbnail(thumb, 200, 100, 1, 50, 25, 100, 50);
    expect(r).toEqual({ x: 0, y: 20, width: 50 * 0.8, height: 25 * 0.8 });
  });

  it('returns null when the image is panned entirely off-screen', () => {
    expect(viewportRectOnThumbnail(thumb, 200, 100, 1, -1000, 0, 100, 50)).toBeNull();
  });

  it('returns null for a degenerate thumbnail', () => {
    const empty = fitThumbnail(0, 0, 100, 100);
    expect(viewportRectOnThumbnail(empty, 200, 100, 1, 0, 0, 100, 100)).toBeNull();
  });
});

describe('thumbnailPointToStage', () => {
  const thumb = fitThumbnail(200, 100, 160, 120); // scale 0.8, x=0, y=20

  it('inverts fitThumbnail for in-bounds clicks', () => {
    // Click middle of thumb: (80, 60) → stage (100, 50).
    expect(thumbnailPointToStage(thumb, 80, 60)).toEqual({ x: 100, y: 50 });
  });

  it('returns null for clicks in the letterbox area', () => {
    expect(thumbnailPointToStage(thumb, 0, 0)).toBeNull(); // y=0 is above thumb (y starts at 20)
    expect(thumbnailPointToStage(thumb, 0, 119)).toBeNull(); // y=119 is below thumb (y < 20+80=100)
  });
});

describe('panToStagePoint', () => {
  it('places the requested point in the centre of the viewport', () => {
    // Stage 200×100, scale 2 → centre is at (100, 50). To put stage point
    // (50, 25) there we need stageX = 100 - 50*2 = 0 and stageY = 50 - 25*2 = 0.
    expect(panToStagePoint({ x: 50, y: 25 }, 2, 200, 100)).toEqual({ stageX: 0, stageY: 0 });
  });

  it('handles offsets that require negative translation', () => {
    expect(panToStagePoint({ x: 100, y: 100 }, 1, 200, 100)).toEqual({ stageX: 0, stageY: -50 });
  });
});
