<script setup lang="ts">
// SPDX-FileCopyrightText: The openTCS Authors
// SPDX-License-Identifier: MIT
//
// S8 — PublishView. Fetches the project's draft from BFF, shows local
// counts + a dry-run/confirm flow against `POST /api/v1/plant-models/publish`.
//
// Why fetch the draft from BFF (not the in-memory editor store)?
//   - The publish action is independent of whether the editor has been
//     opened in this session; routing directly to /projects/:id/publish
//     must work after a reload too.

import { computed, onMounted, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';

import { getDraft, getProject } from '@/api/endpoints/projects';
import { publishPlantModel, type PublishDiff } from '@/api/endpoints/publish';
import { HttpError } from '@/api/errors';
import { toastError, toastInfo, toastSuccess } from '@/ui/toast/toastBus';

interface LocalCounts {
  points: number;
  paths: number;
  locations: number;
  locationTypes: number;
  blocks: number;
  vehicles: number;
}

interface ValidationIssue {
  message: string;
  fieldPath?: string;
}

const route = useRoute();
const router = useRouter();

const projectId = computed(
  () => String(route.params.projectId ?? '').trim(),
);

const projectName = ref<string>('');
const draftLoaded = ref(false);
const counts = ref<LocalCounts>({
  points: 0,
  paths: 0,
  locations: 0,
  locationTypes: 0,
  blocks: 0,
  vehicles: 0,
});
const localIssues = ref<ValidationIssue[]>([]);
const dryRunDiff = ref<PublishDiff | null>(null);
const dryRunOk = ref<boolean | null>(null);
const publishing = ref(false);
const lastError = ref<{ code?: string; message: string; fieldPath?: string } | null>(null);

onMounted(async () => {
  if (!projectId.value) {
    toastError('缺少 projectId，无法发布');
    return;
  }
  try {
    const meta = await getProject(projectId.value);
    projectName.value = meta.name;
  } catch {
    /* toast handled by client */
  }
  await loadDraft();
});

async function loadDraft(): Promise<void> {
  try {
    const env = await getDraft(projectId.value, { toastOnError: false });
    const payload = (env.payload ?? {}) as Record<string, unknown>;
    const arr = (k: string): unknown[] =>
      Array.isArray(payload[k]) ? (payload[k] as unknown[]) : [];
    counts.value = {
      points: arr('points').length,
      paths: arr('paths').length,
      locations: arr('locations').length,
      locationTypes: arr('locationTypes').length,
      blocks: arr('blocks').length,
      vehicles: arr('vehicles').length,
    };
    localIssues.value = collectLocalIssues(payload);
    draftLoaded.value = true;
  } catch (err) {
    if (err instanceof HttpError && err.status === 404) {
      toastError('该工程没有草稿可发布', '草稿缺失');
    } else {
      toastError('加载草稿失败');
    }
  }
}

/** Cheap local sanity checks — duplicate names + dangling Path refs. */
function collectLocalIssues(payload: Record<string, unknown>): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const seen = new Set<string>();
  const pointNames = new Set<string>();
  const arr = (k: string): Array<Record<string, unknown>> =>
    Array.isArray(payload[k]) ? (payload[k] as Array<Record<string, unknown>>) : [];
  for (const p of arr('points')) {
    const n = String(p.name ?? '');
    if (n) pointNames.add(n);
  }
  for (const k of ['points', 'paths', 'locations', 'blocks', 'vehicles'] as const) {
    for (const it of arr(k)) {
      const n = String(it.name ?? '');
      if (!n) {
        issues.push({ message: `${k} 中存在未命名条目`, fieldPath: `${k}[].name` });
        continue;
      }
      if (seen.has(n)) {
        issues.push({ message: `重名实体：${n}`, fieldPath: `${k}[name=${n}].name` });
      }
      seen.add(n);
    }
  }
  for (const p of arr('paths')) {
    // Draft schema names mirror PathCreationTO: srcPointName / destPointName.
    // The BFF publish converter emits the same names in `fieldPath`
    // (e.g. `paths[3].srcPointName`), so we keep them aligned end-to-end.
    const src = String(p.srcPointName ?? '');
    const dst = String(p.destPointName ?? '');
    if (src && !pointNames.has(src)) {
      issues.push({
        message: `Path '${String(p.name)}' 的 srcPointName '${src}' 不存在`,
        fieldPath: `paths[name=${String(p.name)}].srcPointName`,
      });
    }
    if (dst && !pointNames.has(dst)) {
      issues.push({
        message: `Path '${String(p.name)}' 的 destPointName '${dst}' 不存在`,
        fieldPath: `paths[name=${String(p.name)}].destPointName`,
      });
    }
  }
  return issues;
}

