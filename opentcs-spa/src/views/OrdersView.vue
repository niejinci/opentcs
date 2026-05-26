<script setup lang="ts">
// SPDX-FileCopyrightText: The openTCS Authors
// SPDX-License-Identifier: MIT
//
// S9 — OrdersView. Lets the user pick an intended vehicle, configure a
// multi-step destination sequence, and submit a transport order to the
// kernel via the BFF. On success, navigates back to the editor map view
// (so the live SSE-driven AGV animation is visible immediately).
//
// Design notes:
//   - The "destination target" picker offers both Point and Location
//     names from the user's draft. The BFF / Kernel ultimately validate
//     existence; the dropdown is a convenience, not a contract.
//   - The operation column is a dropdown of the four well-known openTCS
//     operations (NOP / MOVE / LIFT / DROP). Free-form text is held back
//     for S10 since the verification suite explicitly enumerates these.
//   - We always send `incompleteName: true` together with a placeholder
//     `name` of the form `spa-<timestamp>` so the kernel may append a
//     uniqueness suffix without the SPA worrying about collisions.

import { computed, onMounted, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';

import { createTransportOrder } from '@/api/endpoints/transportOrders';
import { HttpError } from '@/api/errors';
import { getDraft, getProject } from '@/api/endpoints/projects';
import {
  TRANSPORT_ORDER_OPERATIONS,
  type Destination,
  type TransportOrderOperation,
  type TransportOrderRequest,
  type Vehicle,
} from '@/api/types/bff';
import { useLiveStatusStore } from '@/stores/liveStatus';
import { toastError, toastSuccess } from '@/ui/toast/toastBus';

interface DestinationRow {
  /** Local row id (UUID-ish, just used as v-for key). */
  id: number;
  targetName: string;
  operation: TransportOrderOperation;
}

const route = useRoute();
const router = useRouter();
const live = useLiveStatusStore();

const projectId = computed(() => String(route.params.projectId ?? '').trim());
const projectName = ref<string>('');

const intendedVehicle = ref<string>('');
const destRows = ref<DestinationRow[]>([
  { id: 1, targetName: '', operation: 'MOVE' },
]);
let nextRowId = 2;

const submitting = ref(false);

/** Names of Points + Locations sourced from the project's BFF draft.
 *  Used purely as a dropdown convenience — the kernel is the
 *  authoritative validator. */
const targetSuggestions = ref<string[]>([]);

const vehicleOptions = computed<Vehicle[]>(() => live.vehicleList);

const canSubmit = computed(() => {
  if (submitting.value) return false;
  if (destRows.value.length === 0) return false;
  return destRows.value.every((r) => r.targetName.trim().length > 0);
});

onMounted(async () => {
  if (!projectId.value) {
    toastError('缺少 projectId，无法创建订单');
    void router.replace({ name: 'projects' });
    return;
  }
  try {
    const meta = await getProject(projectId.value);
    projectName.value = meta.name;
  } catch {
    /* toast handled by client */
  }
  await loadDraftTargets();
});

async function loadDraftTargets(): Promise<void> {
  try {
    const env = await getDraft(projectId.value, { toastOnError: false });
    const payload = (env.payload ?? {}) as Record<string, unknown>;
    const arr = (k: string): unknown[] =>
      Array.isArray(payload[k]) ? (payload[k] as unknown[]) : [];
    const names = new Set<string>();
    for (const p of arr('points')) {
      const n = (p as { name?: unknown }).name;
      if (typeof n === 'string' && n.length > 0) names.add(n);
    }
    for (const l of arr('locations')) {
      const n = (l as { name?: unknown }).name;
      if (typeof n === 'string' && n.length > 0) names.add(n);
    }
    targetSuggestions.value = [...names].sort();
  } catch {
    // Non-fatal — user can still type names manually.
    targetSuggestions.value = [];
  }
}

function addDestination(): void {
  destRows.value.push({ id: nextRowId++, targetName: '', operation: 'MOVE' });
}

function removeDestination(id: number): void {
  if (destRows.value.length <= 1) return;
  destRows.value = destRows.value.filter((r) => r.id !== id);
}

function moveRow(id: number, delta: -1 | 1): void {
  const i = destRows.value.findIndex((r) => r.id === id);
  if (i < 0) return;
  const j = i + delta;
  if (j < 0 || j >= destRows.value.length) return;
  const copy = destRows.value.slice();
  const [item] = copy.splice(i, 1);
  copy.splice(j, 0, item);
  destRows.value = copy;
}

async function submit(): Promise<void> {
  if (!canSubmit.value) return;
  submitting.value = true;
  const destinations: Destination[] = destRows.value.map((r) => ({
    locationName: r.targetName.trim(),
    operation: r.operation,
  }));
  const request: TransportOrderRequest = {
    name: `spa-${Date.now()}`,
    incompleteName: true,
    intendedVehicle: intendedVehicle.value.trim() || null,
    destinations,
  };
  try {
    const order = await createTransportOrder(request, { toastOnError: false });
    live.recordCreatedOrder(order);
    toastSuccess(`已创建订单 ${order.name}`, '订单');
    // Back to map view — live SSE will animate the vehicle.
    void router.push({ name: 'editor', params: { projectId: projectId.value } });
  } catch (err) {
    if (err instanceof HttpError) {
      const code = err.payload?.code ?? `HTTP_${err.status}`;
      const msg = err.payload?.message ?? err.statusText;
      const field = err.payload?.fieldPath ? `\n字段：${err.payload.fieldPath}` : '';
      toastError(`${code}: ${msg}${field}`, '订单创建失败');
    } else {
      toastError('订单创建失败，请检查网络');
    }
  } finally {
    submitting.value = false;
  }
}

// If the user navigates here before SSE has primed the vehicle list,
// also surface a hint when the first vehicle finally lands.
watch(
  () => live.vehicleList.length,
  (n, prev) => {
    if (n > 0 && prev === 0 && !intendedVehicle.value) {
      intendedVehicle.value = live.vehicleList[0].name;
    }
  },
  { immediate: true },
);
</script>

<template>
  <section class="orders-shell">
    <header class="orders-header">
      <div>
        <h2>下达运输订单</h2>
        <p class="project">
          工程：<code>{{ projectName || projectId }}</code>
        </p>
      </div>
      <nav>
        <RouterLink :to="{ name: 'editor', params: { projectId } }">返回画布</RouterLink>
      </nav>
    </header>

    <div class="orders-body">
      <div class="vehicle-pick">
        <label for="veh-select">执行车辆 (可选)</label>
        <select id="veh-select" v-model="intendedVehicle">
          <option value="">— 由 Kernel 调度 —</option>
          <option v-for="v in vehicleOptions" :key="v.name" :value="v.name">
            {{ v.name }} ({{ v.state }})
          </option>
        </select>
        <span v-if="vehicleOptions.length === 0" class="hint warn">
          暂未发现 Vehicle —— SSE 状态：{{ live.sseState }}
        </span>
      </div>

      <div class="dest-block">
        <div class="dest-block-hdr">
          <h3>目的地序列</h3>
          <button type="button" @click="addDestination">+ 增加一步</button>
        </div>

        <ol class="dest-list">
          <li v-for="(row, idx) in destRows" :key="row.id" class="dest-row">
            <span class="idx">{{ idx + 1 }}.</span>
            <input
              v-model="row.targetName"
              :list="`dest-targets-${row.id}`"
              placeholder="Point / Location 名"
              spellcheck="false"
              autocomplete="off"
              class="target"
            />
            <datalist :id="`dest-targets-${row.id}`">
              <option v-for="n in targetSuggestions" :key="n" :value="n" />
            </datalist>
            <select v-model="row.operation" class="op">
              <option v-for="op in TRANSPORT_ORDER_OPERATIONS" :key="op" :value="op">
                {{ op }}
              </option>
            </select>
            <div class="row-tools">
              <button type="button" :disabled="idx === 0" @click="moveRow(row.id, -1)">↑</button>
              <button
                type="button"
                :disabled="idx === destRows.length - 1"
                @click="moveRow(row.id, 1)"
              >
                ↓
              </button>
              <button
                type="button"
                :disabled="destRows.length <= 1"
                @click="removeDestination(row.id)"
              >
                ×
              </button>
            </div>
          </li>
        </ol>
      </div>

      <div class="actions">
        <button
          type="button"
          class="submit"
          :disabled="!canSubmit"
          @click="submit"
        >
          {{ submitting ? '提交中…' : '提交订单' }}
        </button>
      </div>
    </div>
  </section>
</template>

<style scoped>
.orders-shell {
  max-width: 880px;
  margin: 0 auto;
  padding: 1.25rem 1rem 3rem;
  color: #1f2328;
}
.orders-header {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  margin-bottom: 1rem;
  flex-wrap: wrap;
  gap: 0.5rem;
}
.orders-header h2 {
  margin: 0;
}
.orders-header .project {
  margin: 0.25rem 0 0;
  color: #57606a;
}
.orders-header nav a {
  color: #0969da;
  text-decoration: none;
  border: 1px solid #d0d7de;
  padding: 0.25rem 0.6rem;
  border-radius: 6px;
  font-size: 0.85rem;
  background: #f6f8fa;
}
.orders-body {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}
.vehicle-pick {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  background: #fff;
  border: 1px solid #d0d7de;
  border-radius: 6px;
  padding: 0.6rem 0.85rem;
}
.vehicle-pick label {
  font-weight: 600;
  flex: 0 0 auto;
}
.vehicle-pick select {
  flex: 1 1 auto;
  padding: 0.25rem 0.4rem;
  font-size: 0.9rem;
}
.hint {
  font-size: 0.8rem;
  color: #6e7781;
}
.hint.warn {
  color: #9a6700;
}
.dest-block {
  background: #fff;
  border: 1px solid #d0d7de;
  border-radius: 6px;
  padding: 0.6rem 0.85rem 0.85rem;
}
.dest-block-hdr {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 0.5rem;
}
.dest-block-hdr h3 {
  margin: 0;
  font-size: 1rem;
}
.dest-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
}
.dest-row {
  display: flex;
  align-items: center;
  gap: 0.4rem;
}
.dest-row .idx {
  width: 1.5rem;
  text-align: right;
  color: #6e7781;
  font-variant-numeric: tabular-nums;
}
.dest-row .target {
  flex: 1 1 auto;
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  padding: 0.25rem 0.4rem;
  border: 1px solid #d0d7de;
  border-radius: 4px;
}
.dest-row .op {
  flex: 0 0 6.5rem;
  padding: 0.25rem 0.4rem;
}
.row-tools {
  display: flex;
  gap: 0.15rem;
}
.row-tools button,
.dest-block-hdr button {
  border: 1px solid #d0d7de;
  background: #f6f8fa;
  padding: 0.15rem 0.5rem;
  font-size: 0.85rem;
  border-radius: 4px;
  cursor: pointer;
}
.row-tools button:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}
.actions {
  display: flex;
  justify-content: flex-end;
}
.submit {
  background: #1f883d;
  color: #fff;
  border: 1px solid #1a7f37;
  padding: 0.4rem 1.1rem;
  border-radius: 6px;
  font-size: 0.95rem;
  cursor: pointer;
}
.submit:disabled {
  background: #94d3a2;
  border-color: #94d3a2;
  cursor: not-allowed;
}
</style>
