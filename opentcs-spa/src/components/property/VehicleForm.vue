<script setup lang="ts">
// SPDX-FileCopyrightText: The openTCS Authors
// SPDX-License-Identifier: MIT
//
// VehicleForm — edits a selected DraftVehicle.
//
// VehicleCreationTO has no canvas position (poses materialise at runtime),
// so `layout.pixelX/Y/orientationDeg` are editor-only — the S8 publish
// converter drops them. Speeds + boundingBox dimensions are stored in mm
// / mm·s⁻¹ exactly as the TO expects.

import { computed, ref, watch } from 'vue';

import { useProjectStore } from '@/stores/project';
import { toastError } from '@/ui/toast/toastBus';

const store = useProjectStore();

const selected = computed(() => {
  const sel = store.selection;
  if (!sel || sel.kind !== 'vehicle') return null;
  return store.findVehicle(sel.name) ?? null;
});

const form = ref({
  name: '',
  boundingBoxLength: 1000,
  boundingBoxWidth: 1000,
  boundingBoxHeight: 1000,
  maxVelocity: 1000,
  maxReverseVelocity: 1000,
  envelopeKey: '',
  orientationDeg: 0,
  routeColorRgb: '#0969da',
  energyLevelCritical: 30,
  energyLevelGood: 90,
  energyLevelSufficientlyRecharged: 30,
  energyLevelFullyRecharged: 90,
});

watch(
  selected,
  (v) => {
    if (!v) return;
    form.value = {
      name: v.name,
      boundingBoxLength: v.boundingBox.length,
      boundingBoxWidth: v.boundingBox.width,
      boundingBoxHeight: v.boundingBox.height,
      maxVelocity: v.maxVelocity,
      maxReverseVelocity: v.maxReverseVelocity,
      envelopeKey: v.envelopeKey,
      orientationDeg: v.layout.orientationDeg,
      routeColorRgb: v.layout.routeColorRgb,
      energyLevelCritical: v.energyLevelThresholdSet.energyLevelCritical,
      energyLevelGood: v.energyLevelThresholdSet.energyLevelGood,
      energyLevelSufficientlyRecharged: v.energyLevelThresholdSet.energyLevelSufficientlyRecharged,
      energyLevelFullyRecharged: v.energyLevelThresholdSet.energyLevelFullyRecharged,
    };
  },
  { immediate: true },
);

function commitName(): void {
  const v = selected.value;
  if (!v) return;
  const next = form.value.name.trim();
  if (next === v.name) return;
  const res = store.renameVehicle(v.name, next);
  if (!res.ok) {
    toastError(res.error ?? '重命名失败', 'Vehicle');
    form.value.name = v.name;
  }
}

type NumericField = Exclude<keyof typeof form.value, 'name' | 'envelopeKey' | 'routeColorRgb'>;

function commitNumber(field: NumericField, min: number): void {
  const v = selected.value;
  if (!v) return;
  const raw = form.value[field];
  const num = Number(raw);
  if (!Number.isFinite(num) || num < min) {
    toastError(`${field} 必须 ≥ ${min}`, 'Vehicle');
    // Revert from store
    switch (field) {
      case 'boundingBoxLength':
        form.value.boundingBoxLength = v.boundingBox.length;
        break;
      case 'boundingBoxWidth':
        form.value.boundingBoxWidth = v.boundingBox.width;
        break;
      case 'boundingBoxHeight':
        form.value.boundingBoxHeight = v.boundingBox.height;
        break;
      case 'maxVelocity':
        form.value.maxVelocity = v.maxVelocity;
        break;
      case 'maxReverseVelocity':
        form.value.maxReverseVelocity = v.maxReverseVelocity;
        break;
      case 'orientationDeg':
        form.value.orientationDeg = v.layout.orientationDeg;
        break;
      case 'energyLevelCritical':
        form.value.energyLevelCritical = v.energyLevelThresholdSet.energyLevelCritical;
        break;
      case 'energyLevelGood':
        form.value.energyLevelGood = v.energyLevelThresholdSet.energyLevelGood;
        break;
      case 'energyLevelSufficientlyRecharged':
        form.value.energyLevelSufficientlyRecharged =
          v.energyLevelThresholdSet.energyLevelSufficientlyRecharged;
        break;
      case 'energyLevelFullyRecharged':
        form.value.energyLevelFullyRecharged = v.energyLevelThresholdSet.energyLevelFullyRecharged;
        break;
    }
    return;
  }
  store.updateVehicleFields(v.name, { [field]: num });
}

