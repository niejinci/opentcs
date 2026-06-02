<script setup lang="ts">
// SPDX-FileCopyrightText: The openTCS Authors
// SPDX-License-Identifier: MIT
//
// ResourceTree — left-side resource tree panel (PR1: pr-add-resource-tree-select).
//
// Mirrors the original Swing `ComponentsTreeViewPanel` from
// opentcs-plantoverview-common: a single tree of model resources grouped
// by entity kind (Points / Paths / LocationTypes / Locations / Blocks /
// Vehicles). The 6 group nodes correspond exactly to the kinds carried
// by `useProjectStore()`'s draft.
//
// Selection is the SINGLE source of truth: clicking a leaf calls
// `store.select({ kind, name })`. Conversely, when something else mutates
// `store.selection` (canvas click, property-panel programmatic select),
// the matching leaf is highlighted automatically because we read straight
// from the store. No local "selectedKey" mirror is kept — the store IS
// the model.
//
// Group expansion state is local-only (component ref) — refresh resets
// to "all expanded". Persistence is intentionally deferred to a later
// PR to keep this change purely additive.
//
// Keyboard model (roving tabindex):
//   ↑/↓     : move focus to previous / next visible node
//   ←       : if expanded group → collapse; else → focus parent group
//   →       : if collapsed group → expand; else → focus first child
//   Home/End: jump to first / last visible node
//   Enter   : select focused leaf / toggle focused group
//   Space   : same as Enter (per WAI-ARIA tree pattern)
// All key handlers `stopPropagation()` so the EditorView's global hotkeys
// (V/P/L/Delete/Esc/space-pan) don't fire when the tree is focused.

import { computed, nextTick, ref, useTemplateRef, watch } from 'vue';

import type { EntityKind } from '@/domain/model/types';
import { useProjectStore } from '@/stores/project';

interface GroupSpec {
  kind: EntityKind;
  /** Display label shown next to the group's expand chevron. */
  label: string;
  /** Glyph rendered in front of each leaf. ASCII / Unicode only — no icon font. */
  glyph: string;
}

const GROUPS: readonly GroupSpec[] = [
  { kind: 'point', label: 'Points', glyph: '●' },
  { kind: 'path', label: 'Paths', glyph: '→' },
  { kind: 'locationType', label: 'LocationTypes', glyph: '◇' },
  { kind: 'location', label: 'Locations', glyph: '◆' },
  { kind: 'block', label: 'Blocks', glyph: '▢' },
  { kind: 'vehicle', label: 'Vehicles', glyph: '🚚' },
];

const store = useProjectStore();

/* --------------------------- Per-group items --------------------------- */

/**
 * Returns the entity-name list for a kind, sorted ascendingly using a
 * locale-aware numeric collation (mirrors AscendingTreeViewNameComparator
 * from the Swing codebase).
 */
function namesFor(kind: EntityKind): string[] {
  let raw: { name: string }[] = [];
  switch (kind) {
    case 'point':
      raw = store.points;
      break;
    case 'path':
      raw = store.paths;
      break;
    case 'locationType':
      raw = store.locationTypes;
      break;
    case 'location':
      raw = store.locations;
      break;
    case 'block':
      raw = store.blocks;
      break;
    case 'vehicle':
      raw = store.vehicles;
      break;
  }
  return raw
    .map((e) => e.name)
    .slice()
    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
}

const itemsByKind = computed<Record<EntityKind, string[]>>(() => ({
  point: namesFor('point'),
  path: namesFor('path'),
  locationType: namesFor('locationType'),
  location: namesFor('location'),
  block: namesFor('block'),
  vehicle: namesFor('vehicle'),
}));

/* --------------------------- Expand / collapse ------------------------- */

const expanded = ref<Record<EntityKind, boolean>>({
  point: true,
  path: true,
  locationType: true,
  location: true,
  block: true,
  vehicle: true,
});

function toggleGroup(kind: EntityKind): void {
  expanded.value[kind] = !expanded.value[kind];
}

/* --------------------- Visible-node order (for keyboard) --------------- */

interface VisibleNode {
  /** Stable DOM id we set on each treeitem element so we can re-focus it. */
  domId: string;
  type: 'group' | 'leaf';
  kind: EntityKind;
  /** Leaf entity name (undefined for group rows). */
  name?: string;
}

function groupId(kind: EntityKind): string {
  return `rt-grp-${kind}`;
}
function leafId(kind: EntityKind, name: string): string {
  // Encode the name so DOM ids stay valid for any user-chosen name.
  return `rt-leaf-${kind}-${encodeURIComponent(name)}`;
}

const visibleNodes = computed<VisibleNode[]>(() => {
  const out: VisibleNode[] = [];
  for (const g of GROUPS) {
    out.push({ domId: groupId(g.kind), type: 'group', kind: g.kind });
    if (expanded.value[g.kind]) {
      for (const name of itemsByKind.value[g.kind]) {
        out.push({ domId: leafId(g.kind, name), type: 'leaf', kind: g.kind, name });
      }
    }
  }
  return out;
});

