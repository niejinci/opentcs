<script setup lang="ts">
// SPDX-FileCopyrightText: The openTCS Authors
// SPDX-License-Identifier: MIT
//
// EditorView — S4 entry view. Wires up:
//   - the toolbar (Select / Point / Path)
//   - the Konva MapStage (zoom / pan / hover)
//   - tool hotkeys (V / P / L), space-pan hint, reset-view button
//   - a status bar showing zoom %, current tool, pixel and world coords
//
// When no map has been imported yet, render a CTA pointing back to /import.
// S5+ will layer real Point/Path creation on top of `tool-fire` events.

import { onBeforeUnmount, onMounted, ref, useTemplateRef } from 'vue';
import { RouterLink } from 'vue-router';

import EditorToolbar from '@/components/canvas/EditorToolbar.vue';
import MapStage from '@/components/canvas/MapStage.vue';
import { useBackgroundMap } from '@/composables/useBackgroundMap';
import {
  EDITOR_TOOLS,
  editorToolForHotkey,
  getEditorTool,
  type EditorToolId,
} from '@/domain/editor/tools';
import { toastInfo } from '@/ui/toast/toastBus';

const { background, hasBackground } = useBackgroundMap();

const activeTool = ref<EditorToolId>('select');
const mapStageRef = useTemplateRef<{ resetView: () => void } | null>('mapStageRef');

function setTool(id: EditorToolId): void {
  if (id === activeTool.value) return;
  activeTool.value = id;
}

/* ----------------------------- Hotkeys ---------------------------------- */

function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  return target.isContentEditable || tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT';
}

function onKeyDown(e: KeyboardEvent): void {
  if (e.repeat || e.ctrlKey || e.metaKey || e.altKey) return;
  if (isEditableTarget(e.target)) return;
  const meta = editorToolForHotkey(e.key);
  if (meta) {
    e.preventDefault();
    setTool(meta.id);
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
  const meta = getEditorTool(payload.tool);
  // S4 boundary: do NOT mutate any model — only acknowledge the click so
  // testers can verify wheel zoom, space pan, and tool dispatch end-to-end.
  toastInfo(
    `像素 (${payload.pixel.x.toFixed(1)}, ${payload.pixel.y.toFixed(1)})` +
      ` → 世界 (${payload.world.x.toFixed(3)}, ${payload.world.y.toFixed(3)}) m`,
    `${meta.label} · 将在 ${meta.milestone} 落地`,
  );
}
</script>

<template>
  <section class="editor">
    <header class="editor__header">
      <h2>S4 · 画布编辑器框架</h2>
      <p class="hint">
        多图层 Konva Stage + 滚轮缩放（聚焦光标）+ 按住
        <kbd>空格</kbd> 拖动平移 + 工具栏切换。<strong>S4 仅落框架</strong>，Point / Path 实体在 S5
        起手；当前工具点击只回显坐标。
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
                >当前工具：<strong>{{ getEditorTool(activeTool).label }}</strong></span
              >
              <span
                >缩放：<code>{{ (scale * 100).toFixed(0) }}%</code></span
              >
              <span v-if="panning" class="pan-hint">↔ 平移中（释放空格退出）</span>
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

      <aside class="editor__sidebar">
        <h3>底图信息</h3>
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

        <h3>快捷键</h3>
        <ul class="hotkeys">
          <li v-for="t in EDITOR_TOOLS" :key="t.id">
            <kbd>{{ t.hotkey }}</kbd> {{ t.label }}
          </li>
          <li><kbd>空格</kbd> + 拖动 = 平移</li>
          <li>滚轮 = 缩放</li>
        </ul>
      </aside>
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
  grid-template-columns: auto 1fr 260px;
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
  border: 1px solid #d0d7de;
  border-radius: 8px;
  background: #ffffff;
  padding: 0.75rem 1rem;
  font-size: 0.85rem;
}
.editor__sidebar h3 {
  margin: 0.25rem 0 0.5rem;
  font-size: 0.95rem;
}
.editor__sidebar dl {
  display: grid;
  grid-template-columns: 6.5em 1fr;
  gap: 0.25rem 0.5rem;
  margin: 0 0 0.75rem;
}
.editor__sidebar dt {
  color: #57606a;
}
.editor__sidebar dd {
  margin: 0;
  word-break: break-all;
}
.hotkeys {
  list-style: none;
  padding: 0;
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: 0.3rem;
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
