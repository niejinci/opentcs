// SPDX-FileCopyrightText: The openTCS Authors
// SPDX-License-Identifier: MIT
//
// Canvas editor tool definitions.
//
// Tool IDs (`select` / `point` / `path`) are stable strings that future
// stores, hotkey maps, and analytics can pin to. Keep additions strictly
// additive.

export type EditorToolId = 'select' | 'point' | 'path' | 'location' | 'block' | 'vehicle';

export interface EditorToolMeta {
  id: EditorToolId;
  /** Short Chinese label for toolbar buttons. */
  label: string;
  /** One-character keyboard shortcut (uppercase, matched case-insensitively). */
  hotkey: string;
  /** CSS cursor value used by MapStage when this tool is active. */
  cursor: string;
  /** Tooltip / status-bar hint. */
  hint: string;
  /** Roadmap milestone where this tool actually starts mutating the model. */
  milestone: 'S5' | 'S6';
}

export const EDITOR_TOOLS: readonly EditorToolMeta[] = Object.freeze([
  {
    id: 'select',
    label: '选择',
    hotkey: 'V',
    cursor: 'default',
    hint: '选择 / 拖动既有实体；点击实体编辑属性；Delete 删除',
    milestone: 'S5',
  },
  {
    id: 'point',
    label: '画点',
    hotkey: 'P',
    cursor: 'crosshair',
    hint: '点击空白处新建 Point（默认 HALT_POSITION）',
    milestone: 'S5',
  },
  {
    id: 'path',
    label: '画路径',
    hotkey: 'L',
    cursor: 'crosshair',
    hint: '依次点击两个 Point 创建有向 Path；Esc 取消',
    milestone: 'S5',
  },
  {
    id: 'location',
    label: '画站点',
    hotkey: 'O',
    cursor: 'crosshair',
    hint: '点击空白处新建 Location；首次会自动创建一个 LocationType',
    milestone: 'S6',
  },
  {
    id: 'block',
    label: '画区块',
    hotkey: 'B',
    cursor: 'crosshair',
    hint: '点击画布新建空 Block；在属性面板勾选 Point / Path / Location 作为成员',
    milestone: 'S6',
  },
  {
    id: 'vehicle',
    label: '画车',
    hotkey: 'K',
    cursor: 'crosshair',
    hint: '点击空白处放置一台 Vehicle；属性面板编辑尺寸 / 朝向 / 速度等',
    milestone: 'S6',
  },
]);

const BY_ID = new Map(EDITOR_TOOLS.map((t) => [t.id, t]));
const BY_HOTKEY = new Map(EDITOR_TOOLS.map((t) => [t.hotkey.toLowerCase(), t]));

export function getEditorTool(id: EditorToolId): EditorToolMeta {
  const meta = BY_ID.get(id);
  if (!meta) throw new Error(`Unknown editor tool id: ${id}`);
  return meta;
}

/** Returns the tool matching a single-character hotkey, or `null`. */
export function editorToolForHotkey(key: string): EditorToolMeta | null {
  if (key.length !== 1) return null;
  return BY_HOTKEY.get(key.toLowerCase()) ?? null;
}