function clearLastError(): void {
  lastError.value = null;
}

async function tryDryRun(): Promise<void> {
  if (publishing.value) return;
  publishing.value = true;
  clearLastError();
  try {
    const resp = await publishPlantModel(
      { projectId: projectId.value, dryRun: true },
      { toastOnError: false },
    );
    dryRunOk.value = resp.ok;
    dryRunDiff.value = resp.diff ?? null;
    if (resp.ok) toastInfo('试运行通过');
  } catch (err) {
    handlePublishError(err, '试运行失败');
  } finally {
    publishing.value = false;
  }
}

async function doPublish(): Promise<void> {
  if (publishing.value) return;
  publishing.value = true;
  clearLastError();
  try {
    const resp = await publishPlantModel(
      { projectId: projectId.value, dryRun: false },
      { toastOnError: false },
    );
    if (resp.ok) {
      toastSuccess('已发布到 Kernel', resp.modelName);
    } else {
      toastError('发布返回未知状态');
    }
  } catch (err) {
    handlePublishError(err, '发布失败');
  } finally {
    publishing.value = false;
  }
}

function handlePublishError(err: unknown, fallback: string): void {
  if (err instanceof HttpError) {
    const body = err.payload;
    const code = body?.code ?? `HTTP_${err.status}`;
    const message = body?.message ?? err.message;
    const fieldPath = body?.fieldPath ?? undefined;
    lastError.value = { code, message, fieldPath };
    const detail = fieldPath ? `${code}: ${message} (${fieldPath})` : `${code}: ${message}`;
    toastError(detail, fallback);
  } else {
    lastError.value = { message: String(err) };
    toastError(fallback);
  }
}

function jumpToField(fieldPath?: string): void {
  if (!fieldPath) return;
  // Best-effort: route back to the editor with the fieldPath as a hint;
  // the editor consumes `?focus=` when present.
  void router.push({
    name: 'editor',
    params: { projectId: projectId.value },
    query: { focus: fieldPath },
  });
}
</script>

