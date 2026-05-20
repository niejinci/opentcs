// SPDX-FileCopyrightText: The openTCS Authors
// SPDX-License-Identifier: MIT
//
// Canvas editor tool definitions.
//
// S4 deliberately only ships the tool-switching framework — picking a tool
// changes the active cursor and the click-dispatch label, but no Point /
// Path entity is created yet (those land in S5/S6).
//
// Tool IDs (`select` / `point` / `path`) are stable strings that future
// stores, hotkey maps, and analytics can pin to. Keep additions strictly
// additive.

export type EditorToolId = 'select' | 'point' | 'path';

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
    hint: '选择 / 拖动既有实体（S5 起生效）',
    milestone: 'S5',
  },
  {
    id: 'point',
    label: '画点',
    hotkey: 'P',
    cursor: 'crosshair',
    hint: '点击空白处新建 Point（S5 起生效）',
    milestone: 'S5',
  },
  {
    id: 'path',
    label: '画路径',
    hotkey: 'L',
    cursor: 'crosshair',
    hint: '依次点击两个 Point 创建 Path（S5 起生效）',
    milestone: 'S5',
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
