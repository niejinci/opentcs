<script setup lang="ts">
// SPDX-FileCopyrightText: The openTCS Authors
// SPDX-License-Identifier: MIT
//
// EditorToolbar — left-hand vertical strip of tool buttons. Pure UI: the
// active tool is owned by EditorView; this component only emits switch
// requests. Hotkeys are also owned by EditorView (so they keep working
// when the toolbar is collapsed or off-screen).
//
// PR2 additions: a "View" sub-section for the canvas-wide settings owned
// by `useEditorSettingsStore` — grid-snap toggle (with spacing input) and
// mini-map toggle. Kept in the toolbar so they sit next to the drawing
// tools and survive route changes via the persisted store.

import {
  DEFAULT_GRID_SPACING_PX,
  MAX_GRID_SPACING_PX,
  MIN_GRID_SPACING_PX,
} from '@/domain/editor/grid';
import { EDITOR_TOOLS, type EditorToolId } from '@/domain/editor/tools';
import { useEditorSettingsStore } from '@/stores/editorSettings';

defineProps<{ activeTool: EditorToolId }>();
const emit = defineEmits<{ 'switch-tool': [EditorToolId] }>();

const settings = useEditorSettingsStore();

function onSpacingInput(e: Event): void {
  const target = e.target as HTMLInputElement | null;
  if (!target) return;
  const value = Number.parseInt(target.value, 10);
  if (!Number.isFinite(value)) return;
  settings.setGridSpacingPx(value);
  // Reflect the clamped value back into the input so the user sees the
  // applied bound (otherwise typing "5000" would silently snap to 1000).
  target.value = String(settings.gridSpacingPx);
}
</script>

<template>
  <aside class="editor-toolbar" aria-label="编辑器工具栏">
    <button
      v-for="t in EDITOR_TOOLS"
      :key="t.id"
      type="button"
      class="tool-button"
      :class="{ 'tool-button--active': t.id === activeTool }"
      :title="`${t.label} (${t.hotkey}) — ${t.hint}`"
      :aria-pressed="t.id === activeTool"
      @click="emit('switch-tool', t.id)"
    >
      <span class="tool-button__label">{{ t.label }}</span>
      <span class="tool-button__hotkey">{{ t.hotkey }}</span>
    </button>

    <hr class="toolbar-sep" />

    <div class="toolbar-section" aria-label="视图设置">
      <label class="toolbar-toggle" :title="`网格吸附（间距 ${settings.gridSpacingPx}px）`">
        <input
          type="checkbox"
          :checked="settings.gridSnap"
          data-testid="toggle-grid-snap"
          @change="settings.toggleGridSnap()"
        />
        <span>网格吸附</span>
      </label>
      <label class="toolbar-spacing" :class="{ 'toolbar-spacing--disabled': !settings.gridSnap }">
        <span>间距</span>
        <input
          type="number"
          :min="MIN_GRID_SPACING_PX"
          :max="MAX_GRID_SPACING_PX"
          :step="1"
          :placeholder="String(DEFAULT_GRID_SPACING_PX)"
          :value="settings.gridSpacingPx"
          :disabled="!settings.gridSnap"
          data-testid="grid-spacing-input"
          aria-label="网格间距（像素）"
          @change="onSpacingInput"
        />
        <span class="unit">px</span>
      </label>
      <label class="toolbar-toggle" title="右下角显示缩略图，便于快速定位视口">
        <input
          type="checkbox"
          :checked="settings.minimap"
          data-testid="toggle-minimap"
          @change="settings.toggleMinimap()"
        />
        <span>缩略图</span>
      </label>
    </div>
  </aside>
</template>

<style scoped>
.editor-toolbar {
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
  padding: 0.5rem;
  background: #ffffff;
  border: 1px solid #d0d7de;
  border-radius: 6px;
  min-width: 90px;
}

.tool-button {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
  padding: 0.45rem 0.6rem;
  border: 1px solid #d0d7de;
  border-radius: 4px;
  background: #f6f8fa;
  color: #1f2328;
  cursor: pointer;
  font: inherit;
  font-size: 0.9rem;
  text-align: left;
}

.tool-button:hover {
  background: #eaeef2;
}

.tool-button--active {
  background: #0969da;
  color: #ffffff;
  border-color: #0969da;
  font-weight: 600;
}

.tool-button__hotkey {
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 0.75rem;
  padding: 0.05rem 0.35rem;
  border-radius: 3px;
  background: rgba(0, 0, 0, 0.08);
}

.toolbar-sep {
  border: none;
  border-top: 1px dashed #d0d7de;
  margin: 0.25rem 0;
}

.toolbar-section {
  display: flex;
  flex-direction: column;
  gap: 0.3rem;
  font-size: 0.82rem;
}

.toolbar-toggle {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  cursor: pointer;
  user-select: none;
}

.toolbar-toggle input[type='checkbox'] {
  margin: 0;
}

.toolbar-spacing {
  display: flex;
  align-items: center;
  gap: 0.3rem;
  padding-left: 1.4rem;
}
.toolbar-spacing--disabled {
  opacity: 0.55;
}
.toolbar-spacing input[type='number'] {
  width: 4.4rem;
  padding: 0.15rem 0.3rem;
  border: 1px solid #d0d7de;
  border-radius: 3px;
  font: inherit;
  font-size: 0.8rem;
  background: #ffffff;
}
.toolbar-spacing input[type='number']:disabled {
  background: #f6f8fa;
  cursor: not-allowed;
}
.toolbar-spacing .unit {
  color: #57606a;
}

.tool-button--active .tool-button__hotkey {
  background: rgba(255, 255, 255, 0.2);
}
</style>