/* ---------------------------- Roving focus ----------------------------- */

const treeEl = useTemplateRef<HTMLUListElement | null>('treeEl');
/**
 * The id of the node that currently owns `tabindex=0`. We try to keep
 * this in sync with `store.selection` so re-tabbing into the tree lands
 * on the active resource; if there's no selection we anchor on the
 * first visible group so keyboard nav has somewhere to start.
 */
const focusId = ref<string>('rt-grp-point');

function selectionDomId(): string | null {
  const sel = store.selection;
  if (!sel) return null;
  return leafId(sel.kind, sel.name);
}

watch(
  () => store.selection,
  (sel) => {
    if (sel) focusId.value = leafId(sel.kind, sel.name);
  },
  { immediate: true },
);

// If the visible set shrinks (e.g. expanded group collapses, focused leaf
// deleted) make sure the roving tabindex doesn't get stranded on an
// invisible row.
watch(visibleNodes, (nodes) => {
  if (!nodes.find((n) => n.domId === focusId.value)) {
    focusId.value = nodes[0]?.domId ?? 'rt-grp-point';
  }
});

function focusNode(domId: string): void {
  focusId.value = domId;
  void nextTick(() => {
    // Use an attribute selector instead of `#${id}` to avoid pulling in
    // CSS.escape (not available in jsdom). encodeURIComponent guarantees
    // no `"` ever appears in the encoded id, so direct interpolation is
    // safe here.
    const el = treeEl.value?.querySelector<HTMLElement>(`[id="${domId}"]`);
    el?.focus();
  });
}

/* --------------------------- Click handlers ---------------------------- */

function onLeafClick(kind: EntityKind, name: string): void {
  store.select({ kind, name });
  focusNode(leafId(kind, name));
}

function onGroupClick(kind: EntityKind): void {
  toggleGroup(kind);
  focusNode(groupId(kind));
}

/* --------------------------- Keyboard handler -------------------------- */

const HANDLED_KEYS = new Set([
  'ArrowUp',
  'ArrowDown',
  'ArrowLeft',
  'ArrowRight',
  'Home',
  'End',
  'Enter',
  ' ',
]);

function onKeyDown(e: KeyboardEvent): void {
  if (!HANDLED_KEYS.has(e.key)) return;
  // Tree owns these keys; never let them bubble to the editor's global
  // hotkey listener (which interprets Space / arrows for canvas pan).
  e.preventDefault();
  e.stopPropagation();

  const nodes = visibleNodes.value;
  const idx = nodes.findIndex((n) => n.domId === focusId.value);
  const cur = idx >= 0 ? nodes[idx] : nodes[0];
  if (!cur) return;

  if (e.key === 'ArrowDown') {
    const next = nodes[Math.min(nodes.length - 1, (idx >= 0 ? idx : 0) + 1)];
    if (next) focusNode(next.domId);
    return;
  }
  if (e.key === 'ArrowUp') {
    const prev = nodes[Math.max(0, (idx >= 0 ? idx : 0) - 1)];
    if (prev) focusNode(prev.domId);
    return;
  }
  if (e.key === 'Home') {
    if (nodes[0]) focusNode(nodes[0].domId);
    return;
  }
  if (e.key === 'End') {
    const last = nodes[nodes.length - 1];
    if (last) focusNode(last.domId);
    return;
  }
  if (e.key === 'ArrowLeft') {
    if (cur.type === 'group') {
      if (expanded.value[cur.kind]) {
        expanded.value[cur.kind] = false;
      }
      // Already collapsed — there's no parent above the group, stay put.
    } else {
      // Leaf → collapse parent group and move focus to it.
      expanded.value[cur.kind] = false;
      focusNode(groupId(cur.kind));
    }
    return;
  }
  if (e.key === 'ArrowRight') {
    if (cur.type === 'group') {
      if (!expanded.value[cur.kind]) {
        expanded.value[cur.kind] = true;
        return;
      }
      // Already expanded — move focus into the first child if any.
      const firstChild = itemsByKind.value[cur.kind][0];
      if (firstChild) focusNode(leafId(cur.kind, firstChild));
    }
    // Leaves with no children: no-op.
    return;
  }
  if (e.key === 'Enter' || e.key === ' ') {
    if (cur.type === 'leaf' && cur.name !== undefined) {
      store.select({ kind: cur.kind, name: cur.name });
    } else if (cur.type === 'group') {
      toggleGroup(cur.kind);
    }
    return;
  }
}

/* ----------------------- Selection-match helper ------------------------ */

function isLeafSelected(kind: EntityKind, name: string): boolean {
  const sel = store.selection;
  return sel?.kind === kind && sel.name === name;
}

/** Used by aria-activedescendant + tests. */
const activeDescendantId = computed<string | null>(() => selectionDomId());
</script>

