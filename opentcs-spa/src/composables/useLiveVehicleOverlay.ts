// SPDX-FileCopyrightText: The openTCS Authors
// SPDX-License-Identifier: MIT
//
// useLiveVehicleOverlay — composition of the editor's draft `DraftVehicle`
// list with the kernel's live `Vehicle` state coming over SSE.
//
// Why a separate composable instead of merging the data inside
// `useProjectStore`? Strictly speaking, the draft store is the editor's
// source of truth and must never be tainted by kernel-side runtime state
// (otherwise a "save draft" would leak per-tick fields back into the BFF
// project store). The composable therefore READS from both stores but
// writes to neither: it produces a derived "render list" for the
// AnnotationLayer to consume.
//
// Merge rules:
//   - For every DraftVehicle, look up the kernel Vehicle by name.
//   - If the kernel reports `currentPosition` and that point exists in
//     the draft, the vehicle is rendered at the point's pixel position
//     (so kernel ticks "drag" the icon along the layout).
//   - Otherwise fall back to the draft layout (last edited position).
//   - Fill colour:
//       IDLE        → green     (#1f883d)
//       EXECUTING   → blue      (#0969da)
//       CHARGING    → amber     (#bf8700)
//       ERROR       → red       (#cf222e)
//       UNAVAILABLE → grey      (#57606a)
//       UNKNOWN     → draft routeColor (so users see "ghost" colour)
//   - Outline / stroke style is unchanged in this composable; the
//     AnnotationLayer keeps its existing selection logic.

import { computed, type ComputedRef } from 'vue';

import type { Vehicle, VehicleState } from '@/api/types/bff';
import type { DraftVehicle } from '@/domain/model/types';
import { useLiveStatusStore } from '@/stores/liveStatus';
import { useProjectStore } from '@/stores/project';

/** Result type consumed by AnnotationLayer. Keeps the same shape as a
 *  DraftVehicle for the editor's existing render code, but with the live
 *  pose / colour overlayed and a flag the renderer can use to dim labels
 *  or skip drag handlers. */
export interface OverlayVehicle {
  /** Source-of-truth vehicle name (always the draft name). */
  name: string;
  /** Render pixel position (kernel-resolved when available). */
  pixelX: number;
  pixelY: number;
  /** Render orientation in degrees (driven by draft only — the BFF
   *  contract does not expose precisePose/orientationAngle yet). */
  orientationDeg: number;
  /** Render fill colour. */
  fillRgb: string;
  /** True when the kernel has reported a position for this vehicle. */
  isLive: boolean;
  /** Last-seen kernel state, if any. */
  kernelState: VehicleState | null;
  /** Backing draft vehicle, for the existing click / drag handlers. */
  draft: DraftVehicle;
}

const STATE_COLOR: Record<VehicleState, string | null> = {
  IDLE: '#1f883d',
  EXECUTING: '#0969da',
  CHARGING: '#bf8700',
  ERROR: '#cf222e',
  UNAVAILABLE: '#57606a',
  UNKNOWN: null, // use draft colour
};

export interface LiveVehicleOverlay {
  /** Reactive list aligned with `useProjectStore().vehicles`. */
  overlay: ComputedRef<OverlayVehicle[]>;
}

export function useLiveVehicleOverlay(): LiveVehicleOverlay {
  const project = useProjectStore();
  const live = useLiveStatusStore();

  const overlay = computed<OverlayVehicle[]>(() => {
    const out: OverlayVehicle[] = [];
    for (const draft of project.vehicles) {
      const kernel: Vehicle | undefined = live.vehicles[draft.name];
      let pixelX = draft.layout.pixelX;
      let pixelY = draft.layout.pixelY;
      let isLive = false;
      if (kernel?.currentPosition) {
        const pt = project.findPoint(kernel.currentPosition);
        if (pt) {
          pixelX = pt.layout.pixelX;
          pixelY = pt.layout.pixelY;
          isLive = true;
        }
      }
      const stateColor = kernel ? STATE_COLOR[kernel.state] : null;
      out.push({
        name: draft.name,
        pixelX,
        pixelY,
        orientationDeg: draft.layout.orientationDeg,
        fillRgb: stateColor ?? draft.layout.routeColorRgb,
        isLive,
        kernelState: kernel?.state ?? null,
        draft,
      });
    }
    return out;
  });

  return { overlay };
}
