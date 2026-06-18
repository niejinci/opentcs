<!-- SPDX-FileCopyrightText: The openTCS Authors -->
<!-- SPDX-License-Identifier: MIT -->
<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';

import { sendInstantActions } from '@/api/endpoints/vehicles';
import { HttpError } from '@/api/errors';
import type { Vehicle } from '@/api/types/bff';
import {
  createBlankInstantActionFormState,
  filterInstantActionTemplates,
  findInstantActionTemplate,
  formStateToInstantActionsRequest,
  INSTANT_ACTION_TEMPLATES,
  type InstantActionFormState,
  type InstantActionParamKind,
  type InstantActionParameterFormRow,
  templateToFormState,
} from '@/domain/instantActions';
import { toastError, toastSuccess } from '@/ui/toast/toastBus';

const props = defineProps<{
  vehicle: Vehicle | null;
}>();

const instantActionSearch = ref('');
const instantActionBusy = ref(false);
const selectedTemplateId = ref('');
const templateListOpen = ref(false);
const templateSearchDirty = ref(false);
const templateCombobox = ref<HTMLElement | null>(null);
let nextInstantParamRowId = 1;

function nextInstantActionRowId(): number {
  return nextInstantParamRowId++;
}

const instantActionForm = ref<InstantActionFormState>(
  createBlankInstantActionFormState(nextInstantActionRowId),
);

const filteredTemplates = computed(() => filterInstantActionTemplates(instantActionSearch.value));
const visibleTemplates = computed(() =>
  templateSearchDirty.value ? filteredTemplates.value : INSTANT_ACTION_TEMPLATES,
);

const canSendInstantAction = computed(() => {
  if (instantActionBusy.value) return false;
  if (!props.vehicle) return false;
  if (!instantActionForm.value.actionType.trim()) return false;
  if (!instantActionForm.value.actionId.trim()) return false;
  return instantActionForm.value.parameters.every((row) => row.key.trim());
});

function selectTemplate(templateId: string): void {
  const template = findInstantActionTemplate(templateId);
  if (!template) return;

  selectedTemplateId.value = template.templateId;
  instantActionSearch.value = template.actionType;
  templateSearchDirty.value = false;
  templateListOpen.value = false;
  instantActionForm.value = templateToFormState(template, nextInstantActionRowId);
}

function removeParameter(rowId: number): void {
  instantActionForm.value.parameters = instantActionForm.value.parameters.filter(
    (row) => row.id !== rowId,
  );
}

function onParameterKindChanged(row: InstantActionParameterFormRow, kind: InstantActionParamKind): void {
  row.kind = kind;
  const text = String(row.valueText ?? '');
  if (kind === 'boolean' && !['true', 'false'].includes(text)) {
    row.valueText = 'true';
  }
  if (kind === 'array' && text.trim() === '') {
    row.valueText = '[]';
  }
}

function onTemplateInput(): void {
  templateListOpen.value = true;
  const template = findInstantActionTemplate(instantActionForm.value.actionType);
  if (!template) return;
  if (template.templateId !== selectedTemplateId.value) {
    selectedTemplateId.value = template.templateId;
    instantActionForm.value.actionDescription = template.actionDescription;
    instantActionForm.value.blockingType = template.blockingType;
    instantActionForm.value.parameters = templateToFormState(template, nextInstantActionRowId).parameters;
  }
}

function openTemplateList(): void {
  templateSearchDirty.value = false;
  templateListOpen.value = true;
}

function onTemplateSearchInput(): void {
  templateSearchDirty.value = true;
  templateListOpen.value = true;
}

function closeTemplateList(event: MouseEvent): void {
  if (!templateCombobox.value?.contains(event.target as Node)) {
    templateListOpen.value = false;
  }
}

onMounted(() => {
  window.addEventListener('mousedown', closeTemplateList);
});

onBeforeUnmount(() => {
  window.removeEventListener('mousedown', closeTemplateList);
});

