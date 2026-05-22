<script setup lang="ts">
// SPDX-FileCopyrightText: The openTCS Authors
// SPDX-License-Identifier: MIT
//
// BlockForm — edits a selected DraftBlock.
//
// Membership is managed as a checkbox list of all eligible entities
// (Point + Path + Location). Toggling commits immediately; there is no
// "save / cancel". The AnnotationLayer highlights the current Block's
// members + draws a dashed bounding box around their geometry.

import { computed, ref, watch } from 'vue';

import MiscPropertiesEditor from '@/components/property/MiscPropertiesEditor.vue';
import type { BlockType } from '@/domain/model/types';
import { useProjectStore } from '@/stores/project';
import { toastError } from '@/ui/toast/toastBus';

const store = useProjectStore();

const selected = computed(() => {
  const sel = store.selection;
  if (!sel || sel.kind !== 'block') return null;
  return store.findBlock(sel.name) ?? null;
});

const form = ref({
  name: '',
  type: 'SINGLE_VEHICLE_ONLY' as BlockType,
  colorRgb: '#bf3989',
});

watch(
  selected,
  (b) => {
    if (!b) return;
    form.value = {
      name: b.name,
      type: b.type,
      colorRgb: b.layout.colorRgb,
    };
  },
  { immediate: true },
);

const candidates = computed(() => store.blockMemberCandidates());

function isMember(name: string): boolean {
  const b = selected.value;
  if (!b) return false;
  return b.memberNames.includes(name);
}

function toggleMember(name: string): void {
  const b = selected.value;
  if (!b) return;
  store.toggleBlockMember(b.name, name);
}

function commitName(): void {
  const b = selected.value;
  if (!b) return;
  const next = form.value.name.trim();
  if (next === b.name) return;
  const res = store.renameBlock(b.name, next);
  if (!res.ok) {
    toastError(res.error ?? '重命名失败', 'Block');
    form.value.name = b.name;
  }
}

function commitType(): void {
  const b = selected.value;
  if (!b) return;
  store.updateBlockFields(b.name, { type: form.value.type });
}

function commitColor(): void {
  const b = selected.value;
  if (!b) return;
  store.updateBlockFields(b.name, { colorRgb: form.value.colorRgb });
}

function onDelete(): void {
  store.deleteSelected();
}
</script>

<template>
  <section v-if="selected" class="form" data-kind="block">
    <h4>
      Block · <code>{{ selected.name }}</code>
    </h4>
    <label>
      <span>name</span>
      <input v-model="form.name" type="text" @change="commitName" />
    </label>
    <label>
      <span>type</span>
      <select v-model="form.type" @change="commitType">
        <option value="SINGLE_VEHICLE_ONLY">SINGLE_VEHICLE_ONLY</option>
        <option value="SAME_DIRECTION_ONLY">SAME_DIRECTION_ONLY</option>
      </select>
    </label>
    <label>
      <span>layout.color</span>
      <input v-model="form.colorRgb" type="color" @change="commitColor" />
    </label>

    <fieldset class="members">
      <legend>members（{{ selected.memberNames.length }} 个）</legend>
      <p v-if="candidates.length === 0" class="hint">
        尚无可作为成员的实体；先创建 Point / Path / Location。
      </p>
      <ul v-else>
        <li v-for="c in candidates" :key="`${c.kind}:${c.name}`">
          <label class="checkbox">
            <input type="checkbox" :checked="isMember(c.name)" @change="toggleMember(c.name)" />
            <span
              ><code>{{ c.name }}</code> <em class="kind">· {{ c.kind }}</em></span
            >
          </label>
        </li>
      </ul>
    </fieldset>

    <p class="hint">画布上以虚线框标出成员包络（仅在选中本 Block 时显示）。</p>
    <MiscPropertiesEditor kind="block" :name="selected.name" />
    <button class="danger" type="button" @click="onDelete">删除此 Block</button>
  </section>
</template>

<style scoped>
.form {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}
.form h4 {
  margin: 0 0 0.25rem;
  font-size: 0.95rem;
}
.form code {
  background: #f6f8fa;
  padding: 0.05rem 0.3rem;
  border-radius: 3px;
}
.form label {
  display: flex;
  flex-direction: column;
  gap: 0.2rem;
}
.form label.checkbox {
  flex-direction: row;
  align-items: center;
  gap: 0.4rem;
}
.form label span {
  color: #57606a;
  font-size: 0.78rem;
}
.form label.checkbox span {
  color: #1f2328;
  font-size: 0.85rem;
}
.form input[type='text'],
.form select {
  border: 1px solid #d0d7de;
  border-radius: 4px;
  padding: 0.3rem 0.5rem;
  font: inherit;
  font-size: 0.85rem;
}
.form input[type='color'] {
  width: 60px;
  height: 30px;
  border: 1px solid #d0d7de;
  border-radius: 4px;
  padding: 0;
}
.members {
  border: 1px solid #eaeef2;
  border-radius: 4px;
  padding: 0.4rem 0.6rem;
  margin: 0;
}
.members legend {
  font-size: 0.78rem;
  color: #57606a;
  padding: 0 0.25rem;
}
.members ul {
  list-style: none;
  padding: 0;
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  max-height: 240px;
  overflow-y: auto;
}
.members .kind {
  color: #8c959f;
  font-style: normal;
  font-size: 0.78rem;
  margin-left: 0.35rem;
}
.hint {
  color: #57606a;
  font-size: 0.8rem;
  margin: 0.25rem 0;
}
.danger {
  margin-top: 0.5rem;
  padding: 0.4rem 0.6rem;
  border: 1px solid #cf222e;
  background: #ffffff;
  color: #cf222e;
  border-radius: 4px;
  cursor: pointer;
  font: inherit;
  font-size: 0.85rem;
}
.danger:hover {
  background: #cf222e;
  color: #ffffff;
}
</style>
