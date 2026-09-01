// SPDX-FileCopyrightText: The openTCS Authors
// SPDX-License-Identifier: MIT

import { defineStore } from 'pinia';
import { computed, ref } from 'vue';

import type { RequestOptions } from '@/api/client';
import {
  createChargingPile,
  deleteChargingPile,
  listChargingPiles,
  updateChargingPile,
} from '@/api/endpoints/charging';
import {
  getDraft,
  putDraft,
  type DraftEnvelope,
  type ProjectSummary,
} from '@/api/endpoints/projects';
import { HttpError } from '@/api/errors';
import {
  removeChargingPileDraftArtifacts,
  upsertChargingPileDraftArtifacts,
} from '@/domain/charging/chargingPileDraftSync';
import {
  chargingPileDtoToRecord,
  chargingPileFormFromRecord,
  chargingPileFormToDto,
  isChargingPileBoundPointUsed,
  isChargingPileIpUsed,
  isChargingPileNameUsed,
  isChargingPileSnUsed,
  normalizeChargingPileForm,
  validateChargingPileForm,
  type ChargingPileFormData,
  type ChargingPileRecord,
} from '@/domain/charging/chargingPile';
import { useProjectStore } from '@/stores/project';
import { useProjectsStore } from '@/stores/projects';

interface DraftSyncContext {
  project: ProjectSummary;
  isCurrentProject: boolean;
  payload: Record<string, unknown>;
}

const DRAFT_ENVELOPE_VERSION = 1;
const PENDING_CHARGING_PILE_ID = '__pending_charging_pile__';

