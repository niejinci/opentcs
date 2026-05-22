// SPDX-FileCopyrightText: The openTCS Authors
// SPDX-License-Identifier: MIT
//
// useCloudDraftSync — install a watcher that pushes the editor draft to
// `PUT /api/v1/projects/{id}/draft` whenever the in-memory state changes.
// Mounted from `EditorView.vue` (only once a current project is set), so
// list-only views (`/projects`) don't trigger any cloud writes.

import { watch, onScopeDispose } from 'vue';

import { useProjectsStore } from '@/stores/projects';
import { useProjectStore } from '@/stores/project';
import { toastError } from '@/ui/toast/toastBus';

const CLOUD_PUSH_DEBOUNCE_MS = 500;
const ENVELOPE_VERSION = 1;

export function useCloudDraftSync(): void {
  const projects = useProjectsStore();
  const project = useProjectStore();

  let timer: ReturnType<typeof setTimeout> | null = null;
  let inFlight = false;

  function flush(): void {
    if (!projects.currentId) return;
    if (inFlight) {
      // Coalesce: re-arm and try again after the in-flight request resolves.
      timer = setTimeout(flush, CLOUD_PUSH_DEBOUNCE_MS);
      return;
    }
    inFlight = true;
    const payload = project.serializeDraftPayload();
    projects
      .saveCurrentDraft({
        version: ENVELOPE_VERSION,
        savedAt: new Date().toISOString(),
        payload,
      })
      .catch(() => {
        // localStorage is still being written by the existing 200 ms watcher,
        // so we don't lose the user's work; just inform them.
        toastError('云端保存失败，已暂存本地', 'BFF 保存草稿失败');
      })
      .finally(() => {
        inFlight = false;
      });
  }

  function schedule(): void {
    if (!projects.currentId) return;
    if (timer) clearTimeout(timer);
    timer = setTimeout(flush, CLOUD_PUSH_DEBOUNCE_MS);
  }

  const stop = watch(
    () => [
      project.points,
      project.paths,
      project.locationTypes,
      project.locations,
      project.blocks,
      project.vehicles,
    ],
    schedule,
    { deep: true },
  );

  onScopeDispose(() => {
    if (timer) clearTimeout(timer);
    stop();
  });
}
