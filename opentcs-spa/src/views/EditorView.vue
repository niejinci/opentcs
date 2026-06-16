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

import { onBeforeUnmount, onMounted, ref, useTemplateRef, watch } from 'vue';
import { RouterLink, useRoute, useRouter } from 'vue-router';

import EditorToolbar from '@/components/canvas/EditorToolbar.vue';
import MapStage from '@/components/canvas/MapStage.vue';
import OrderStatusSidebar from '@/components/OrderStatusSidebar.vue';
import PropertyPanel from '@/components/property/PropertyPanel.vue';
import ResourceTree from '@/components/tree/ResourceTree.vue';
import VehicleStatusPanel from '@/components/VehicleStatusPanel.vue';
import { useBackgroundMap } from '@/composables/useBackgroundMap';
import { useCloudDraftSync } from '@/composables/useCloudDraftSync';
import {
  EDITOR_TOOLS,
  editorToolForHotkey,
  getEditorTool,
  type EditorToolId,
} from '@/domain/editor/tools';
import {
  MAX_SIDEBAR_WIDTH_PX,
  MAX_STATUS_PANEL_HEIGHT_PX,
  MIN_SIDEBAR_WIDTH_PX,
  MIN_STATUS_PANEL_HEIGHT_PX,
  useEditorSettingsStore,
} from '@/stores/editorSettings';
import { useProjectStore } from '@/stores/project';
import { useProjectsStore } from '@/stores/projects';
import { toastError, toastInfo } from '@/ui/toast/toastBus';

const { background, hasBackground } = useBackgroundMap();
const store = useProjectStore();
const projects = useProjectsStore();
const settings = useEditorSettingsStore();
const route = useRoute();
const router = useRouter();

// S7: push every debounced state change to the BFF for the active project.
// No-op when no project is selected (cloud sync simply skips the request).
useCloudDraftSync();

// Hydrate the editor with the persisted draft for the URL-bound project.
// If the route has no `projectId` and there's no remembered current one,
// kick the user back to /projects so the catalogue is the single entry
// point into the editor.
async function activateProjectFromRoute(): Promise<void> {
  const id = (route.params.projectId as string | undefined) ?? projects.currentId ?? null;
  if (!id) {
    void router.replace({ name: 'projects' });
    return;
  }
  try {
    await projects.setCurrent(id);
    const env = await projects.loadCurrentDraft();
    store.hydrateDraftPayload(env?.payload ?? null);
  } catch {
    toastError('加载工程失败', 'BFF');
    void router.replace({ name: 'projects' });
  }
}

watch(
  () => route.params.projectId,
  () => void activateProjectFromRoute(),
  { immediate: true },
);

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
  if (isEditableTarget(e.target)) return;
  const modifier = e.ctrlKey || e.metaKey;
  if (modifier && !e.altKey) {
    const key = e.key.toLowerCase();
    if (key === 'z') {
      e.preventDefault();
      if (e.shiftKey) store.redo();
      else store.undo();
      return;
    }
    if (key === 'y' && !e.shiftKey) {
      e.preventDefault();
      store.redo();
      return;
    }
  }
  if (e.ctrlKey || e.metaKey || e.altKey) return;
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

/* --------------------------- Layout resizing --------------------------- */

function setResizeCursor(cursor: string): void {
  document.body.style.userSelect = 'none';
  document.body.style.cursor = cursor;
}

function clearResizeCursor(): void {
  document.body.style.userSelect = '';
  document.body.style.cursor = '';
}

function onSidebarResizePointerDown(e: PointerEvent): void {
  if (e.button !== 0) return;
  e.preventDefault();
  const startX = e.clientX;
  const startWidth = settings.sidebarWidthPx;
  setResizeCursor('col-resize');

  function onMove(ev: PointerEvent): void {
    settings.setSidebarWidthPx(startWidth + (startX - ev.clientX));
  }

  function onUp(): void {
    window.removeEventListener('pointermove', onMove);
    clearResizeCursor();
  }

  window.addEventListener('pointermove', onMove);
  window.addEventListener('pointerup', onUp, { once: true });
  window.addEventListener('pointercancel', onUp, { once: true });
}

function onSidebarResizeKeyDown(e: KeyboardEvent): void {
  const step = e.shiftKey ? 32 : 8;
  if (e.key === 'ArrowLeft') {
    e.preventDefault();
    settings.setSidebarWidthPx(settings.sidebarWidthPx + step);
  } else if (e.key === 'ArrowRight') {
    e.preventDefault();
    settings.setSidebarWidthPx(settings.sidebarWidthPx - step);
  } else if (e.key === 'Home') {
    e.preventDefault();
    settings.setSidebarWidthPx(MIN_SIDEBAR_WIDTH_PX);
  } else if (e.key === 'End') {
    e.preventDefault();
    settings.setSidebarWidthPx(MAX_SIDEBAR_WIDTH_PX);
  }
}

