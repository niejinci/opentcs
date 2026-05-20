<script setup lang="ts">
// SPDX-FileCopyrightText: The openTCS Authors
// SPDX-License-Identifier: MIT
//
// EditorView — S4 introduced the Konva canvas framework; S5 wires the
// first real entities (Point + Path) onto it.
//
// Responsibilities:
//   - Toolbar (Select / Point / Path) state
//   - Konva MapStage with hover/click dispatch
//   - Tool hotkeys (V / P / L), Delete/Backspace, Escape
//   - Dispatching `tool-fire` into `useProjectStore()`:
//       * `point` tool → addPoint
//       * `path`  tool → background click while picking dest = cancel half-state
//       * `select` tool → empty-canvas click = clear selection
//   - Right-hand PropertyPanel for the currently selected entity

import { onBeforeUnmount, onMounted, ref, useTemplateRef } from 'vue';
import { RouterLink } from 'vue-router';

import EditorToolbar from '@/components/canvas/EditorToolbar.vue';
import MapStage from '@/components/canvas/MapStage.vue';
import PropertyPanel from '@/components/property/PropertyPanel.vue';
import { useBackgroundMap } from '@/composables/useBackgroundMap';
import {
  EDITOR_TOOLS,
  editorToolForHotkey,
  getEditorTool,
  type EditorToolId,
} from '@/domain/editor/tools';
import { useProjectStore } from '@/stores/project';
import { toastInfo } from '@/ui/toast/toastBus';

const { background, hasBackground } = useBackgroundMap();
const store = useProjectStore();

const activeTool = ref<EditorToolId>('select');
const mapStageRef = useTemplateRef<{ resetView: () => void } | null>('mapStageRef');

function setTool(id: EditorToolId): void {
  if (id === activeTool.value) return;
  // Switching away from path tool while a source is half-picked = cancel.
  if (activeTool.value === 'path' && store.pathDraftSrc !== null) {
    store.cancelPathDraft();
  }
  activeTool.value = id;
}

/* ----------------------------- Hotkeys ---------------------------------- */

function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  return target.isContentEditable || tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT';
}

function onKeyDown(e: KeyboardEvent): void {
  if (e.ctrlKey || e.metaKey || e.altKey) return;
  if (isEditableTarget(e.target)) return;
  // Tool switching (V/P/L)
  if (!e.repeat) {
    const meta = editorToolForHotkey(e.key);
    if (meta) {
      e.preventDefault();
      setTool(meta.id);
      return;
    }
  }
  // Delete / Backspace = delete selection
  if (e.key === 'Delete' || e.key === 'Backspace') {
    if (store.selection !== null) {
      e.preventDefault();
      store.deleteSelected();
    }
    return;
  }
  // Escape = cancel path half-state and clear selection
  if (e.key === 'Escape') {
    e.preventDefault();
    if (store.pathDraftSrc !== null) store.cancelPathDraft();
    else store.select(null);
  }
}

onMounted(() => window.addEventListener('keydown', onKeyDown));
onBeforeUnmount(() => window.removeEventListener('keydown', onKeyDown));

/* ------------------------- Stage event handlers ------------------------- */

