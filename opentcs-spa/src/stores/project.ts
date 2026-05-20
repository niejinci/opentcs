// SPDX-FileCopyrightText: The openTCS Authors
// SPDX-License-Identifier: MIT
//
// useProjectStore — the single Pinia store that owns the editor's
// in-progress plant-model draft.
//
// State shape:
//   - background : currently imported scan triple + AffineMapping
//                  (NOT persisted — HTMLImageElement is not serialisable;
//                  user re-imports after page reload)
//   - points     : DraftPoint[]  (mirror of PointCreationTO[])
//   - paths      : DraftPath[]   (mirror of PathCreationTO[])
//   - selection  : SelectionRef | null  (property-panel target)
//   - pathDraft  : { srcName } | null   (Path tool's transient first-click state)
//
// Persistence:
//   `{ points, paths, selection }` are debounced (200 ms) into
//   `localStorage[STORAGE_KEY]` under a versioned envelope `{ v: 1, ... }`.
//   The store hydrates from localStorage on first use; a corrupt or
//   future-version payload is ignored (and the user keeps an empty draft).
//
// S5 deliberately stops *here*. S7 will swap the localStorage layer for
// BFF `/api/v1/projects/{id}/draft` PUT, keeping the actions identical.

import { defineStore } from 'pinia';
import { ref, shallowRef, watch } from 'vue';

import type { AffineMapping, WorldPoint } from '@/domain/geometry/affine';
import { pixelToWorld, worldToPixel } from '@/domain/geometry/affine';
import { isValidEntityName, nextAutoName } from '@/domain/model/naming';
import { distanceMm } from '@/domain/model/path';
import type {
  BlockType,
  DraftBlock,
  DraftLocation,
  DraftLocationType,
  DraftPath,
  DraftPoint,
  DraftVehicle,
  LocationRepresentation,
  PointType,
  SelectionRef,
} from '@/domain/model/types';
import type { RosMapMetadata } from '@/domain/yaml/parseRosMapYaml';

/* --------------------------- Background state --------------------------- */

export interface BackgroundMapState {
  image: HTMLImageElement;
  pngName: string;
  pgmName: string | null;
  yamlName: string;
  width: number;
  height: number;
  yaml: RosMapMetadata;
  affine: AffineMapping;
}

/* ------------------------------ Persistence ----------------------------- */

const STORAGE_KEY = 'opentcs-spa.draftV1';
const STORAGE_VERSION = 2;
const PERSIST_DEBOUNCE_MS = 200;

interface PersistedDraft {
  v: number;
  points: DraftPoint[];
  paths: DraftPath[];
  locationTypes: DraftLocationType[];
  locations: DraftLocation[];
  blocks: DraftBlock[];
  vehicles: DraftVehicle[];
  selection: SelectionRef | null;
}

function loadPersisted(): PersistedDraft | null {
  if (typeof localStorage === 'undefined') return null;
  let raw: string | null;
  try {
    raw = localStorage.getItem(STORAGE_KEY);
  } catch {
    return null; // localStorage disabled (Safari private mode etc.)
  }
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<PersistedDraft>;
    if (parsed?.v !== STORAGE_VERSION && parsed?.v !== 1) return null;
    if (!Array.isArray(parsed.points) || !Array.isArray(parsed.paths)) return null;
    // v1 → v2: only Point/Path existed. Initialise the S6 arrays empty.
    return {
      v: STORAGE_VERSION,
      points: parsed.points as DraftPoint[],
      paths: parsed.paths as DraftPath[],
      locationTypes: Array.isArray(parsed.locationTypes)
        ? (parsed.locationTypes as DraftLocationType[])
        : [],
      locations: Array.isArray(parsed.locations) ? (parsed.locations as DraftLocation[]) : [],
      blocks: Array.isArray(parsed.blocks) ? (parsed.blocks as DraftBlock[]) : [],
      vehicles: Array.isArray(parsed.vehicles) ? (parsed.vehicles as DraftVehicle[]) : [],
      selection: parsed.selection ?? null,
    };
  } catch {
    return null; // corrupt JSON
  }
}