function onStatusPanelResizePointerDown(panel: 'vehicle' | 'order', e: PointerEvent): void {
  if (e.button !== 0) return;
  e.preventDefault();
  const startY = e.clientY;
  const startHeight =
    panel === 'vehicle' ? settings.vehiclePanelHeightPx : settings.orderPanelHeightPx;
  setResizeCursor('row-resize');

  function onMove(ev: PointerEvent): void {
    const next = startHeight + (ev.clientY - startY);
    if (panel === 'vehicle') settings.setVehiclePanelHeightPx(next);
    else settings.setOrderPanelHeightPx(next);
  }

  function onUp(): void {
    window.removeEventListener('pointermove', onMove);
    clearResizeCursor();
  }

  window.addEventListener('pointermove', onMove);
  window.addEventListener('pointerup', onUp, { once: true });
  window.addEventListener('pointercancel', onUp, { once: true });
}

function onStatusPanelResizeKeyDown(panel: 'vehicle' | 'order', e: KeyboardEvent): void {
  const current = panel === 'vehicle' ? settings.vehiclePanelHeightPx : settings.orderPanelHeightPx;
  const setHeight =
    panel === 'vehicle' ? settings.setVehiclePanelHeightPx : settings.setOrderPanelHeightPx;
  const step = e.shiftKey ? 32 : 8;
  if (e.key === 'ArrowUp') {
    e.preventDefault();
    setHeight(current - step);
  } else if (e.key === 'ArrowDown') {
    e.preventDefault();
    setHeight(current + step);
  } else if (e.key === 'Home') {
    e.preventDefault();
    setHeight(MIN_STATUS_PANEL_HEIGHT_PX);
  } else if (e.key === 'End') {
    e.preventDefault();
    setHeight(MAX_STATUS_PANEL_HEIGHT_PX);
  }
}

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
        <kbd>Ctrl+Z</kbd> 撤销 · <kbd>Ctrl+Y</kbd> 重做 ·
        <kbd>Esc</kbd> 取消半态。左侧资源树支持单击选中、<kbd>↑↓</kbd> 切换、<kbd>←→</kbd>
        折叠、<kbd>Enter</kbd>
        选中。工具栏底部可开关「网格吸附」与「缩略图」（右下角点击/拖动可重定位视口）。草稿自动落本机
        <code>localStorage</code>（刷新页面不丢）。
      </p>
    </header>

    <div v-if="!hasBackground" class="editor__empty">
      <p class="hint">尚未导入底图。</p>
      <RouterLink to="/import" class="cta">前往「地图导入」上传三件套 →</RouterLink>
    </div>

    <div
      v-else
      class="editor__workspace"
      :data-tree-collapsed="settings.treeCollapsed"
      :style="{
        '--sidebar-width': `${settings.sidebarWidthPx}px`,
        '--vehicle-panel-height': `${settings.vehiclePanelHeightPx}px`,
        '--order-panel-height': `${settings.orderPanelHeightPx}px`,
      }"
    >
      <ResourceTree />
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
              <span v-if="panning" class="pan-hint">↔ 平移中（释放鼠标退出）</span>
              <span v-else-if="store.pathDraftSrc" class="pan-hint">
                Path 起点：<code>{{ store.pathDraftSrc }}</code> · 再点一个 Point 完成
              </span>
              <span v-else class="pan-hint--muted">提示：拖动空白画布 = 平移</span>
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

      <div
        class="sidebar-resize"
        role="separator"
        tabindex="0"
        aria-orientation="vertical"
        :aria-valuemin="MIN_SIDEBAR_WIDTH_PX"
        :aria-valuemax="MAX_SIDEBAR_WIDTH_PX"
        :aria-valuenow="settings.sidebarWidthPx"
        :aria-label="`右侧属性面板宽度（${settings.sidebarWidthPx} px，按住左右拖动或使用 ←/→ 键调整）`"
        :title="`拖动调整右侧属性面板宽度（${settings.sidebarWidthPx} px）`"
        data-testid="sidebar-resize"
        @pointerdown="onSidebarResizePointerDown"
        @keydown="onSidebarResizeKeyDown"
      >
        <span class="sidebar-resize__grip" aria-hidden="true"></span>
      </div>
      <div class="editor__sidebar">
        <PropertyPanel />
        <section
          class="sidebar-panel sidebar-panel--vehicle"
          :style="{ height: `${settings.vehiclePanelHeightPx}px` }"
        >
          <VehicleStatusPanel />
          <div
            class="panel-resize"
            role="separator"
            tabindex="0"
            aria-orientation="horizontal"
            :aria-valuemin="MIN_STATUS_PANEL_HEIGHT_PX"
            :aria-valuemax="MAX_STATUS_PANEL_HEIGHT_PX"
            :aria-valuenow="settings.vehiclePanelHeightPx"
            :aria-label="`车辆实时状态面板高度（${settings.vehiclePanelHeightPx} px，按住上下拖动或使用 ↑/↓ 键调整）`"
            :title="`拖动调整车辆实时状态面板高度（${settings.vehiclePanelHeightPx} px）`"
            data-testid="vehicle-panel-resize"
            @pointerdown="(e: PointerEvent) => onStatusPanelResizePointerDown('vehicle', e)"
            @keydown="(e: KeyboardEvent) => onStatusPanelResizeKeyDown('vehicle', e)"
          >
            <span class="panel-resize__grip" aria-hidden="true"></span>
          </div>
        </section>
        <section
          class="sidebar-panel sidebar-panel--order"
          :style="{ height: `${settings.orderPanelHeightPx}px` }"
        >
          <OrderStatusSidebar />
          <div
            class="panel-resize"
            role="separator"
            tabindex="0"
            aria-orientation="horizontal"
            :aria-valuemin="MIN_STATUS_PANEL_HEIGHT_PX"
            :aria-valuemax="MAX_STATUS_PANEL_HEIGHT_PX"
            :aria-valuenow="settings.orderPanelHeightPx"
            :aria-label="`订单状态面板高度（${settings.orderPanelHeightPx} px，按住上下拖动或使用 ↑/↓ 键调整）`"
            :title="`拖动调整订单状态面板高度（${settings.orderPanelHeightPx} px）`"
            data-testid="order-panel-resize"
            @pointerdown="(e: PointerEvent) => onStatusPanelResizePointerDown('order', e)"
            @keydown="(e: KeyboardEvent) => onStatusPanelResizeKeyDown('order', e)"
          >
            <span class="panel-resize__grip" aria-hidden="true"></span>
          </div>
        </section>
        <RouterLink
          v-if="projects.currentId"
          :to="{ name: 'project-orders', params: { projectId: projects.currentId } }"
          class="orders-cta"
        >
          下达运输订单 →
        </RouterLink>
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
            <li><kbd>Ctrl+Z</kbd> 撤销；<kbd>Ctrl+Y</kbd>/<kbd>Ctrl+Shift+Z</kbd> 重做</li>
            <li><kbd>Esc</kbd> 取消 Path 半态 / 取消选中</li>
            <li>拖动空白画布 = 平移</li>
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
  grid-template-columns: 240px auto 1fr 8px var(--sidebar-width, 340px);
  /* Bound the row height to the viewport so the canvas area cannot
     grow with its own content (which would re-trigger ResizeObserver). */
  grid-template-rows: minmax(560px, calc(100vh - 220px));
  gap: 0.75rem;
  align-items: stretch;
}
.editor__workspace[data-tree-collapsed='true'] {
  /* Shrink the resource-tree track to a thin strip so the canvas can
     reclaim the freed horizontal space. */
  grid-template-columns: 32px auto 1fr 8px var(--sidebar-width, 340px);
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

.sidebar-resize {
  cursor: col-resize;
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 0;
  outline: none;
  touch-action: none;
  user-select: none;
}
.sidebar-resize__grip {
  display: block;
  width: 2px;
  height: 56px;
  border-radius: 1px;
  background: #d0d7de;
  transition:
    background 0.12s ease,
    height 0.12s ease;
}
.sidebar-resize:hover .sidebar-resize__grip,
.sidebar-resize:focus-visible .sidebar-resize__grip,
.sidebar-resize:active .sidebar-resize__grip {
  background: #0969da;
  height: 88px;
}
.sidebar-resize:focus-visible {
  box-shadow: inset 2px 0 0 #0969da;
}

.editor__sidebar {
  /* Grid layout so PropertyPanel claims the remaining vertical space and
     scrolls internally; the order/vehicle status panels keep their
     content-bounded heights and never squeeze the property editor. */
  display: grid;
  grid-template-rows:
    minmax(220px, 1fr)
    var(--vehicle-panel-height, 220px)
    var(--order-panel-height, 260px)
    auto
    auto;
  gap: 0.5rem;
  min-width: 0;
  min-height: 0;
  width: var(--sidebar-width, 340px);
  overflow-y: auto;
  overflow-x: hidden;
  padding-right: 0.15rem;
}
/* Direct flex/grid children must not collapse below their content. */
.editor__sidebar > * {
  min-height: 0;
}
.sidebar-panel {
  display: grid;
  grid-template-rows: minmax(0, 1fr) 8px;
  min-width: 0;
  min-height: 0;
}
.sidebar-panel > :first-child {
  min-height: 0;
}
.panel-resize {
  cursor: row-resize;
  display: flex;
  align-items: center;
  justify-content: center;
  outline: none;
  touch-action: none;
  user-select: none;
}
.panel-resize__grip {
  display: block;
  width: 48px;
  height: 2px;
  border-radius: 1px;
  background: #d0d7de;
  transition:
    background 0.12s ease,
    width 0.12s ease;
}
.panel-resize:hover .panel-resize__grip,
.panel-resize:focus-visible .panel-resize__grip,
.panel-resize:active .panel-resize__grip {
  width: 88px;
  background: #0969da;
}
.panel-resize:focus-visible {
  box-shadow: inset 0 -2px 0 #0969da;
}
.orders-cta {
  display: block;
  text-align: center;
  padding: 0.4rem 0.6rem;
  background: #0969da;
  color: #ffffff;
  border-radius: 6px;
  text-decoration: none;
  font-weight: 600;
  font-size: 0.9rem;
}
.orders-cta:hover {
  background: #0a5cb6;
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