function onToolFire(payload: {
  tool: EditorToolId;
  pixel: { x: number; y: number };
  world: { x: number; y: number };
}): void {
  if (payload.tool === 'point') {
    const created = store.addPoint(payload.pixel);
    if (created) {
      toastInfo(
        `已创建 ${created.name} @ (${payload.world.x.toFixed(3)}, ${payload.world.y.toFixed(3)}) m`,
        'Point',
      );
    }
    return;
  }
  if (payload.tool === 'path') {
    // Clicking empty canvas during a path-in-progress cancels it.
    if (store.pathDraftSrc !== null) {
      store.cancelPathDraft();
      toastInfo('已取消路径绘制（点击空白处）', 'Path');
    } else {
      toastInfo('请点击一个 Point 作为路径起点', 'Path');
    }
    return;
  }
  if (payload.tool === 'location') {
    const created = store.addLocation(payload.pixel);
    if (created) {
      toastInfo(
        `已创建 ${created.name}（type=${created.typeName}）@ (${payload.world.x.toFixed(3)}, ${payload.world.y.toFixed(3)}) m`,
        'Location',
      );
    }
    return;
  }
  if (payload.tool === 'block') {
    const created = store.addBlock();
    toastInfo(`已创建 ${created.name}（在右侧面板勾选成员）`, 'Block');
    return;
  }
  if (payload.tool === 'vehicle') {
    const created = store.addVehicle(payload.pixel);
    toastInfo(`已创建 ${created.name}（拖动可调整初始位置 / 朝向在面板编辑）`, 'Vehicle');
    return;
  }
  // select tool: clicking empty canvas clears selection.
  if (payload.tool === 'select') {
    store.select(null);
  }
}

/* ------------------ Pretty-print helper for status bar ------------------ */
function pointTypeBadge(): string {
  return getEditorTool(activeTool.value).label;
}
</script>

<template>
  <section class="editor">
    <header class="editor__header">
      <h2>S6 · 画布编辑器（Point / Path / Location / Block / Vehicle）</h2>
      <p class="hint">
        <kbd>V</kbd> 选择 · <kbd>P</kbd> Point · <kbd>L</kbd> Path · <kbd>O</kbd> Location ·
        <kbd>B</kbd> Block · <kbd>K</kbd> Vehicle；<kbd>Delete</kbd> 删除选中 ·
        <kbd>Esc</kbd> 取消半态。草稿自动落本机 <code>localStorage</code>（刷新页面不丢）。
      </p>
    </header>

    <div v-if="!hasBackground" class="editor__empty">
      <p class="hint">尚未导入底图。</p>
      <RouterLink to="/import" class="cta">前往「地图导入」上传三件套 →</RouterLink>
    </div>

    <div v-else class="editor__workspace">
      <EditorToolbar :active-tool="activeTool" @switch-tool="setTool" />

      <div class="editor__stage">
        <MapStage
          v-if="background"
          ref="mapStageRef"
          :image="background.image"
          :image-width="background.width"
          :image-height="background.height"
          :affine="background.affine"
          :tool="activeTool"
          @tool-fire="onToolFire"
        >
          <template #status="{ scale, pixel, world, panning }">
            <footer class="statusbar">
              <span
                >当前工具：<strong>{{ pointTypeBadge() }}</strong></span
              >
              <span
                >缩放：<code>{{ (scale * 100).toFixed(0) }}%</code></span
              >
              <span v-if="panning" class="pan-hint">↔ 平移中（释放空格退出）</span>
              <span v-else-if="store.pathDraftSrc" class="pan-hint">
                Path 起点：<code>{{ store.pathDraftSrc }}</code> · 再点一个 Point 完成
              </span>
              <span v-else class="pan-hint--muted">提示：按住空格 + 拖动 = 平移</span>
              <span v-if="pixel">
                像素：(<code>{{ pixel.x.toFixed(1) }}</code
                >, <code>{{ pixel.y.toFixed(1) }}</code
                >)
              </span>
              <span v-if="world" class="world">
                世界：(<code>{{ world.x.toFixed(3) }}</code
                >, <code>{{ world.y.toFixed(3) }}</code
                >) m
              </span>
              <button
                type="button"
                class="reset-btn"
                aria-label="重置画布视口到适应窗口的初始位置"
                @click="mapStageRef?.resetView()"
              >
                重置视口
              </button>
            </footer>
          </template>
        </MapStage>
      </div>

      <div class="editor__sidebar">
        <PropertyPanel />
        <details class="meta">
          <summary>底图 / 快捷键</summary>
          <dl v-if="background">
            <dt>文件</dt>
            <dd>{{ background.pngName }}</dd>
            <dt>尺寸</dt>
            <dd>{{ background.width }} × {{ background.height }} px</dd>
            <dt>resolution</dt>
            <dd>{{ background.yaml.resolution }} m/px</dd>
            <dt>origin</dt>
            <dd>({{ background.yaml.origin.x }}, {{ background.yaml.origin.y }})</dd>
          </dl>
          <ul class="hotkeys">
            <li v-for="t in EDITOR_TOOLS" :key="t.id">
              <kbd>{{ t.hotkey }}</kbd> {{ t.label }}
            </li>
            <li><kbd>Delete</kbd> 删除选中</li>
            <li><kbd>Esc</kbd> 取消 Path 半态 / 取消选中</li>
            <li><kbd>空格</kbd> + 拖动 = 平移</li>
            <li>滚轮 = 缩放</li>
          </ul>
        </details>
      </div>
    </div>
  </section>
