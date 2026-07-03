<script setup lang="ts">
import { ref, watch } from 'vue';

import {
  CHARGE_DURATION_VALIDATION_MESSAGE,
  createEmptyTaskParams,
  isValidChargeDurationMinutes,
  MAX_CHARGE_DURATION_MINUTES,
  MIN_CHARGE_DURATION_MINUTES,
  type TaskParams,
} from '@/domain/tasks/createTask';

const props = defineProps<{
  modelValue: TaskParams;
}>();

const emit = defineEmits<{
  'update:modelValue': [value: TaskParams];
  close: [];
}>();

const draft = ref<TaskParams>({ ...props.modelValue });
const chargeDurationError = ref('');

watch(
  () => props.modelValue,
  (next) => {
    draft.value = { ...next };
    chargeDurationError.value = '';
  },
  { deep: true },
);

watch(
  () => draft.value.chargeDurationMinutes,
  (next) => {
    if (chargeDurationError.value && isValidChargeDurationMinutes(next)) {
      chargeDurationError.value = '';
    }
  },
);
function clearDraft(): void {
  draft.value = createEmptyTaskParams();
  chargeDurationError.value = '';
}

function cancel(): void {
  emit('close');
}

function normalizedParams(): TaskParams {
  return {
    ...draft.value,
    chargeDurationMinutes: String(draft.value.chargeDurationMinutes ?? '').trim(),
  };
}

function confirm(): void {
  const nextParams = normalizedParams();
  if (!isValidChargeDurationMinutes(nextParams.chargeDurationMinutes)) {
    chargeDurationError.value = CHARGE_DURATION_VALIDATION_MESSAGE;
    return;
  }

  emit('update:modelValue', nextParams);
  emit('close');
}
</script>

<template>
  <div class="param-backdrop" role="presentation">
    <section class="param-dialog" role="dialog" aria-modal="true" aria-labelledby="param-title">
      <header class="param-header">
        <h2 id="param-title">参数</h2>
        <button type="button" class="close-button" aria-label="关闭" @click="cancel">×</button>
      </header>

      <div class="param-actions">
        <button type="button" class="clear-button" @click="clearDraft">清空数据</button>
      </div>

      <div class="param-grid">
        <label>
          <span class="field-label">货架编号<small>LoadId</small></span>
          <input v-model.trim="draft.loadId" autocomplete="off" />
        </label>
        <label>
          <span class="field-label">货架型号<small>loadType</small></span>
          <input v-model.trim="draft.loadType" autocomplete="off" />
        </label>
        <label>
          <span class="field-label field-label--inline">顶升/下降高度<small>(米)</small></span>
          <input v-model.trim="draft.height" inputmode="decimal" autocomplete="off" />
        </label>
        <label>
          <span class="field-label">充电时长（分钟）</span>
          <div class="field-control">
            <input
              v-model.trim="draft.chargeDurationMinutes"
              type="number"
              :min="MIN_CHARGE_DURATION_MINUTES"
              :max="MAX_CHARGE_DURATION_MINUTES"
              step="1"
              inputmode="numeric"
              autocomplete="off"
              :aria-invalid="chargeDurationError ? 'true' : undefined"
              aria-describedby="charge-duration-error"
              :class="{ 'input--invalid': chargeDurationError }"
            />
            <p v-if="chargeDurationError" id="charge-duration-error" class="field-error">
              {{ chargeDurationError }}
            </p>
          </div>
        </label>
      </div>

      <footer class="param-footer">
        <button type="button" class="cancel-button" @click="cancel">取消</button>
        <button type="button" class="confirm-button" @click="confirm">确定</button>
      </footer>
    </section>
  </div>
</template>

<style scoped>
.param-backdrop {
  position: fixed;
  inset: 0;
  z-index: 50;
  display: flex;
  align-items: stretch;
  justify-content: center;
  background: rgba(246, 248, 250, 0.42);
}

.param-dialog {
  width: min(92rem, calc(100vw - 2rem));
  height: min(42rem, calc(100vh - 2rem));
  margin-top: 1rem;
  background: #ffffff;
  border: 1px solid #d8dee7;
  border-radius: 4px;
  box-shadow: 0 18px 46px rgba(31, 35, 40, 0.18);
  display: grid;
  grid-template-rows: auto auto minmax(0, 1fr) auto;
  color: #5f6670;
}

.param-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 1.35rem 1.25rem 0.75rem;
}

.param-header h2 {
  margin: 0;
  color: #ff4d1d;
  font-size: 1.45rem;
  font-weight: 500;
}

.close-button {
  border: 0;
  background: transparent;
  color: #777f89;
  font-size: 2rem;
  line-height: 1;
  cursor: pointer;
}

.param-actions {
  padding: 1rem 1.25rem;
}

.clear-button {
  height: 3.55rem;
  min-width: 9.2rem;
  border: 1px solid #ff9b91;
  border-radius: 4px;
  background: #fff1f0;
  color: #ff2525;
  font-size: 1.05rem;
  font-weight: 650;
  cursor: pointer;
}

.param-grid {
  min-height: 0;
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  align-content: start;
  gap: 2.3rem 4.4rem;
  padding: 1.25rem 2rem 2rem;
}

label {
  min-width: 0;
  display: grid;
  grid-template-columns: minmax(8rem, 10.5rem) minmax(0, 1fr);
  align-items: center;
  gap: 1.2rem;
}

.field-label {
  color: #5c636d;
  font-size: 1.05rem;
  font-weight: 650;
  line-height: 1.25;
  text-align: right;
}

.field-label small {
  display: block;
  color: inherit;
  font: inherit;
}

.field-label--inline {
  white-space: nowrap;
}

.field-label--inline small {
  display: inline;
}

.field-control {
  min-width: 0;
}

.field-error {
  margin: 0.45rem 0 0;
  color: #ff4d1d;
  font-size: 0.92rem;
  font-weight: 650;
  line-height: 1.25;
}

input {
  width: 100%;
  min-width: 0;
  height: 3.25rem;
  padding: 0 0.85rem;
  border: 1px solid #d8dee7;
  border-radius: 4px;
  color: #24292f;
  font: inherit;
}

input:focus {
  border-color: #ff6a3a;
  outline: none;
}

.input--invalid,
.input--invalid:focus {
  border-color: #ff4d1d;
  background: #fff7f5;
}

.param-footer {
  display: flex;
  justify-content: flex-end;
  gap: 1rem;
  padding: 1rem 1.8rem 1.25rem;
}

.cancel-button,
.confirm-button {
  min-width: 6.6rem;
  height: 3.2rem;
  border-radius: 4px;
  font-size: 1.05rem;
  font-weight: 650;
  cursor: pointer;
}

.cancel-button {
  border: 1px solid #d8dee7;
  background: #ffffff;
  color: #69717c;
}

.confirm-button {
  border: 1px solid #ff5a1f;
  background: #ff5a1f;
  color: #ffffff;
}

@media (max-width: 980px) {
  .param-grid {
    grid-template-columns: 1fr;
    gap: 1rem;
  }

  label {
    grid-template-columns: 10.5rem minmax(0, 1fr);
  }
}
</style>
