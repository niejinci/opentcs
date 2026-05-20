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
// Vehicle (and LocationType) on top of the same Draft container.

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
export type EntityKind = 'point' | 'path' | 'locationType' | 'location' | 'block' | 'vehicle';

export interface SelectionRef {
  kind: EntityKind;
  /** Stable entity name (== TO name). */
  name: string;
}

/* ---------------------------------------------------------------------- */
/* S6: Location / LocationType / Block / Vehicle                          */
/* ---------------------------------------------------------------------- */

/**
 * Mirror of {@code LocationRepresentationTO} (subset; SPA exposes the most
 * common values — the rest are accepted but not surfaced in pickers). The
 * full enum lives in `org.opentcs.access.to.model.LocationRepresentationTO`.
 */
export type LocationRepresentation =
  | 'NONE'
  | 'DEFAULT'
  | 'LOAD_TRANSFER_GENERIC'
  | 'LOAD_TRANSFER_ALT_1'
  | 'LOAD_TRANSFER_ALT_2'
  | 'LOAD_TRANSFER_ALT_3'
  | 'LOAD_TRANSFER_ALT_4'
  | 'LOAD_TRANSFER_ALT_5'
  | 'WORKING_GENERIC'
  | 'WORKING_ALT_1'
  | 'WORKING_ALT_2'
  | 'RECHARGE_GENERIC'
  | 'RECHARGE_ALT_1'
  | 'RECHARGE_ALT_2';

export const LOCATION_REPRESENTATIONS: readonly LocationRepresentation[] = Object.freeze([
  'NONE',
  'DEFAULT',
  'LOAD_TRANSFER_GENERIC',
  'LOAD_TRANSFER_ALT_1',
  'LOAD_TRANSFER_ALT_2',
  'LOAD_TRANSFER_ALT_3',
  'LOAD_TRANSFER_ALT_4',
  'LOAD_TRANSFER_ALT_5',
  'WORKING_GENERIC',
  'WORKING_ALT_1',
  'WORKING_ALT_2',
  'RECHARGE_GENERIC',
  'RECHARGE_ALT_1',
  'RECHARGE_ALT_2',
]);

/**
 * Mirror of `LocationTypeCreationTO`.
 *
 * `allowedOperations` is the most important field for S9 (a TransportOrder
 * destination's `operation` must be in the linked Location's type's list).
 * S6 only edits `allowedOperations` + `layout.locationRepresentation`;
 * `allowedPeripheralOperations` is left at empty (peripheral devices are
 * not part of MVP).
 */
export interface DraftLocationType {
  name: string;
  allowedOperations: string[];
  allowedPeripheralOperations: string[];
  layout: {
    locationRepresentation: LocationRepresentation;
  };
}

/**
 * Mirror of `LocationCreationTO`.
 *
 * `links` maps an attached Point name → set of allowed operations (subset
 * of the LocationType's `allowedOperations`; empty = "inherit all"). For
 * MVP we model each link as an array (ordered for stable display) and
 * dedupe on commit.
 *
 * `layout.pixelXY` is editor-only (same role as on DraftPoint).
 */
export interface DraftLocation {
  name: string;
  /** Must match an existing DraftLocationType.name; renames cascade. */
  typeName: string;
  /** TripleCreationTO in mm, integer. */
  position: Triple;
  /** Locked locations cannot be the target of a transport order. */
  locked: boolean;
  /** Map of attached Point name → allowed operations on this Location. */
  links: { pointName: string; allowedOperations: string[] }[];
  layout: {
    pixelX: number;
    pixelY: number;
    /** Optional override of the LocationType's representation. */
    locationRepresentation: LocationRepresentation;
  };
}

/** Mirror of `BlockCreationTO.Type`. */
export type BlockType = 'SINGLE_VEHICLE_ONLY' | 'SAME_DIRECTION_ONLY';

/**
 * Mirror of `BlockCreationTO`.
 *
 * `memberNames` references Point / Path / Location names (Kernel enforces
 * the actual constraints at publish time; the SPA only checks "name
 * exists somewhere in the draft"). Block has no canvas geometry of its
 * own — when selected, the AnnotationLayer highlights members and draws
 * a bounding box around their positions.
 *
 * `layout.colorRgb` mirrors `BlockCreationTO.Layout.color` (hex `#RRGGBB`,
 * stored without alpha so the S8 publish converter can parse straight
 * into `java.awt.Color`).
 */
export interface DraftBlock {
  name: string;
  type: BlockType;
  memberNames: string[];
  layout: {
    colorRgb: string;
  };
}

/**
 * Mirror of `VehicleCreationTO` (subset relevant for S6 editing).
 *
 * VehicleCreationTO itself carries no initial pose — the SPA needs *some*
 * canvas position to render the vehicle icon, so we add an editor-only
 * `layout.pixelXY` + `layout.orientationDeg`. The S8 publish converter
 * drops them.
 *
 * `energyLevelThresholdSet` uses TO defaults (30 / 90 / 30 / 90) until
 * the user edits them; the property panel exposes them in S6.
 */
export interface DraftVehicle {
  name: string;
  /** BoundingBoxCreationTO. mm, long. */
  boundingBox: {
    length: number;
    width: number;
    height: number;
  };
  /** EnergyLevelThresholdSet (percentages 0-100). */
  energyLevelThresholdSet: {
    energyLevelCritical: number;
    energyLevelGood: number;
    energyLevelSufficientlyRecharged: number;
    energyLevelFullyRecharged: number;
  };
  /** mm/s; 0 disables forward / reverse travel. */
  maxVelocity: number;
  maxReverseVelocity: number;
  /** Empty string = use default (TO accepts "" too). */
  envelopeKey: string;
  layout: {
    /** Editor-only: where the vehicle icon sits on the background. */
    pixelX: number;
    pixelY: number;
    /** Editor-only: icon orientation (degrees, 0 = +x). */
    orientationDeg: number;
    /** routeColor mirrored as hex `#RRGGBB`. */
    routeColorRgb: string;
  };
}