function commitEnvelopeKey(): void {
  const v = selected.value;
  if (!v) return;
  store.updateVehicleFields(v.name, { envelopeKey: form.value.envelopeKey });
}

function commitColor(): void {
  const v = selected.value;
  if (!v) return;
  store.updateVehicleFields(v.name, { routeColorRgb: form.value.routeColorRgb });
}

function onDelete(): void {
  store.deleteSelected();
}
</script>

<template>
  <section v-if="selected" class="form" data-kind="vehicle">
    <h4>
      Vehicle · <code>{{ selected.name }}</code>
    </h4>
    <label>
      <span>name</span>
      <input v-model="form.name" type="text" @change="commitName" />
    </label>
    <fieldset>
      <legend>boundingBox (mm)</legend>
      <div class="row3">
        <label>
          <span>length</span>
          <input
            v-model.number="form.boundingBoxLength"
            type="number"
            min="1"
            step="10"
            @change="commitNumber('boundingBoxLength', 1)"
          />
        </label>
        <label>
          <span>width</span>
          <input
            v-model.number="form.boundingBoxWidth"
            type="number"
            min="1"
            step="10"
            @change="commitNumber('boundingBoxWidth', 1)"
          />
        </label>
        <label>
          <span>height</span>
          <input
            v-model.number="form.boundingBoxHeight"
            type="number"
            min="1"
            step="10"
            @change="commitNumber('boundingBoxHeight', 1)"
          />
        </label>
      </div>
    </fieldset>
    <div class="row">
      <label>
        <span>maxVelocity (mm/s)</span>
        <input
          v-model.number="form.maxVelocity"
          type="number"
          min="0"
          step="50"
          @change="commitNumber('maxVelocity', 0)"
        />
      </label>
      <label>
        <span>maxReverseVelocity</span>
        <input
          v-model.number="form.maxReverseVelocity"
          type="number"
          min="0"
          step="50"
          @change="commitNumber('maxReverseVelocity', 0)"
        />
      </label>
    </div>
    <label>
      <span>envelopeKey（留空 = 默认）</span>
      <input v-model="form.envelopeKey" type="text" @change="commitEnvelopeKey" />
    </label>
    <div class="row">
      <label>
        <span>layout.orientation (°)</span>
        <input
          v-model.number="form.orientationDeg"
          type="number"
          step="1"
          @change="commitNumber('orientationDeg', -360)"
        />
      </label>
      <label>
        <span>layout.routeColor</span>
        <input v-model="form.routeColorRgb" type="color" @change="commitColor" />
      </label>
    </div>
    <fieldset>
      <legend>energyLevelThresholdSet (%)</legend>
      <div class="row2x2">
        <label>
          <span>critical</span>
          <input
            v-model.number="form.energyLevelCritical"
            type="number"
            min="0"
            max="100"
            @change="commitNumber('energyLevelCritical', 0)"
          />
        </label>
        <label>
          <span>good</span>
          <input
            v-model.number="form.energyLevelGood"
            type="number"
            min="0"
            max="100"
            @change="commitNumber('energyLevelGood', 0)"
          />
        </label>
        <label>
          <span>sufficientlyRecharged</span>
          <input
            v-model.number="form.energyLevelSufficientlyRecharged"
            type="number"
            min="0"
            max="100"
            @change="commitNumber('energyLevelSufficientlyRecharged', 0)"
          />
        </label>
        <label>
          <span>fullyRecharged</span>
          <input
            v-model.number="form.energyLevelFullyRecharged"
            type="number"
            min="0"
            max="100"
            @change="commitNumber('energyLevelFullyRecharged', 0)"
          />
        </label>
      </div>
    </fieldset>
    <p class="hint">
      pixel: ({{ selected.layout.pixelX.toFixed(1) }}, {{ selected.layout.pixelY.toFixed(1) }}) —
      拖动画布上车体或在选择工具下拖拽可调位置
    </p>
    <button class="danger" type="button" @click="onDelete">删除此 Vehicle</button>
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
.form input[type='number'] {
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
fieldset {
  border: 1px solid #eaeef2;
  border-radius: 4px;
  padding: 0.4rem 0.6rem;
  margin: 0;
}
fieldset legend {
  font-size: 0.78rem;
  color: #57606a;
  padding: 0 0.25rem;
}
.row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0.5rem;
}
.row3 {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 0.5rem;
}
.row2x2 {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0.5rem;
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
