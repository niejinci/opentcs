<script setup lang="ts">
// S3 ImportView — upload the scan triple (.png, .pgm, .yaml) and render
// the PNG as a read-only background with a pixel↔meter affine mapping.
//
// MVP decisions:
//   - Native <canvas> + a single Image draw. The full Konva editor lives in
//     EditorView (S4); this view stays a thin preview to keep the import
//     loop cheap and visually distinct from the editor.
//   - PGM is uploaded for archival / S7 BFF storage; SPA does not render it
//     (browsers can't natively decode P5 PGM). We only checksum-pair it with
//     the yaml via filename matching.
//   - Everything is in-browser: nothing is uploaded to BFF yet (S7 lands
//     the multipart endpoints). Files live in component state.
//   - No localStorage persistence here — drafts persist starting at S5.
//   - S4 addition: on successful import, publish the decoded image +
//     AffineMapping into `useBackgroundMap()` so EditorView can pick it up
//     without re-uploading.

import { computed, onBeforeUnmount, ref, shallowRef, useTemplateRef } from 'vue';
import { useRouter } from 'vue-router';

import { useBackgroundMap } from '@/composables/useBackgroundMap';
import { buildAffine, pixelToWorld, type AffineMapping } from '@/domain/geometry/affine';
import {
  parseRosMapYaml,
  RosMapYamlError,
  type RosMapMetadata,
} from '@/domain/yaml/parseRosMapYaml';
import { toastError, toastSuccess, toastWarning } from '@/ui/toast/toastBus';

/* ----------------------------- File-state ------------------------------ */

interface UploadedFile {
  name: string;
  sizeBytes: number;
}

const router = useRouter();
const { setBackgroundMap, clearBackgroundMap } = useBackgroundMap();

const pngFile = ref<UploadedFile | null>(null);
const pgmFile = ref<UploadedFile | null>(null);
const yamlFile = ref<UploadedFile | null>(null);

const pngObjectUrl = ref<string | null>(null);
// Most-recently decoded PNG, kept around so we can publish to the shared
// background-map composable once yaml + image are both present.
const decodedImage = shallowRef<HTMLImageElement | null>(null);
// Base64 data URL of the most-recently uploaded PNG, captured so the store
// can stash it in localStorage and rehydrate the background after F5.
const pngDataUrl = ref<string | null>(null);

const yamlMeta = shallowRef<RosMapMetadata | null>(null);
const affine = shallowRef<AffineMapping | null>(null);
const imageNaturalSize = ref<{ width: number; height: number } | null>(null);
const fileNameWarnings = ref<string[]>([]);

const canvasRef = useTemplateRef<HTMLCanvasElement>('canvasRef');
const hoverPixel = ref<{ x: number; y: number } | null>(null);
const hoverWorld = computed<{ x: number; y: number } | null>(() => {
  if (!hoverPixel.value || !affine.value) return null;
  return pixelToWorld(affine.value, hoverPixel.value);
});

const PNG_MAX_BYTES = 50 * 1024 * 1024; // 50 MiB — roadmap S3 risk row.

/* ----------------------------- Helpers --------------------------------- */