<template>
  <aside class="resource-tree" aria-label="资源树">
    <header class="resource-tree__header">
      <h3>资源树</h3>
      <span class="hint">单击选中 · ↑↓ 切换 · ←→ 折叠 · Enter 选中</span>
    </header>
    <ul
      ref="treeEl"
      class="resource-tree__root"
      role="tree"
      :aria-activedescendant="activeDescendantId ?? undefined"
      @keydown="onKeyDown"
    >
      <li
        v-for="g in GROUPS"
        :key="g.kind"
        role="treeitem"
        :aria-expanded="expanded[g.kind]"
        :aria-label="`${g.label} (${itemsByKind[g.kind].length})`"
        class="group"
      >
        <div
          :id="groupId(g.kind)"
          class="group__row"
          :class="{ 'is-focus': focusId === groupId(g.kind) }"
          :tabindex="focusId === groupId(g.kind) ? 0 : -1"
          :data-kind="g.kind"
          @click="onGroupClick(g.kind)"
        >
          <span class="chevron" aria-hidden="true">{{ expanded[g.kind] ? '▼' : '▶' }}</span>
          <span class="group__label">{{ g.label }}</span>
          <span class="group__count" aria-hidden="true">{{ itemsByKind[g.kind].length }}</span>
        </div>
        <ul v-show="expanded[g.kind]" role="group" class="group__children">
          <li v-if="itemsByKind[g.kind].length === 0" class="empty" aria-hidden="true">— 暂无 —</li>
          <li
            v-for="name in itemsByKind[g.kind]"
            v-else
            :id="leafId(g.kind, name)"
            :key="name"
            role="treeitem"
            :aria-selected="isLeafSelected(g.kind, name)"
            :tabindex="focusId === leafId(g.kind, name) ? 0 : -1"
            class="leaf"
            :class="{
              'is-selected': isLeafSelected(g.kind, name),
              'is-focus': focusId === leafId(g.kind, name),
            }"
            :data-kind="g.kind"
            :data-name="name"
            @click="onLeafClick(g.kind, name)"
          >
            <span class="leaf__glyph" aria-hidden="true">{{ g.glyph }}</span>
            <span class="leaf__name">{{ name }}</span>
          </li>
        </ul>
      </li>
    </ul>
  </aside>
</template>

<style scoped>
.resource-tree {
  display: flex;
  flex-direction: column;
  border: 1px solid #d0d7de;
  border-radius: 8px;
  background: #ffffff;
  overflow: hidden;
  min-height: 0;
}

.resource-tree__header {
  padding: 0.5rem 0.75rem;
  border-bottom: 1px solid #eaeef2;
  background: #f6f8fa;
}
.resource-tree__header h3 {
  margin: 0;
  font-size: 0.95rem;
}
.resource-tree__header .hint {
  display: block;
  margin-top: 0.15rem;
  color: #57606a;
  font-size: 0.75rem;
}

.resource-tree__root {
  list-style: none;
  margin: 0;
  padding: 0.25rem 0;
  flex: 1 1 auto;
  overflow-y: auto;
  font-size: 0.85rem;
  outline: none;
}

.group {
  list-style: none;
}
.group__row {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  padding: 0.25rem 0.5rem;
  cursor: pointer;
  user-select: none;
  font-weight: 600;
  color: #1f2328;
  border-radius: 4px;
  margin: 0 0.25rem;
  outline: none;
}
.group__row:hover {
  background: #f6f8fa;
}
.group__row.is-focus {
  box-shadow: inset 0 0 0 2px #0969da;
}
.chevron {
  display: inline-block;
  width: 0.9em;
  text-align: center;
  color: #57606a;
  font-size: 0.7em;
}
.group__label {
  flex: 1 1 auto;
}
.group__count {
  display: inline-block;
  min-width: 1.6em;
  padding: 0 0.4em;
  text-align: center;
  background: #eaeef2;
  color: #57606a;
  border-radius: 999px;
  font-size: 0.75em;
  font-weight: 500;
}

.group__children {
  list-style: none;
  margin: 0;
  padding: 0;
}
.empty {
  padding: 0.2rem 0.75rem 0.4rem 2.1rem;
  color: #8c959f;
  font-style: italic;
  font-size: 0.8rem;
}
.leaf {
  display: flex;
  align-items: center;
  gap: 0.45rem;
  padding: 0.2rem 0.5rem 0.2rem 1.7rem;
  cursor: pointer;
  user-select: none;
  border-radius: 4px;
  margin: 0 0.25rem;
  outline: none;
  color: #1f2328;
}
.leaf:hover {
  background: #f6f8fa;
}
.leaf.is-focus {
  box-shadow: inset 0 0 0 2px #0969da;
}
.leaf.is-selected {
  background: #ddf4ff;
  color: #0a3069;
  font-weight: 600;
}
.leaf__glyph {
  display: inline-block;
  width: 1em;
  text-align: center;
  color: #57606a;
}
.leaf.is-selected .leaf__glyph {
  color: #0a3069;
}
.leaf__name {
  flex: 1 1 auto;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
</style>