export const useChargingPilesStore = defineStore('chargingPiles', () => {
  const piles = ref<ChargingPileRecord[]>([]);
  const loading = ref(false);
  const loaded = ref(false);
  const lastError = ref<string | null>(null);

  const enabledCount = computed(() => piles.value.filter((item) => item.enabled).length);
  const occupiedCount = computed(
    () => piles.value.filter((item) => item.occupancyStatus === 'OCCUPIED').length,
  );

  async function refresh(options?: RequestOptions): Promise<void> {
    loading.value = true;
    try {
      piles.value = (await listChargingPiles(options)).map(chargingPileDtoToRecord);
      loaded.value = true;
      lastError.value = null;
    } catch (err) {
      lastError.value = err instanceof Error ? err.message : String(err);
      throw err;
    } finally {
      loading.value = false;
    }
  }

  async function ensureLoaded(options?: RequestOptions): Promise<void> {
    if (loaded.value) return;
    await refresh(options);
  }

  async function create(form: ChargingPileFormData): Promise<ChargingPileRecord> {
    const normalized = validateForm(form);
    const draftContext = await loadDraftSyncContext(normalized.mapName);
    const draftCandidate = chargingPileFormToRecord(normalized);
    upsertChargingPileDraftArtifacts(draftContext.payload, draftCandidate);

    const created = chargingPileDtoToRecord(
      await createChargingPile(chargingPileFormToDto(normalized)),
    );
    await saveDraftSyncContext(
      draftContext,
      upsertChargingPileDraftArtifacts(draftContext.payload, created),
    );
    piles.value = [created, ...piles.value.filter((item) => item.id !== created.id)];
    return created;
  }

  async function update(id: string, form: ChargingPileFormData): Promise<ChargingPileRecord> {
    const current = findById(id);
    if (!current) throw new Error('充电桩不存在');
    const normalized = validateForm(form, id);
    const previousDraftContext = await loadDraftSyncContext(current.mapName);
    const nextDraftContext =
      current.mapName === normalized.mapName
        ? previousDraftContext
        : await loadDraftSyncContext(normalized.mapName);
    const draftCandidate = chargingPileFormToRecord(normalized, current, id);

    if (previousDraftContext.project.id === nextDraftContext.project.id) {
      upsertChargingPileDraftArtifacts(nextDraftContext.payload, draftCandidate, current);
    } else {
      upsertChargingPileDraftArtifacts(nextDraftContext.payload, draftCandidate);
    }

    const updated = chargingPileDtoToRecord(
      await updateChargingPile(id, chargingPileFormToDto(normalized, current, id)),
    );
    if (previousDraftContext.project.id === nextDraftContext.project.id) {
      await saveDraftSyncContext(
        nextDraftContext,
        upsertChargingPileDraftArtifacts(nextDraftContext.payload, updated, current),
      );
    } else {
      await saveDraftSyncContext(
        previousDraftContext,
        removeChargingPileDraftArtifacts(previousDraftContext.payload, current),
      );
      await saveDraftSyncContext(
        nextDraftContext,
        upsertChargingPileDraftArtifacts(nextDraftContext.payload, updated),
      );
    }
    piles.value = [updated, ...piles.value.filter((item) => item.id !== id)];
    return updated;
  }

  async function toggleEnabled(id: string, enabled: boolean): Promise<ChargingPileRecord> {
    const current = findById(id);
    if (!current) throw new Error('充电桩不存在');
    return update(id, { ...chargingPileFormFromRecord(current), enabled });
  }

  async function remove(id: string): Promise<void> {
    const current = findById(id);
    const draftContext = current ? await loadDraftSyncContext(current.mapName) : null;
    await deleteChargingPile(id);
    if (current && draftContext) {
      await saveDraftSyncContext(
        draftContext,
        removeChargingPileDraftArtifacts(draftContext.payload, current),
      );
    }
    piles.value = piles.value.filter((item) => item.id !== id);
  }

  function findById(id: string): ChargingPileRecord | null {
    return piles.value.find((item) => item.id === id) ?? null;
  }

  function validateForm(form: ChargingPileFormData, exceptId?: string): ChargingPileFormData {
    const normalized = normalizeChargingPileForm(form);
    validateChargingPileForm(normalized);
    if (isChargingPileNameUsed(piles.value, normalized.name, exceptId)) {
      throw new Error(`充电桩名称 ${normalized.name} 已存在`);
    }
    if (isChargingPileBoundPointUsed(piles.value, normalized.boundPointName, exceptId)) {
      throw new Error(`绑定点位 ${normalized.boundPointName} 已被其他充电桩占用`);
    }
    if (isChargingPileSnUsed(piles.value, normalized.sn, exceptId)) {
      throw new Error(`充电桩 SN ${normalized.sn} 已存在`);
    }
    if (isChargingPileIpUsed(piles.value, normalized.ip, exceptId)) {
      throw new Error(`充电桩 IP ${normalized.ip} 已存在`);
    }
    return normalized;
  }

  async function loadDraftSyncContext(mapName: string): Promise<DraftSyncContext> {
    const projects = useProjectsStore();
    const project = await resolveProjectByName(mapName);

    try {
      const envelope = await getDraft(project.id, { toastOnError: false });
      return {
        project,
        isCurrentProject: projects.currentId === project.id,
        payload: envelope.payload,
      };
    } catch (err) {
      if (err instanceof HttpError && err.status === 404) {
        throw new Error(`工程 ${mapName} 暂无 draft，无法同步充电桩模型`);
      }
      throw err;
    }
  }

  async function resolveProjectByName(mapName: string): Promise<ProjectSummary> {
    const projects = useProjectsStore();
    let project = projects.list.find((item) => item.name === mapName);

    if (!project) {
      await projects.refresh();
      project = projects.list.find((item) => item.name === mapName);
    }

    if (!project) {
      throw new Error(`未找到工程 ${mapName}，无法同步充电桩模型`);
    }

    return project;
  }

  async function saveDraftSyncContext(
    context: DraftSyncContext,
    payload: Record<string, unknown>,
  ): Promise<void> {
    const envelope: DraftEnvelope = {
      version: DRAFT_ENVELOPE_VERSION,
      savedAt: new Date().toISOString(),
      payload,
    };

    if (context.isCurrentProject) {
      const projects = useProjectsStore();
      const projectStore = useProjectStore();
      await projects.saveCurrentDraft(envelope);
      projectStore.hydrateDraftPayload(payload);
      return;
    }

    await putDraft(context.project.id, envelope, { toastOnError: false });
  }

  function chargingPileFormToRecord(
    form: ChargingPileFormData,
    existing?: ChargingPileRecord,
    id?: string,
  ): ChargingPileRecord {
    const dto = chargingPileFormToDto(form, existing, id);
    return chargingPileDtoToRecord({
      ...dto,
      id: dto.id ?? PENDING_CHARGING_PILE_ID,
    });
  }

  return {
    piles,
    loading,
    loaded,
    lastError,
    enabledCount,
    occupiedCount,
    refresh,
    ensureLoaded,
    create,
    update,
    toggleEnabled,
    remove,
    findById,
  };
});
