<script setup lang="ts">
// SPDX-FileCopyrightText: The openTCS Authors
// SPDX-License-Identifier: MIT

import { computed } from 'vue';

import { toastError, toastSuccess } from '@/ui/toast/toastBus';

const props = defineProps<{
  label: string;
  value: string | number | boolean | null | undefined;
}>();

const displayValue = computed(() => {
  if (props.value === null || props.value === undefined || props.value === '') return '-';
  return String(props.value);
});

async function copyValue(): Promise<void> {
  try {
    await navigator.clipboard.writeText(displayValue.value);
    toastSuccess('已复制' + props.label, '复制字段');
  } catch {
    toastError('复制失败，请确认浏览器剪贴板权限', '复制字段');
  }
}
</script>

<template>
  <dd class="copyable-value">
    <span>{{ displayValue }}</span>
    <button type="button" :aria-label="'复制' + label" @click="copyValue">复制</button>
  </dd>
</template>

<style scoped>
.copyable-value {
  min-width: 0;
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: start;
  gap: 0.45rem;
  margin: 0;
  color: #1f2328;
  overflow-wrap: anywhere;
}
.copyable-value span {
  min-width: 0;
  overflow-wrap: anywhere;
}
.copyable-value button {
  border: 1px solid #d0d7de;
  border-radius: 5px;
  background: #f6f8fa;
  color: #0969da;
  cursor: pointer;
  font: inherit;
  font-size: 0.76rem;
  line-height: 1.2;
  padding: 0.12rem 0.35rem;
}
.copyable-value button:hover {
  background: #ddf4ff;
}
</style>
