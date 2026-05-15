<script setup lang="ts">
// Root shell. S1 introduced a static hello page; S2 mounts a single Debug
// view that exercises the new HTTP / SSE infra. vue-router is intentionally
// not introduced yet (deferred to S3+ when multiple real views land).
import DebugView from '@/views/DebugView.vue';
import ToastContainer from '@/ui/toast/ToastContainer.vue';

const milestone = 'S2 · BFF 接口对接基础设施';
</script>

<template>
  <main class="app-shell">
    <header class="app-header">
      <h1>openTCS SPA</h1>
      <p class="milestone">{{ milestone }}</p>
    </header>
    <DebugView />
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
</style>
