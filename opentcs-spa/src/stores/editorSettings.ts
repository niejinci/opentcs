// SPDX-FileCopyrightText: The openTCS Authors
// SPDX-License-Identifier: MIT
//
// useEditorSettingsStore — small Pinia store for canvas-editor UI
// preferences that are not part of the project draft itself:
//
//   - `gridSnap` enabled flag + grid spacing in stage pixels.
//   - `minimap`  enabled flag.
//
// Persistence: a single `localStorage` key under a versioned envelope so
// upgrades can be additive without clobbering older stored shapes (same
// pattern used by `useProjectStore`). The store stays usable in SSR / test
// environments without `localStorage` by guarding every access.

import { defineStore } from 'pinia';
import { ref, watch } from 'vue';

import { clampGridSpacing, DEFAULT_GRID_SPACING_PX } from '@/domain/editor/grid';
import { clampToleranceMm, DEFAULT_TOLERANCE_MM } from '@/domain/editor/tolerance';

/** Editor toolbar ("选择" panel) width, in CSS pixels. */
export const MIN_TOOLBAR_WIDTH_PX = 140;
export const MAX_TOOLBAR_WIDTH_PX = 360;
export const DEFAULT_TOOLBAR_WIDTH_PX = 200;

export function clampToolbarWidthPx(px: number): number {
  if (!Number.isFinite(px)) return DEFAULT_TOOLBAR_WIDTH_PX;
  return Math.min(MAX_TOOLBAR_WIDTH_PX, Math.max(MIN_TOOLBAR_WIDTH_PX, Math.round(px)));
}

const STORAGE_KEY = 'opentcs-spa.editorSettings';
const STORAGE_VERSION = 1;

interface PersistedShape {
  v: typeof STORAGE_VERSION;
  gridSnap: boolean;
  gridSpacingPx: number;
  minimap: boolean;
  // PR3 additions — additive on the same v=1 envelope; older payloads
  // simply fall back to the defaults computed below.
  toleranceShow: boolean;
  toleranceDefaultMm: number;
  // Editor layout — collapsing the resource tree frees horizontal
  // real estate for the canvas. Additive on the same v=1 envelope.
  treeCollapsed: boolean;
  // Width of the editor toolbar ("选择" panel) in pixels — user-resizable
  // via a drag handle on its right edge so the canvas can reclaim space.
  toolbarWidthPx: number;
}

function loadFromStorage(): Partial<PersistedShape> | null {
  if (typeof localStorage === 'undefined') return null;
  let raw: string | null;
  try {
    raw = localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<PersistedShape>;
    if (parsed && typeof parsed === 'object' && parsed.v === STORAGE_VERSION) {
      return parsed;
    }
  } catch {
    // fall through and ignore corrupt payload
  }
  return null;
}

function saveToStorage(payload: PersistedShape): void {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  } catch {
    // localStorage may throw on quota exceeded / disabled; the UI must
    // keep working even if we cannot persist the toggle.
  }
}

export const useEditorSettingsStore = defineStore('editorSettings', () => {
  const stored = loadFromStorage();

  const gridSnap = ref<boolean>(stored?.gridSnap === true);
  const gridSpacingPx = ref<number>(
    clampGridSpacing(
      typeof stored?.gridSpacingPx === 'number' ? stored.gridSpacingPx : DEFAULT_GRID_SPACING_PX,
    ),
  );
  const minimap = ref<boolean>(stored?.minimap !== false);

  // PR3 — Point tolerance circles. Disabled globally by default (still
  // shown around the currently-selected Point in AnnotationLayer).
  const toleranceShow = ref<boolean>(stored?.toleranceShow === true);
  const toleranceDefaultMm = ref<number>(
    clampToleranceMm(
      typeof stored?.toleranceDefaultMm === 'number'
        ? stored.toleranceDefaultMm
        : DEFAULT_TOLERANCE_MM,
    ),
  );

  // Resource-tree collapse state. Default = expanded (false) so first-time
  // users still see the tree; once collapsed the choice is remembered.
  const treeCollapsed = ref<boolean>(stored?.treeCollapsed === true);

  // Editor toolbar ("选择" panel) width — resizable via the drag handle
  // on its right edge. Clamped on read/write so corrupt or out-of-range
  // payloads (older builds, hand-edited storage) cannot break the layout.
  const toolbarWidthPx = ref<number>(
    clampToolbarWidthPx(
      typeof stored?.toolbarWidthPx === 'number'
        ? stored.toolbarWidthPx
        : DEFAULT_TOOLBAR_WIDTH_PX,
    ),
  );

  // Persist after every change. Pinia composables run inside an effect
  // scope tied to the active app instance, so this watcher is cleaned up
  // automatically when the app is unmounted (e.g. in vitest tear-down).
  watch(
    [
      gridSnap,
      gridSpacingPx,
      minimap,
      toleranceShow,
      toleranceDefaultMm,
      treeCollapsed,
      toolbarWidthPx,
    ],
    ([snap, spacing, mini, tolShow, tolMm, treeC, toolbarW]) => {
      saveToStorage({
        v: STORAGE_VERSION,
        gridSnap: snap,
        gridSpacingPx: clampGridSpacing(spacing),
        minimap: mini,
        toleranceShow: tolShow,
        toleranceDefaultMm: clampToleranceMm(tolMm),
        treeCollapsed: treeC,
        toolbarWidthPx: clampToolbarWidthPx(toolbarW),
      });
    },
    { flush: 'post' },
  );

  function toggleGridSnap(): void {
    gridSnap.value = !gridSnap.value;
  }

  function setGridSpacingPx(px: number): void {
    gridSpacingPx.value = clampGridSpacing(px);
  }

  function toggleMinimap(): void {
    minimap.value = !minimap.value;
  }

  function toggleToleranceShow(): void {
    toleranceShow.value = !toleranceShow.value;
  }

  function setToleranceDefaultMm(mm: number): void {
    toleranceDefaultMm.value = clampToleranceMm(mm);
  }

  function toggleTreeCollapsed(): void {
    treeCollapsed.value = !treeCollapsed.value;
  }

  function setToolbarWidthPx(px: number): void {
    toolbarWidthPx.value = clampToolbarWidthPx(px);
  }

  return {
    gridSnap,
    gridSpacingPx,
    minimap,
    toleranceShow,
    toleranceDefaultMm,
    treeCollapsed,
    toolbarWidthPx,
    toggleGridSnap,
    setGridSpacingPx,
    toggleMinimap,
    toggleToleranceShow,
    setToleranceDefaultMm,
    toggleTreeCollapsed,
    setToolbarWidthPx,
  };
});
