<script setup lang="ts">
// SPDX-FileCopyrightText: The openTCS Authors
// SPDX-License-Identifier: MIT
//
// MiscPropertiesEditor — shared key/value editor for the free-form
// `properties` map (mirror of `CreationTO.properties`) carried by every
// Draft* entity (Point / Path / LocationType / Location / Block / Vehicle).
//
// These properties drive adapter + order behaviour (e.g. VDA5050
// manufacturer / serialNumber / topic prefix on a Vehicle, pickup/place
// parameters on a Location operation, max-speed overrides on a Path),
// matching the "Miscellaneous" tab in opentcs-modeleditor.
//
// Edit semantics:
//   - Each row commits on `change` (blur / Enter), never per keystroke.
//   - Renaming a key keeps insertion order; duplicate / empty keys are
//     rejected with a toast and the input reverts.
//   - The "+ 添加属性" row is a separate transient buffer so the user can
//     type freely without polluting the model until they confirm.

import { computed, ref, watch } from 'vue';

import type { EntityKind } from '@/domain/model/types';
import { useProjectStore } from '@/stores/project';
import { toastError } from '@/ui/toast/toastBus';

const props = defineProps<{
  /** Entity kind addressed by the editor (drives the store action target). */
  kind: EntityKind;
  /** Stable entity name (== TO name). Re-resolving on each change covers renames. */
  name: string;
}>();

const store = useProjectStore();

/** Reactive view of the current entity's `properties` bag. */
const entries = computed<Array<[string, string]>>(() => {
  const target = resolveTarget();
  if (!target) return [];
  return Object.entries(target.properties);
});

/**
 * Resolves the entity behind the (kind, name) prop pair so the template
 * can stay agnostic. Returns `undefined` if the entity was deleted
 * concurrently (race against rename / delete) — template hides the editor
 * in that case via the `v-if` guard upstream.
 */
function resolveTarget(): { properties: Record<string, string> } | undefined {
  switch (props.kind) {
    case 'point':
      return store.findPoint(props.name);
    case 'path':
      return store.findPath(props.name);
    case 'locationType':
      return store.findLocationType(props.name);
    case 'location':
      return store.findLocation(props.name);
    case 'block':
      return store.findBlock(props.name);
    case 'vehicle':
      return store.findVehicle(props.name);
    default:
      return undefined;
  }
}

/* ---------------------- Existing-row local mirrors --------------------- */

// Local mirror of each row's editable key + value, so an in-progress edit
// (e.g. user typing in the key field) doesn't immediately re-trigger a
// commit on every keystroke. Re-synced whenever the underlying entries change.
interface RowDraft {
  /** Original / committed key — used as the lookup handle for rename + delete. */
  originalKey: string;
  key: string;
  value: string;
}

const rows = ref<RowDraft[]>([]);

watch(
  entries,
  (next) => {
    rows.value = next.map(([k, v]) => ({ originalKey: k, key: k, value: v }));
  },
  { immediate: true },
);

function commitKey(row: RowDraft): void {
  const trimmed = row.key.trim();
  if (trimmed === row.originalKey) {
    // Snap back any whitespace-only change.
    row.key = row.originalKey;
    return;
  }
  const res = store.renameEntityPropertyKey(props.kind, props.name, row.originalKey, trimmed);
  if (!res.ok) {
    toastError(res.error ?? '修改属性键失败', 'Properties');
    row.key = row.originalKey;
    return;
  }
  row.originalKey = trimmed;
  row.key = trimmed;
}

function commitValue(row: RowDraft): void {
  const res = store.setEntityProperty(props.kind, props.name, row.originalKey, row.value);
  if (!res.ok) {
    toastError(res.error ?? '修改属性值失败', 'Properties');
  }
}

function deleteRow(row: RowDraft): void {
  store.deleteEntityProperty(props.kind, props.name, row.originalKey);
}

/* --------------------------- Add-row buffer ---------------------------- */

const draftKey = ref('');
const draftValue = ref('');

function addRow(): void {
  const key = draftKey.value.trim();
  if (!key) {
    toastError('请输入属性键', 'Properties');
    return;
  }
  const res = store.setEntityProperty(props.kind, props.name, key, draftValue.value);
  if (!res.ok) {
    toastError(res.error ?? '添加属性失败', 'Properties');
    return;
  }
  draftKey.value = '';
  draftValue.value = '';
}
</script>

<template>
  <fieldset class="misc-props">
    <legend>properties（{{ rows.length }} 项）</legend>

    <p v-if="rows.length === 0" class="hint">
      暂无自定义属性。常见键：<code>vda5050:manufacturer</code> /
      <code>tcs:loadHandlingDevices</code> 等。
    </p>

    <ul v-if="rows.length > 0" class="rows">
      <li v-for="(row, idx) in rows" :key="`${row.originalKey}-${idx}`" class="row">
        <input
          v-model="row.key"
          type="text"
          class="row__key"
          aria-label="property key"
          @change="commitKey(row)"
        />
        <input
          v-model="row.value"
          type="text"
          class="row__value"
          aria-label="property value"
          @change="commitValue(row)"
        />
        <button
          type="button"
          class="row__del"
          :title="`删除属性 ${row.originalKey}`"
          :aria-label="`删除属性 ${row.originalKey}`"
          @click="deleteRow(row)"
        >
          ×
        </button>
      </li>
    </ul>

    <div class="row row--add">
      <input
        v-model="draftKey"
        type="text"
        class="row__key"
        placeholder="键"
        aria-label="new property key"
        @keydown.enter.prevent="addRow"
      />
      <input
        v-model="draftValue"
        type="text"
        class="row__value"
        placeholder="值"
        aria-label="new property value"
        @keydown.enter.prevent="addRow"
      />
      <button type="button" class="row__add" @click="addRow">+ 添加</button>
    </div>
  </fieldset>
</template>

<style scoped>
.misc-props {
  border: 1px solid #eaeef2;
  border-radius: 4px;
  padding: 0.4rem 0.6rem 0.5rem;
  margin: 0;
}
.misc-props legend {
  font-size: 0.78rem;
  color: #57606a;
  padding: 0 0.25rem;
}
.rows {
  list-style: none;
  margin: 0 0 0.4rem;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  max-height: 12rem;
  overflow-y: auto;
}
.row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1.4fr) auto;
  gap: 0.3rem;
  align-items: center;
}
.row--add {
  margin-top: 0.25rem;
  padding-top: 0.35rem;
  border-top: 1px dashed #d0d7de;
}
.row__key,
.row__value {
  border: 1px solid #d0d7de;
  border-radius: 4px;
  padding: 0.25rem 0.45rem;
  font: inherit;
  font-size: 0.82rem;
  min-width: 0;
}
.row__key {
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
}
.row__del {
  border: none;
  background: transparent;
  color: #57606a;
  cursor: pointer;
  font: inherit;
  font-size: 0.95rem;
  line-height: 1;
  padding: 0.15rem 0.4rem;
  border-radius: 3px;
}
.row__del:hover {
  background: #ffebe9;
  color: #cf222e;
}
.row__add {
  padding: 0.25rem 0.55rem;
  border: 1px solid #d0d7de;
  background: #f6f8fa;
  border-radius: 4px;
  cursor: pointer;
  font: inherit;
  font-size: 0.78rem;
}
.row__add:hover {
  background: #eaeef2;
}
.hint {
  color: #57606a;
  font-size: 0.78rem;
  margin: 0.1rem 0 0.4rem;
}
.hint code {
  background: #f6f8fa;
  padding: 0.02rem 0.25rem;
  border-radius: 3px;
  font-size: 0.75rem;
}
</style>
