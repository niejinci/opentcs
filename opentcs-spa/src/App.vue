<script setup lang="ts">
// S1 hello-world root component. Subsequent milestones replace this with
// <RouterView /> + a real shell (see docs/spa-frontend-architecture.md §2).
const bffBaseUrl = import.meta.env.VITE_BFF_BASE_URL ?? '(dev: vite proxy)';
const milestone = 'S1 · 项目脚手架';
</script>

<template>
  <main class="app-shell">
    <h1>openTCS SPA</h1>
    <p class="milestone">{{ milestone }}</p>
    <p class="bff">BFF base URL: {{ bffBaseUrl }}</p>
    <p class="hint">下一步（S2）：实现 HTTP / SSE client，调用 <code>/health</code> 自检。</p>
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
  max-width: 720px;
  margin: 4rem auto;
  padding: 0 1rem;
  color: #1f2328;
}

h1 {
  font-size: 2rem;
  margin-bottom: 0.5rem;
}

.milestone {
  color: #57606a;
  margin: 0 0 1.5rem;
}

.bff,
.hint {
  margin: 0.25rem 0;
}

code {
  background: #f6f8fa;
  padding: 0.1rem 0.35rem;
  border-radius: 4px;
}
</style>