</template>

<style scoped>
.editor {
  max-width: 1280px;
  margin: 1.25rem auto;
  padding: 0 1rem;
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.editor__header h2 {
  margin: 0 0 0.25rem;
  font-size: 1.4rem;
}
.hint {
  color: #57606a;
  font-size: 0.9rem;
  margin: 0.25rem 0;
}

.editor__empty {
  border: 1px dashed #d0d7de;
  border-radius: 8px;
  background: #f6f8fa;
  padding: 2rem 1rem;
  text-align: center;
}
.cta {
  display: inline-block;
  margin-top: 0.5rem;
  padding: 0.4rem 0.9rem;
  background: #0969da;
  color: #ffffff;
  border-radius: 5px;
  text-decoration: none;
  font-weight: 600;
}
.cta:hover {
  background: #0a5cb6;
}

.editor__workspace {
  display: grid;
  grid-template-columns: auto 1fr 280px;
  gap: 0.75rem;
  align-items: stretch;
  min-height: 580px;
}

.editor__stage {
  position: relative;
  border: 1px solid #d0d7de;
  border-radius: 8px;
  background: #ffffff;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  min-height: 560px;
}
.editor__stage :deep(.map-stage) {
  flex: 1;
  min-height: 0;
}

.statusbar {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem 1.25rem;
  align-items: center;
  padding: 0.5rem 0.75rem;
  margin: 0;
  border-top: 1px solid #eaeef2;
  background: #f6f8fa;
  font-size: 0.85rem;
}
.statusbar code {
  background: #ffffff;
  padding: 0.05rem 0.3rem;
  border-radius: 3px;
  border: 1px solid #eaeef2;
}
.statusbar .world {
  color: #1a7f37;
  font-weight: 600;
}
.statusbar .pan-hint {
  color: #1a7f37;
}
.statusbar .pan-hint--muted {
  color: #8c959f;
}
.reset-btn {
  margin-left: auto;
  padding: 0.3rem 0.7rem;
  border: 1px solid #d0d7de;
  background: #ffffff;
  border-radius: 4px;
  cursor: pointer;
  font: inherit;
  font-size: 0.85rem;
}
.reset-btn:hover {
  background: #eaeef2;
}

.editor__sidebar {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  min-width: 0;
}
.meta {
  border: 1px solid #d0d7de;
  border-radius: 8px;
  background: #ffffff;
  padding: 0.5rem 0.75rem;
  font-size: 0.8rem;
}
.meta summary {
  cursor: pointer;
  font-weight: 600;
}
.meta dl {
  display: grid;
  grid-template-columns: 6.5em 1fr;
  gap: 0.2rem 0.5rem;
  margin: 0.5rem 0 0.5rem;
}
.meta dt {
  color: #57606a;
}
.meta dd {
  margin: 0;
  word-break: break-all;
}
.hotkeys {
  list-style: none;
  padding: 0;
  margin: 0.25rem 0 0;
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}
kbd {
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  background: #f6f8fa;
  border: 1px solid #d0d7de;
  border-bottom-width: 2px;
  padding: 0.05rem 0.35rem;
  border-radius: 3px;
  font-size: 0.8rem;
}
</style>