async function submitInstantAction(): Promise<void> {
  if (!props.vehicle || !canSendInstantAction.value) return;

  let request;
  try {
    request = formStateToInstantActionsRequest(instantActionForm.value);
  } catch (err) {
    toastError((err as Error).message, '即时动作参数错误');
    return;
  }

  instantActionBusy.value = true;
  try {
    await sendInstantActions(props.vehicle.name, request, { toastOnError: false });
    toastSuccess(`已下发即时动作 ${request.actions[0].actionType}`, 'VDA5050');
    instantActionForm.value.actionId = crypto.randomUUID();
  } catch (err) {
    if (err instanceof HttpError) {
      const code = err.payload?.code ?? `HTTP_${err.status}`;
      const msg = err.payload?.message ?? err.statusText;
      toastError(`${code}: ${msg}`, '即时动作下发失败');
    } else {
      toastError('即时动作下发失败，请检查网络');
    }
  } finally {
    instantActionBusy.value = false;
  }
}
</script>

<template>
  <section class="instant-actions" aria-labelledby="instant-actions-title">
    <div class="instant-actions-hdr">
      <div>
        <h3 id="instant-actions-title">VDA5050 即时动作</h3>
        <p>目标车辆：{{ vehicle?.name || '请选择车辆' }}</p>
      </div>
    </div>

    <label class="template-search">
      Action Type 搜索
      <div ref="templateCombobox" class="template-combobox">
        <input
          v-model="instantActionSearch"
          placeholder="输入 actionType 搜索"
          spellcheck="false"
          @focus="openTemplateList"
          @input="onTemplateSearchInput"
          @keydown.escape="templateListOpen = false"
        />
        <button type="button" class="template-toggle" aria-label="展开候选" @mousedown.prevent="openTemplateList">
          ▾
        </button>
        <div v-if="templateListOpen" class="template-popup" role="listbox">
          <button
            v-for="template in visibleTemplates"
            :key="template.templateId"
            type="button"
            class="template-option"
            @mousedown.prevent="selectTemplate(template.templateId)"
          >
            <strong>{{ template.actionType }}</strong>
            <span>{{ template.actionDescription }}</span>
          </button>
          <p v-if="visibleTemplates.length === 0" class="template-empty">无匹配模板</p>
        </div>
      </div>
    </label>

    <div class="instant-grid">
      <label>
        Action Type
        <input
          v-model="instantActionForm.actionType"
          placeholder="stateRequest / cancelOrder / ..."
          spellcheck="false"
          @input="onTemplateInput"
        />
      </label>
      <label>
        Action ID
        <input v-model="instantActionForm.actionId" spellcheck="false" />
      </label>
      <label>
        Blocking Type
        <select v-model="instantActionForm.blockingType">
          <option value="NONE">NONE</option>
          <option value="SOFT">SOFT</option>
          <option value="HARD">HARD</option>
        </select>
      </label>
      <label>
        Description
        <input v-model="instantActionForm.actionDescription" spellcheck="false" />
      </label>
    </div>

    <div class="instant-param-list">
        <div
          v-for="row in instantActionForm.parameters"
          :key="row.id"
          class="instant-param-row"
        >
        <div class="param-key-cell">
          <input v-model="row.key" placeholder="key" spellcheck="false" />
        </div>

        <select :value="row.kind" @change="onParameterKindChanged(row, ($event.target as HTMLSelectElement).value as InstantActionParamKind)">
          <option value="string">string</option>
          <option value="number">number</option>
          <option value="boolean">boolean</option>
          <option value="array">array</option>
        </select>

        <select v-if="row.kind === 'boolean'" v-model="row.valueText">
          <option value="true">true</option>
          <option value="false">false</option>
        </select>
        <input
          v-else
          v-model="row.valueText"
          class="param-value"
          :type="row.kind === 'number' ? 'number' : 'text'"
          :min="row.kind === 'number' ? row.min : undefined"
          :max="row.kind === 'number' ? row.max : undefined"
          :step="row.kind === 'number' ? row.step ?? 'any' : undefined"
          :placeholder="row.kind === 'array' ? '[&quot;a&quot;, 1, true]' : 'value'"
          spellcheck="false"
        />

        <p class="param-description">
          {{ row.optional ? '可选参数' : '必填参数' }} · {{ row.description || '自定义参数' }}
        </p>

        <button type="button" @click="removeParameter(row.id)">
          ×
        </button>
      </div>
    </div>

    <div class="instant-actions-footer">
      <span class="hint">
        array 仅支持 string / number / boolean 元素，提交前会由 BFF 进行严格 JSON Schema 校验。
      </span>
      <button
        type="button"
        class="instant-submit"
        :disabled="!canSendInstantAction"
        @click="submitInstantAction"
      >
        {{ instantActionBusy ? '下发中…' : '下发即时动作' }}
      </button>
    </div>
  </section>
