<script setup lang="ts">
// SPDX-FileCopyrightText: The openTCS Authors
// SPDX-License-Identifier: MIT
//
// PropertyPanel — right-hand sidebar that edits whichever entity is
// currently selected in the project store. Shows a friendly "nothing
// selected" placeholder otherwise.
//
// Edit semantics:
//   - All inputs are committed on `change` (= blur or Enter), not on each
//     keystroke, so an in-progress numeric edit doesn't kick off a path
//     length recompute on every digit.
//   - Names are validated locally; invalid edits revert the field and
//     show a toast.
//   - Point world coordinates are entered in meters; the store converts
//     to mm Triple internally.
//   - Path length defaults to "auto" (= straight-line distance between
//     endpoints). A manual edit sets `length` directly; if endpoints then
//     move, the length is recomputed and the manual value is overwritten
//     (documented MVP trade-off).

import { computed, ref, watch } from 'vue';

import BlockForm from '@/components/property/BlockForm.vue';
import LocationForm from '@/components/property/LocationForm.vue';
import LocationTypeForm from '@/components/property/LocationTypeForm.vue';
import VehicleForm from '@/components/property/VehicleForm.vue';
import { useProjectStore } from '@/stores/project';
import { toastError } from '@/ui/toast/toastBus';

const store = useProjectStore();

/* --------------------------- Selected resolvers ------------------------ */

const selectedPoint = computed(() => {
  const sel = store.selection;
  if (!sel || sel.kind !== 'point') return null;
  return store.findPoint(sel.name) ?? null;
});

const selectedPath = computed(() => {
  const sel = store.selection;
  if (!sel || sel.kind !== 'path') return null;
  return store.findPath(sel.name) ?? null;
});

/* ------------------------- Point form bindings ------------------------- */

// Local mirrors so the user can edit a field and only commit on change.
// `watch` resets the mirror when the selected point identity changes.

const pointForm = ref({
  name: '',
  type: 'HALT_POSITION' as 'HALT_POSITION' | 'PARK_POSITION',
  worldX: 0, // meters
  worldY: 0, // meters
  z: 0, // mm
  orientationAngle: '' as string, // degrees, '' = NaN = unset
});

watch(
  selectedPoint,
  (pt) => {
    if (!pt) return;
    pointForm.value = {
      name: pt.name,
      type: pt.type,
      worldX: pt.pose.position.x / 1000,
      worldY: pt.pose.position.y / 1000,
      z: pt.pose.position.z,
      orientationAngle: Number.isFinite(pt.pose.orientationAngle)
        ? String(pt.pose.orientationAngle)
        : '',
    };
  },
  { immediate: true },
);

function commitPointName(): void {
  const pt = selectedPoint.value;
  if (!pt) return;
  const next = pointForm.value.name.trim();
  if (next === pt.name) return;
  const res = store.renamePoint(pt.name, next);
  if (!res.ok) {
    toastError(res.error ?? '重命名失败', 'Point');
    pointForm.value.name = pt.name;
  }
}

function commitPointType(): void {
  const pt = selectedPoint.value;
  if (!pt) return;
  store.updatePointFields(pt.name, { type: pointForm.value.type });
}

function commitPointWorld(): void {
  const pt = selectedPoint.value;
  if (!pt) return;
  if (!store.background) {
    toastError('未导入底图，无法直接编辑世界坐标', 'Point');
    pointForm.value.worldX = pt.pose.position.x / 1000;
    pointForm.value.worldY = pt.pose.position.y / 1000;
    return;
  }
  const wx = Number(pointForm.value.worldX);
  const wy = Number(pointForm.value.worldY);
  if (!Number.isFinite(wx) || !Number.isFinite(wy)) {
    toastError('坐标必须是数字', 'Point');
    pointForm.value.worldX = pt.pose.position.x / 1000;
    pointForm.value.worldY = pt.pose.position.y / 1000;
    return;
  }
  store.setPointWorldMeters(pt.name, { x: wx, y: wy });
}

function commitPointZ(): void {
  const pt = selectedPoint.value;
  if (!pt) return;
  const z = Number(pointForm.value.z);
  if (!Number.isFinite(z)) {
    pointForm.value.z = pt.pose.position.z;
    return;
  }
  store.updatePointFields(pt.name, { z });
}