function formatBytes(b: number): string {
  if (b < 1024) return `${b} B`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KiB`;
  return `${(b / 1024 / 1024).toFixed(2)} MiB`;
}

function stripExt(name: string): string {
  const dot = name.lastIndexOf('.');
  return dot > 0 ? name.slice(0, dot) : name;
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result;
      if (typeof result === 'string') resolve(result);
      else reject(new Error('FileReader returned non-string result'));
    };
    reader.onerror = () => reject(reader.error ?? new Error('FileReader failed'));
    reader.readAsDataURL(file);
  });
}

function revokePngObjectUrl(): void {
  if (pngObjectUrl.value) {
    URL.revokeObjectURL(pngObjectUrl.value);
    pngObjectUrl.value = null;
  }
}

function resetMappingState(): void {
  affine.value = null;
  imageNaturalSize.value = null;
  decodedImage.value = null;
  pngDataUrl.value = null;
  hoverPixel.value = null;
  clearBackgroundMap();
}

function recomputeAffine(): void {
  if (yamlMeta.value && imageNaturalSize.value) {
    affine.value = buildAffine({
      resolution: yamlMeta.value.resolution,
      originX: yamlMeta.value.origin.x,
      originY: yamlMeta.value.origin.y,
      imageWidth: imageNaturalSize.value.width,
      imageHeight: imageNaturalSize.value.height,
    });
    publishBackgroundIfReady();
  } else {
    affine.value = null;
    clearBackgroundMap();
  }
}

function publishBackgroundIfReady(): void {
  const img = decodedImage.value;
  const meta = yamlMeta.value;
  const aff = affine.value;
  if (!img || !meta || !aff || !pngFile.value || !yamlFile.value) return;
  setBackgroundMap({
    image: img,
    pngDataUrl: pngDataUrl.value ?? undefined,
    pngName: pngFile.value.name,
    pgmName: pgmFile.value?.name ?? null,
    yamlName: yamlFile.value.name,
    width: aff.imageWidth,
    height: aff.imageHeight,
    yaml: meta,
    affine: aff,
  });
}

function recomputeFileNameWarnings(): void {
  const warns: string[] = [];
  const yamlImage = yamlMeta.value?.image;
  if (yamlImage && pgmFile.value) {
    if (stripExt(yamlImage).toLowerCase() !== stripExt(pgmFile.value.name).toLowerCase()) {
      warns.push(
        `yaml.image='${yamlImage}' 与上传的 .pgm 文件名 '${pgmFile.value.name}' 不匹配（仅作提醒）。`,
      );
    }
  }
  if (pngFile.value && pgmFile.value) {
    if (stripExt(pngFile.value.name).toLowerCase() !== stripExt(pgmFile.value.name).toLowerCase()) {
      warns.push(
        `png='${pngFile.value.name}' 与 pgm='${pgmFile.value.name}' 文件名前缀不一致；请确认它们对应同一张地图。`,
      );
    }
  }
  fileNameWarnings.value = warns;
}

/* ----------------------------- File handlers --------------------------- */

async function onPngChange(e: Event): Promise<void> {
  const file = (e.target as HTMLInputElement).files?.[0];
  if (!file) return;
  if (!/\.png$/i.test(file.name)) {
    toastError(`期望 .png 后缀，得到 '${file.name}'`, 'PNG 上传');
    return;
  }
  if (file.size > PNG_MAX_BYTES) {
    toastWarning(
      `PNG 大小 ${formatBytes(file.size)} 超过 ${formatBytes(PNG_MAX_BYTES)} 上限；S7 BFF 流式上传完成前请避免上传超大图。`,
      'PNG 体积过大',
    );
  }

  revokePngObjectUrl();
  pngObjectUrl.value = URL.createObjectURL(file);
  pngFile.value = { name: file.name, sizeBytes: file.size };
  resetMappingState();
  recomputeFileNameWarnings();

  // Read PNG bytes as a base64 data URL in parallel with image decoding;
  // the store stashes this in localStorage so the background survives F5.
  try {
    pngDataUrl.value = await readFileAsDataUrl(file);
  } catch {
    // Non-fatal — F5 persistence will degrade gracefully (the user simply
    // has to re-upload after refresh).
    pngDataUrl.value = null;
  }

  // Decode image to obtain natural pixel dimensions, then paint to canvas.
  const img = new Image();
  img.onload = () => {
    imageNaturalSize.value = { width: img.naturalWidth, height: img.naturalHeight };
    decodedImage.value = img;
    paintImage(img);
    recomputeAffine();
    toastSuccess(`PNG 解码成功：${img.naturalWidth} × ${img.naturalHeight} px`, file.name);
  };
  img.onerror = () => {
    toastError('PNG 解码失败：浏览器无法识别该文件', file.name);
    pngFile.value = null;
    revokePngObjectUrl();
  };
  img.src = pngObjectUrl.value;
}

function onPgmChange(e: Event): void {
  const file = (e.target as HTMLInputElement).files?.[0];
  if (!file) return;
  if (!/\.pgm$/i.test(file.name)) {
    toastError(`期望 .pgm 后缀，得到 '${file.name}'`, 'PGM 上传');
    return;
  }
  pgmFile.value = { name: file.name, sizeBytes: file.size };
  recomputeFileNameWarnings();
  toastSuccess(`PGM 已记录（不在前端渲染，S7 起随草稿上传到 BFF）`, file.name);
}

async function onYamlChange(e: Event): Promise<void> {
  const file = (e.target as HTMLInputElement).files?.[0];
  if (!file) return;
  if (!/\.ya?ml$/i.test(file.name)) {
    toastError(`期望 .yaml / .yml 后缀，得到 '${file.name}'`, 'YAML 上传');
    return;
  }
  let text: string;
  try {
    text = await file.text();
  } catch (err) {
    toastError(err instanceof Error ? err.message : String(err), 'YAML 读取失败');
    return;
  }
  try {
    const meta = parseRosMapYaml(text);
    yamlMeta.value = meta;
    yamlFile.value = { name: file.name, sizeBytes: file.size };
    recomputeFileNameWarnings();
    recomputeAffine();
    toastSuccess(
      `resolution=${meta.resolution} m/px, origin=(${meta.origin.x}, ${meta.origin.y})`,
      file.name,
    );
    for (const w of meta.warnings) toastWarning(w, file.name);
  } catch (err) {
    if (err instanceof RosMapYamlError) {
      toastError(err.message, 'YAML 解析失败');
    } else {
      toastError(err instanceof Error ? err.message : String(err), 'YAML 解析失败');
    }
    yamlMeta.value = null;
    yamlFile.value = null;
    affine.value = null;
  }
}

/* ------------------------------ Canvas --------------------------------- */

function paintImage(img: HTMLImageElement): void {
  const canvas = canvasRef.value;
  if (!canvas) return;
  // Cap on-screen size so very large maps don't blow out the layout —
  // affine math always uses the natural pixel size, not the canvas size.
  const MAX_DISPLAY = 800;
  const scale = Math.min(1, MAX_DISPLAY / Math.max(img.naturalWidth, img.naturalHeight));
  canvas.width = Math.round(img.naturalWidth * scale);
  canvas.height = Math.round(img.naturalHeight * scale);
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  ctx.imageSmoothingEnabled = false;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
}

function onCanvasMouseMove(e: MouseEvent): void {
  const canvas = canvasRef.value;
  const natural = imageNaturalSize.value;
  if (!canvas || !natural) return;
  const rect = canvas.getBoundingClientRect();
  // Map CSS pixels -> canvas display pixels -> natural image pixels.
  const cssX = e.clientX - rect.left;
  const cssY = e.clientY - rect.top;
  const naturalX = (cssX / rect.width) * natural.width;
  const naturalY = (cssY / rect.height) * natural.height;
  hoverPixel.value = { x: naturalX, y: naturalY };
}

function onCanvasMouseLeave(): void {
  hoverPixel.value = null;
}

onBeforeUnmount(() => {
  revokePngObjectUrl();
});
</script>

<template>
  <section class="import">
    <header>
      <h2>S3 · 地图导入（三件套）</h2>
      <p class="hint">
        上传扫描三件套 <code>.png / .pgm / .yaml</code>，前端在内存中解析 yaml 的
        <code>resolution</code> 与 <code>origin</code>，建立"像素 ↔ 米"仿射映射，并把 PNG
        作为只读底图绘制。<strong>本轮不上传到 BFF</strong>，S7 起接入文件存储。
      </p>
    </header>

    <article class="card">
      <h3>1. 上传三件套</h3>
      <div class="dropzones">
        <label class="dropzone">
          <span class="dropzone__title">PNG（底图）</span>
          <input type="file" accept=".png,image/png" @change="onPngChange" />
          <small v-if="pngFile">{{ pngFile.name }} · {{ formatBytes(pngFile.sizeBytes) }}</small>
          <small v-else class="dropzone__placeholder">尚未选择</small>
        </label>
        <label class="dropzone">
          <span class="dropzone__title">PGM（原始栅格，仅记录）</span>
          <input type="file" accept=".pgm" @change="onPgmChange" />
          <small v-if="pgmFile">{{ pgmFile.name }} · {{ formatBytes(pgmFile.sizeBytes) }}</small>
          <small v-else class="dropzone__placeholder">尚未选择</small>
        </label>
        <label class="dropzone">
          <span class="dropzone__title">YAML（地图元数据）</span>
          <input type="file" accept=".yaml,.yml,application/x-yaml" @change="onYamlChange" />
          <small v-if="yamlFile">{{ yamlFile.name }} · {{ formatBytes(yamlFile.sizeBytes) }}</small>
          <small v-else class="dropzone__placeholder">尚未选择</small>
        </label>
      </div>
      <ul v-if="fileNameWarnings.length" class="warnings">
        <li v-for="(w, i) in fileNameWarnings" :key="i">⚠ {{ w }}</li>
      </ul>
    </article>

    <article class="card">
      <h3>2. YAML 解析结果</h3>
      <div v-if="yamlMeta" class="yaml-grid">
        <div>
          <span class="label">image</span><code>{{ yamlMeta.image }}</code>
        </div>
        <div>
          <span class="label">resolution</span>
          <code>{{ yamlMeta.resolution }} m/px</code>
        </div>
        <div>
          <span class="label">origin (m)</span>
          <code>
            ({{ yamlMeta.origin.x }}, {{ yamlMeta.origin.y }}, θ={{ yamlMeta.origin.theta }})
          </code>
        </div>
        <div>
          <span class="label">negate</span>
          <code>{{ yamlMeta.negate }}</code>
        </div>
        <div>
          <span class="label">occupied_thresh</span>
          <code>{{ yamlMeta.occupiedThresh }}</code>
        </div>
        <div>
          <span class="label">free_thresh</span>
          <code>{{ yamlMeta.freeThresh }}</code>
        </div>
      </div>
      <p v-else class="hint">请先上传 yaml 文件。</p>
      <ul v-if="yamlMeta?.warnings?.length" class="warnings">
        <li v-for="(w, i) in yamlMeta.warnings" :key="i">⚠ {{ w }}</li>
      </ul>
    </article>

    <article class="card">
      <h3>3. 底图（只读）+ 仿射坐标</h3>
      <div class="canvas-host">
        <canvas
          ref="canvasRef"
          class="map-canvas"
          @mousemove="onCanvasMouseMove"
          @mouseleave="onCanvasMouseLeave"
        />
        <p v-if="!pngFile" class="hint">请先上传 PNG 文件。</p>
      </div>

      <footer class="statusbar">
        <span v-if="imageNaturalSize">
          原始尺寸：{{ imageNaturalSize.width }} × {{ imageNaturalSize.height }} px
        </span>
        <span v-if="!affine && pngFile" class="warn">
          ⚠ 仿射映射未就绪（需同时上传 PNG 与 YAML）
        </span>
        <span v-if="hoverPixel">
          像素：(<code>{{ hoverPixel.x.toFixed(1) }}</code
          >, <code>{{ hoverPixel.y.toFixed(1) }}</code
          >) px
        </span>
        <span v-if="hoverWorld" class="world">
          世界坐标：(<code>{{ hoverWorld.x.toFixed(3) }}</code
          >, <code>{{ hoverWorld.y.toFixed(3) }}</code
          >) m
        </span>
      </footer>
      <div v-if="affine" class="open-editor">
        <button
          type="button"
          class="cta-btn"
          aria-label="打开画布编辑器"
          @click="router.push('/editor')"
        >
          底图已就绪 — 打开「画布编辑器」 →
        </button>
      </div>
    </article>
  </section>
</template>

<style scoped>
.import {
  max-width: 880px;
  margin: 1.5rem auto;
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
  font-size: 0.9rem;
  margin: 0.25rem 0;
}

.card {
  border: 1px solid #d0d7de;
  border-radius: 8px;
  padding: 1rem 1.25rem;
  background: #ffffff;
}

.dropzones {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: 0.75rem;
}
.dropzone {
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
  padding: 0.75rem;
  border: 1px dashed #afb8c1;
  border-radius: 6px;
  background: #f6f8fa;
}
.dropzone__title {
  font-weight: 600;
  font-size: 0.9rem;
}
.dropzone__placeholder {
  color: #8c959f;
}

.warnings {
  margin: 0.75rem 0 0;
  padding: 0.5rem 0.75rem;
  list-style: none;
  border-left: 4px solid #d4a72c;
  background: #fff8c5;
  border-radius: 4px;
  font-size: 0.85rem;
  color: #7d4e00;
}
.warnings li + li {
  margin-top: 0.25rem;
}

.yaml-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: 0.5rem 1rem;
  font-size: 0.9rem;
}
.yaml-grid .label {
  display: inline-block;
  width: 7.5em;
  color: #57606a;
}

.canvas-host {
  display: flex;
  justify-content: center;
  padding: 0.5rem 0;
}
.map-canvas {
  max-width: 100%;
  border: 1px solid #d0d7de;
  border-radius: 4px;
  background: repeating-conic-gradient(#eee 0% 25%, #fff 0% 50%) 0 0 / 16px 16px;
  cursor: crosshair;
  display: block;
}

.statusbar {
  display: flex;
  flex-wrap: wrap;
  gap: 0.75rem 1.5rem;
  padding: 0.5rem 0 0;
  margin: 0;
  border-top: 1px solid #eaeef2;
  font-size: 0.85rem;
  color: #1f2328;
}
.statusbar .world {
  color: #1a7f37;
  font-weight: 600;
}
.statusbar .warn {
  color: #7d4e00;
}
.statusbar code {
  background: #f6f8fa;
  padding: 0.05rem 0.3rem;
  border-radius: 3px;
}

.open-editor {
  margin-top: 0.75rem;
  text-align: right;
}
.cta-btn {
  padding: 0.45rem 0.9rem;
  border: none;
  background: #1a7f37;
  color: #ffffff;
  border-radius: 5px;
  font: inherit;
  font-weight: 600;
  cursor: pointer;
}
.cta-btn:hover {
  background: #14702f;
}
</style>
