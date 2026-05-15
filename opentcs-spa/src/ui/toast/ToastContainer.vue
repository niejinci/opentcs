<script setup lang="ts">
// Visual host for the in-house toast bus (see `toastBus.ts`). Mounted once
// from `App.vue`. Intentionally tiny — when Element Plus is introduced
// (S5+), swap the implementation without touching `pushToast` callers.
import { dismissToast, useToasts } from './toastBus';

const { items } = useToasts();
</script>

<template>
  <div class="toast-container" role="region" aria-label="Notifications">
    <div v-for="t in items" :key="t.id" class="toast" :class="`toast--${t.level}`" role="alert">
      <div class="toast__body">
        <p v-if="t.title" class="toast__title">{{ t.title }}</p>
        <p class="toast__message">{{ t.message }}</p>
      </div>
      <button
        type="button"
        class="toast__close"
        :aria-label="'Dismiss notification'"
        @click="dismissToast(t.id)"
      >
        ×
      </button>
    </div>
  </div>
</template>

<style scoped>
.toast-container {
  position: fixed;
  top: 1rem;
  right: 1rem;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  z-index: 9999;
  max-width: 380px;
  pointer-events: none;
}

.toast {
  pointer-events: auto;
  display: flex;
  align-items: flex-start;
  gap: 0.75rem;
  padding: 0.75rem 1rem;
  background: #ffffff;
  border-radius: 6px;
  border-left: 4px solid #57606a;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.12);
  font-size: 0.9rem;
  color: #1f2328;
}

.toast--info {
  border-left-color: #0969da;
}
.toast--success {
  border-left-color: #1a7f37;
}
.toast--warning {
  border-left-color: #bf8700;
}
.toast--error {
  border-left-color: #cf222e;
}

.toast__body {
  flex: 1 1 auto;
  min-width: 0;
}

.toast__title {
  margin: 0 0 0.25rem;
  font-weight: 600;
}

.toast__message {
  margin: 0;
  word-wrap: break-word;
  white-space: pre-wrap;
}

.toast__close {
  flex: 0 0 auto;
  background: none;
  border: 0;
  font-size: 1.25rem;
  line-height: 1;
  cursor: pointer;
  color: #57606a;
}

.toast__close:hover {
  color: #1f2328;
}
</style>