function commitPointOrientation(): void {
  const pt = selectedPoint.value;
  if (!pt) return;
  const raw = pointForm.value.orientationAngle.trim();
  if (raw === '') {
    store.updatePointFields(pt.name, { orientationAngle: Number.NaN });
    return;
  }
  const v = Number(raw);
  if (!Number.isFinite(v)) {
    toastError('orientationAngle 必须是数字（度），留空表示未设置', 'Point');
    pointForm.value.orientationAngle = Number.isFinite(pt.pose.orientationAngle)
      ? String(pt.pose.orientationAngle)
      : '';
    return;
  }
  store.updatePointFields(pt.name, { orientationAngle: v });
}

/* -------------------------- Path form bindings ------------------------- */

const pathForm = ref({
  name: '',
  length: 0,
  maxVelocity: 0,
  maxReverseVelocity: 0,
  locked: false,
});

watch(
  selectedPath,
  (pa) => {
    if (!pa) return;
    pathForm.value = {
      name: pa.name,
      length: pa.length,
      maxVelocity: pa.maxVelocity,
      maxReverseVelocity: pa.maxReverseVelocity,
      locked: pa.locked,
    };
  },
  { immediate: true },
);

function commitPathName(): void {
  const pa = selectedPath.value;
  if (!pa) return;
  const next = pathForm.value.name.trim();
  if (next === pa.name) return;
  const res = store.renamePath(pa.name, next);
  if (!res.ok) {
    toastError(res.error ?? '重命名失败', 'Path');
    pathForm.value.name = pa.name;
  }
}

function commitPathField(field: 'length' | 'maxVelocity' | 'maxReverseVelocity'): void {
  const pa = selectedPath.value;
  if (!pa) return;
  const v = Number(pathForm.value[field]);
  if (!Number.isFinite(v) || v < 0) {
    pathForm.value[field] = pa[field];
    toastError(`${field} 必须 ≥ 0`, 'Path');
    return;
  }
  store.updatePathFields(pa.name, { [field]: v });
}

function commitPathLocked(): void {
  const pa = selectedPath.value;
  if (!pa) return;
  store.updatePathFields(pa.name, { locked: pathForm.value.locked });
}

function onDelete(): void {
  store.deleteSelected();
}

function onAddLocationType(): void {
  const created = store.addLocationType();
  store.select({ kind: 'locationType', name: created.name });
}

function onAddBlock(): void {
  const created = store.addBlock();
  store.select({ kind: 'block', name: created.name });
}

function onSelectLocationType(name: string): void {
  store.select({ kind: 'locationType', name });
}

function onSelectBlock(name: string): void {
  store.select({ kind: 'block', name });
}

function onDeleteLocationType(name: string): void {
  const refs = store.locations.filter((l) => l.typeName === name);
  if (refs.length > 0) {
    toastError(
      `LocationType "${name}" 仍被 ${refs.length} 个 Location 引用，请先在 Location 上改 type 后再删`,
      'LocationType',
    );
    return;
  }
  store.select({ kind: 'locationType', name });
  store.deleteSelected();
}

function onDeleteBlock(name: string): void {
  store.select({ kind: 'block', name });
  store.deleteSelected();
}
</script>

