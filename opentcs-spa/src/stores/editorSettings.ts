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

import {
  clampGridSpacing,
  DEFAULT_GRID_SPACING_PX,
} from '@/domain/editor/grid';

const STORAGE_KEY = 'opentcs-spa.editorSettings';
const STORAGE_VERSION = 1;

interface PersistedShape {
  v: typeof STORAGE_VERSION;
  gridSnap: boolean;
  gridSpacingPx: number;
  minimap: boolean;
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
      typeof stored?.gridSpacingPx === 'number'
        ? stored.gridSpacingPx
        : DEFAULT_GRID_SPACING_PX,
    ),
  );
  const minimap = ref<boolean>(stored?.minimap !== false);

  // Persist after every change. Pinia composables run inside an effect
  // scope tied to the active app instance, so this watcher is cleaned up
  // automatically when the app is unmounted (e.g. in vitest tear-down).
  watch(
    [gridSnap, gridSpacingPx, minimap],
    ([snap, spacing, mini]) => {
      saveToStorage({
        v: STORAGE_VERSION,
        gridSnap: snap,
        gridSpacingPx: clampGridSpacing(spacing),
        minimap: mini,
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

  return {
    gridSnap,
    gridSpacingPx,
    minimap,
    toggleGridSnap,
    setGridSpacingPx,
    toggleMinimap,
  };
});
