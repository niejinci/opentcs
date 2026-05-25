<script setup lang="ts">
// S2 Debug page. Validates the infra layer end-to-end without pulling in
// vue-router (deferred to S3+): a `GET /health` button + an SSE connect /
// disconnect pair. Both surface raw JSON / state so the developer can
// confirm the proxy + auth + backoff logic with the BFF running locally.
//
// This page intentionally has zero domain logic — once S3+ ships real
// pages, it can stay in /debug as a permanent diagnostics tool, or be
// removed if Storybook-style debug pages move elsewhere.

import { computed, onBeforeUnmount, ref, shallowRef } from 'vue';

import { getHealth } from '@/api/endpoints/health';
import { SseClient, type SseConnectionState } from '@/api/sse';
import type { HealthResponse, SseEventEnvelope, TransportOrder, Vehicle } from '@/api/types/bff';
import { HttpError, NetworkError } from '@/api/errors';
import { getRuntimeConfig } from '@/config/runtime';
import { toastError, toastInfo, toastSuccess } from '@/ui/toast/toastBus';

interface SseLogEntry {
  ts: string;
  kind: 'state' | 'vehicle' | 'transportOrder' | 'error';
  text: string;
}

const config = getRuntimeConfig();
const accessKeyMasked = computed(() => {
  const key = config.bffAccessKey;
  if (!key) return '(empty — auth disabled)';
  return key.length > 4 ? `${key.slice(0, 2)}***` : '***';
});
const baseUrlDisplay = computed(() =>
  config.bffBaseUrl ? config.bffBaseUrl : '(same-origin / Vite proxy)',
);

/* --------------------------------- Health --------------------------------- */

const healthLoading = ref(false);
const healthResult = ref<HealthResponse | null>(null);
const healthError = ref<string | null>(null);

async function callHealth(): Promise<void> {
  healthLoading.value = true;
  healthError.value = null;
  healthResult.value = null;
  try {
    const res = await getHealth();
    healthResult.value = res;
    toastSuccess(`/health → ${JSON.stringify(res)}`, 'BFF reachable');
  } catch (err) {
    healthError.value = formatError(err);
    toastError(healthError.value, '/health failed');
  } finally {
    healthLoading.value = false;
  }
}

function formatError(err: unknown): string {
  if (err instanceof HttpError) {
    const trace = err.traceId ? ` traceId=${err.traceId}` : '';
    return `HTTP ${err.status} ${err.statusText}${trace} — ${err.payload?.message ?? err.bodyText}`;
  }
  if (err instanceof NetworkError) {
    return `Network error: ${err.message}`;
  }
  return err instanceof Error ? err.message : String(err);
}

/* ----------------------------------- SSE ---------------------------------- */

const sseState = ref<SseConnectionState>('idle');
const sseLog = shallowRef<SseLogEntry[]>([]);
const sseClient = ref<SseClient | null>(null);
const MAX_LOG_ENTRIES = 50;

function pushLog(entry: SseLogEntry): void {
  const next = [entry, ...sseLog.value];
  if (next.length > MAX_LOG_ENTRIES) next.length = MAX_LOG_ENTRIES;
  sseLog.value = next;
}

function nowIso(): string {
  return new Date().toISOString().substring(11, 23); // HH:mm:ss.SSS
}

function summarise<T extends Vehicle | TransportOrder>(env: SseEventEnvelope<T>): string {
  const cur = env.currentObjectState;
  const prev = env.previousObjectState;
  if (cur && !prev) return `created ${cur.name}`;
  if (!cur && prev) return `removed ${prev.name}`;
  if (cur && prev) return `updated ${cur.name}`;
  return 'empty envelope';
}

function connectSse(): void {
  if (sseClient.value) return;
  const client = new SseClient({
    vehicles: true,
    transportOrders: true,
    onStateChange: (state) => {
      sseState.value = state;
      pushLog({ ts: nowIso(), kind: 'state', text: state });
    },
    onVehicleEvent: (env) => {
      pushLog({ ts: nowIso(), kind: 'vehicle', text: summarise(env) });
    },
    onTransportOrderEvent: (env) => {
      pushLog({ ts: nowIso(), kind: 'transportOrder', text: summarise(env) });
    },
    onError: () => {
      pushLog({ ts: nowIso(), kind: 'error', text: 'EventSource error (will retry)' });
    },
  });
  sseClient.value = client;
  client.connect();
  toastInfo('SSE connecting…', '/api/v1/sse');
}

function disconnectSse(): void {
  if (!sseClient.value) return;
  sseClient.value.close();
  sseClient.value = null;
  toastInfo('SSE closed', '/api/v1/sse');
}

onBeforeUnmount(() => {
  if (sseClient.value) sseClient.value.close();
});
</script>