<template>
  <section class="publish-view">
    <header class="row">
      <h2>发布到 Kernel</h2>
      <span v-if="projectName" class="muted">{{ projectName }}</span>
      <button type="button" class="btn" @click="router.push({ name: 'projects' })">
        返回工程列表
      </button>
    </header>

    <div class="cols">
      <!-- LEFT: draft summary -->
      <section class="card">
        <h3>当前草稿摘要</h3>
        <p v-if="!draftLoaded" class="muted">加载中…</p>
        <table v-else class="kv">
          <tbody>
            <tr><th>Point</th><td>{{ counts.points }}</td></tr>
            <tr><th>Path</th><td>{{ counts.paths }}</td></tr>
            <tr><th>Location</th><td>{{ counts.locations }}</td></tr>
            <tr><th>LocationType</th><td>{{ counts.locationTypes }}</td></tr>
            <tr><th>Block</th><td>{{ counts.blocks }}</td></tr>
            <tr><th>Vehicle</th><td>{{ counts.vehicles }}</td></tr>
          </tbody>
        </table>

        <div v-if="localIssues.length > 0" class="issues">
          <p class="error-line">本地校验发现 {{ localIssues.length }} 处问题：</p>
          <ul>
            <li v-for="(iss, idx) in localIssues" :key="idx">
              {{ iss.message }}
              <button
                v-if="iss.fieldPath"
                type="button"
                class="link"
                @click="jumpToField(iss.fieldPath)"
              >定位</button>
            </li>
          </ul>
        </div>
      </section>

      <!-- RIGHT: publish actions -->
      <section class="card">
        <h3>发布操作</h3>
        <div class="actions">
          <button
            type="button"
            class="btn"
            :disabled="publishing || !draftLoaded"
            @click="tryDryRun"
          >先试运行（dryRun）</button>
          <button
            type="button"
            class="btn primary"
            :disabled="publishing || !draftLoaded"
            @click="doPublish"
          >确认发布</button>
        </div>

        <div v-if="dryRunDiff" class="diff">
          <h4>试运行 / 本地对比</h4>
          <table class="kv">
            <thead>
              <tr><th>种类</th><th>本地</th><th>服务端（dryRun）</th></tr>
            </thead>
            <tbody>
              <tr><th>Point</th><td>{{ counts.points }}</td><td>{{ dryRunDiff.pointCount }}</td></tr>
              <tr><th>Path</th><td>{{ counts.paths }}</td><td>{{ dryRunDiff.pathCount }}</td></tr>
              <tr><th>Location</th><td>{{ counts.locations }}</td><td>{{ dryRunDiff.locationCount }}</td></tr>
              <tr><th>LocationType</th><td>{{ counts.locationTypes }}</td><td>{{ dryRunDiff.locationTypeCount }}</td></tr>
              <tr><th>Block</th><td>{{ counts.blocks }}</td><td>{{ dryRunDiff.blockCount }}</td></tr>
              <tr><th>Vehicle</th><td>{{ counts.vehicles }}</td><td>{{ dryRunDiff.vehicleCount }}</td></tr>
            </tbody>
          </table>
          <p v-if="dryRunOk" class="ok-line">服务端校验通过，可执行确认发布。</p>
        </div>

        <div v-if="lastError" class="error-box">
          <p><strong>{{ lastError.code ?? '错误' }}</strong>：{{ lastError.message }}</p>
          <p v-if="lastError.fieldPath">
            字段：
            <button type="button" class="link" @click="jumpToField(lastError.fieldPath)">
              {{ lastError.fieldPath }}
            </button>
          </p>
        </div>
      </section>
    </div>
  </section>
</template>

<style scoped>
.publish-view {
  max-width: 960px;
  margin: 1rem auto;
  padding: 1rem;
}
.row {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  margin-bottom: 1rem;
}
.row .muted {
  color: #57606a;
}
.cols {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1rem;
}
.card {
  border: 1px solid #d0d7de;
  border-radius: 8px;
  padding: 1rem;
  background: #ffffff;
}
.kv {
  width: 100%;
  border-collapse: collapse;
}
.kv th, .kv td {
  text-align: left;
  padding: 0.25rem 0.5rem;
  border-bottom: 1px solid #eaeef2;
}
.actions {
  display: flex;
  gap: 0.5rem;
  margin-bottom: 0.75rem;
}
.btn {
  padding: 0.4rem 0.8rem;
  border: 1px solid #d0d7de;
  border-radius: 6px;
  background: #f6f8fa;
  cursor: pointer;
}
.btn.primary {
  background: #1f6feb;
  color: #ffffff;
  border-color: #1f6feb;
}
.btn[disabled] {
  opacity: 0.6;
  cursor: not-allowed;
}
.issues {
  margin-top: 0.75rem;
  padding: 0.5rem 0.75rem;
  background: #ffebe9;
  border: 1px solid #ff8182;
  border-radius: 6px;
}
.issues ul {
  margin: 0.25rem 0 0 1rem;
  padding: 0;
}
.error-line { color: #cf222e; font-weight: 600; margin: 0; }
.ok-line { color: #1a7f37; margin-top: 0.5rem; }
.error-box {
  margin-top: 0.75rem;
  padding: 0.5rem 0.75rem;
  background: #fff8c5;
  border: 1px solid #d4a72c;
  border-radius: 6px;
}
.link {
  background: none;
  border: none;
  color: #1f6feb;
  cursor: pointer;
  padding: 0;
  text-decoration: underline;
}
</style>