<template>
  <aside class="property-panel" aria-label="实体属性面板">
    <header class="property-panel__header">
      <h3>属性面板</h3>
      <p class="hint">
        <strong>{{ store.points.length }}</strong> Point ·
        <strong>{{ store.paths.length }}</strong> Path ·
        <strong>{{ store.locations.length }}</strong> Location ·
        <strong>{{ store.locationTypes.length }}</strong> LocType ·
        <strong>{{ store.blocks.length }}</strong> Block ·
        <strong>{{ store.vehicles.length }}</strong> Vehicle
      </p>
      <div class="quick-actions">
        <button type="button" @click="onAddLocationType">+ LocationType</button>
        <button type="button" @click="onAddBlock">+ Block</button>
      </div>
      <!-- Click-to-select lists for entities with no canvas position
           (LocationType / Block). Without these the user can only reach
           a freshly-created item via auto-select; existing ones become
           orphaned. The active row is highlighted to mirror the canvas
           selection state. -->
      <div v-if="store.locationTypes.length > 0" class="entity-list">
        <p class="entity-list__title">LocationType ({{ store.locationTypes.length }})</p>
        <ul>
          <li
            v-for="t in store.locationTypes"
            :key="t.name"
            :class="{
              active: store.selection?.kind === 'locationType' && store.selection.name === t.name,
            }"
          >
            <button type="button" class="entity-list__row" @click="onSelectLocationType(t.name)">
              {{ t.name }}
            </button>
            <button
              type="button"
              class="entity-list__del"
              :title="`删除 ${t.name}`"
              :aria-label="`删除 ${t.name}`"
              @click.stop="onDeleteLocationType(t.name)"
            >
              ×
            </button>
          </li>
        </ul>
      </div>
      <div v-if="store.blocks.length > 0" class="entity-list">
        <p class="entity-list__title">Block ({{ store.blocks.length }})</p>
        <ul>
          <li
            v-for="b in store.blocks"
            :key="b.name"
            :class="{
              active: store.selection?.kind === 'block' && store.selection.name === b.name,
            }"
          >
            <button type="button" class="entity-list__row" @click="onSelectBlock(b.name)">
              {{ b.name }}
              <span class="entity-list__meta">· {{ b.memberNames.length }} 成员</span>
            </button>
            <button
              type="button"
              class="entity-list__del"
              :title="`删除 ${b.name}`"
              :aria-label="`删除 ${b.name}`"
              @click.stop="onDeleteBlock(b.name)"
            >
              ×
            </button>
          </li>
        </ul>
      </div>
    </header>

    <!-- Point editor -->
    <section v-if="selectedPoint" class="form" data-kind="point">
      <h4>
        Point · <code>{{ selectedPoint.name }}</code>
      </h4>
      <label>
        <span>name</span>
        <input v-model="pointForm.name" type="text" @change="commitPointName" />
      </label>
      <label>
        <span>type</span>
        <select v-model="pointForm.type" @change="commitPointType">
          <option value="HALT_POSITION">HALT_POSITION</option>
          <option value="PARK_POSITION">PARK_POSITION</option>
        </select>
      </label>
      <div class="row">
        <label>
          <span>world x (m)</span>
          <input
            v-model.number="pointForm.worldX"
            type="number"
            step="0.001"
            @change="commitPointWorld"
          />
        </label>
        <label>
          <span>world y (m)</span>
          <input
            v-model.number="pointForm.worldY"
            type="number"
            step="0.001"
            @change="commitPointWorld"
          />
        </label>
      </div>
      <label>
        <span>z (mm)</span>
        <input v-model.number="pointForm.z" type="number" step="1" @change="commitPointZ" />
      </label>
      <label>
        <span>orientationAngle (°, 留空 = 未设置)</span>
        <input
          v-model="pointForm.orientationAngle"
          type="text"
          inputmode="decimal"
          placeholder="NaN"
          @change="commitPointOrientation"
        />
      </label>
      <p class="hint">
        position mm: ({{ selectedPoint.pose.position.x }}, {{ selectedPoint.pose.position.y }},
        {{ selectedPoint.pose.position.z }})
      </p>
      <button class="danger" type="button" @click="onDelete">
        删除此 Point（级联删除其相关 Path / Location.links / Block.members）
      </button>
    </section>

    <!-- Path editor -->
    <section v-else-if="selectedPath" class="form" data-kind="path">
      <h4>
        Path · <code>{{ selectedPath.name }}</code>
      </h4>
      <label>
        <span>name</span>
        <input v-model="pathForm.name" type="text" @change="commitPathName" />
      </label>
      <p class="hint">
        <code>{{ selectedPath.srcPointName }}</code> →
        <code>{{ selectedPath.destPointName }}</code>
      </p>
      <label>
        <span>length (mm)</span>
        <input
          v-model.number="pathForm.length"
          type="number"
          step="1"
          min="0"
          @change="commitPathField('length')"
        />
      </label>
      <label>
        <span>maxVelocity (mm/s)</span>
        <input
          v-model.number="pathForm.maxVelocity"
          type="number"
          step="1"
          min="0"
          @change="commitPathField('maxVelocity')"
        />
      </label>
      <label>
        <span>maxReverseVelocity (mm/s)</span>
        <input
          v-model.number="pathForm.maxReverseVelocity"
          type="number"
          step="1"
          min="0"
          @change="commitPathField('maxReverseVelocity')"
        />
      </label>
      <label class="checkbox">
        <input v-model="pathForm.locked" type="checkbox" @change="commitPathLocked" />
        <span>locked（虚线显示，订单不会经过）</span>
      </label>
      <button class="danger" type="button" @click="onDelete">删除此 Path</button>
    </section>

    <!-- S6: LocationType / Location / Block / Vehicle editors -->
    <LocationTypeForm v-else-if="store.selection?.kind === 'locationType'" />
    <LocationForm v-else-if="store.selection?.kind === 'location'" />
    <BlockForm v-else-if="store.selection?.kind === 'block'" />
    <VehicleForm v-else-if="store.selection?.kind === 'vehicle'" />

    <section v-else class="empty">
      <p class="hint">未选中实体。</p>
      <ul class="howto">
        <li><kbd>V</kbd> 选择 / 拖动 · 点击实体编辑属性</li>
        <li><kbd>P</kbd> Point · <kbd>L</kbd> Path · <kbd>O</kbd> Location</li>
        <li><kbd>B</kbd> Block · <kbd>K</kbd> Vehicle</li>
        <li>按 <kbd>Delete</kbd> 删除选中；按 <kbd>Esc</kbd> 取消 Path 半态 / 取消选中</li>
        <li>用上方 <code>+ LocationType</code> / <code>+ Block</code> 直接新建</li>
      </ul>
    </section>
  </aside>
