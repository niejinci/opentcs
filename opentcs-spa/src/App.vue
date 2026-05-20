<script setup lang="ts">
// Root shell. S3 introduces vue-router and a top nav switching between
// the new ImportView and the S2 DebugView. Each view stays a leaf
// component reachable only through its route.

import { RouterLink, RouterView } from 'vue-router';

import ToastContainer from '@/ui/toast/ToastContainer.vue';

const milestone = 'S3 · 地图导入：三件套上传 + yaml 解析 + 仿射映射';
</script>

<template>
  <main class="app-shell">
    <header class="app-header">
      <div>
        <h1>openTCS SPA</h1>
        <p class="milestone">{{ milestone }}</p>
      </div>
      <nav class="app-nav">
        <RouterLink to="/import">地图导入</RouterLink>
        <RouterLink to="/debug">BFF 调试</RouterLink>
      </nav>
    </header>
    <RouterView />
    <ToastContainer />
  </main>
</template>

<style scoped>
.app-shell {
  font-family:
    system-ui,
    -apple-system,
    Segoe UI,
    Roboto,
    sans-serif;
  color: #1f2328;
  min-height: 100vh;
  background: #f6f8fa;
}

.app-header {
  max-width: 880px;
  margin: 0 auto;
  padding: 1.5rem 1rem 0;
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 1rem;
  flex-wrap: wrap;
}

.app-header h1 {
  font-size: 1.5rem;
  margin: 0;
}

.milestone {
  color: #57606a;
  margin: 0.25rem 0 0;
  font-size: 0.95rem;
}

.app-nav {
  display: flex;
  gap: 0.75rem;
  font-size: 0.95rem;
}

.app-nav :deep(a) {
  padding: 0.3rem 0.75rem;
  border-radius: 6px;
  border: 1px solid transparent;
  color: #57606a;
  text-decoration: none;
}

.app-nav :deep(a:hover) {
  background: #eaeef2;
  color: #1f2328;
}

.app-nav :deep(a.router-link-active) {
  border-color: #d0d7de;
  background: #ffffff;
  color: #1f2328;
  font-weight: 600;
}
</style>
