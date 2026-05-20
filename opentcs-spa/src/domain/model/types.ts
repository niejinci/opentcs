// SPDX-FileCopyrightText: The openTCS Authors
// SPDX-License-Identifier: MIT
//
// SPA editor middle-state types — mirrors of openTCS *CreationTO* classes
// (ADR-0003 in spa-frontend-architecture.md). Field names, nesting and
// units (mm / mm·s⁻¹ / degrees) are deliberately kept identical to the
// Java TOs so the S8 publish layer is a pure "pack + validate + RMI"
// step with zero translation.
//
// Reference Java classes (opentcs-api-base):
//   - org.opentcs.access.to.model.PointCreationTO
//   - org.opentcs.access.to.model.PathCreationTO
//   - org.opentcs.access.to.model.PoseCreationTO
//   - org.opentcs.access.to.model.TripleCreationTO
//
// S5 scope: only Point + Path are modelled. S6 adds Location / Block /
// Vehicle on top of the same Draft container.

/** PointCreationTO.Type */
export type PointType = 'HALT_POSITION' | 'PARK_POSITION';

/** Mirror of TripleCreationTO (units = mm; integer). */
export interface Triple {
  x: number;
  y: number;
  z: number;
}

/** Mirror of PoseCreationTO. orientationAngle is degrees; NaN = "unset". */
export interface Pose {
  position: Triple;
  orientationAngle: number;
}

/**
 * Mirror of PointCreationTO.
 *
 * `layout.pixelX/pixelY` is an editor-only field (NOT present in the TO
 * itself) recording where on the background image this point was placed,
 * so we can re-draw it without reverse-applying the affine each frame.
 * It is dropped by the S8 publish converter.
 */
export interface DraftPoint {
  name: string;
  type: PointType;
  pose: Pose;
  layout: {
    /** Pixel x on the background image (top-left origin, y down). */
    pixelX: number;
    /** Pixel y on the background image (top-left origin, y down). */
    pixelY: number;
  };
}

/** Mirror of PathCreationTO (subset; locked / envelopes / peripheralOps land later). */
export interface DraftPath {
  name: string;
  srcPointName: string;
  destPointName: string;
  /** Length in mm. Auto-computed from endpoints unless edited by hand. */
  length: number;
  /** mm/s; 0 disables forward travel (TO default). */
  maxVelocity: number;
  /** mm/s; 0 disables reverse travel (TO default). */
  maxReverseVelocity: number;
  /** Mirrors PathCreationTO.locked. */
  locked: boolean;
}

/** Discriminator for selection / property-panel routing. */
export type EntityKind = 'point' | 'path';

export interface SelectionRef {
  kind: EntityKind;
  /** Stable entity name (== TO name). */
  name: string;
}