<template>
  <section class="debug">
    <header>
      <h2>S2 · BFF infra debug</h2>
      <p class="hint">
        本页用于验证 S2 基础设施层：HTTP client、SSE client、运行时配置、统一错误/Toast。 启动
        <code>opentcs-bff</code> 后点击下方按钮自检。
      </p>
    </header>

    <article class="card">
      <h3>运行时配置</h3>
      <dl class="kv">
        <dt>BFF base URL</dt>
        <dd>
          <code>{{ baseUrlDisplay }}</code>
        </dd>
        <dt>X-Api-Access-Key</dt>
        <dd>
          <code>{{ accessKeyMasked }}</code>
        </dd>
      </dl>
    </article>

    <article class="card">
      <h3>1. HTTP — <code>GET /health</code></h3>
      <button type="button" :disabled="healthLoading" @click="callHealth">
        {{ healthLoading ? '请求中…' : '调用 /health' }}
      </button>
      <pre v-if="healthResult" class="output ok">{{ JSON.stringify(healthResult, null, 2) }}</pre>
      <pre v-if="healthError" class="output err">{{ healthError }}</pre>
    </article>

    <article class="card">
      <h3>2. SSE — <code>/api/v1/sse?vehicles=true&amp;transportOrders=true</code></h3>
      <p>
        当前状态：
        <span class="state" :class="`state--${sseState}`">{{ sseState }}</span>
      </p>
      <div class="actions">
        <button type="button" :disabled="!!sseClient" @click="connectSse">连接</button>
        <button type="button" :disabled="!sseClient" @click="disconnectSse">断开</button>
      </div>
      <ol v-if="sseLog.length" class="log">
        <li v-for="(entry, i) in sseLog" :key="i" :class="`log__item log__item--${entry.kind}`">
          <span class="log__ts">{{ entry.ts }}</span>
          <span class="log__kind">{{ entry.kind }}</span>
          <span class="log__text">{{ entry.text }}</span>
        </li>
      </ol>
      <p v-else class="hint">
        尚无事件。建议先启动 BFF + Kernel，并在 Kernel 中触发车辆/订单变化。
      </p>
    </article>
  </section>
</template>

<style scoped>
.debug {
  max-width: 880px;
  margin: 2rem auto;
  padding: 0 1rem;
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
}

h2 {
  margin: 0 0 0.25rem;
  font-size: 1.5rem;
}

h3 {
  margin: 0 0 0.75rem;
  font-size: 1.05rem;
}

.hint {
  color: #57606a;
  margin: 0.25rem 0;
  font-size: 0.9rem;
}

.card {
  border: 1px solid #d0d7de;
  border-radius: 8px;
  padding: 1rem 1.25rem;
  background: #ffffff;
}

.kv {
  display: grid;
  grid-template-columns: max-content 1fr;
  gap: 0.25rem 1rem;
  margin: 0;
}
.kv dt {
  color: #57606a;
  font-size: 0.85rem;
}
.kv dd {
  margin: 0;
}

button {
  font: inherit;
  padding: 0.4rem 0.9rem;
  border-radius: 6px;
  border: 1px solid #d0d7de;
  background: #f6f8fa;
  color: #1f2328;
  cursor: pointer;
}
button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
button:hover:not(:disabled) {
  background: #eaeef2;
}

.actions {
  display: flex;
  gap: 0.5rem;
  margin-bottom: 0.5rem;
}

.output {
  margin: 0.75rem 0 0;
  padding: 0.75rem;
  background: #f6f8fa;
  border-radius: 6px;
  font-size: 0.85rem;
  white-space: pre-wrap;
  word-break: break-word;
}
.output.ok {
  border-left: 4px solid #1a7f37;
}
.output.err {
  border-left: 4px solid #cf222e;
}

.state {
  display: inline-block;
  padding: 0.1rem 0.5rem;
  border-radius: 999px;
  font-size: 0.8rem;
  background: #eaeef2;
  color: #1f2328;
}
.state--connecting,
.state--reconnecting {
  background: #fff8c5;
  color: #7d4e00;
}
.state--open {
  background: #dafbe1;
  color: #1a7f37;
}
.state--closed {
  background: #ffebe9;
  color: #cf222e;
}

.log {
  list-style: none;
  margin: 0.75rem 0 0;
  padding: 0.5rem;
  border-radius: 6px;
  background: #0d1117;
  color: #c9d1d9;
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 0.8rem;
  max-height: 240px;
  overflow-y: auto;
}
.log__item {
  display: grid;
  grid-template-columns: 7em 8em 1fr;
  gap: 0.5rem;
  padding: 0.15rem 0.25rem;
}
.log__ts {
  color: #8b949e;
}
.log__kind {
  font-weight: 600;
}
.log__item--state .log__kind {
  color: #79c0ff;
}
.log__item--vehicle .log__kind {
  color: #d2a8ff;
}
.log__item--transportOrder .log__kind {
  color: #a5d6ff;
}
.log__item--error .log__kind {
  color: #ff7b72;
}
</style>
