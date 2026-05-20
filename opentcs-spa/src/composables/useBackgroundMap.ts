// SPDX-FileCopyrightText: The openTCS Authors
// SPDX-License-Identifier: MIT
//
// Background-map shared state.
//
// S5 migration note: this used to be a hand-rolled `shallowRef` singleton
// (see S4 完工备忘). Starting in S5 the source of truth is
// `useProjectStore()`. We keep this composable as a thin compatibility
// layer with the *exact same* surface (`background` / `hasBackground` /
// `version` / `setBackgroundMap` / `clearBackgroundMap`) so the S4-era
// callers in ImportView do not need to change their shape — the only
// effect is that ImportView ↔ EditorView now share a single Pinia store
// (which also persists Point / Path drafts to localStorage).

import { computed, ref, shallowReadonly } from 'vue';
import { storeToRefs } from 'pinia';

import { useProjectStore, type BackgroundMapState } from '@/stores/project';

export type { BackgroundMapState };

// Monotonic counter so consumers (MapStage) can react to "a new map was
// imported" even when two backgrounds happen to compare equal.
const version = ref(0);

export function useBackgroundMap() {
  const store = useProjectStore();
  const { background } = storeToRefs(store);
  return {
    background: shallowReadonly(background),
    hasBackground: computed(() => background.value !== null),
    version: shallowReadonly(version),

    setBackgroundMap(next: BackgroundMapState): void {
      store.setBackground(next);
      version.value += 1;
    },

    clearBackgroundMap(): void {
      store.clearBackground();
      version.value += 1;
    },
  };
}
