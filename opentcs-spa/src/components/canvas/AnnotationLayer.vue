<script setup lang="ts">
// SPDX-FileCopyrightText: The openTCS Authors
// SPDX-License-Identifier: MIT
//
// AnnotationLayer — renders user-created entities from the project store
// on top of the BackgroundLayer.
//
// Coordinate system: same as MapStage — stage-local coords ≡ natural PNG
// pixel coords, so each entity is drawn at its `layout.pixelX/pixelY`
// directly. Visual sizes are divided by the Stage scale where appropriate
// to keep them roughly screen-constant under zoom.
//
// Interactions handled in this layer (rest delegated to MapStage):
//   - select tool: click an entity = select it; drag a Point / Location /
//                  Vehicle = move it (Path / Block have no canvas drag)
//   - point  tool: pass-through (MapStage handles click → addPoint)
//   - path   tool: click an existing Point to start / complete a Path
//   - location / block / vehicle tools: pass-through (MapStage handles)
//
// We swallow stage clicks on entities by emitting `entity-click` and
// stopping the Konva event bubble where needed.

import type Konva from 'konva';
import type { KonvaEventObject } from 'konva/lib/Node';
import { computed } from 'vue';

import type { EditorToolId } from '@/domain/editor/tools';
import type { DraftLocation, DraftPath, DraftPoint, DraftVehicle } from '@/domain/model/types';
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
const LOCATION_HALF_CSS_PX = 7; // half-side of the square
const VEHICLE_LENGTH_CSS_PX = 28; // icon length (= vehicle's +x dimension)
const VEHICLE_WIDTH_CSS_PX = 16;
const BLOCK_OUTLINE_PADDING_CSS_PX = 10;

const pointRadius = computed(() => POINT_RADIUS_CSS_PX / safeScale(props.scale));
const pointStroke = computed(() => POINT_STROKE_CSS_PX / safeScale(props.scale));
const pathStroke = computed(() => PATH_STROKE_CSS_PX / safeScale(props.scale));
const labelFontSize = computed(() => LABEL_FONT_CSS_PX / safeScale(props.scale));
const arrowSize = computed(() => ARROW_SIZE_CSS_PX / safeScale(props.scale));
const locationHalf = computed(() => LOCATION_HALF_CSS_PX / safeScale(props.scale));
const vehicleLength = computed(() => VEHICLE_LENGTH_CSS_PX / safeScale(props.scale));
const vehicleWidth = computed(() => VEHICLE_WIDTH_CSS_PX / safeScale(props.scale));
const blockOutlinePadding = computed(() => BLOCK_OUTLINE_PADDING_CSS_PX / safeScale(props.scale));

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

/* ----------------------- Block outline geometry ----------------------- */

interface BlockOutline {
  name: string;
  colorRgb: string;
  rect: { x: number; y: number; width: number; height: number };
}

/** Convert a member name → list of (px, py) anchors to include in the bbox. */
function memberAnchors(memberName: string): { x: number; y: number }[] {
  const pt = store.findPoint(memberName);
  if (pt) return [{ x: pt.layout.pixelX, y: pt.layout.pixelY }];
  const loc = store.findLocation(memberName);
  if (loc) return [{ x: loc.layout.pixelX, y: loc.layout.pixelY }];
  const path = store.findPath(memberName);
  if (path) {
    const src = store.findPoint(path.srcPointName);
    const dst = store.findPoint(path.destPointName);
    const xs: { x: number; y: number }[] = [];
    if (src) xs.push({ x: src.layout.pixelX, y: src.layout.pixelY });
    if (dst) xs.push({ x: dst.layout.pixelX, y: dst.layout.pixelY });
    return xs;
  }
  return [];
}

const blockOutlines = computed<BlockOutline[]>(() => {
  const sel = store.selection;
  if (!sel || sel.kind !== 'block') return [];
  const block = store.findBlock(sel.name);
  if (!block || block.memberNames.length === 0) return [];
  const anchors: { x: number; y: number }[] = [];
  for (const m of block.memberNames) anchors.push(...memberAnchors(m));
  if (anchors.length === 0) return [];
  let minX = Infinity,
    minY = Infinity,
    maxX = -Infinity,
    maxY = -Infinity;
  for (const a of anchors) {
    if (a.x < minX) minX = a.x;
    if (a.y < minY) minY = a.y;
    if (a.x > maxX) maxX = a.x;
    if (a.y > maxY) maxY = a.y;
  }
  const pad = blockOutlinePadding.value;
  return [
    {
      name: block.name,
      colorRgb: block.layout.colorRgb,
      rect: {
        x: minX - pad,
        y: minY - pad,
        width: maxX - minX + pad * 2,
        height: maxY - minY + pad * 2,
      },
    },
  ];
});