</template>

<style scoped>
.property-panel {
  border: 1px solid #d0d7de;
  border-radius: 8px;
  background: #ffffff;
  padding: 0.75rem 1rem;
  font-size: 0.85rem;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  overflow-y: auto;
  min-width: 0;
}
.property-panel__header h3 {
  margin: 0;
  font-size: 1rem;
}
.quick-actions {
  display: flex;
  gap: 0.4rem;
  margin-top: 0.35rem;
  flex-wrap: wrap;
}
.quick-actions button {
  padding: 0.25rem 0.55rem;
  border: 1px solid #d0d7de;
  background: #f6f8fa;
  border-radius: 4px;
  cursor: pointer;
  font: inherit;
  font-size: 0.78rem;
}
.quick-actions button:hover {
  background: #eaeef2;
}
.entity-list {
  margin-top: 0.5rem;
  border: 1px solid #eaeef2;
  border-radius: 4px;
  padding: 0.3rem 0.4rem 0.4rem;
  background: #fbfcfd;
}
.entity-list__title {
  margin: 0 0 0.2rem;
  font-size: 0.72rem;
  color: #57606a;
  text-transform: uppercase;
  letter-spacing: 0.04em;
}
.entity-list ul {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 0.15rem;
  max-height: 8.5rem;
  overflow-y: auto;
}
.entity-list li {
  display: flex;
  align-items: stretch;
  gap: 0.25rem;
  border-radius: 3px;
}
.entity-list li.active {
  background: #ddf4ff;
  outline: 1px solid #0969da;
}
.entity-list__row {
  flex: 1;
  text-align: left;
  padding: 0.2rem 0.4rem;
  border: none;
  background: transparent;
  cursor: pointer;
  font: inherit;
  font-size: 0.8rem;
  color: #1f2328;
  border-radius: 3px;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.entity-list__row:hover {
  background: #eaeef2;
}
.entity-list__meta {
  color: #57606a;
  font-size: 0.72rem;
}
.entity-list__del {
  border: none;
  background: transparent;
  color: #57606a;
  cursor: pointer;
  font: inherit;
  font-size: 0.95rem;
  line-height: 1;
  padding: 0 0.4rem;
  border-radius: 3px;
}
.entity-list__del:hover {
  background: #ffebe9;
  color: #cf222e;
}
.hint {
  color: #57606a;
  font-size: 0.8rem;
  margin: 0.25rem 0;
}
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
.form label.checkbox {
  flex-direction: row;
  align-items: center;
  gap: 0.4rem;
}
.form label.checkbox span {
  color: #1f2328;
  font-size: 0.85rem;
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
.empty .howto {
  list-style: disc;
  padding-left: 1.25rem;
  margin: 0.25rem 0 0;
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  color: #1f2328;
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
