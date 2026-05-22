// SPDX-FileCopyrightText: The openTCS Authors
// SPDX-License-Identifier: MIT
//
// useProjectsStore — list/CRUD of BFF-persisted projects. Pairs with
// `useProjectStore` (singular), which owns the in-memory draft.
//
// Note the naming convention: `useProjectsStore` (plural) deals with the
// catalogue of projects; `useProjectStore` (singular) deals with the
// editor's current document. The two are wired together by
// `setCurrentProject(id)`, which loads the persisted draft envelope and
// hands it to `useProjectStore.hydrateFromPayload(...)`.

import { defineStore } from 'pinia';
import { computed, ref } from 'vue';

import {
  copyProject,
  createProject,
  deleteProject,
  getDraft,
  getProject,
  listProjects,
  putDraft,
  renameProject,
  type DraftEnvelope,
  type ProjectMeta,
  type ProjectSummary,
} from '@/api/endpoints/projects';
import { HttpError } from '@/api/errors';

const CURRENT_ID_KEY = 'opentcs-spa.currentProjectId';

function loadCurrentProjectId(): string | null {
  if (typeof localStorage === 'undefined') return null;
  try {
    return localStorage.getItem(CURRENT_ID_KEY);
  } catch {
    return null;
  }
}

function saveCurrentProjectId(id: string | null): void {
  if (typeof localStorage === 'undefined') return;
  try {
    if (id) {
      localStorage.setItem(CURRENT_ID_KEY, id);
    } else {
      localStorage.removeItem(CURRENT_ID_KEY);
    }
  } catch {
    // ignore
  }
}

export const useProjectsStore = defineStore('projects', () => {
  const list = ref<ProjectSummary[]>([]);
  const currentMeta = ref<ProjectMeta | null>(null);
  const currentId = ref<string | null>(loadCurrentProjectId());
  const status = ref<'idle' | 'loading' | 'error'>('idle');
  const lastError = ref<string | null>(null);

  const hasCurrent = computed(() => currentMeta.value !== null);

  async function refresh(): Promise<void> {
    status.value = 'loading';
    lastError.value = null;
    try {
      list.value = await listProjects();
      status.value = 'idle';
    } catch (err) {
      status.value = 'error';
      lastError.value = err instanceof Error ? err.message : String(err);
      throw err;
    }
  }

  async function create(name: string, id?: string): Promise<ProjectMeta> {
    const meta = await createProject(name, id);
    list.value = [...list.value, projectSummary(meta)];
    return meta;
  }

  async function setCurrent(id: string): Promise<ProjectMeta> {
    const meta = await getProject(id);
    currentMeta.value = meta;
    currentId.value = id;
    saveCurrentProjectId(id);
    return meta;
  }

  function clearCurrent(): void {
    currentMeta.value = null;
    currentId.value = null;
    saveCurrentProjectId(null);
  }

  async function loadCurrentDraft(): Promise<DraftEnvelope | null> {
    if (!currentId.value) return null;
    try {
      return await getDraft(currentId.value);
    } catch (err) {
      if (err instanceof HttpError && err.status === 404) return null;
      throw err;
    }
  }

  async function saveCurrentDraft(envelope: DraftEnvelope): Promise<void> {
    if (!currentId.value) return;
    await putDraft(currentId.value, envelope, { toastOnError: false });
    if (currentMeta.value) {
      currentMeta.value = { ...currentMeta.value, hasDraft: true, updatedAt: new Date().toISOString() };
    }
  }

  async function renameCurrent(name: string): Promise<ProjectMeta> {
    if (!currentId.value) throw new Error('No current project');
    const meta = await renameProject(currentId.value, name);
    currentMeta.value = meta;
    list.value = list.value.map((p) => (p.id === meta.id ? projectSummary(meta) : p));
    return meta;
  }

  async function copyCurrent(newName: string, newId?: string): Promise<ProjectMeta> {
    if (!currentId.value) throw new Error('No current project');
    const meta = await copyProject(currentId.value, newName, newId);
    list.value = [...list.value, projectSummary(meta)];
    return meta;
  }

  async function deleteById(id: string): Promise<void> {
    await deleteProject(id);
    list.value = list.value.filter((p) => p.id !== id);
    if (currentId.value === id) {
      clearCurrent();
    }
  }

  return {
    list,
    currentMeta,
    currentId,
    status,
    lastError,
    hasCurrent,
    refresh,
    create,
    setCurrent,
    clearCurrent,
    loadCurrentDraft,
    saveCurrentDraft,
    renameCurrent,
    copyCurrent,
    deleteById,
  };
});

function projectSummary(meta: ProjectMeta): ProjectSummary {
  return {
    id: meta.id,
    name: meta.name,
    updatedAt: meta.updatedAt,
    hasDraft: meta.hasDraft,
  };
}
