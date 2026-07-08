<script setup lang="ts">
import { RouterLink, RouterView } from 'vue-router';
</script>

<template>
  <section class="warehouse-shell">
    <header class="warehouse-header">
      <div>
        <h2>货架管理</h2>
        <p>维护货架型号与现场货架实例，创建任务参数弹窗会复用这里的货架型号。</p>
      </div>
      <nav class="warehouse-tabs" aria-label="货架管理子页面">
        <RouterLink :to="{ name: 'warehouse-types' }">货架型号</RouterLink>
        <RouterLink :to="{ name: 'warehouse-racks' }">货架列表</RouterLink>
      </nav>
    </header>

    <RouterView />
  </section>
</template>

<style scoped>
.warehouse-shell {
  min-height: calc(100vh - 5.5rem);
  padding: 0.85rem;
}

.warehouse-header {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 1rem;
  flex-wrap: wrap;
  margin-bottom: 0.8rem;
}

.warehouse-header h2 {
  margin: 0;
  font-size: 1.28rem;
}

.warehouse-header p {
  margin: 0.25rem 0 0;
  color: #6e7781;
  font-size: 0.88rem;
}

.warehouse-tabs {
  display: inline-flex;
  gap: 0.45rem;
  padding: 0.25rem;
  border: 1px solid #d8dee7;
  border-radius: 8px;
  background: #ffffff;
}

.warehouse-tabs :deep(a) {
  padding: 0.42rem 0.85rem;
  border-radius: 6px;
  color: #57606a;
  font-size: 0.9rem;
  text-decoration: none;
}

.warehouse-tabs :deep(a.router-link-active) {
  background: #fff1ed;
  color: #ff4d1d;
  font-weight: 700;
}
</style>
