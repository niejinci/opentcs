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
import { computed, ref } from 'vue';

import type { EditorToolId } from '@/domain/editor/tools';
import type { DraftLocation, DraftPath, DraftPoint, DraftVehicle } from '@/domain/model/types';
import { resolveToleranceMm, toleranceMmToStagePx } from '@/domain/editor/tolerance';
import {
  directedPathArrowGeometry,
  directedPathKey,
  type PathArrowGeometry,
} from '@/domain/model/path';
import { useLiveVehicleOverlay } from '@/composables/useLiveVehicleOverlay';
import { useEditorSettingsStore } from '@/stores/editorSettings';
import { useProjectStore } from '@/stores/project';
import { toastError } from '@/ui/toast/toastBus';

const props = defineProps<{
  tool: EditorToolId;
  /** Current Stage scale; used to keep visual sizes screen-constant. */
  scale: number;
  /** Read-only render mode used by the realtime monitor page. */
  readonly?: boolean;
  /** Vehicle highlighted by an external monitor selection. */
  selectedVehicleName?: string | null;
  /** Point highlighted by an external monitor selection. */
  selectedPointName?: string | null;
  /** Whether Point / Location / Vehicle name labels should be rendered. */
  showEntityLabels?: boolean;
}>();

const emit = defineEmits<{
  /** Fired so MapStage can suppress its own click-to-create when the user
   *  hit an entity (Konva's bubble flag is unreliable across pointer paths). */
  'entity-click': [];
  /** Fired in read-only order/task pages when a Point or Location is picked. */
  'target-click': [target: { kind: 'point' | 'location'; name: string }];
  /** Fired in monitor/read-only mode when the user clicks a vehicle. */
  'vehicle-click': [name: string];
  /** Fired in monitor/read-only mode when a click hits a vehicle that overlaps a Point. */
  'vehicle-point-overlap-click': [
    payload: { vehicleName: string; pointName: string; clientX: number; clientY: number },
  ];
}>();

const store = useProjectStore();
const settings = useEditorSettingsStore();
const { overlay: vehicleOverlay } = useLiveVehicleOverlay();

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
const POINT_SELECTED_HALO_RADIUS_CSS_PX = 14;
const POINT_SELECTED_HALO_STROKE_CSS_PX = 2.5;

const pointRadius = computed(() => POINT_RADIUS_CSS_PX / safeScale(props.scale));
const pointStroke = computed(() => POINT_STROKE_CSS_PX / safeScale(props.scale));
const pathStroke = computed(() => PATH_STROKE_CSS_PX / safeScale(props.scale));
const labelFontSize = computed(() => LABEL_FONT_CSS_PX / safeScale(props.scale));
const arrowSize = computed(() => ARROW_SIZE_CSS_PX / safeScale(props.scale));
const locationHalf = computed(() => LOCATION_HALF_CSS_PX / safeScale(props.scale));
const vehicleLength = computed(() => VEHICLE_LENGTH_CSS_PX / safeScale(props.scale));
const vehicleWidth = computed(() => VEHICLE_WIDTH_CSS_PX / safeScale(props.scale));
const blockOutlinePadding = computed(() => BLOCK_OUTLINE_PADDING_CSS_PX / safeScale(props.scale));
const pointSelectedHaloRadius = computed(
  () => POINT_SELECTED_HALO_RADIUS_CSS_PX / safeScale(props.scale),
);
const pointSelectedHaloStroke = computed(
  () => POINT_SELECTED_HALO_STROKE_CSS_PX / safeScale(props.scale),
);
const entityLabelsVisible = computed(() => props.showEntityLabels !== false);

function safeScale(s: number): number {
  return s > 0.0001 ? s : 0.0001;
}

/* ------------------------- Path endpoint geometry ---------------------- */

