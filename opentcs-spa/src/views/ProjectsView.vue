<script setup lang="ts">
// SPDX-FileCopyrightText: The openTCS Authors
// SPDX-License-Identifier: MIT
//
// ProjectsView — S7 project catalogue. List, create, open, rename, copy,
// delete. Native `<dialog>` is used for prompts to avoid pulling in
// Element Plus or another UI lib for a single screen.

import { onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';

import { HttpError } from '@/api/errors';
import { useProjectsStore } from '@/stores/projects';
import { toastError, toastInfo } from '@/ui/toast/toastBus';

const projects = useProjectsStore();
const router = useRouter();

const newName = ref('');
const newId = ref('');
const renameTarget = ref<string | null>(null);
const renameValue = ref('');
const copyTarget = ref<string | null>(null);
const copyName = ref('');

onMounted(() => {
  void refresh();
});

async function refresh(): Promise<void> {
  try {
    await projects.refresh();
  } catch {
    /* toast handled by HTTP client */
  }
}

async function create(): Promise<void> {
  const name = newName.value.trim();
  if (!name) return;
  try {
    const meta = await projects.create(name, newId.value.trim() || undefined);
    newName.value = '';
    newId.value = '';
    toastInfo(`已创建工程 ${meta.name}`);
    open(meta.id);
  } catch (err) {
    if (err instanceof HttpError && err.status === 409) {
      toastError('工程 ID 已存在', '创建失败');
    }
  }
}

async function open(id: string): Promise<void> {
  try {
    await projects.setCurrent(id);
    await router.push({ name: 'editor', params: { projectId: id } });
  } catch {
    /* toast handled */
  }
}

async function publish(id: string): Promise<void> {
  await router.push({ name: 'project-publish', params: { projectId: id } });
}

function startRename(id: string, currentName: string): void {
  renameTarget.value = id;
  renameValue.value = currentName;
}

async function confirmRename(): Promise<void> {
  const id = renameTarget.value;
  const name = renameValue.value.trim();
  if (!id || !name) {
    renameTarget.value = null;
    return;
  }
  try {
    // Set as current temporarily so renameCurrent() works on any list row.
    await projects.setCurrent(id);
    await projects.renameCurrent(name);
    toastInfo(`已重命名为 ${name}`);
  } catch {
    /* toast handled */
  } finally {
    renameTarget.value = null;
  }
}

function startCopy(id: string, currentName: string): void {
  copyTarget.value = id;
  copyName.value = `${currentName} 副本`;
}

async function confirmCopy(): Promise<void> {
  const id = copyTarget.value;
  const name = copyName.value.trim();
  if (!id || !name) {
    copyTarget.value = null;
    return;
  }
  try {
    await projects.setCurrent(id);
    const meta = await projects.copyCurrent(name);
    toastInfo(`已另存为 ${meta.name}`);
  } catch (err) {
    if (err instanceof HttpError && err.status === 409) {
      toastError('新工程 ID 已存在', '另存为失败');
    }
  } finally {
    copyTarget.value = null;
  }
}

async function remove(id: string, name: string): Promise<void> {
  if (!window.confirm(`删除工程 "${name}"？此操作不可撤销。`)) return;
  try {
    await projects.deleteById(id);
    toastInfo(`已删除工程 ${name}`);
  } catch {
    /* toast handled */
  }
}

function fmt(ts: string): string {
  try {
    return new Date(ts).toLocaleString();
  } catch {
    return ts;
  }
}
</script>

<template>
  <section class="projects-view">
    <header class="row">
      <h2>工程列表</h2>
      <button type="button" class="btn" @click="refresh">刷新</button>
    </header>

    <form class="row create" @submit.prevent="create">
      <input v-model="newName" placeholder="工程名" required class="input" />
      <input v-model="newId" placeholder="ID（可选，留空自动生成）" class="input" />
      <button type="submit" class="btn primary">新建</button>
    </form>

    <p v-if="projects.status === 'loading'" class="muted">加载中…</p>
    <p v-else-if="projects.list.length === 0" class="muted">暂无工程。</p>

    <table v-else class="grid">
      <thead>
        <tr>
          <th>名称</th>
          <th>ID</th>
          <th>更新时间</th>
          <th>草稿</th>
          <th class="actions">操作</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="p in projects.list" :key="p.id">
          <td>{{ p.name }}</td>
          <td><code>{{ p.id }}</code></td>
          <td>{{ fmt(p.updatedAt) }}</td>
          <td>{{ p.hasDraft ? '✔' : '—' }}</td>
          <td class="actions">
            <button type="button" class="btn" @click="open(p.id)">打开</button>
            <button type="button" class="btn" @click="publish(p.id)">发布</button>
            <button type="button" class="btn" @click="startRename(p.id, p.name)">重命名</button>
            <button type="button" class="btn" @click="startCopy(p.id, p.name)">另存为</button>
            <button type="button" class="btn danger" @click="remove(p.id, p.name)">删除</button>
          </td>
        </tr>
      </tbody>
    </table>

    <!-- Rename dialog -->
    <dialog v-if="renameTarget !== null" open class="dlg">
      <form @submit.prevent="confirmRename">
        <p>重命名工程</p>
        <input v-model="renameValue" required class="input" />
        <menu>
          <button type="button" class="btn" @click="renameTarget = null">取消</button>
          <button type="submit" class="btn primary">确定</button>
        </menu>
      </form>
    </dialog>

    <!-- Copy / save-as dialog -->
    <dialog v-if="copyTarget !== null" open class="dlg">
      <form @submit.prevent="confirmCopy">
        <p>另存为新工程</p>
        <input v-model="copyName" required class="input" />
        <menu>
          <button type="button" class="btn" @click="copyTarget = null">取消</button>
          <button type="submit" class="btn primary">确定</button>
        </menu>
      </form>
    </dialog>
  </section>
</template>

<style scoped>
.projects-view {
  max-width: 880px;
  margin: 1rem auto;
  padding: 1rem;
}
.row {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-bottom: 1rem;
  flex-wrap: wrap;
}
.row.create .input {
  flex: 1;
  min-width: 12rem;
}
.input {
  padding: 0.4rem 0.6rem;
  border: 1px solid #d0d7de;
  border-radius: 6px;
  background: #ffffff;
  color: #1f2328;
  font: inherit;
}
.btn {
  padding: 0.35rem 0.75rem;
  border: 1px solid #d0d7de;
  border-radius: 6px;
  background: #ffffff;
  color: #1f2328;
  cursor: pointer;
  font: inherit;
}
.btn:hover {
  background: #f3f4f6;
}
.btn.primary {
  background: #0969da;
  color: #ffffff;
  border-color: #0969da;
}
.btn.danger {
  color: #cf222e;
  border-color: #cf222e;
}
.muted {
  color: #57606a;
}
.grid {
  width: 100%;
  border-collapse: collapse;
}
.grid th,
.grid td {
  padding: 0.5rem 0.75rem;
  border-bottom: 1px solid #d8dee4;
  text-align: left;
  vertical-align: middle;
}
.grid th.actions,
.grid td.actions {
  display: flex;
  gap: 0.35rem;
  flex-wrap: wrap;
}
.dlg {
  border: 1px solid #d0d7de;
  border-radius: 8px;
  padding: 1rem;
  min-width: 18rem;
}
.dlg menu {
  display: flex;
  gap: 0.5rem;
  justify-content: flex-end;
  margin: 0.75rem 0 0;
  padding: 0;
}
</style>