/** Names of all entities highlighted because they are members of the
 *  currently selected Block. Used to recolor strokes. */
const highlightedBlockMembers = computed<Set<string>>(() => {
  const sel = store.selection;
  if (!sel || sel.kind !== 'block') return new Set();
  const block = store.findBlock(sel.name);
  if (!block) return new Set();
  return new Set(block.memberNames);
});

/* ----------------------------- Highlighting --------------------------- */

const POINT_FILL_DEFAULT = '#0969da';
const POINT_FILL_SELECTED = '#bf3989';
const POINT_FILL_PATH_SRC = '#bf8700'; // path-tool first-click highlight
const POINT_FILL_PARK = '#1a7f37';
const POINT_STROKE = '#ffffff';
const PATH_STROKE_DEFAULT = '#0969da';
const PATH_STROKE_SELECTED = '#bf3989';
const PATH_STROKE_LOCKED = '#8c959f';
const LOCATION_FILL_DEFAULT = '#8250df';
const LOCATION_FILL_SELECTED = '#bf3989';
const LOCATION_FILL_LOCKED = '#8c959f';
const VEHICLE_STROKE = '#1f2328';

function isMemberHighlighted(name: string): boolean {
  return highlightedBlockMembers.value.has(name);
}

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

function locationFill(l: DraftLocation): string {
  if (store.selection?.kind === 'location' && store.selection.name === l.name) {
    return LOCATION_FILL_SELECTED;
  }
  if (l.locked) return LOCATION_FILL_LOCKED;
  return LOCATION_FILL_DEFAULT;
}

function vehicleFill(v: DraftVehicle): string {
  return v.layout.routeColorRgb;
}

function vehicleStrokeWidth(v: DraftVehicle): number {
  const selected = store.selection?.kind === 'vehicle' && store.selection.name === v.name;
  return (selected ? 2.5 : 1.5) / safeScale(props.scale);
}

/* --------------------------- Link rendering --------------------------- */

interface RenderedLocationLink {
  key: string;
  points: number[];
}

const renderedLocationLinks = computed<RenderedLocationLink[]>(() => {
  const out: RenderedLocationLink[] = [];
  for (const l of store.locations) {
    for (const link of l.links) {
      const pt = store.findPoint(link.pointName);
      if (!pt) continue;
      out.push({
        key: `${l.name}->${link.pointName}`,
        points: [l.layout.pixelX, l.layout.pixelY, pt.layout.pixelX, pt.layout.pixelY],
      });
    }
  }
  return out;
});

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
  // select + creation tools treat a hit on an existing Point as "select it"
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

function onLocationClick(l: DraftLocation, e: KonvaEventObject<MouseEvent>): void {
  e.cancelBubble = true;
  emit('entity-click');
  store.select({ kind: 'location', name: l.name });
}

function onLocationDragStart(l: DraftLocation, e: KonvaEventObject<DragEvent>): void {
  if (props.tool !== 'select') {
    e.target.stopDrag();
    e.target.position({ x: l.layout.pixelX, y: l.layout.pixelY });
    return;
  }
  e.cancelBubble = true;
  store.select({ kind: 'location', name: l.name });
}

function onLocationDragMove(l: DraftLocation, e: KonvaEventObject<DragEvent>): void {
  if (props.tool !== 'select') return;
  const node = e.target as Konva.Node;
  store.moveLocation(l.name, { x: node.x(), y: node.y() });
}

function onVehicleClick(v: DraftVehicle, e: KonvaEventObject<MouseEvent>): void {
  e.cancelBubble = true;
  emit('entity-click');
  store.select({ kind: 'vehicle', name: v.name });
}

function onVehicleDragStart(v: DraftVehicle, e: KonvaEventObject<DragEvent>): void {
  if (props.tool !== 'select') {
    e.target.stopDrag();
    e.target.position({ x: v.layout.pixelX, y: v.layout.pixelY });
    return;
  }
  e.cancelBubble = true;
  store.select({ kind: 'vehicle', name: v.name });
}

function onVehicleDragMove(v: DraftVehicle, e: KonvaEventObject<DragEvent>): void {
  if (props.tool !== 'select') return;
  const node = e.target as Konva.Node;
  store.moveVehicle(v.name, { x: node.x(), y: node.y() });
}

/* The Point / Location / Vehicle are `draggable` only under the select
 * tool; in creation tools we still want clicks but not accidental drags. */
function isEntityDraggable(): boolean {
  return props.tool === 'select';
}
</script>

