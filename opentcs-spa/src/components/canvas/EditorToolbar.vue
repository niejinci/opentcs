<script setup lang="ts">
// SPDX-FileCopyrightText: The openTCS Authors
// SPDX-License-Identifier: MIT
//
// EditorToolbar — left-hand vertical strip of tool buttons. Pure UI: the
// active tool is owned by EditorView; this component only emits switch
// requests. Hotkeys are also owned by EditorView (so they keep working
// when the toolbar is collapsed or off-screen).

import { EDITOR_TOOLS, type EditorToolId } from '@/domain/editor/tools';

defineProps<{ activeTool: EditorToolId }>();
const emit = defineEmits<{ 'switch-tool': [EditorToolId] }>();
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

.tool-button--active .tool-button__hotkey {
  background: rgba(255, 255, 255, 0.2);
}
</style>
