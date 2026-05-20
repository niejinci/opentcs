<script setup lang="ts">
// SPDX-FileCopyrightText: The openTCS Authors
// SPDX-License-Identifier: MIT
//
// LocationTypeForm — edits a selected DraftLocationType.
//
// Edit semantics mirror PropertyPanel:
//   - commit on `change` (blur / Enter)
//   - invalid edits revert the field with a toast
//   - `allowedOperations` is rendered as a comma-separated text box;
//     the store dedupes + trims on commit

import { computed, ref, watch } from 'vue';

import { LOCATION_REPRESENTATIONS, type LocationRepresentation } from '@/domain/model/types';
import { useProjectStore } from '@/stores/project';
import { toastError } from '@/ui/toast/toastBus';

const store = useProjectStore();

const selected = computed(() => {
  const sel = store.selection;
  if (!sel || sel.kind !== 'locationType') return null;
  return store.findLocationType(sel.name) ?? null;
});

const referencingLocationCount = computed(() => {
  const sel = selected.value;
  if (!sel) return 0;
  return store.locations.filter((l) => l.typeName === sel.name).length;
});

const form = ref({
  name: '',
  allowedOperations: '',
  allowedPeripheralOperations: '',
  locationRepresentation: 'LOAD_TRANSFER_GENERIC' as LocationRepresentation,
});

watch(
  selected,
  (t) => {
    if (!t) return;
    form.value = {
      name: t.name,
      allowedOperations: t.allowedOperations.join(', '),
      allowedPeripheralOperations: t.allowedPeripheralOperations.join(', '),
      locationRepresentation: t.layout.locationRepresentation,
    };
  },
  { immediate: true },
);

function commitName(): void {
  const t = selected.value;
  if (!t) return;
  const next = form.value.name.trim();
  if (next === t.name) return;
  const res = store.renameLocationType(t.name, next);
  if (!res.ok) {
    toastError(res.error ?? '重命名失败', 'LocationType');
    form.value.name = t.name;
  }
}

function parseCsv(raw: string): string[] {
  return raw
    .split(',')
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

function commitOps(): void {
  const t = selected.value;
  if (!t) return;
  store.updateLocationTypeFields(t.name, {
    allowedOperations: parseCsv(form.value.allowedOperations),
  });
}

function commitPeripheralOps(): void {
  const t = selected.value;
  if (!t) return;
  store.updateLocationTypeFields(t.name, {
    allowedPeripheralOperations: parseCsv(form.value.allowedPeripheralOperations),
  });
}

function commitRepresentation(): void {
  const t = selected.value;
  if (!t) return;
  store.updateLocationTypeFields(t.name, {
    locationRepresentation: form.value.locationRepresentation,
  });
}

function onDelete(): void {
  if (referencingLocationCount.value > 0) {
    toastError(
      `还有 ${referencingLocationCount.value} 个 Location 引用此类型，请先改类型或删除它们`,
      'LocationType',
    );
    return;
  }
  store.deleteSelected();
}
</script>

<template>
  <section v-if="selected" class="form" data-kind="locationType">
    <h4>
      LocationType · <code>{{ selected.name }}</code>
    </h4>
    <label>
      <span>name</span>
      <input v-model="form.name" type="text" @change="commitName" />
    </label>
    <label>
      <span>allowedOperations（逗号分隔）</span>
      <input v-model="form.allowedOperations" type="text" @change="commitOps" />
    </label>
    <label>
      <span>allowedPeripheralOperations（逗号分隔）</span>
      <input
        v-model="form.allowedPeripheralOperations"
        type="text"
        placeholder="（MVP 通常留空）"
        @change="commitPeripheralOps"
      />
    </label>
    <label>
      <span>layout.locationRepresentation</span>
      <select v-model="form.locationRepresentation" @change="commitRepresentation">
        <option v-for="r in LOCATION_REPRESENTATIONS" :key="r" :value="r">{{ r }}</option>
      </select>
    </label>
    <p class="hint">
      被 <strong>{{ referencingLocationCount }}</strong> 个 Location 引用
      {{ referencingLocationCount > 0 ? '；删除将被拦截' : '' }}
    </p>
    <button class="danger" type="button" @click="onDelete">删除此 LocationType</button>
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
.form label span {
  color: #57606a;
  font-size: 0.78rem;
}
.form input[type='text'],
.form select {
  border: 1px solid #d0d7de;
  border-radius: 4px;
  padding: 0.3rem 0.5rem;
  font: inherit;
  font-size: 0.85rem;
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