</template>

<style scoped>
.instant-actions {
  background: #fff;
  border: 1px solid #d0d7de;
  border-radius: 6px;
  padding: 0.6rem 0.85rem 0.85rem;
}
.instant-actions-hdr {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 0.75rem;
  margin-bottom: 0.6rem;
}
.instant-actions-hdr h3 {
  margin: 0;
  font-size: 1rem;
}
.instant-actions-hdr p {
  margin: 0.15rem 0 0;
  color: #6e7781;
  font-size: 0.8rem;
}
.instant-actions-hdr button {
  border: 1px solid #d0d7de;
  background: #f6f8fa;
  padding: 0.2rem 0.55rem;
  font-size: 0.85rem;
  border-radius: 4px;
  cursor: pointer;
}
.template-search {
  display: flex;
  flex-direction: column;
  gap: 0.2rem;
  font-size: 0.82rem;
  font-weight: 600;
  color: #57606a;
}
.template-combobox {
  position: relative;
  display: flex;
  align-items: stretch;
  min-width: 0;
}
.template-combobox input,
.template-toggle {
  border: 1px solid #d0d7de;
  background: #fff;
  font-size: 0.88rem;
}
.template-combobox input {
  flex: 1 1 auto;
  min-width: 0;
  border-radius: 4px 0 0 4px;
  padding: 0.3rem 0.45rem;
}
.template-toggle {
  flex: 0 0 2rem;
  border-left: 0;
  border-radius: 0 4px 4px 0;
  cursor: pointer;
}
.template-popup {
  position: absolute;
  z-index: 10;
  left: 0;
  right: 0;
  top: calc(100% + 0.25rem);
  background: #fff;
  border: 1px solid #d0d7de;
  border-radius: 6px;
  box-shadow: 0 8px 24px rgba(31, 35, 40, 0.12);
  max-height: 18rem;
  overflow: auto;
}
.template-option {
  width: 100%;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 0.1rem;
  padding: 0.45rem 0.55rem;
  border: 0;
  background: #fff;
  text-align: left;
  cursor: pointer;
}
.template-option:hover {
  background: #ddf4ff;
}
.template-option strong {
  font-size: 0.85rem;
}
.template-option span,
.template-empty {
  font-size: 0.76rem;
  color: #57606a;
}
.template-empty {
  margin: 0;
  padding: 0.5rem 0.55rem;
}
.template-search input,
.instant-grid input,
.instant-grid select,
.instant-param-row input,
.instant-param-row select {
  min-width: 0;
  border: 1px solid #d0d7de;
  border-radius: 4px;
  padding: 0.3rem 0.45rem;
  font-size: 0.88rem;
}
.instant-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.55rem 0.75rem;
}
.instant-grid label {
  display: flex;
  flex-direction: column;
  gap: 0.2rem;
  font-size: 0.82rem;
  font-weight: 600;
  color: #57606a;
}
.instant-param-list {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
  margin-top: 0.65rem;
}
.instant-param-row {
  display: grid;
  grid-template-columns: minmax(9rem, 1fr) 7rem minmax(0, 1fr) minmax(16rem, 1.2fr) auto;
  gap: 0.35rem;
  align-items: center;
}
.param-key-cell {
  display: flex;
  align-items: center;
  gap: 0.45rem;
  min-width: 0;
}
.param-key-cell label {
  font-size: 0.78rem;
  color: #57606a;
  display: inline-flex;
  gap: 0.2rem;
  align-items: center;
  white-space: nowrap;
}
.param-description {
  margin: 0;
  color: #57606a;
  font-size: 0.78rem;
}
.instant-actions-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  margin-top: 0.65rem;
}
.instant-submit {
  flex: 0 0 auto;
  background: #0969da;
  color: #fff;
  border: 1px solid #0969da;
  padding: 0.35rem 0.9rem;
  border-radius: 6px;
  font-size: 0.88rem;
  cursor: pointer;
}
.instant-submit:disabled {
  background: #8cbded;
  border-color: #8cbded;
  cursor: not-allowed;
}
.hint {
  font-size: 0.8rem;
  color: #6e7781;
}
@media (max-width: 760px) {
  .instant-grid,
  .instant-param-row {
    grid-template-columns: 1fr;
  }
  .instant-actions-footer {
    align-items: stretch;
    flex-direction: column;
  }
}
</style>
