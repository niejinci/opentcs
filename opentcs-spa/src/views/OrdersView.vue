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
import { updateVehicleIntegrationLevel } from '@/api/endpoints/vehicles';
import VehicleStatusPanel from '@/components/VehicleStatusPanel.vue';
import { HttpError } from '@/api/errors';
import { getDraft, getProject } from '@/api/endpoints/projects';
import {
  TRANSPORT_ORDER_OPERATIONS,
  type Destination,
  type TransportOrderOperation,
  type TransportOrderRequest,
  type Vehicle,
  type VehicleIntegrationLevel,
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
/**
 * `ProjectMeta.lastPublishedAt` from the BFF — absent ⇒ the user has
 * never published this project's draft to the kernel, in which case
 * none of the draft's points/locations exist on the kernel side and any
 * order will fail with `NOT_FOUND: <name>`. Used to render the
 * "未发布" pre-submit hint banner.
 */
const lastPublishedAt = ref<string | null>(null);

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

/**
 * Per-target metadata derived from the project's BFF draft, used to
 * constrain the operation dropdown so the user can't submit a
 * combination the kernel will reject (e.g. `Point-1 + LIFT` →
 * `BAD_REQUEST: LIFT is not a valid operation for point destination
 * Point-1`). The kernel rules (see
 * `TransportOrderPoolManager#isValidOperationOnPoint` /
 * `#isValidOperationOnLocationType`) are:
 *   - Point destination → only `MOVE` or `PARK` are valid.
 *   - Location destination → `NOP`, or anything in the LocationType's
 *     `allowedOperations` (intersected with the attached Link's
 *     `allowedOperations` if non-empty).
 * For unknown targets (user typed a name not in the draft) we keep the
 * full op list and let the BFF/Kernel produce the authoritative 4xx,
 * matching scenario #3 of the S9 acceptance script.
 */
type TargetInfo =
  | { kind: 'point' }
  | { kind: 'location'; allowedOps: ReadonlySet<string> };
const targetInfoByName = ref<Map<string, TargetInfo>>(new Map());

const POINT_OPS: readonly TransportOrderOperation[] = ['MOVE', 'PARK'];

function resolveAllowedOps(targetName: string): readonly TransportOrderOperation[] {
  const info = targetInfoByName.value.get(targetName.trim());
  if (!info) return TRANSPORT_ORDER_OPERATIONS;
  if (info.kind === 'point') return POINT_OPS;
  // Location: NOP + MOVE are always accepted by the kernel; union with
  // whatever the LocationType explicitly allows (filtered to the four
  // well-known ops the SPA exposes).
  const out: TransportOrderOperation[] = [];
  for (const op of TRANSPORT_ORDER_OPERATIONS) {
    if (op === 'NOP' || op === 'MOVE' || info.allowedOps.has(op)) {
      out.push(op);
    }
  }
  return out;
}

function rowAllowedOps(row: DestinationRow): readonly TransportOrderOperation[] {
  return resolveAllowedOps(row.targetName);
}

function rowIsValid(row: DestinationRow): boolean {
  if (row.targetName.trim().length === 0) return false;
  return rowAllowedOps(row).includes(row.operation);
}

const vehicleOptions = computed<Vehicle[]>(() => live.vehicleList);

const INTEGRATION_LEVELS: VehicleIntegrationLevel[] = [
  'TO_BE_IGNORED',
  'TO_BE_NOTICED',
  'TO_BE_RESPECTED',
  'TO_BE_UTILIZED',
];
/** Currently selected vehicle (from the order's intendedVehicle dropdown). */
const selectedVehicle = computed<Vehicle | null>(() => {
  const name = intendedVehicle.value;
  if (!name) return null;
  return live.vehicles[name] ?? null;
});
/** Pending UI selection for the "set integration level" picker. */
const integrationLevelDraft = ref<VehicleIntegrationLevel | ''>('');
const integrationLevelBusy = ref(false);

watch(
  selectedVehicle,
  (veh) => {
    integrationLevelDraft.value = veh ? veh.integrationLevel : '';
  },
  { immediate: true },
);

async function applyIntegrationLevel(): Promise<void> {
  const veh = selectedVehicle.value;
  const next = integrationLevelDraft.value;
  if (!veh || !next || next === veh.integrationLevel) return;
  integrationLevelBusy.value = true;
  try {
    const updated = await updateVehicleIntegrationLevel(veh.name, next);
    // Optimistically update the live store so the picker reflects reality
    // even before the SSE event round-trips. We replace the whole map (not a
    // single key) to match the pattern used by `applyVehicleEnvelope` and
    // guarantee Pinia reactivity.
    live.vehicles = { ...live.vehicles, [updated.name]: updated };
    toastSuccess(`${updated.name} → ${updated.integrationLevel}`);
  } catch (err) {
    if (err instanceof HttpError) {
      // HttpError already triggered a toast via the api client.
      return;
    }
    toastError(`更新失败：${(err as Error).message}`);
  } finally {
    integrationLevelBusy.value = false;
  }
}

const canSubmit = computed(() => {
  if (submitting.value) return false;
  if (destRows.value.length === 0) return false;
  return destRows.value.every((r) => rowIsValid(r));
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
    lastPublishedAt.value = meta.lastPublishedAt ?? null;
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
    const info = new Map<string, TargetInfo>();

    // Build a lookup of LocationType name → allowed ops first so we can
    // copy it onto each Location.
    const typeAllowedOps = new Map<string, ReadonlySet<string>>();
    for (const t of arr('locationTypes')) {
      const obj = t as { name?: unknown; allowedOperations?: unknown };
      if (typeof obj.name !== 'string' || obj.name.length === 0) continue;
      const ops = Array.isArray(obj.allowedOperations)
        ? (obj.allowedOperations as unknown[]).filter(
            (x): x is string => typeof x === 'string',
          )
        : [];
      typeAllowedOps.set(obj.name, new Set(ops));
    }

    for (const p of arr('points')) {
      const n = (p as { name?: unknown }).name;
      if (typeof n === 'string' && n.length > 0) {
        names.add(n);
        info.set(n, { kind: 'point' });
      }
    }
    for (const l of arr('locations')) {
      const obj = l as { name?: unknown; typeName?: unknown };
      const n = obj.name;
      if (typeof n !== 'string' || n.length === 0) continue;
      names.add(n);
      const tn = typeof obj.typeName === 'string' ? obj.typeName : '';
      info.set(n, {
        kind: 'location',
        allowedOps: typeAllowedOps.get(tn) ?? new Set<string>(),
      });
    }
    targetSuggestions.value = [...names].sort();
    targetInfoByName.value = info;
  } catch {
    // Non-fatal — user can still type names manually.
    targetSuggestions.value = [];
    targetInfoByName.value = new Map();
  }
}

function addDestination(): void {
  destRows.value.push({ id: nextRowId++, targetName: '', operation: 'MOVE' });
}

/**
 * Called whenever a row's target name changes. If the currently chosen
 * operation is invalid for the new target's kind, snap to the first
 * allowed op so the form stays in a submittable state by default and
 * the user isn't surprised by the kernel's 400 (which is the exact
 * failure mode reported in the S9 acceptance Happy-path).
 */
function onTargetChanged(row: DestinationRow): void {
  const allowed = rowAllowedOps(row);
  if (allowed.length > 0 && !allowed.includes(row.operation)) {
    row.operation = allowed[0];
  }
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
      const hint = orderErrorHint(code, msg, destinations);
      toastError(`${code}: ${msg}${field}${hint}`, '订单创建失败');
    } else {
      toastError('订单创建失败，请检查网络');
    }
  } finally {
    submitting.value = false;
  }
}

