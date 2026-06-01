// SPDX-FileCopyrightText: The openTCS Authors
// SPDX-License-Identifier: MIT
//
// Vitest config — introduced in PR3 alongside the timeline-dedup fix and
// the new VehicleStatusPanel. Keeps environment / alias setup in lockstep
// with `vite.config.ts` so tests resolve `@/` exactly like the app.

import { fileURLToPath, URL } from 'node:url';
import { defineConfig } from 'vitest/config';
import vue from '@vitejs/plugin-vue';

export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  test: {
    environment: 'jsdom',
    globals: false,
    include: ['src/**/*.{test,spec}.ts'],
    css: false,
  },
});
