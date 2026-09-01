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
    const created = chargingPileDtoToRecord(
      await createChargingPile(chargingPileFormToDto(normalized)),
    );
    piles.value = [created, ...piles.value.filter((item) => item.id !== created.id)];
    return created;
  }

  async function update(id: string, form: ChargingPileFormData): Promise<ChargingPileRecord> {
    const current = findById(id);
    if (!current) throw new Error('充电桩不存在');
    const normalized = validateForm(form, id);
    const updated = chargingPileDtoToRecord(
      await updateChargingPile(id, chargingPileFormToDto(normalized, current, id)),
    );
    piles.value = [updated, ...piles.value.filter((item) => item.id !== id)];
    return updated;
  }

  async function toggleEnabled(id: string, enabled: boolean): Promise<ChargingPileRecord> {
    const current = findById(id);
    if (!current) throw new Error('充电桩不存在');
    return update(id, { ...chargingPileFormFromRecord(current), enabled });
  }

  async function remove(id: string): Promise<void> {
    await deleteChargingPile(id);
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
