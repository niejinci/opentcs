// SPDX-FileCopyrightText: The openTCS Authors
// SPDX-License-Identifier: MIT
//
// Cross-view shared state for the currently-imported scan triple
// (PNG + PGM + YAML) and its derived AffineMapping.
//
// S4 scope only: this is a deliberately tiny module-level singleton built
// on `ref` + `shallowRef`, NOT a Pinia store. The roadmap puts Pinia at S5
// ("S5 起手"), where this composable will be replaced by a proper
// `useProjectStore()`. Keeping the API surface small here (set/clear +
// individual readonly refs) keeps that migration mechanical.
//
// Why share across views?
//   - ImportView (S3) owns the upload UX + yaml parsing.
//   - EditorView (S4+) needs the AffineMapping and a decoded HTMLImageElement
//     to draw the Konva BackgroundLayer.
//   - Re-uploading inside the editor would create two parallel input flows;
//     a singleton ref keeps "import once, edit anywhere" intuitive.

import { computed, shallowReadonly, shallowRef, readonly, ref } from 'vue';

import type { AffineMapping } from '@/domain/geometry/affine';
import type { RosMapMetadata } from '@/domain/yaml/parseRosMapYaml';

export interface BackgroundMapState {
  /** Decoded PNG, ready to hand to a Konva.Image / vue-konva <v-image>. */
  image: HTMLImageElement;
  /** Original PNG file name (display only). */
  pngName: string;
  /** Original PGM file name (display only). Optional — PGM is archival, not rendered. */
  pgmName: string | null;
  /** Original YAML file name (display only). */
  yamlName: string;
  /** Natural pixel size of the PNG; matches `affine.image{Width,Height}`. */
  width: number;
  height: number;
  /** Parsed ROS map.yaml metadata. */
  yaml: RosMapMetadata;
  /** Pixel↔meter mapping derived from `yaml` + image size. */
  affine: AffineMapping;
}

const state = shallowRef<BackgroundMapState | null>(null);
// Monotonically increases each time `setBackgroundMap` is called; lets
// consumers (e.g. MapStage) react to "a new map was imported" even when the
// AffineMapping happens to compare equal.
const version = ref(0);

export function useBackgroundMap() {
  return {
    /** Current background map or `null` if nothing has been imported yet. */
    background: shallowReadonly(state),
    /** True iff a background map is currently available. */
    hasBackground: computed(() => state.value !== null),
    /** Bumps on every successful import. */
    version: readonly(version),

    setBackgroundMap(next: BackgroundMapState): void {
      state.value = next;
      version.value += 1;
    },

    clearBackgroundMap(): void {
      state.value = null;
      version.value += 1;
    },
  };
}