function savePersisted(payload: PersistedDraft): void {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  } catch {
    // Quota exceeded or storage disabled — silently skip; the in-memory
    // draft remains usable for the rest of the session.
  }
}

/* ------------------------------ Color palettes -------------------------- */

const BLOCK_COLORS = [
  '#bf3989',
  '#1f883d',
  '#bf8700',
  '#0969da',
  '#cf222e',
  '#8250df',
  '#9a6700',
  '#0a5cb6',
];
const VEHICLE_COLORS = ['#0969da', '#1f883d', '#bf3989', '#bf8700', '#8250df', '#cf222e'];

function pickBlockColor(idx: number): string {
  return BLOCK_COLORS[idx % BLOCK_COLORS.length] ?? '#bf3989';
}
function pickVehicleColor(idx: number): string {
  return VEHICLE_COLORS[idx % VEHICLE_COLORS.length] ?? '#0969da';
}

/* -------------------------------- Store -------------------------------- */

export const useProjectStore = defineStore('project', () => {
  // shallowRef: HTMLImageElement must not be deeply reactive.
  const background = shallowRef<BackgroundMapState | null>(null);

  const hydrated = loadPersisted();
  const points = ref<DraftPoint[]>(hydrated?.points ?? []);
  const paths = ref<DraftPath[]>(hydrated?.paths ?? []);
  const locationTypes = ref<DraftLocationType[]>(hydrated?.locationTypes ?? []);
  const locations = ref<DraftLocation[]>(hydrated?.locations ?? []);
  const blocks = ref<DraftBlock[]>(hydrated?.blocks ?? []);
  const vehicles = ref<DraftVehicle[]>(hydrated?.vehicles ?? []);
  const selection = ref<SelectionRef | null>(hydrated?.selection ?? null);

  /** Transient first-click state for the Path tool. Not persisted. */
  const pathDraftSrc = ref<string | null>(null);

  /* ----------------------------- Persistence ---------------------------- */

  let persistTimer: ReturnType<typeof setTimeout> | null = null;
  function schedulePersist(): void {
    if (persistTimer) clearTimeout(persistTimer);
    persistTimer = setTimeout(() => {
      savePersisted({
        v: STORAGE_VERSION,
        points: points.value,
        paths: paths.value,
        locationTypes: locationTypes.value,
        locations: locations.value,
        blocks: blocks.value,
        vehicles: vehicles.value,
        selection: selection.value,
      });
      persistTimer = null;
    }, PERSIST_DEBOUNCE_MS);
  }
  // Watch with deep:true because DraftPoint.pose etc. are nested objects.
  watch([points, paths, locationTypes, locations, blocks, vehicles, selection], schedulePersist, {
    deep: true,
  });

  /* ---------------------------- Background ----------------------------- */

  function setBackground(next: BackgroundMapState): void {
    background.value = next;
  }
  function clearBackground(): void {
    background.value = null;
  }

  /* ------------------------------ Lookups ------------------------------ */

  function findPoint(name: string): DraftPoint | undefined {
    return points.value.find((p) => p.name === name);
  }
  function findPath(name: string): DraftPath | undefined {
    return paths.value.find((p) => p.name === name);
  }
  function findLocationType(name: string): DraftLocationType | undefined {
    return locationTypes.value.find((t) => t.name === name);
  }
  function findLocation(name: string): DraftLocation | undefined {
    return locations.value.find((l) => l.name === name);
  }
  function findBlock(name: string): DraftBlock | undefined {
    return blocks.value.find((b) => b.name === name);
  }
  function findVehicle(name: string): DraftVehicle | undefined {
    return vehicles.value.find((v) => v.name === name);
  }
  function nameTaken(name: string): boolean {
    return (
      points.value.some((p) => p.name === name) ||
      paths.value.some((p) => p.name === name) ||
      locationTypes.value.some((t) => t.name === name) ||
      locations.value.some((l) => l.name === name) ||
      blocks.value.some((b) => b.name === name) ||
      vehicles.value.some((v) => v.name === name)
    );
  }
  /** Names that may appear as a Block member: Point / Path / Location. */
  function blockMemberCandidates(): { name: string; kind: 'point' | 'path' | 'location' }[] {
    const out: { name: string; kind: 'point' | 'path' | 'location' }[] = [];
    for (const p of points.value) out.push({ name: p.name, kind: 'point' });
    for (const p of paths.value) out.push({ name: p.name, kind: 'path' });
    for (const l of locations.value) out.push({ name: l.name, kind: 'location' });
    return out;
  }

  /* ---------------------------- Helpers -------------------------------- */

  function worldToMmTriple(w: WorldPoint): { x: number; y: number; z: number } {
    // openTCS uses millimeters everywhere; affine produces meters.
    return { x: Math.round(w.x * 1000), y: Math.round(w.y * 1000), z: 0 };
  }

  function recomputeAttachedPathLengths(pointName: string): void {
    paths.value.forEach((path) => {
      if (path.srcPointName !== pointName && path.destPointName !== pointName) return;
      const src = findPoint(path.srcPointName);
      const dst = findPoint(path.destPointName);
      if (!src || !dst) return;
      path.length = distanceMm(src.pose.position, dst.pose.position);
    });
  }

  /** Deduplicate while preserving order; trims surrounding whitespace and drops empties. */
  function dedupeOrdered(values: string[]): string[] {
    const seen = new Set<string>();
    const out: string[] = [];
    for (const v of values) {
      const trimmed = v.trim();
      if (!trimmed || seen.has(trimmed)) continue;
      seen.add(trimmed);
      out.push(trimmed);
    }
    return out;
  }

  function clampPercent(n: number): number {
    if (!Number.isFinite(n)) return 0;
    return Math.min(100, Math.max(0, Math.round(n)));
  }

  /* ------------------------------ Actions ------------------------------ */

  /**
   * Create a new Point at a pixel coordinate (top-left, y down) on the
   * background image. World position is derived from the AffineMapping
   * and converted to mm. Returns the created Point.
   */
  function addPoint(pixel: { x: number; y: number }): DraftPoint | null {
    const bg = background.value;
    if (!bg) return null;
    const world = pixelToWorld(bg.affine, pixel);
    const name = nextAutoName(
      'Point',
      points.value.map((p) => p.name),
    );
    const created: DraftPoint = {
      name,
      type: 'HALT_POSITION',
      pose: {
        position: worldToMmTriple(world),
        orientationAngle: Number.NaN,
      },
      layout: { pixelX: pixel.x, pixelY: pixel.y },
    };
    points.value.push(created);
    selection.value = { kind: 'point', name };
    return created;
  }

  /** Move an existing Point to a new pixel coord; updates pose + length. */
  function movePoint(name: string, pixel: { x: number; y: number }): void {
    const pt = findPoint(name);
    const bg = background.value;
    if (!pt || !bg) return;
    pt.layout.pixelX = pixel.x;
    pt.layout.pixelY = pixel.y;
    const world = pixelToWorld(bg.affine, pixel);
    pt.pose.position = worldToMmTriple(world);
    recomputeAttachedPathLengths(name);
  }

  /** Rename a Point. Updates any attached Path's src/dest references. */
  function renamePoint(oldName: string, newName: string): { ok: boolean; error?: string } {
    if (oldName === newName) return { ok: true };
    if (!isValidEntityName(newName))
      return { ok: false, error: '名称非法（不能为空 / 含空白 / 含 / \\）' };
    if (nameTaken(newName)) return { ok: false, error: `名称 '${newName}' 已被占用` };
    const pt = findPoint(oldName);
    if (!pt) return { ok: false, error: `未找到 Point '${oldName}'` };
    pt.name = newName;
    paths.value.forEach((p) => {
      if (p.srcPointName === oldName) p.srcPointName = newName;
      if (p.destPointName === oldName) p.destPointName = newName;
    });
    if (selection.value?.kind === 'point' && selection.value.name === oldName) {
      selection.value = { kind: 'point', name: newName };
    }
    return { ok: true };
  }

  /** Update one or more editable Point fields (besides name + layout/pose handled separately). */
  function updatePointFields(
    name: string,
    patch: Partial<{ type: PointType; orientationAngle: number; z: number }>,
  ): void {
    const pt = findPoint(name);
    if (!pt) return;
    if (patch.type !== undefined) pt.type = patch.type;
    if (patch.orientationAngle !== undefined) pt.pose.orientationAngle = patch.orientationAngle;
    if (patch.z !== undefined) {
      pt.pose.position = { ...pt.pose.position, z: Math.round(patch.z) };
      recomputeAttachedPathLengths(name);
    }
  }

  /**
   * Update a Point's world position (in meters) directly from the property
   * panel. Keeps `layout.pixelXY` in sync via the AffineMapping so the
   * shape on the canvas moves too.
   */
  function setPointWorldMeters(name: string, worldMeters: { x: number; y: number }): void {
    const pt = findPoint(name);
    const bg = background.value;
    if (!pt || !bg) return;
    pt.pose.position = {
      ...pt.pose.position,
      x: Math.round(worldMeters.x * 1000),
      y: Math.round(worldMeters.y * 1000),
    };
    const pixel = worldToPixel(bg.affine, worldMeters);
    pt.layout.pixelX = pixel.x;
    pt.layout.pixelY = pixel.y;
    recomputeAttachedPathLengths(name);
  }

  /** Path tool: first click records the source; second click creates. */
  function startPath(srcName: string): void {
    if (!findPoint(srcName)) return;
    pathDraftSrc.value = srcName;
  }

  function cancelPathDraft(): void {
    pathDraftSrc.value = null;
  }

  function completePath(destName: string): DraftPath | null {
    const src = pathDraftSrc.value;
    if (!src) return null;
    pathDraftSrc.value = null;
    if (src === destName) return null;
    const srcPt = findPoint(src);
    const dstPt = findPoint(destName);
    if (!srcPt || !dstPt) return null;
    const name = nextAutoName(
      'Path',
      paths.value.map((p) => p.name),
    );
    const created: DraftPath = {
      name,
      srcPointName: src,
      destPointName: destName,
      length: distanceMm(srcPt.pose.position, dstPt.pose.position),
      maxVelocity: 1000, // 1 m/s default
      maxReverseVelocity: 0,
      locked: false,
    };
    paths.value.push(created);
    selection.value = { kind: 'path', name };
    return created;
  }

  function renamePath(oldName: string, newName: string): { ok: boolean; error?: string } {
    if (oldName === newName) return { ok: true };
    if (!isValidEntityName(newName))
      return { ok: false, error: '名称非法（不能为空 / 含空白 / 含 / \\）' };
    if (nameTaken(newName)) return { ok: false, error: `名称 '${newName}' 已被占用` };
    const path = findPath(oldName);
    if (!path) return { ok: false, error: `未找到 Path '${oldName}'` };
    path.name = newName;
    if (selection.value?.kind === 'path' && selection.value.name === oldName) {
      selection.value = { kind: 'path', name: newName };
    }
    return { ok: true };
  }

  function updatePathFields(
    name: string,
    patch: Partial<Pick<DraftPath, 'length' | 'maxVelocity' | 'maxReverseVelocity' | 'locked'>>,
  ): void {
    const p = findPath(name);
    if (!p) return;
    if (patch.length !== undefined) p.length = Math.max(0, Math.round(patch.length));
    if (patch.maxVelocity !== undefined) p.maxVelocity = Math.max(0, Math.round(patch.maxVelocity));
    if (patch.maxReverseVelocity !== undefined) {
      p.maxReverseVelocity = Math.max(0, Math.round(patch.maxReverseVelocity));
    }
    if (patch.locked !== undefined) p.locked = patch.locked;
  }

  /* ----------------------- LocationType actions ------------------------ */

  /**
   * Create a new LocationType with sensible MVP defaults. Returns the new
   * type. Used both by the explicit "新建 LocationType" panel button and
   * by `addLocation` when the draft has no types yet (auto-bootstrap).
   */
  function addLocationType(): DraftLocationType {
    const name = nextAutoName(
      'LocType',
      locationTypes.value.map((t) => t.name),
    );
    const created: DraftLocationType = {
      name,
      allowedOperations: ['Load', 'Unload'],
      allowedPeripheralOperations: [],
      layout: { locationRepresentation: 'LOAD_TRANSFER_GENERIC' },
    };
    locationTypes.value.push(created);
    return created;
  }

  function renameLocationType(oldName: string, newName: string): { ok: boolean; error?: string } {
    if (oldName === newName) return { ok: true };
    if (!isValidEntityName(newName))
      return { ok: false, error: '名称非法（不能为空 / 含空白 / 含 / \\）' };
    if (nameTaken(newName)) return { ok: false, error: `名称 '${newName}' 已被占用` };
    const t = findLocationType(oldName);
    if (!t) return { ok: false, error: `未找到 LocationType '${oldName}'` };
    t.name = newName;
    // Cascade: every Location referencing the old type must follow.
    locations.value.forEach((l) => {
      if (l.typeName === oldName) l.typeName = newName;
    });
    if (selection.value?.kind === 'locationType' && selection.value.name === oldName) {
      selection.value = { kind: 'locationType', name: newName };
    }
    return { ok: true };
  }

  function updateLocationTypeFields(
    name: string,
    patch: Partial<Pick<DraftLocationType, 'allowedOperations' | 'allowedPeripheralOperations'>> & {
      locationRepresentation?: LocationRepresentation;
    },
  ): void {
    const t = findLocationType(name);
    if (!t) return;
    if (patch.allowedOperations !== undefined) {
      t.allowedOperations = dedupeOrdered(patch.allowedOperations);
    }
    if (patch.allowedPeripheralOperations !== undefined) {
      t.allowedPeripheralOperations = dedupeOrdered(patch.allowedPeripheralOperations);
    }
    if (patch.locationRepresentation !== undefined) {
      t.layout.locationRepresentation = patch.locationRepresentation;
    }
  }

  /* -------------------------- Location actions ------------------------- */

  /**
   * Create a new Location at a pixel coordinate. Auto-bootstraps a
   * default LocationType if none exists yet. Returns null if there is no
   * background map loaded.
   */
  function addLocation(pixel: { x: number; y: number }): DraftLocation | null {
    const bg = background.value;
    if (!bg) return null;
    const world = pixelToWorld(bg.affine, pixel);
    const type = locationTypes.value[0] ?? addLocationType();
    const name = nextAutoName(
      'Location',
      locations.value.map((l) => l.name),
    );
    const created: DraftLocation = {
      name,
      typeName: type.name,
      position: worldToMmTriple(world),
      locked: false,
      links: [],
      layout: {
        pixelX: pixel.x,
        pixelY: pixel.y,
        locationRepresentation: 'DEFAULT',
      },
    };
    locations.value.push(created);
    selection.value = { kind: 'location', name };
    return created;
  }

  function moveLocation(name: string, pixel: { x: number; y: number }): void {
    const l = findLocation(name);
    const bg = background.value;
    if (!l || !bg) return;
    l.layout.pixelX = pixel.x;
    l.layout.pixelY = pixel.y;
    const world = pixelToWorld(bg.affine, pixel);
    l.position = worldToMmTriple(world);
  }

  function renameLocation(oldName: string, newName: string): { ok: boolean; error?: string } {
    if (oldName === newName) return { ok: true };
    if (!isValidEntityName(newName))
      return { ok: false, error: '名称非法（不能为空 / 含空白 / 含 / \\）' };
    if (nameTaken(newName)) return { ok: false, error: `名称 '${newName}' 已被占用` };
    const l = findLocation(oldName);
    if (!l) return { ok: false, error: `未找到 Location '${oldName}'` };
    l.name = newName;
    blocks.value.forEach((b) => {
      b.memberNames = b.memberNames.map((n) => (n === oldName ? newName : n));
    });
    if (selection.value?.kind === 'location' && selection.value.name === oldName) {
      selection.value = { kind: 'location', name: newName };
    }
    return { ok: true };
  }

  function updateLocationFields(
    name: string,
    patch: Partial<{
      typeName: string;
      locked: boolean;
      z: number;
      locationRepresentation: LocationRepresentation;
    }>,
  ): void {
    const l = findLocation(name);
    if (!l) return;
    if (patch.typeName !== undefined && findLocationType(patch.typeName)) {
      l.typeName = patch.typeName;
    }
    if (patch.locked !== undefined) l.locked = patch.locked;
    if (patch.z !== undefined) l.position = { ...l.position, z: Math.round(patch.z) };
    if (patch.locationRepresentation !== undefined) {
      l.layout.locationRepresentation = patch.locationRepresentation;
    }
  }

  function setLocationWorldMeters(name: string, worldMeters: { x: number; y: number }): void {
    const l = findLocation(name);
    const bg = background.value;
    if (!l || !bg) return;
    l.position = {
      ...l.position,
      x: Math.round(worldMeters.x * 1000),
      y: Math.round(worldMeters.y * 1000),
    };
    const pixel = worldToPixel(bg.affine, worldMeters);
    l.layout.pixelX = pixel.x;
    l.layout.pixelY = pixel.y;
  }

  /** Add or remove a Point ↔ Location link. */
  function toggleLocationLink(locName: string, pointName: string): void {
    const l = findLocation(locName);
    if (!l || !findPoint(pointName)) return;
    const existing = l.links.findIndex((lk) => lk.pointName === pointName);
    if (existing >= 0) l.links.splice(existing, 1);
    else l.links.push({ pointName, allowedOperations: [] });
  }

  function setLocationLinkOperations(locName: string, pointName: string, ops: string[]): void {
    const l = findLocation(locName);
    if (!l) return;
    const link = l.links.find((lk) => lk.pointName === pointName);
    if (!link) return;
    link.allowedOperations = dedupeOrdered(ops);
  }

  /* ---------------------------- Block actions -------------------------- */

  function addBlock(): DraftBlock {
    const name = nextAutoName(
      'Block',
      blocks.value.map((b) => b.name),
    );
    const created: DraftBlock = {
      name,
      type: 'SINGLE_VEHICLE_ONLY',
      memberNames: [],
      layout: { colorRgb: pickBlockColor(blocks.value.length) },
    };
    blocks.value.push(created);
    selection.value = { kind: 'block', name };
    return created;
  }

  function renameBlock(oldName: string, newName: string): { ok: boolean; error?: string } {
    if (oldName === newName) return { ok: true };
    if (!isValidEntityName(newName))
      return { ok: false, error: '名称非法（不能为空 / 含空白 / 含 / \\）' };
    if (nameTaken(newName)) return { ok: false, error: `名称 '${newName}' 已被占用` };
    const b = findBlock(oldName);
    if (!b) return { ok: false, error: `未找到 Block '${oldName}'` };
    b.name = newName;
    if (selection.value?.kind === 'block' && selection.value.name === oldName) {
      selection.value = { kind: 'block', name: newName };
    }
    return { ok: true };
  }

  function updateBlockFields(
    name: string,
    patch: Partial<{ type: BlockType; colorRgb: string }>,
  ): void {
    const b = findBlock(name);
    if (!b) return;
    if (patch.type !== undefined) b.type = patch.type;
    if (patch.colorRgb !== undefined && /^#[0-9a-fA-F]{6}$/.test(patch.colorRgb)) {
      b.layout.colorRgb = patch.colorRgb.toLowerCase();
    }
  }

  /** Toggle a Point / Path / Location membership in a Block. */
  function toggleBlockMember(blockName: string, memberName: string): void {
    const b = findBlock(blockName);
    if (!b) return;
    if (!findPoint(memberName) && !findPath(memberName) && !findLocation(memberName)) {
      return;
    }
    const idx = b.memberNames.indexOf(memberName);
    if (idx >= 0) b.memberNames.splice(idx, 1);
    else b.memberNames.push(memberName);
  }

  /* --------------------------- Vehicle actions ------------------------- */

  function addVehicle(pixel: { x: number; y: number } | null): DraftVehicle {
    const name = nextAutoName(
      'Vehicle',
      vehicles.value.map((v) => v.name),
    );
    const created: DraftVehicle = {
      name,
      boundingBox: { length: 1000, width: 1000, height: 1000 },
      energyLevelThresholdSet: {
        energyLevelCritical: 30,
        energyLevelGood: 90,
        energyLevelSufficientlyRecharged: 30,
        energyLevelFullyRecharged: 90,
      },
      maxVelocity: 1000,
      maxReverseVelocity: 1000,
      envelopeKey: '',
      layout: {
        pixelX: pixel?.x ?? 0,
        pixelY: pixel?.y ?? 0,
        orientationDeg: 0,
        routeColorRgb: pickVehicleColor(vehicles.value.length),
      },
    };
    vehicles.value.push(created);
    selection.value = { kind: 'vehicle', name };
    return created;
  }

  function moveVehicle(name: string, pixel: { x: number; y: number }): void {
    const v = findVehicle(name);
    if (!v) return;
    v.layout.pixelX = pixel.x;
    v.layout.pixelY = pixel.y;
  }

  function renameVehicle(oldName: string, newName: string): { ok: boolean; error?: string } {
    if (oldName === newName) return { ok: true };
    if (!isValidEntityName(newName))
      return { ok: false, error: '名称非法（不能为空 / 含空白 / 含 / \\）' };
    if (nameTaken(newName)) return { ok: false, error: `名称 '${newName}' 已被占用` };
    const v = findVehicle(oldName);
    if (!v) return { ok: false, error: `未找到 Vehicle '${oldName}'` };
    v.name = newName;
    if (selection.value?.kind === 'vehicle' && selection.value.name === oldName) {
      selection.value = { kind: 'vehicle', name: newName };
    }
    return { ok: true };
  }

  function updateVehicleFields(
    name: string,
    patch: Partial<{
      boundingBoxLength: number;
      boundingBoxWidth: number;
      boundingBoxHeight: number;
      maxVelocity: number;
      maxReverseVelocity: number;
      envelopeKey: string;
      orientationDeg: number;
      routeColorRgb: string;
      energyLevelCritical: number;
      energyLevelGood: number;
      energyLevelSufficientlyRecharged: number;
      energyLevelFullyRecharged: number;
    }>,
  ): void {
    const v = findVehicle(name);
    if (!v) return;
    if (patch.boundingBoxLength !== undefined)
      v.boundingBox.length = Math.max(1, Math.round(patch.boundingBoxLength));
    if (patch.boundingBoxWidth !== undefined)
      v.boundingBox.width = Math.max(1, Math.round(patch.boundingBoxWidth));
    if (patch.boundingBoxHeight !== undefined)
      v.boundingBox.height = Math.max(1, Math.round(patch.boundingBoxHeight));
    if (patch.maxVelocity !== undefined) v.maxVelocity = Math.max(0, Math.round(patch.maxVelocity));
    if (patch.maxReverseVelocity !== undefined)
      v.maxReverseVelocity = Math.max(0, Math.round(patch.maxReverseVelocity));
    if (patch.envelopeKey !== undefined) v.envelopeKey = patch.envelopeKey;
    if (patch.orientationDeg !== undefined) {
      v.layout.orientationDeg = Number.isFinite(patch.orientationDeg) ? patch.orientationDeg : 0;
    }
    if (patch.routeColorRgb !== undefined && /^#[0-9a-fA-F]{6}$/.test(patch.routeColorRgb)) {
      v.layout.routeColorRgb = patch.routeColorRgb.toLowerCase();
    }
    const e = v.energyLevelThresholdSet;
    if (patch.energyLevelCritical !== undefined)
      e.energyLevelCritical = clampPercent(patch.energyLevelCritical);
    if (patch.energyLevelGood !== undefined)
      e.energyLevelGood = clampPercent(patch.energyLevelGood);
    if (patch.energyLevelSufficientlyRecharged !== undefined)
      e.energyLevelSufficientlyRecharged = clampPercent(patch.energyLevelSufficientlyRecharged);
    if (patch.energyLevelFullyRecharged !== undefined)
      e.energyLevelFullyRecharged = clampPercent(patch.energyLevelFullyRecharged);
  }

  /* ------------------------ Selection + deletion ----------------------- */

  function select(ref: SelectionRef | null): void {
    selection.value = ref;
  }

  function deleteSelected(): void {
    const sel = selection.value;
    if (!sel) return;
    if (sel.kind === 'point') {
      points.value = points.value.filter((p) => p.name !== sel.name);
      // Cascade: drop any path that referenced this point.
      paths.value = paths.value.filter(
        (p) => p.srcPointName !== sel.name && p.destPointName !== sel.name,
      );
      // Cascade: drop the deleted point from any Location.links.
      locations.value.forEach((l) => {
        l.links = l.links.filter((lk) => lk.pointName !== sel.name);
      });
      // Cascade: drop the deleted point from any Block.memberNames.
      blocks.value.forEach((b) => {
        b.memberNames = b.memberNames.filter((n) => n !== sel.name);
      });
    } else if (sel.kind === 'path') {
      paths.value = paths.value.filter((p) => p.name !== sel.name);
      blocks.value.forEach((b) => {
        b.memberNames = b.memberNames.filter((n) => n !== sel.name);
      });
    } else if (sel.kind === 'locationType') {
      // Block deletion if any Location still references this type — the
      // user has to re-assign first.
      const refs = locations.value.filter((l) => l.typeName === sel.name);
      if (refs.length > 0) {
        // Soft-fail: just leave selection in place; the property panel
        // surfaces the count so the user can act.
        return;
      }
      locationTypes.value = locationTypes.value.filter((t) => t.name !== sel.name);
    } else if (sel.kind === 'location') {
      locations.value = locations.value.filter((l) => l.name !== sel.name);
      blocks.value.forEach((b) => {
        b.memberNames = b.memberNames.filter((n) => n !== sel.name);
      });
    } else if (sel.kind === 'block') {
      blocks.value = blocks.value.filter((b) => b.name !== sel.name);
    } else if (sel.kind === 'vehicle') {
      vehicles.value = vehicles.value.filter((v) => v.name !== sel.name);
    }
    selection.value = null;
  }

  /** Wipe everything (used by tests + "重置草稿" button if/when added). */
  function clearAll(): void {
    points.value = [];
    paths.value = [];
    locationTypes.value = [];
    locations.value = [];
    blocks.value = [];
    vehicles.value = [];
    selection.value = null;
    pathDraftSrc.value = null;
  }

  return {
    // state
    background,
    points,
    paths,
    locationTypes,
    locations,
    blocks,
    vehicles,
    selection,
    pathDraftSrc,
    // background actions
    setBackground,
    clearBackground,
    // lookups
    findPoint,
    findPath,
    findLocationType,
    findLocation,
    findBlock,
    findVehicle,
    nameTaken,
    blockMemberCandidates,
    // point actions
    addPoint,
    movePoint,
    renamePoint,
    updatePointFields,
    setPointWorldMeters,
    // path actions
    startPath,
    cancelPathDraft,
    completePath,
    renamePath,
    updatePathFields,
    // locationType actions
    addLocationType,
    renameLocationType,
    updateLocationTypeFields,
    // location actions
    addLocation,
    moveLocation,
    renameLocation,
    updateLocationFields,
    setLocationWorldMeters,
    toggleLocationLink,
    setLocationLinkOperations,
    // block actions
    addBlock,
    renameBlock,
    updateBlockFields,
    toggleBlockMember,
    // vehicle actions
    addVehicle,
    moveVehicle,
    renameVehicle,
    updateVehicleFields,
    // selection + delete
    select,
    deleteSelected,
    clearAll,
  };
});

export { STORAGE_KEY };