interface RenderedPath {
  path: DraftPath;
  src: DraftPoint;
  dst: DraftPoint;
  /**
   * When the *reverse* path (dst → src) also exists, both paths are bent
   * sideways via a quadratic Bézier so they no longer overlap and each
   * has its own click hit-zone. `curveSign` selects which side to bend
   * towards (+1 / -1); `null` means render as a straight v-arrow.
   */
  curveSign: 1 | -1 | null;
}

const renderedPaths = computed<RenderedPath[]>(() => {
  const byName = new Map(store.points.map((p) => [p.name, p]));
  // Collect the (src, dst) pairs of every renderable path so we can
  // detect the bidirectional case in O(1).
  const directed = new Set<string>();
  for (const path of store.paths) {
    if (byName.has(path.srcPointName) && byName.has(path.destPointName)) {
      directed.add(directedPathKey(path.srcPointName, path.destPointName));
    }
  }
  const out: RenderedPath[] = [];
  for (const path of store.paths) {
    const src = byName.get(path.srcPointName);
    const dst = byName.get(path.destPointName);
    if (!src || !dst) continue;
    const reverseExists = directed.has(directedPathKey(path.destPointName, path.srcPointName));
    let curveSign: 1 | -1 | null = null;
    if (reverseExists) {
      // Stable side assignment: the path whose src name sorts before the
      // dst name bends "+1", the reverse bends "-1". Using string compare
      // avoids any draw-order dependency.
      curveSign = path.srcPointName < path.destPointName ? 1 : -1;
    }
    out.push({ path, src, dst, curveSign });
  }
  return out;
});

/**
 * Visual offset (in stage-pixel space) used to bend a bidirectional
 * path's quadratic-Bézier control point off the straight-line midpoint.
 * Kept screen-constant under zoom by dividing by the stage scale, just
 * like every other "css-px" constant in this file.
 */
const PATH_CURVE_SAGITTA_CSS_PX = 16;
const pathCurveSagitta = computed(() => PATH_CURVE_SAGITTA_CSS_PX / safeScale(props.scale));

function curvedPathGeom(rp: RenderedPath): PathArrowGeometry {
  return directedPathArrowGeometry({
    srcPointName: rp.path.srcPointName,
    destPointName: rp.path.destPointName,
    sx: rp.src.layout.pixelX,
    sy: rp.src.layout.pixelY,
    dx: rp.dst.layout.pixelX,
    dy: rp.dst.layout.pixelY,
    curveSign: rp.curveSign,
    sagitta: pathCurveSagitta.value,
    arrowSize: arrowSize.value,
  });
}

