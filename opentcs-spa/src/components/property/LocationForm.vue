<script setup lang="ts">
// SPDX-FileCopyrightText: The openTCS Authors
// SPDX-License-Identifier: MIT
//
// LocationForm — edits a selected DraftLocation.
//
// In addition to the basic fields (name / typeName / world position /
// locked / per-Location locationRepresentation override) this form lets
// the user manage Location ↔ Point links: each existing Point can be
// toggled as a link, and per-link `allowedOperations` can be entered as
// comma-separated text (same convention as LocationTypeForm).

import { computed, ref, watch } from 'vue';

import MiscPropertiesEditor from '@/components/property/MiscPropertiesEditor.vue';
import { LOCATION_REPRESENTATIONS, type LocationRepresentation } from '@/domain/model/types';
import { useProjectStore } from '@/stores/project';
import { toastError } from '@/ui/toast/toastBus';

const store = useProjectStore();

const selected = computed(() => {
  const sel = store.selection;
  if (!sel || sel.kind !== 'location') return null;
  return store.findLocation(sel.name) ?? null;
});

const form = ref({
  name: '',
  typeName: '',
  worldX: 0,
  worldY: 0,
  z: 0,
  locked: false,
  locationRepresentation: 'DEFAULT' as LocationRepresentation,
});

/** Per-Point editable string buffer for `allowedOperations` (keyed by Point name). */
const linkOpsForm = ref<Record<string, string>>({});

watch(
  selected,
  (l) => {
    if (!l) return;
    form.value = {
      name: l.name,
      typeName: l.typeName,
      worldX: l.position.x / 1000,
      worldY: l.position.y / 1000,
      z: l.position.z,
      locked: l.locked,
      locationRepresentation: l.layout.locationRepresentation,
    };
    const buf: Record<string, string> = {};
    for (const link of l.links) buf[link.pointName] = link.allowedOperations.join(', ');
    linkOpsForm.value = buf;
  },
  { immediate: true },
);

function commitName(): void {
  const l = selected.value;
  if (!l) return;
  const next = form.value.name.trim();
  if (next === l.name) return;
  const res = store.renameLocation(l.name, next);
  if (!res.ok) {
    toastError(res.error ?? '重命名失败', 'Location');
    form.value.name = l.name;
  }
}

function commitType(): void {
  const l = selected.value;
  if (!l) return;
  if (!store.findLocationType(form.value.typeName)) {
    toastError(`未知 LocationType '${form.value.typeName}'`, 'Location');
    form.value.typeName = l.typeName;
    return;
  }
  store.updateLocationFields(l.name, { typeName: form.value.typeName });
}

function commitWorld(): void {
  const l = selected.value;
  if (!l) return;
  if (!store.background) {
    toastError('未导入底图，无法直接编辑世界坐标', 'Location');
    form.value.worldX = l.position.x / 1000;
    form.value.worldY = l.position.y / 1000;
    return;
  }
  const wx = Number(form.value.worldX);
  const wy = Number(form.value.worldY);
  if (!Number.isFinite(wx) || !Number.isFinite(wy)) {
    toastError('坐标必须是数字', 'Location');
    form.value.worldX = l.position.x / 1000;
    form.value.worldY = l.position.y / 1000;
    return;
  }
  store.setLocationWorldMeters(l.name, { x: wx, y: wy });
}

function commitZ(): void {
  const l = selected.value;
  if (!l) return;
  const z = Number(form.value.z);
  if (!Number.isFinite(z)) {
    form.value.z = l.position.z;
    return;
  }
  store.updateLocationFields(l.name, { z });
}

function commitLocked(): void {
  const l = selected.value;
  if (!l) return;
  store.updateLocationFields(l.name, { locked: form.value.locked });
}

function commitRepresentation(): void {
  const l = selected.value;
  if (!l) return;
  store.updateLocationFields(l.name, {
    locationRepresentation: form.value.locationRepresentation,
  });
}

function toggleLink(pointName: string): void {
  const l = selected.value;
  if (!l) return;
  store.toggleLocationLink(l.name, pointName);
}

