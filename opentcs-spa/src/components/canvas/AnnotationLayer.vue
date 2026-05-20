<script setup lang="ts">
// SPDX-FileCopyrightText: The openTCS Authors
// SPDX-License-Identifier: MIT
//
// AnnotationLayer — renders user-created Point / Path entities from the
// project store on top of the BackgroundLayer.
//
// Coordinate system: same as MapStage — stage-local coords ≡ natural PNG
// pixel coords, so each Point is drawn at `(layout.pixelX, layout.pixelY)`
// directly. Visual sizes are divided by the Stage scale where appropriate
// to keep them roughly screen-constant under zoom.
//
// Interactions handled in this layer (rest delegated to MapStage):
//   - select tool: click a Point or a Path = select it; drag a Point = move
//   - point tool : pass-through (MapStage handles click → addPoint)
//   - path  tool : click an existing Point to start / complete a Path
//
// We swallow stage clicks on entities by emitting `entity-click` and
// stopping the Konva event bubble where needed.

import type Konva from 'konva';
import type { KonvaEventObject } from 'konva/lib/Node';
import { computed } from 'vue';

import type { EditorToolId } from '@/domain/editor/tools';
import type { DraftPath, DraftPoint } from '@/domain/model/types';
import { useProjectStore } from '@/stores/project';

const props = defineProps<{
  tool: EditorToolId;
  /** Current Stage scale; used to keep visual sizes screen-constant. */
  scale: number;
}>();

const emit = defineEmits<{
  /** Fired so MapStage can suppress its own click-to-create when the user
   *  hit an entity (Konva's bubble flag is unreliable across pointer paths). */
  'entity-click': [];
}>();

const store = useProjectStore();

/* --------------------------- Visual constants -------------------------- */

const POINT_RADIUS_CSS_PX = 6;
const POINT_STROKE_CSS_PX = 1.5;
const PATH_STROKE_CSS_PX = 1.5;
const LABEL_FONT_CSS_PX = 11;
const ARROW_SIZE_CSS_PX = 8;

const pointRadius = computed(() => POINT_RADIUS_CSS_PX / safeScale(props.scale));
const pointStroke = computed(() => POINT_STROKE_CSS_PX / safeScale(props.scale));
const pathStroke = computed(() => PATH_STROKE_CSS_PX / safeScale(props.scale));
const labelFontSize = computed(() => LABEL_FONT_CSS_PX / safeScale(props.scale));
const arrowSize = computed(() => ARROW_SIZE_CSS_PX / safeScale(props.scale));

function safeScale(s: number): number {
  return s > 0.0001 ? s : 0.0001;
}

/* ------------------------- Path endpoint geometry ---------------------- */

interface RenderedPath {
  path: DraftPath;
  src: DraftPoint;
  dst: DraftPoint;
}

const renderedPaths = computed<RenderedPath[]>(() => {
  const byName = new Map(store.points.map((p) => [p.name, p]));
  const out: RenderedPath[] = [];
  for (const path of store.paths) {
    const src = byName.get(path.srcPointName);
    const dst = byName.get(path.destPointName);
    if (src && dst) out.push({ path, src, dst });
  }
  return out;
});

function pathPoints(rp: RenderedPath): number[] {
  return [rp.src.layout.pixelX, rp.src.layout.pixelY, rp.dst.layout.pixelX, rp.dst.layout.pixelY];
}

/* ----------------------------- Highlighting --------------------------- */

const POINT_FILL_DEFAULT = '#0969da';
const POINT_FILL_SELECTED = '#bf3989';
const POINT_FILL_PATH_SRC = '#bf8700'; // path-tool first-click highlight
const POINT_FILL_PARK = '#1a7f37';
const POINT_STROKE = '#ffffff';
const PATH_STROKE_DEFAULT = '#0969da';
const PATH_STROKE_SELECTED = '#bf3989';
const PATH_STROKE_LOCKED = '#8c959f';

function pointFill(p: DraftPoint): string {
  if (store.pathDraftSrc === p.name) return POINT_FILL_PATH_SRC;
  if (store.selection?.kind === 'point' && store.selection.name === p.name) {
    return POINT_FILL_SELECTED;
  }
  return p.type === 'PARK_POSITION' ? POINT_FILL_PARK : POINT_FILL_DEFAULT;
}

