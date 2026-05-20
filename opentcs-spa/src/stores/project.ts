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
import type { DraftPath, DraftPoint, PointType, SelectionRef } from '@/domain/model/types';
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
const STORAGE_VERSION = 1;
const PERSIST_DEBOUNCE_MS = 200;

interface PersistedDraft {
  v: number;
  points: DraftPoint[];
  paths: DraftPath[];
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
    if (parsed?.v !== STORAGE_VERSION) return null;
    if (!Array.isArray(parsed.points) || !Array.isArray(parsed.paths)) return null;
    return {
      v: STORAGE_VERSION,
      points: parsed.points as DraftPoint[],
      paths: parsed.paths as DraftPath[],
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

/* -------------------------------- Store -------------------------------- */

export const useProjectStore = defineStore('project', () => {
  // shallowRef: HTMLImageElement must not be deeply reactive.
  const background = shallowRef<BackgroundMapState | null>(null);

  const hydrated = loadPersisted();
  const points = ref<DraftPoint[]>(hydrated?.points ?? []);
  const paths = ref<DraftPath[]>(hydrated?.paths ?? []);
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
        selection: selection.value,
      });
      persistTimer = null;
    }, PERSIST_DEBOUNCE_MS);
  }
  // Watch with deep:true because DraftPoint.pose etc. are nested objects.
  watch([points, paths, selection], schedulePersist, { deep: true });

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
  function nameTaken(name: string): boolean {
    return points.value.some((p) => p.name === name) || paths.value.some((p) => p.name === name);
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
    } else {
      paths.value = paths.value.filter((p) => p.name !== sel.name);
    }
    selection.value = null;
  }

  /** Wipe everything (used by tests + "重置草稿" button if/when added). */
  function clearAll(): void {
    points.value = [];
    paths.value = [];
    selection.value = null;
    pathDraftSrc.value = null;
  }

  return {
    // state
    background,
    points,
    paths,
    selection,
    pathDraftSrc,
    // background actions
    setBackground,
    clearBackground,
    // lookups
    findPoint,
    findPath,
    nameTaken,
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
    // selection + delete
    select,
    deleteSelected,
    clearAll,
  };
});

export { STORAGE_KEY };