function commitLinkOps(pointName: string): void {
  const l = selected.value;
  if (!l) return;
  const raw = linkOpsForm.value[pointName] ?? '';
  const ops = raw
    .split(',')
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
  store.setLocationLinkOperations(l.name, pointName, ops);
}

function isLinked(pointName: string): boolean {
  const l = selected.value;
  if (!l) return false;
  return l.links.some((lk) => lk.pointName === pointName);
}

function onDelete(): void {
  store.deleteSelected();
}
</script>

<template>
  <section v-if="selected" class="form" data-kind="location">
    <h4>
      Location · <code>{{ selected.name }}</code>
    </h4>
    <label>
      <span>name</span>
      <input v-model="form.name" type="text" @change="commitName" />
    </label>
    <label>
      <span>typeName</span>
      <select v-model="form.typeName" @change="commitType">
        <option v-for="t in store.locationTypes" :key="t.name" :value="t.name">
          {{ t.name }}
        </option>
      </select>
    </label>
    <div class="row">
      <label>
        <span>world x (m)</span>
        <input v-model.number="form.worldX" type="number" step="0.001" @change="commitWorld" />
      </label>
      <label>
        <span>world y (m)</span>
        <input v-model.number="form.worldY" type="number" step="0.001" @change="commitWorld" />
      </label>
    </div>
    <label>
      <span>z (mm)</span>
      <input v-model.number="form.z" type="number" step="1" @change="commitZ" />
    </label>
    <label class="checkbox">
      <input v-model="form.locked" type="checkbox" @change="commitLocked" />
      <span>locked（订单不会以此为目的地）</span>
    </label>
    <label>
      <span>layout.locationRepresentation（仅此 Location 覆盖类型）</span>
      <select v-model="form.locationRepresentation" @change="commitRepresentation">
        <option v-for="r in LOCATION_REPRESENTATIONS" :key="r" :value="r">{{ r }}</option>
      </select>
    </label>

    <fieldset class="links">
      <legend>links（关联 Point）</legend>
      <p v-if="store.points.length === 0" class="hint">尚无 Point，请先用 <kbd>P</kbd> 画点。</p>
      <ul v-else>
        <li v-for="p in store.points" :key="p.name" class="link-row">
          <label class="checkbox">
            <input type="checkbox" :checked="isLinked(p.name)" @change="toggleLink(p.name)" />
            <span
              ><code>{{ p.name }}</code></span
            >
          </label>
          <input
            v-if="isLinked(p.name)"
            v-model="linkOpsForm[p.name]"
            type="text"
            placeholder="allowedOperations（逗号分隔；留空 = 继承类型）"
            @change="commitLinkOps(p.name)"
          />
        </li>
      </ul>
    </fieldset>

    <p class="hint">
      position mm: ({{ selected.position.x }}, {{ selected.position.y }}, {{ selected.position.z }})
    </p>
    <MiscPropertiesEditor kind="location" :name="selected.name" />
    <button class="danger" type="button" @click="onDelete">删除此 Location</button>
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
.form input[type='text'],
.form input[type='number'],
.form select {
  border: 1px solid #d0d7de;
  border-radius: 4px;
  padding: 0.3rem 0.5rem;
  font: inherit;
  font-size: 0.85rem;
}
.form .row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0.5rem;
}
.links {
  border: 1px solid #eaeef2;
  border-radius: 4px;
  padding: 0.4rem 0.6rem;
  margin: 0;
}
.links legend {
  font-size: 0.78rem;
  color: #57606a;
  padding: 0 0.25rem;
}
.links ul {
  list-style: none;
  padding: 0;
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
  max-height: 220px;
  overflow-y: auto;
}
.link-row {
  display: flex;
  flex-direction: column;
  gap: 0.2rem;
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
kbd {
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  background: #f6f8fa;
  border: 1px solid #d0d7de;
  border-bottom-width: 2px;
  padding: 0.05rem 0.35rem;
  border-radius: 3px;
  font-size: 0.75rem;
}
</style>