/**
 * Produce a user-facing hint for the most common failure modes the
 * kernel returns when the SPA draft drifts from the published plant
 * model. Most importantly: when the kernel replies `NOT_FOUND: <name>`
 * for a destination we just sent, the error is usually that the
 * referenced Point/Location only exists in the local draft and was
 * never published — the raw 404 message gives the user no clue. We
 * detect that case and append a Chinese suggestion to re-publish, plus
 * (when applicable) the exact offending name and "去画布发布" reminder.
 *
 * Returns either the empty string (no hint) or a leading-newline
 * suffix that callers can append straight onto the toast body.
 */
function orderErrorHint(
  code: string,
  message: string,
  sentDestinations: readonly Destination[],
): string {
  if (code !== 'NOT_FOUND') return '';
  // The kernel formats the message as "NOT_FOUND: <name>" or
  // "<some-prefix> <name>"; try to recover the missing name either by
  // intersecting the message text with our own destinations or by
  // stripping the leading code.
  const sentNames = sentDestinations.map((d) => d.locationName);
  const offending = sentNames.find((n) => n.length > 0 && message.includes(n));
  const subject = offending ?? message.replace(/^NOT_FOUND:\s*/, '').trim();
  const subjectStr = subject.length > 0 ? `「${subject}」` : '该目的地';
  const publishedHint = lastPublishedAt.value
    ? '该名称最近一次发布之后被新增或重命名'
    : '当前工程从未发布过模型';
  return `\n提示：${subjectStr} 在内核中不存在 —— 可能${publishedHint}。请回到画布编辑器，使用「发布到内核」按钮重新发布模型后再下单。`;
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
      <VehicleStatusPanel class="vehicle-status" />

      <div v-if="!lastPublishedAt" class="publish-banner warn" role="status">
        ⚠ 当前工程尚未发布过模型到内核，提交订单会失败（kernel 会返回
        <code>NOT_FOUND</code>）。请先回到画布编辑器使用「发布到内核」按钮。
      </div>
      <div v-else class="publish-banner info" role="status">
        上次发布：{{ lastPublishedAt }} ——
        若画布中新增或重命名了 Point / Location，请重新发布后再下单。
      </div>

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

      <div v-if="selectedVehicle" class="vehicle-integration">
        <label :for="`int-lvl-${selectedVehicle.name}`">
          {{ selectedVehicle.name }} · 集成等级
        </label>
        <select
          :id="`int-lvl-${selectedVehicle.name}`"
          v-model="integrationLevelDraft"
          :disabled="integrationLevelBusy"
        >
          <option v-for="lvl in INTEGRATION_LEVELS" :key="lvl" :value="lvl">
            {{ lvl }}
          </option>
        </select>
        <button
          type="button"
          :disabled="
            integrationLevelBusy ||
              !integrationLevelDraft ||
              integrationLevelDraft === selectedVehicle.integrationLevel
          "
          @click="applyIntegrationLevel"
        >
          {{ integrationLevelBusy ? '应用中…' : '应用' }}
        </button>
        <span class="hint">
          当前：<code>{{ selectedVehicle.integrationLevel }}</code> ——
          调度执行需 <code>TO_BE_UTILIZED</code>。
        </span>
      </div>

      <div class="dest-block">
        <div class="dest-block-hdr">
          <h3>目的地序列</h3>
          <button type="button" @click="addDestination">+ 增加一步</button>
        </div>

        <ol class="dest-list">
          <li v-for="(row, idx) in destRows" :key="row.id" class="dest-row-wrap">
            <div class="dest-row">
              <span class="idx">{{ idx + 1 }}.</span>
              <input
                v-model="row.targetName"
                :list="`dest-targets-${row.id}`"
                placeholder="Point / Location 名"
                spellcheck="false"
                autocomplete="off"
                class="target"
                @change="onTargetChanged(row)"
              />
              <datalist :id="`dest-targets-${row.id}`">
                <option v-for="n in targetSuggestions" :key="n" :value="n" />
              </datalist>
              <select v-model="row.operation" class="op">
                <option v-for="op in rowAllowedOps(row)" :key="op" :value="op">
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
            </div>
            <p
              v-if="row.targetName.trim().length > 0 && !rowIsValid(row)"
              class="row-warn"
            >
              「{{ row.operation }}」对该目标不可用，请选择上方下拉中的有效操作。
            </p>
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
.vehicle-integration {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  background: #fff;
  border: 1px solid #d0d7de;
  border-radius: 6px;
  padding: 0.6rem 0.85rem;
  flex-wrap: wrap;
}
.vehicle-integration label {
  font-weight: 600;
  flex: 0 0 auto;
}
.vehicle-integration select {
  padding: 0.25rem 0.4rem;
  font-size: 0.9rem;
}
.vehicle-integration button {
  padding: 0.3rem 0.8rem;
  font-size: 0.85rem;
  cursor: pointer;
}
.vehicle-integration button:disabled {
  cursor: not-allowed;
  opacity: 0.55;
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
.dest-row-wrap {
  display: flex;
  flex-direction: column;
  gap: 0.15rem;
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
.row-warn {
  margin: 0 0 0 1.9rem;
  font-size: 0.78rem;
  color: #9a6700;
}
.publish-banner {
  border-radius: 6px;
  padding: 0.5rem 0.85rem;
  font-size: 0.85rem;
  line-height: 1.45;
}
.publish-banner code {
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  background: rgba(0, 0, 0, 0.06);
  padding: 0 0.25rem;
  border-radius: 3px;
}
.publish-banner.warn {
  background: #fff8c5;
  border: 1px solid #d4a72c;
  color: #633c01;
}
.publish-banner.info {
  background: #ddf4ff;
  border: 1px solid #54aeff;
  color: #0550ae;
}
</style>
