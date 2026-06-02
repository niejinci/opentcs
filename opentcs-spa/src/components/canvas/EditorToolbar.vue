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
//
// PR3 additions:
//   - "对齐" subsection with 6 align (left/right/top/bottom/centerX/centerY)
//     and 2 distribute (X/Y) buttons that fan out to `store.applyAlign(...)`.
//   - "容差圆" toggle + default radius input (mm) wired to
//     `useEditorSettingsStore.tolerance*`. Per-Point overrides live in
//     `DraftPoint.properties` and are edited in the property panel.

import { computed } from 'vue';

import {
  DEFAULT_GRID_SPACING_PX,
  MAX_GRID_SPACING_PX,
  MIN_GRID_SPACING_PX,
} from '@/domain/editor/grid';
import { ALIGN_MIN_COUNT, DISTRIBUTE_MIN_COUNT, type AlignAction } from '@/domain/editor/align';
import {
  DEFAULT_TOLERANCE_MM,
  MAX_TOLERANCE_MM,
  MIN_TOLERANCE_MM,
} from '@/domain/editor/tolerance';
import { EDITOR_TOOLS, type EditorToolId } from '@/domain/editor/tools';
import { useEditorSettingsStore } from '@/stores/editorSettings';
import { useProjectStore } from '@/stores/project';

defineProps<{ activeTool: EditorToolId }>();
const emit = defineEmits<{ 'switch-tool': [EditorToolId] }>();

const settings = useEditorSettingsStore();
const project = useProjectStore();

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

function onToleranceMmInput(e: Event): void {
  const target = e.target as HTMLInputElement | null;
  if (!target) return;
  const value = Number.parseInt(target.value, 10);
  if (!Number.isFinite(value)) return;
  settings.setToleranceDefaultMm(value);
  target.value = String(settings.toleranceDefaultMm);
}

/* ----------------------------- Align buttons ---------------------------- */

interface AlignButton {
  action: AlignAction;
  label: string;
  glyph: string;
  /** Minimum selection size below which the button is disabled. */
  minCount: number;
}

const ALIGN_BUTTONS: readonly AlignButton[] = [
  { action: 'left', label: '左对齐', glyph: '⇤', minCount: ALIGN_MIN_COUNT },
  { action: 'centerX', label: '水平居中', glyph: '↔', minCount: ALIGN_MIN_COUNT },
  { action: 'right', label: '右对齐', glyph: '⇥', minCount: ALIGN_MIN_COUNT },
  { action: 'top', label: '顶对齐', glyph: '⤒', minCount: ALIGN_MIN_COUNT },
  { action: 'centerY', label: '垂直居中', glyph: '↕', minCount: ALIGN_MIN_COUNT },
  { action: 'bottom', label: '底对齐', glyph: '⤓', minCount: ALIGN_MIN_COUNT },
  { action: 'distributeX', label: '横向均匀', glyph: '⇿', minCount: DISTRIBUTE_MIN_COUNT },
  { action: 'distributeY', label: '纵向均匀', glyph: '⇳', minCount: DISTRIBUTE_MIN_COUNT },
];

const alignableCount = computed<number>(
  () =>
    project.multiSelectedNamesByKind('point').length +
    project.multiSelectedNamesByKind('location').length +
    project.multiSelectedNamesByKind('vehicle').length,
);

function onAlignClick(action: AlignAction): void {
  project.applyAlign(action);
}

function onClearMultiSelection(): void {
  project.clearMultiSelection();
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
      <label class="toolbar-toggle" title="为所有 Point 显示到位精度容差圆；选中的 Point 始终显示">
        <input
          type="checkbox"
          :checked="settings.toleranceShow"
          data-testid="toggle-tolerance"
          @change="settings.toggleToleranceShow()"
        />
        <span>容差圆</span>
      </label>
      <label
        class="toolbar-spacing"
        :class="{ 'toolbar-spacing--disabled': !settings.toleranceShow }"
      >
        <span>默认</span>
        <input
          type="number"
          :min="MIN_TOLERANCE_MM"
          :max="MAX_TOLERANCE_MM"
          :step="10"
          :placeholder="String(DEFAULT_TOLERANCE_MM)"
          :value="settings.toleranceDefaultMm"
          :disabled="!settings.toleranceShow"
          data-testid="tolerance-default-input"
          aria-label="默认容差半径（毫米）"
          @change="onToleranceMmInput"
        />
        <span class="unit">mm</span>
      </label>
    </div>

    <hr class="toolbar-sep" />

    <div class="toolbar-section" aria-label="对齐与分布">
      <div class="align-header">
        <span>对齐 / 分布</span>
        <span class="align-count" :data-empty="alignableCount === 0">{{ alignableCount }}</span>
      </div>
      <p class="align-hint">
        在左侧资源树用 <kbd>Ctrl</kbd>/<kbd>⌘</kbd>+单击 多选 Point / Location /
        Vehicle，再点击下方按钮。
      </p>
      <div class="align-grid">
        <button
          v-for="b in ALIGN_BUTTONS"
          :key="b.action"
          type="button"
          class="align-btn"
          :title="`${b.label}（需选中 ≥${b.minCount} 个）`"
          :aria-label="b.label"
          :disabled="alignableCount < b.minCount"
          :data-testid="`align-${b.action}`"
          @click="onAlignClick(b.action)"
        >
          <span class="align-btn__glyph" aria-hidden="true">{{ b.glyph }}</span>
          <span class="align-btn__label">{{ b.label }}</span>
        </button>
      </div>
      <button
        type="button"
        class="align-clear"
        :disabled="alignableCount === 0"
        data-testid="align-clear"
        @click="onClearMultiSelection"
      >
        清空多选
      </button>
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

/* PR3 — align toolbar */
.align-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-weight: 600;
  color: #1f2328;
}
.align-count {
  display: inline-block;
  min-width: 1.6em;
  padding: 0 0.4em;
  text-align: center;
  background: #ddf4ff;
  color: #0a3069;
  border-radius: 999px;
  font-size: 0.75em;
  font-weight: 600;
}
.align-count[data-empty='true'] {
  background: #eaeef2;
  color: #57606a;
}
.align-hint {
  margin: 0;
  color: #57606a;
  font-size: 0.75rem;
  line-height: 1.35;
}
.align-hint kbd {
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  background: #f6f8fa;
  border: 1px solid #d0d7de;
  border-bottom-width: 2px;
  padding: 0.02rem 0.3rem;
  border-radius: 3px;
  font-size: 0.7rem;
}
.align-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0.25rem;
}
.align-btn {
  display: flex;
  align-items: center;
  gap: 0.35rem;
  padding: 0.3rem 0.4rem;
  border: 1px solid #d0d7de;
  border-radius: 4px;
  background: #f6f8fa;
  color: #1f2328;
  cursor: pointer;
  font: inherit;
  font-size: 0.78rem;
  text-align: left;
}
.align-btn:hover:not(:disabled) {
  background: #eaeef2;
}
.align-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
.align-btn__glyph {
  font-size: 1rem;
  line-height: 1;
  width: 1.2em;
  text-align: center;
  color: #0969da;
}
.align-btn__label {
  flex: 1 1 auto;
}
.align-clear {
  margin-top: 0.3rem;
  padding: 0.25rem 0.4rem;
  border: 1px solid #d0d7de;
  border-radius: 4px;
  background: #ffffff;
  color: #1f2328;
  cursor: pointer;
  font: inherit;
  font-size: 0.78rem;
}
.align-clear:hover:not(:disabled) {
  background: #eaeef2;
}
.align-clear:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
</style>