function pathStrokeColor(rp: RenderedPath): string {
  if (store.selection?.kind === 'path' && store.selection.name === rp.path.name) {
    return PATH_STROKE_SELECTED;
  }
  if (rp.path.locked) return PATH_STROKE_LOCKED;
  return PATH_STROKE_DEFAULT;
}

/* ----------------------------- Event handlers -------------------------- */

function onPointClick(p: DraftPoint, e: KonvaEventObject<MouseEvent>): void {
  // Cancel bubble so MapStage's click-to-create doesn't also fire.
  e.cancelBubble = true;
  emit('entity-click');
  if (props.tool === 'path') {
    if (store.pathDraftSrc === null) {
      store.startPath(p.name);
      store.select({ kind: 'point', name: p.name });
    } else if (store.pathDraftSrc === p.name) {
      // Clicking the same point twice cancels the in-progress path.
      store.cancelPathDraft();
    } else {
      store.completePath(p.name);
    }
    return;
  }
  // select + point tools both treat a hit on an existing Point as "select it"
  store.select({ kind: 'point', name: p.name });
}

function onPointDragStart(p: DraftPoint, e: KonvaEventObject<DragEvent>): void {
  if (props.tool !== 'select') {
    // Prevent dragging while in creation tools — would otherwise displace
    // the point on accident.
    e.target.stopDrag();
    e.target.position({ x: p.layout.pixelX, y: p.layout.pixelY });
    return;
  }
  e.cancelBubble = true;
  store.select({ kind: 'point', name: p.name });
}

function onPointDragMove(p: DraftPoint, e: KonvaEventObject<DragEvent>): void {
  if (props.tool !== 'select') return;
  const node = e.target as Konva.Node;
  store.movePoint(p.name, { x: node.x(), y: node.y() });
}

function onPathClick(rp: RenderedPath, e: KonvaEventObject<MouseEvent>): void {
  e.cancelBubble = true;
  emit('entity-click');
  store.select({ kind: 'path', name: rp.path.name });
}

/* The Point is `draggable` only under the select tool; in path / point
   tools we still want clicks but not accidental drags. */
function isPointDraggable(): boolean {
  return props.tool === 'select';
}
</script>

<template>
  <v-layer>
    <!-- Paths first so they sit visually under the Points. -->
    <template v-for="rp in renderedPaths" :key="rp.path.name">
      <v-arrow
        :config="{
          points: pathPoints(rp),
          stroke: pathStrokeColor(rp),
          fill: pathStrokeColor(rp),
          strokeWidth: pathStroke,
          pointerLength: arrowSize,
          pointerWidth: arrowSize,
          dash: rp.path.locked ? [arrowSize, arrowSize] : undefined,
          hitStrokeWidth: Math.max(8, pathStroke * 4),
          listening: true,
        }"
        @click="(e: KonvaEventObject<MouseEvent>) => onPathClick(rp, e)"
        @tap="(e: KonvaEventObject<MouseEvent>) => onPathClick(rp, e)"
      />
    </template>

    <template v-for="p in store.points" :key="p.name">
      <v-circle
        :config="{
          x: p.layout.pixelX,
          y: p.layout.pixelY,
          radius: pointRadius,
          fill: pointFill(p),
          stroke: POINT_STROKE,
          strokeWidth: pointStroke,
          draggable: isPointDraggable(),
          hitStrokeWidth: Math.max(4, pointStroke * 4),
          name: 'draft-point',
        }"
        @click="(e: KonvaEventObject<MouseEvent>) => onPointClick(p, e)"
        @tap="(e: KonvaEventObject<MouseEvent>) => onPointClick(p, e)"
        @dragstart="(e: KonvaEventObject<DragEvent>) => onPointDragStart(p, e)"
        @dragmove="(e: KonvaEventObject<DragEvent>) => onPointDragMove(p, e)"
      />
      <v-text
        :config="{
          x: p.layout.pixelX + pointRadius * 1.4,
          y: p.layout.pixelY - labelFontSize * 0.6,
          text: p.name,
          fontSize: labelFontSize,
          fill: '#1f2328',
          listening: false,
        }"
      />
    </template>
  </v-layer>
</template>