const renderedPathGeoms = computed<Array<RenderedPath & PathArrowGeometry>>(() => {
  return renderedPaths.value.map((rp) => ({ ...rp, ...curvedPathGeom(rp) }));
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
const VEHICLE_SELECTED_HALO_STROKE = '#0969da';
const VEHICLE_SELECTED_HALO_FILL = 'rgba(9, 105, 218, 0.12)';
const VEHICLE_HALO_RADIUS_CSS_PX = 22;
const VEHICLE_HALO_STROKE_CSS_PX = 2;

function isMemberHighlighted(name: string): boolean {
  return highlightedBlockMembers.value.has(name);
}

function pointSelected(p: DraftPoint): boolean {
  return (
    props.selectedPointName === p.name ||
    (store.selection?.kind === 'point' && store.selection.name === p.name)
  );
}

function pointFill(p: DraftPoint): string {
  if (store.pathDraftSrc === p.name) return POINT_FILL_PATH_SRC;
  if (pointSelected(p)) {
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
  // S9: when a kernel SSE tick has reported a state for this vehicle,
  // use the state-derived colour from `useLiveVehicleOverlay`; otherwise
  // fall back to the draft route colour so empty / disconnected sessions
  // still render the icons.
  const entry = vehicleOverlay.value.find((o) => o.name === v.name);
  return entry?.fillRgb ?? v.layout.routeColorRgb;
}

function vehiclePixel(v: DraftVehicle): { x: number; y: number } {
  // S9: kernel `currentPosition` (if any) wins over draft layout.
  const entry = vehicleOverlay.value.find((o) => o.name === v.name);
  if (entry && entry.isLive) {
    return { x: entry.pixelX, y: entry.pixelY };
  }
  return { x: v.layout.pixelX, y: v.layout.pixelY };
}

function vehicleIsLive(v: DraftVehicle): boolean {
  return vehicleOverlay.value.find((o) => o.name === v.name)?.isLive === true;
}

/* ----------------------- PR3: Point tolerance circle ------------------- */
//
// Each Point is rendered with a dashed circle whose radius is the Point's
// positioning tolerance, in stage-pixel units (= mm / (1000 * resolution)).
// Visible when:
//   - the global `editorSettings.toleranceShow` toggle is on, OR
//   - the Point is currently selected (single or multi).
//
// Stroke width is divided by the stage scale so the dash stays roughly
// screen-constant under zoom (same trick used by `pointStroke`).

interface ToleranceRing {
  pointName: string;
  x: number;
  y: number;
  radius: number;
  selected: boolean;
}

const TOLERANCE_STROKE_CSS_PX = 1.2;
const toleranceStrokeWidth = computed(() => TOLERANCE_STROKE_CSS_PX / safeScale(props.scale));

const toleranceRings = computed<ToleranceRing[]>(() => {
  const bg = store.background;
  if (!bg) return [];
  const radiusFor = (p: DraftPoint): number | null => {
    const mm = resolveToleranceMm(p, settings.toleranceDefaultMm);
    return toleranceMmToStagePx(mm, bg.yaml.resolution);
  };
  const rings: ToleranceRing[] = [];
  const sel = store.selection;
  for (const p of store.points) {
    const isSelected =
      (sel?.kind === 'point' && sel.name === p.name) || store.isMultiSelected('point', p.name);
    if (!settings.toleranceShow && !isSelected) continue;
    const r = radiusFor(p);
    if (r === null || r <= 0) continue;
    rings.push({
      pointName: p.name,
      x: p.layout.pixelX,
      y: p.layout.pixelY,
      radius: r,
      selected: isSelected,
    });
  }
  return rings;
});

const TOLERANCE_STROKE_DEFAULT = '#0969da';
const TOLERANCE_STROKE_SELECTED = '#bf3989';

const vehicleHaloRadius = computed(() => VEHICLE_HALO_RADIUS_CSS_PX / safeScale(props.scale));
const vehicleHaloStrokeWidth = computed(
  () => VEHICLE_HALO_STROKE_CSS_PX / safeScale(props.scale),
);

function vehicleSelected(v: DraftVehicle): boolean {
  return (
    props.selectedVehicleName === v.name ||
    (store.selection?.kind === 'vehicle' && store.selection.name === v.name)
  );
}

function vehicleStrokeWidth(v: DraftVehicle): number {
  return (vehicleSelected(v) ? 2.5 : 1.5) / safeScale(props.scale);
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
  if (props.readonly) {
    emit('target-click', { kind: 'point', name: p.name });
    return;
  }
  if (props.tool === 'path') {
    if (store.pathDraftSrc === null) {
      store.startPath(p.name);
      store.select({ kind: 'point', name: p.name });
    } else if (store.pathDraftSrc === p.name) {
      // Clicking the same point twice cancels the in-progress path.
      store.cancelPathDraft();
    } else {
      const res = store.completePath(p.name);
      if (res.error) toastError(res.error, 'Path');
    }
    return;
  }
  // select + creation tools treat a hit on an existing Point as "select it"
  store.select({ kind: 'point', name: p.name });
}

function onPointDragStart(p: DraftPoint, e: KonvaEventObject<DragEvent>): void {
  if (props.readonly) {
    e.target.stopDrag();
    e.target.position({ x: p.layout.pixelX, y: p.layout.pixelY });
    return;
  }
  if (props.tool !== 'select') {
    // Prevent dragging while in creation tools — would otherwise displace
    // the point on accident.
    e.target.stopDrag();
    e.target.position({ x: p.layout.pixelX, y: p.layout.pixelY });
    return;
  }
  e.cancelBubble = true;
  store.select({ kind: 'point', name: p.name });
  store.beginHistoryTransaction('移动 Point');
}

function onPointDragMove(p: DraftPoint, e: KonvaEventObject<DragEvent>): void {
  if (props.readonly) return;
  if (props.tool !== 'select') return;
  const node = e.target as Konva.Node;
  store.movePoint(p.name, { x: node.x(), y: node.y() });
}

function onPointDragEnd(): void {
  store.commitHistoryTransaction();
}

function onPathClick(rp: RenderedPath, e: KonvaEventObject<MouseEvent>): void {
  e.cancelBubble = true;
  emit('entity-click');
  if (props.readonly) return;
  store.select({ kind: 'path', name: rp.path.name });
}

function onLocationClick(l: DraftLocation, e: KonvaEventObject<MouseEvent>): void {
  e.cancelBubble = true;
  emit('entity-click');
  if (props.readonly) {
    emit('target-click', { kind: 'location', name: l.name });
    return;
  }
  store.select({ kind: 'location', name: l.name });
}

function onLocationDragStart(l: DraftLocation, e: KonvaEventObject<DragEvent>): void {
  if (props.readonly) {
    e.target.stopDrag();
    e.target.position({ x: l.layout.pixelX, y: l.layout.pixelY });
    return;
  }
  if (props.tool !== 'select') {
    e.target.stopDrag();
    e.target.position({ x: l.layout.pixelX, y: l.layout.pixelY });
    return;
  }
  e.cancelBubble = true;
  store.select({ kind: 'location', name: l.name });
  store.beginHistoryTransaction('移动 Location');
}

function onLocationDragMove(l: DraftLocation, e: KonvaEventObject<DragEvent>): void {
  if (props.readonly) return;
  if (props.tool !== 'select') return;
  const node = e.target as Konva.Node;
  store.moveLocation(l.name, { x: node.x(), y: node.y() });
}

function onLocationDragEnd(): void {
  store.commitHistoryTransaction();
}

/**
 * Threshold (in stage-pixel space, so it tracks zoom) used to decide
 * whether a Vehicle's draft layout coincides with a Point. We can't
 * trust strict equality because the user may have nudged the vehicle
 * a fraction of a pixel; the Point circle visual radius is ~6 css px,
 * so 1 stage-px is well inside the same visual cluster.
 */
const VEHICLE_POINT_OVERLAP_TOLERANCE_PX = 1.5;

/** Returns the Point that visually overlaps with a Vehicle, or null. */
function pointUnderVehicle(v: DraftVehicle): DraftPoint | null {
  const pos = vehiclePixel(v);
  for (const p of store.points) {
    const dx = p.layout.pixelX - pos.x;
    const dy = p.layout.pixelY - pos.y;
    if (dx * dx + dy * dy <= VEHICLE_POINT_OVERLAP_TOLERANCE_PX ** 2) {
      return p;
    }
  }
  return null;
}

function pointCoveredByVehicleIcon(v: DraftVehicle): DraftPoint | null {
  const pos = vehiclePixel(v);
  const angleRad =
    ((Number.isFinite(v.layout.orientationDeg) ? v.layout.orientationDeg : 0) * Math.PI) / 180;
  const cos = Math.cos(angleRad);
  const sin = Math.sin(angleRad);
  const halfLength = vehicleLength.value / 2 + pointRadius.value;
  const halfWidth = vehicleWidth.value / 2 + pointRadius.value;
  let best: { point: DraftPoint; distanceSq: number } | null = null;

  for (const p of store.points) {
    const dx = p.layout.pixelX - pos.x;
    const dy = p.layout.pixelY - pos.y;
    const localX = dx * cos + dy * sin;
    const localY = -dx * sin + dy * cos;
    if (Math.abs(localX) > halfLength || Math.abs(localY) > halfWidth) continue;

    const distanceSq = dx * dx + dy * dy;
    if (!best || distanceSq < best.distanceSq) {
      best = { point: p, distanceSq };
    }
  }

  return best?.point ?? null;
}

function pointerPixel(e: KonvaEventObject<MouseEvent>): { x: number; y: number } | null {
  const stage = e.target.getStage();
  const pointer = stage?.getPointerPosition();
  if (!stage || !pointer) return null;
  return {
    x: (pointer.x - stage.x()) / safeScale(stage.scaleX()),
    y: (pointer.y - stage.y()) / safeScale(stage.scaleY()),
  };
}

function pointNearPointer(e: KonvaEventObject<MouseEvent>): DraftPoint | null {
  const pixel = pointerPixel(e);
  if (!pixel) return null;
  const radius = Math.max(pointRadius.value * 2, 8 / safeScale(props.scale));
  let best: { point: DraftPoint; distanceSq: number } | null = null;
  for (const p of store.points) {
    const dx = p.layout.pixelX - pixel.x;
    const dy = p.layout.pixelY - pixel.y;
    const distanceSq = dx * dx + dy * dy;
    if (distanceSq > radius * radius) continue;
    if (!best || distanceSq < best.distanceSq) {
      best = { point: p, distanceSq };
    }
  }
  return best?.point ?? null;
}

function onVehicleClick(v: DraftVehicle, e: KonvaEventObject<MouseEvent>): void {
  if (props.readonly) {
    e.cancelBubble = true;
    emit('entity-click');
    const underlying = pointCoveredByVehicleIcon(v);
    if (underlying) {
      emit('vehicle-point-overlap-click', {
        vehicleName: v.name,
        pointName: underlying.name,
        clientX: e.evt.clientX,
        clientY: e.evt.clientY,
      });
      return;
    }
    emit('vehicle-click', v.name);
    return;
  }

  if (props.tool === 'path') {
    const point = pointNearPointer(e) ?? pointUnderVehicle(v);
    if (point) {
      onPointClick(point, e);
      return;
    }
  }

  emit('entity-click');
  // Alt+Click: hard pass-through to whatever Point is underneath the
  // vehicle, so the user can always reach a Point that the vehicle
  // visually covers.
  if (e.evt && e.evt.altKey) {
    const underlying = pointUnderVehicle(v);
    if (underlying) {
      e.cancelBubble = true;
      store.select({ kind: 'point', name: underlying.name });
      return;
    }
  }
  // No-modifier click: if a Point is under the vehicle, cycle the
  // selection between Point <-> Vehicle each time the user clicks the
  // overlapping cluster. Otherwise fall back to "select the vehicle".
  e.cancelBubble = true;
  const underlying = pointUnderVehicle(v);
  if (underlying) {
    const sel = store.selection;
    const pointSelected = sel?.kind === 'point' && sel.name === underlying.name;
    if (pointSelected) {
      store.select({ kind: 'vehicle', name: v.name });
    } else {
      store.select({ kind: 'point', name: underlying.name });
    }
    return;
  }
  store.select({ kind: 'vehicle', name: v.name });
}

function onVehicleDragStart(v: DraftVehicle, e: KonvaEventObject<DragEvent>): void {
  if (props.readonly) {
    e.target.stopDrag();
    const pos = vehiclePixel(v);
    e.target.position({ x: pos.x, y: pos.y });
    return;
  }
  if (props.tool !== 'select') {
    e.target.stopDrag();
    e.target.position({ x: v.layout.pixelX, y: v.layout.pixelY });
    return;
  }
  // S9 protective semantics: when the kernel SSE has reported a
  // currentPosition for this vehicle, dragging only mutates the editor
  // draft (it doesn't push the vehicle on the kernel side). Confirm
  // before accepting the drag so the operator doesn't accidentally
  // diverge the draft layout from the live state.
  if (vehicleIsLive(v)) {
    const ok =
      typeof window !== 'undefined'
        ? window.confirm(
            `车辆 ${v.name} 正受 kernel 控制（SSE 在线）。\n` +
              `本次拖动只会修改编辑模型，不会影响在线坐标。\n` +
              `确认继续？`,
          )
        : true;
    if (!ok) {
      e.target.stopDrag();
      e.target.position({ x: v.layout.pixelX, y: v.layout.pixelY });
      return;
    }
  }
  e.cancelBubble = true;
  store.select({ kind: 'vehicle', name: v.name });
  store.beginHistoryTransaction('移动 Vehicle');
}

function onVehicleDragMove(v: DraftVehicle, e: KonvaEventObject<DragEvent>): void {
  if (props.readonly) return;
  if (props.tool !== 'select') return;
  const node = e.target as Konva.Node;
  store.moveVehicle(v.name, { x: node.x(), y: node.y() });
}

function onVehicleDragEnd(): void {
  store.commitHistoryTransaction();
}

/* The Point / Location / Vehicle are `draggable` only under the select
 * tool; in creation tools we still want clicks but not accidental drags. */
function isEntityDraggable(): boolean {
  if (props.readonly) return false;
  return props.tool === 'select';
}

/* ---------------- AGV measured-position ("实测点") layer ---------------- */
//
// Rendered as a small red crosshair + filled centre dot at the vehicle's
// `precisePosition` (mm) projected through the background's AffineMapping.
// Visually distinct from:
//   - the Point circle (green / blue, larger, on grid)
//   - the Vehicle rectangle (state-coloured, oriented body)
// so the operator can see "实测停靠点 vs 最近 Point 距离 vs 容差" at a glance.

interface PreciseMarker {
  name: string;
  x: number;
  y: number;
  orientationDeg: number | null;
  currentPosition: string | null;
  positionMm: { x: number; y: number; z: number };
}

const PRECISE_MARKER_CSS_PX = 5; // half-length of crosshair arms / dot radius
const PRECISE_MARKER_HIT_CSS_PX = 12;
const PRECISE_STROKE_CSS_PX = 1.4;
const PRECISE_FILL = '#cf222e'; // GitHub red.500
const PRECISE_STROKE = '#ffffff'; // white outline so it's visible on dark bg

const preciseMarkerHalf = computed(() => PRECISE_MARKER_CSS_PX / safeScale(props.scale));
const preciseMarkerHitRadius = computed(() => PRECISE_MARKER_HIT_CSS_PX / safeScale(props.scale));
const preciseMarkerStroke = computed(() => PRECISE_STROKE_CSS_PX / safeScale(props.scale));
const preciseTooltipOffset = computed(() => 12 / safeScale(props.scale));
const preciseTooltipFontSize = computed(() => 11 / safeScale(props.scale));
const preciseTooltipPadding = computed(() => 6 / safeScale(props.scale));

const hoveredPreciseVehicleName = ref<string | null>(null);
const pinnedPreciseVehicleName = ref<string | null>(null);

const preciseMarkers = computed<PreciseMarker[]>(() => {
  const out: PreciseMarker[] = [];
  for (const o of vehicleOverlay.value) {
    if (!o.precisePixel || !o.precisePositionMm) continue;
    out.push({
      name: o.name,
      x: o.precisePixel.x,
      y: o.precisePixel.y,
      orientationDeg: o.preciseOrientationDeg,
      currentPosition: o.currentPosition,
      positionMm: o.precisePositionMm,
    });
  }
  return out;
});

const activePreciseMarker = computed<PreciseMarker | null>(() => {
  const activeName = hoveredPreciseVehicleName.value ?? pinnedPreciseVehicleName.value;
  if (!activeName) return null;
  return preciseMarkers.value.find((marker) => marker.name === activeName) ?? null;
});

function formatMeters(mm: number): string {
  return (mm / 1000).toFixed(3);
}

function formatMm(mm: number): string {
  return Math.round(mm).toString();
}

function formatYaw(deg: number | null): string {
  return deg === null ? '—' : `${deg.toFixed(1)}°`;
}

function preciseMarkerTooltip(marker: PreciseMarker): string {
  return [
    `${marker.name} 实测坐标`,
    `currentPosition: ${marker.currentPosition ?? '—'}`,
    `x: ${formatMeters(marker.positionMm.x)} m (${formatMm(marker.positionMm.x)} mm)`,
    `y: ${formatMeters(marker.positionMm.y)} m (${formatMm(marker.positionMm.y)} mm)`,
    `yaw: ${formatYaw(marker.orientationDeg)}`,
  ].join('\n');
}

function onPreciseMarkerEnter(marker: PreciseMarker): void {
  hoveredPreciseVehicleName.value = marker.name;
}

function onPreciseMarkerLeave(marker: PreciseMarker): void {
  if (hoveredPreciseVehicleName.value === marker.name) {
    hoveredPreciseVehicleName.value = null;
  }
}

function onPreciseMarkerClick(marker: PreciseMarker, e: KonvaEventObject<MouseEvent>): void {
  e.cancelBubble = true;
  emit('entity-click');
  pinnedPreciseVehicleName.value =
    pinnedPreciseVehicleName.value === marker.name ? null : marker.name;
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

    <!-- Paths next so they sit visually under the Points. Bidirectional
         pairs (A->B + B->A) bend in opposite directions via a quadratic
         Bézier so each branch has its own visual track and click-zone.
         Single-direction paths stay straight. -->
    <template v-for="rp in renderedPathGeoms" :key="rp.path.name">
      <v-path
        :config="{
          data: rp.pathData,
          stroke: pathStrokeColor(rp),
          strokeWidth: isMemberHighlighted(rp.path.name) ? pathStroke * 2 : pathStroke,
          dash: rp.path.locked ? [arrowSize, arrowSize] : undefined,
          hitStrokeWidth: Math.max(8, pathStroke * 4),
          listening: true,
          name: 'draft-path',
        }"
        @click="(e: KonvaEventObject<MouseEvent>) => onPathClick(rp, e)"
        @tap="(e: KonvaEventObject<MouseEvent>) => onPathClick(rp, e)"
      />
      <v-line
        v-if="rp.arrowHeadPoints.length === 6"
        :config="{
          points: rp.arrowHeadPoints,
          fill: pathStrokeColor(rp),
          stroke: pathStrokeColor(rp),
          strokeWidth: pathStroke,
          closed: true,
          listening: false,
        }"
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
        @dragend="onLocationDragEnd"
      />
      <v-text
        v-if="entityLabelsVisible"
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

    <!-- PR3: Point tolerance circles — rendered before Points so the small
         circle (the Point itself) draws on top of the dashed outline. -->
    <template v-for="ring in toleranceRings" :key="`tol-${ring.pointName}`">
      <v-circle
        :config="{
          x: ring.x,
          y: ring.y,
          radius: ring.radius,
          stroke: ring.selected ? TOLERANCE_STROKE_SELECTED : TOLERANCE_STROKE_DEFAULT,
          strokeWidth: toleranceStrokeWidth,
          dash: [toleranceStrokeWidth * 4, toleranceStrokeWidth * 3],
          listening: false,
          opacity: ring.selected ? 0.8 : 0.45,
          name: 'point-tolerance',
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
        @dragend="onPointDragEnd"
      />
      <v-text
        v-if="entityLabelsVisible"
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
      <v-circle
        v-if="vehicleSelected(v)"
        :config="{
          x: vehiclePixel(v).x,
          y: vehiclePixel(v).y,
          radius: vehicleHaloRadius,
          fill: VEHICLE_SELECTED_HALO_FILL,
          stroke: VEHICLE_SELECTED_HALO_STROKE,
          strokeWidth: vehicleHaloStrokeWidth,
          listening: false,
          name: 'selected-vehicle-halo',
        }"
      />
      <v-rect
        :config="{
          x: vehiclePixel(v).x,
          y: vehiclePixel(v).y,
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
        @dragend="onVehicleDragEnd"
      />
      <v-text
        v-if="entityLabelsVisible"
        :config="{
          x: vehiclePixel(v).x + vehicleLength * 0.6,
          y: vehiclePixel(v).y - vehicleWidth * 0.6,
          text: v.name,
          fontSize: labelFontSize,
          fill: '#1f2328',
          listening: false,
        }"
      />
    </template>

    <!-- External point focus marker: drawn above vehicles so a searched Point stays visible. -->
    <template v-for="p in store.points" :key="`point-focus-${p.name}`">
      <v-circle
        v-if="pointSelected(p)"
        :config="{
          x: p.layout.pixelX,
          y: p.layout.pixelY,
          radius: pointSelectedHaloRadius,
          stroke: '#ff7b2f',
          strokeWidth: pointSelectedHaloStroke,
          dash: [pointSelectedHaloStroke * 2, pointSelectedHaloStroke * 1.4],
          listening: false,
          name: 'selected-point-halo',
        }"
      />
    </template>

    <!-- AGV measured-position markers ("实测点"): rendered last so they
         sit above the Vehicle body and Points. A red crosshair + centre
         dot makes them visually unambiguous against the green/blue
         editor entities. -->
    <template v-for="m in preciseMarkers" :key="`precise-${m.name}`">
      <v-group
        :config="{
          x: m.x,
          y: m.y,
          listening: true,
          name: 'agv-precise-marker',
        }"
        @mouseenter="() => onPreciseMarkerEnter(m)"
        @mouseleave="() => onPreciseMarkerLeave(m)"
        @click="(e: KonvaEventObject<MouseEvent>) => onPreciseMarkerClick(m, e)"
        @tap="(e: KonvaEventObject<MouseEvent>) => onPreciseMarkerClick(m, e)"
      >
        <v-circle
          :config="{
            radius: preciseMarkerHitRadius,
            fill: PRECISE_FILL,
            opacity: 0.001,
            listening: true,
            name: 'agv-precise-hit',
          }"
        />
        <v-line
          :config="{
            points: [-preciseMarkerHalf, 0, preciseMarkerHalf, 0],
            stroke: PRECISE_FILL,
            strokeWidth: preciseMarkerStroke,
            listening: false,
            name: 'agv-precise-crosshair',
          }"
        />
        <v-line
          :config="{
            points: [0, -preciseMarkerHalf, 0, preciseMarkerHalf],
            stroke: PRECISE_FILL,
            strokeWidth: preciseMarkerStroke,
            listening: false,
            name: 'agv-precise-crosshair',
          }"
        />
        <v-circle
          :config="{
            radius: preciseMarkerStroke * 1.2,
            fill: PRECISE_FILL,
            stroke: PRECISE_STROKE,
            strokeWidth: preciseMarkerStroke * 0.6,
            listening: false,
            name: 'agv-precise-dot',
          }"
        />
      </v-group>
      <v-text
        v-if="entityLabelsVisible"
        :config="{
          x: m.x + preciseMarkerHalf * 1.4,
          y: m.y + preciseMarkerHalf * 0.4,
          text: `实测·${m.name}`,
          fontSize: labelFontSize * 0.9,
          fill: PRECISE_FILL,
          listening: false,
        }"
      />
    </template>
    <v-label
      v-if="activePreciseMarker"
      :config="{
        x: activePreciseMarker.x + preciseTooltipOffset,
        y: activePreciseMarker.y - preciseTooltipOffset,
        listening: false,
      }"
    >
      <v-tag
        :config="{
          fill: '#24292f',
          opacity: 0.92,
          cornerRadius: 4 / safeScale(props.scale),
          pointerDirection: 'left',
          pointerWidth: 8 / safeScale(props.scale),
          pointerHeight: 8 / safeScale(props.scale),
          lineJoin: 'round',
        }"
      />
      <v-text
        :config="{
          text: preciseMarkerTooltip(activePreciseMarker),
          fontSize: preciseTooltipFontSize,
          lineHeight: 1.25,
          padding: preciseTooltipPadding,
          fill: '#ffffff',
          fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
        }"
      />
    </v-label>
  </v-layer>
</template>