<template>
  <v-layer>
    <!-- Block bounding-box overlay (only when a Block is selected). -->
    <template v-for="bo in blockOutlines" :key="`block-outline-${bo.name}`">
      <v-rect
        :config="{
          x: bo.rect.x,
          y: bo.rect.y,
          width: bo.rect.width,
          height: bo.rect.height,
          stroke: bo.colorRgb,
          strokeWidth: pathStroke * 1.5,
          dash: [arrowSize, arrowSize * 0.6],
          listening: false,
        }"
      />
    </template>

    <!-- Location → Point link lines (drawn under everything else). -->
    <template v-for="ll in renderedLocationLinks" :key="`link-${ll.key}`">
      <v-line
        :config="{
          points: ll.points,
          stroke: '#8250df',
          strokeWidth: pointStroke,
          dash: [pointStroke * 4, pointStroke * 2],
          opacity: 0.6,
          listening: false,
        }"
      />
    </template>

    <!-- Paths next so they sit visually under the Points. -->
    <template v-for="rp in renderedPaths" :key="rp.path.name">
      <v-arrow
        :config="{
          points: [
            rp.src.layout.pixelX,
            rp.src.layout.pixelY,
            rp.dst.layout.pixelX,
            rp.dst.layout.pixelY,
          ],
          stroke: pathStrokeColor(rp),
          fill: pathStrokeColor(rp),
          strokeWidth: isMemberHighlighted(rp.path.name) ? pathStroke * 2 : pathStroke,
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

    <!-- Locations (squares). -->
    <template v-for="l in store.locations" :key="`loc-${l.name}`">
      <v-rect
        :config="{
          x: l.layout.pixelX - locationHalf,
          y: l.layout.pixelY - locationHalf,
          width: locationHalf * 2,
          height: locationHalf * 2,
          fill: locationFill(l),
          stroke: isMemberHighlighted(l.name) ? '#bf8700' : POINT_STROKE,
          strokeWidth: isMemberHighlighted(l.name) ? pointStroke * 2 : pointStroke,
          draggable: isEntityDraggable(),
          name: 'draft-location',
        }"
        @click="(e: KonvaEventObject<MouseEvent>) => onLocationClick(l, e)"
        @tap="(e: KonvaEventObject<MouseEvent>) => onLocationClick(l, e)"
        @dragstart="(e: KonvaEventObject<DragEvent>) => onLocationDragStart(l, e)"
        @dragmove="(e: KonvaEventObject<DragEvent>) => onLocationDragMove(l, e)"
      />
      <v-text
        :config="{
          x: l.layout.pixelX + locationHalf * 1.2,
          y: l.layout.pixelY + locationHalf * 0.2,
          text: l.name,
          fontSize: labelFontSize,
          fill: '#1f2328',
          listening: false,
        }"
      />
    </template>

    <!-- Points (circles) — kept after Locations so small points sit on top. -->
    <template v-for="p in store.points" :key="`pt-${p.name}`">
      <v-circle
        :config="{
          x: p.layout.pixelX,
          y: p.layout.pixelY,
          radius: pointRadius,
          fill: pointFill(p),
          stroke: isMemberHighlighted(p.name) ? '#bf8700' : POINT_STROKE,
          strokeWidth: isMemberHighlighted(p.name) ? pointStroke * 2 : pointStroke,
          draggable: isEntityDraggable(),
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

    <!-- Vehicles (oriented rectangle + small triangle indicator). -->
    <template v-for="v in store.vehicles" :key="`veh-${v.name}`">
      <v-rect
        :config="{
          x: v.layout.pixelX,
          y: v.layout.pixelY,
          width: vehicleLength,
          height: vehicleWidth,
          offsetX: vehicleLength / 2,
          offsetY: vehicleWidth / 2,
          rotation: v.layout.orientationDeg,
          fill: vehicleFill(v),
          stroke: VEHICLE_STROKE,
          strokeWidth: vehicleStrokeWidth(v),
          opacity: 0.85,
          draggable: isEntityDraggable(),
          name: 'draft-vehicle',
        }"
        @click="(e: KonvaEventObject<MouseEvent>) => onVehicleClick(v, e)"
        @tap="(e: KonvaEventObject<MouseEvent>) => onVehicleClick(v, e)"
        @dragstart="(e: KonvaEventObject<DragEvent>) => onVehicleDragStart(v, e)"
        @dragmove="(e: KonvaEventObject<DragEvent>) => onVehicleDragMove(v, e)"
      />
      <v-text
        :config="{
          x: v.layout.pixelX + vehicleLength * 0.6,
          y: v.layout.pixelY - vehicleWidth * 0.6,
          text: v.name,
          fontSize: labelFontSize,
          fill: '#1f2328',
          listening: false,
        }"
      />
    </template>
  </v-layer>
</template>
