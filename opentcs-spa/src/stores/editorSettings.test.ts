// SPDX-FileCopyrightText: The openTCS Authors
// SPDX-License-Identifier: MIT

import { beforeEach, describe, expect, it } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';

import {
  DEFAULT_SIDEBAR_WIDTH_PX,
  DEFAULT_VEHICLE_PANEL_HEIGHT_PX,
  MAX_SIDEBAR_WIDTH_PX,
  MAX_STATUS_PANEL_HEIGHT_PX,
  MIN_SIDEBAR_WIDTH_PX,
  MIN_STATUS_PANEL_HEIGHT_PX,
  clampSidebarWidthPx,
  clampStatusPanelHeightPx,
  useEditorSettingsStore,
} from '@/stores/editorSettings';

describe('editorSettings layout sizing', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    localStorage.clear();
  });

  it('clamps right sidebar width', () => {
    expect(clampSidebarWidthPx(Number.NaN)).toBe(DEFAULT_SIDEBAR_WIDTH_PX);
    expect(clampSidebarWidthPx(MIN_SIDEBAR_WIDTH_PX - 1)).toBe(MIN_SIDEBAR_WIDTH_PX);
    expect(clampSidebarWidthPx(MAX_SIDEBAR_WIDTH_PX + 1)).toBe(MAX_SIDEBAR_WIDTH_PX);
  });

  it('clamps status panel heights', () => {
    expect(clampStatusPanelHeightPx(Number.NaN)).toBe(DEFAULT_VEHICLE_PANEL_HEIGHT_PX);
    expect(clampStatusPanelHeightPx(MIN_STATUS_PANEL_HEIGHT_PX - 1)).toBe(
      MIN_STATUS_PANEL_HEIGHT_PX,
    );
    expect(clampStatusPanelHeightPx(MAX_STATUS_PANEL_HEIGHT_PX + 1)).toBe(
      MAX_STATUS_PANEL_HEIGHT_PX,
    );
  });

  it('stores resizable sidebar and status-panel dimensions through setters', () => {
    const store = useEditorSettingsStore();

    store.setSidebarWidthPx(MAX_SIDEBAR_WIDTH_PX + 100);
    store.setVehiclePanelHeightPx(MIN_STATUS_PANEL_HEIGHT_PX - 100);
    store.setOrderPanelHeightPx(MAX_STATUS_PANEL_HEIGHT_PX + 100);

    expect(store.sidebarWidthPx).toBe(MAX_SIDEBAR_WIDTH_PX);
    expect(store.vehiclePanelHeightPx).toBe(MIN_STATUS_PANEL_HEIGHT_PX);
    expect(store.orderPanelHeightPx).toBe(MAX_STATUS_PANEL_HEIGHT_PX);
  });
});
