// SPDX-FileCopyrightText: The openTCS Authors
// SPDX-License-Identifier: MIT
//
// Minimal in-house toast bus.
//
// Why hand-rolled instead of Element Plus's `ElNotification`? S2 must avoid
// new runtime dependencies (architecture §1 row 13 says Element Plus is
// per-component on-demand; no other Element Plus component is needed yet).
// When the editor (S5+) starts pulling in real Element Plus components,
// this module's surface is small enough to re-implement on top of
// `ElNotification` without touching call sites — see `pushToast` /
// `useToasts` only.

import { reactive, readonly } from 'vue';

export type ToastLevel = 'info' | 'success' | 'warning' | 'error';

export interface Toast {
  /** Monotonically increasing id used as the v-for key. */
  id: number;
  level: ToastLevel;
  /** Short heading shown in bold. Optional. */
  title?: string;
  /** Body text. */
  message: string;
  /** ms after which the toast auto-dismisses. 0 / undefined = sticky. */
  durationMs?: number;
}

interface ToastState {
  items: Toast[];
}

const state: ToastState = reactive({ items: [] });
let nextId = 1;
const timers = new Map<number, ReturnType<typeof setTimeout>>();

/** Pushes a new toast and returns its id (so callers can dismiss early). */
export function pushToast(toast: Omit<Toast, 'id'>): number {
  const id = nextId++;
  const entry: Toast = { id, ...toast };
  state.items.push(entry);
  if (entry.durationMs && entry.durationMs > 0) {
    const timer = setTimeout(() => dismissToast(id), entry.durationMs);
    timers.set(id, timer);
  }
  return id;
}

/** Removes the toast with the given id (no-op if already gone). */
export function dismissToast(id: number): void {
  const timer = timers.get(id);
  if (timer) {
    clearTimeout(timer);
    timers.delete(id);
  }
  const idx = state.items.findIndex((t) => t.id === id);
  if (idx >= 0) {
    state.items.splice(idx, 1);
  }
}

/** Read-only handle used by the `<ToastContainer>` component. */
export function useToasts(): { items: Readonly<Toast[]> } {
  return { items: readonly(state.items) as Readonly<Toast[]> };
}

/* ----------------------- Convenience helpers ----------------------- */

const DEFAULT_DURATION_MS: Record<ToastLevel, number> = {
  info: 4000,
  success: 4000,
  warning: 6000,
  error: 0, // errors stay until dismissed
};

export function toastInfo(message: string, title?: string): number {
  return pushToast({ level: 'info', title, message, durationMs: DEFAULT_DURATION_MS.info });
}

export function toastSuccess(message: string, title?: string): number {
  return pushToast({ level: 'success', title, message, durationMs: DEFAULT_DURATION_MS.success });
}

export function toastWarning(message: string, title?: string): number {
  return pushToast({ level: 'warning', title, message, durationMs: DEFAULT_DURATION_MS.warning });
}

export function toastError(message: string, title?: string): number {
  return pushToast({ level: 'error', title, message, durationMs: DEFAULT_DURATION_MS.error });
}
