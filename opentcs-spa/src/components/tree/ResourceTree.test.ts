// SPDX-FileCopyrightText: The openTCS Authors
// SPDX-License-Identifier: MIT
//
// Smoke tests for ResourceTree (PR1: pr-add-resource-tree-select).
//
// The store is the single source of truth for selection; the tree must
// (a) render every kind, (b) write selection on click, (c) mirror an
// externally driven selection (e.g. from a canvas click), (d) collapse /
// expand groups, (e) support keyboard navigation, and (f) drop the
// highlight when the selected entity disappears (ties into the store's
// own deleteSelected() cascade).

import { beforeEach, describe, expect, it } from 'vitest';
import { mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';

import ResourceTree from '@/components/tree/ResourceTree.vue';
import type {
  DraftBlock,
  DraftLocation,
  DraftLocationType,
  DraftPath,
  DraftPoint,
  DraftVehicle,
} from '@/domain/model/types';
import { useProjectStore } from '@/stores/project';

function makePoint(name: string, pixelX = 0): DraftPoint {
  return {
    name,
    type: 'HALT_POSITION',
    pose: { position: { x: 0, y: 0, z: 0 }, orientationAngle: Number.NaN },
    layout: { pixelX, pixelY: 0 },
    properties: {},
  };
}
function makePath(name: string, src: string, dst: string): DraftPath {
  return {
    name,
    srcPointName: src,
    destPointName: dst,
    length: 1000,
    maxVelocity: 1000,
    maxReverseVelocity: 0,
    locked: false,
    properties: {},
  };
}
function makeLocationType(name: string): DraftLocationType {
  return {
    name,
    allowedOperations: [],
    allowedPeripheralOperations: [],
    properties: {},
  } as unknown as DraftLocationType;
}
function makeLocation(name: string, typeName: string): DraftLocation {
  return {
    name,
    typeName,
    position: { x: 0, y: 0, z: 0 },
    layout: { pixelX: 0, pixelY: 0, representation: 'NONE' as never },
    links: [],
    properties: {},
  } as unknown as DraftLocation;
}
function makeBlock(name: string): DraftBlock {
  return {
    name,
    type: 'SINGLE_VEHICLE_ONLY',
    memberNames: [],
    properties: {},
  } as unknown as DraftBlock;
}
function makeVehicle(name: string): DraftVehicle {
  return {
    name,
    length: 1000,
    width: 600,
    energyLevelCritical: 30,
    energyLevelGood: 90,
    energyLevelFullyRecharged: 100,
    energyLevelSufficientlyRecharged: 50,
    maxVelocity: 1000,
    maxReverseVelocity: 0,
    layout: { pixelX: 0, pixelY: 0, orientationAngle: 0 },
    properties: {},
  } as unknown as DraftVehicle;
}

/**
 * Seed the store with one entity of every kind so all six groups are
 * non-empty. Returns the store handle for further per-test tweaks.
 */
function seedAllKinds(): ReturnType<typeof useProjectStore> {
  const store = useProjectStore();
  store.points.push(makePoint('P-1'), makePoint('P-2'));
  store.paths.push(makePath('Pa-1', 'P-1', 'P-2'));
  store.locationTypes.push(makeLocationType('LT-1'));
  store.locations.push(makeLocation('L-1', 'LT-1'));
  store.blocks.push(makeBlock('B-1'));
  store.vehicles.push(makeVehicle('V-1'));
  return store;
}

describe('ResourceTree', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  it('renders all six groups with a count badge', () => {
    seedAllKinds();
    const wrapper = mount(ResourceTree);

    const groupRows = wrapper.findAll('.group__row');
    expect(groupRows).toHaveLength(6);

    const labels = groupRows.map((r) => r.find('.group__label').text());
    expect(labels).toEqual(['Points', 'Paths', 'LocationTypes', 'Locations', 'Blocks', 'Vehicles']);

    // Counts: 2 points, 1 each of the others.
    const counts = groupRows.map((r) => r.find('.group__count').text());
    expect(counts).toEqual(['2', '1', '1', '1', '1', '1']);
  });

  it('renders empty groups with a placeholder and zero count', () => {
    const wrapper = mount(ResourceTree);
    const counts = wrapper.findAll('.group__count').map((n) => n.text());
    expect(counts).toEqual(['0', '0', '0', '0', '0', '0']);
    // Each group renders the placeholder li.
    expect(wrapper.findAll('.empty')).toHaveLength(6);
  });

  it('sorts leaves by ascending name with numeric collation', () => {
    const store = useProjectStore();
    store.points.push(makePoint('P-10'), makePoint('P-2'), makePoint('P-1'));
    const wrapper = mount(ResourceTree);
    const names = wrapper
      .findAll('[data-kind="point"][data-name]')
      .map((n) => n.attributes('data-name'));
    expect(names).toEqual(['P-1', 'P-2', 'P-10']);
  });

  it('writes store.selection on leaf click', async () => {
    const store = seedAllKinds();
    const wrapper = mount(ResourceTree);

    await wrapper.get('[data-kind="point"][data-name="P-2"]').trigger('click');
    expect(store.selection).toEqual({ kind: 'point', name: 'P-2' });
  });

  it('reflects an externally driven selection via aria-selected', async () => {
    const store = seedAllKinds();
    const wrapper = mount(ResourceTree);

    // Simulate a canvas-driven selection.
    store.select({ kind: 'vehicle', name: 'V-1' });
    await wrapper.vm.$nextTick();

    const v = wrapper.get('[data-kind="vehicle"][data-name="V-1"]');
    expect(v.attributes('aria-selected')).toBe('true');
    expect(v.classes()).toContain('is-selected');

    // Other leaves stay unselected.
    const other = wrapper.get('[data-kind="point"][data-name="P-1"]');
    expect(other.attributes('aria-selected')).toBe('false');
  });

  it('collapses and expands a group on header click', async () => {
    seedAllKinds();
    const wrapper = mount(ResourceTree);

    const pointGroup = wrapper.findAll('.group')[0]!;
    expect(pointGroup.attributes('aria-expanded')).toBe('true');

    await pointGroup.find('.group__row').trigger('click');
    expect(pointGroup.attributes('aria-expanded')).toBe('false');

    await pointGroup.find('.group__row').trigger('click');
    expect(pointGroup.attributes('aria-expanded')).toBe('true');
  });

  it('moves roving focus and selects with keyboard', async () => {
    const store = seedAllKinds();
    const wrapper = mount(ResourceTree, { attachTo: document.body });

    const tree = wrapper.get('[role="tree"]');

    // Start at first group (Points). ArrowDown → first leaf P-1.
    await tree.trigger('keydown', { key: 'ArrowDown' });
    await wrapper.vm.$nextTick();
    expect(wrapper.get('[data-kind="point"][data-name="P-1"]').attributes('tabindex')).toBe('0');

    // Enter selects the focused leaf.
    await tree.trigger('keydown', { key: 'Enter' });
    expect(store.selection).toEqual({ kind: 'point', name: 'P-1' });

    // ArrowLeft from a leaf collapses parent group + moves focus to it.
    await tree.trigger('keydown', { key: 'ArrowLeft' });
    await wrapper.vm.$nextTick();
    const pointGroup = wrapper.findAll('.group')[0]!;
    expect(pointGroup.attributes('aria-expanded')).toBe('false');
    expect(pointGroup.find('.group__row').attributes('tabindex')).toBe('0');

    // ArrowRight expands; ArrowRight again jumps to the first child.
    await tree.trigger('keydown', { key: 'ArrowRight' });
    await wrapper.vm.$nextTick();
    expect(pointGroup.attributes('aria-expanded')).toBe('true');
    await tree.trigger('keydown', { key: 'ArrowRight' });
    await wrapper.vm.$nextTick();
    expect(wrapper.get('[data-kind="point"][data-name="P-1"]').attributes('tabindex')).toBe('0');

    // Home → first node (Points group).
    await tree.trigger('keydown', { key: 'Home' });
    await wrapper.vm.$nextTick();
    expect(pointGroup.find('.group__row').attributes('tabindex')).toBe('0');

    // End → last visible node (Vehicle V-1).
    await tree.trigger('keydown', { key: 'End' });
    await wrapper.vm.$nextTick();
    expect(wrapper.get('[data-kind="vehicle"][data-name="V-1"]').attributes('tabindex')).toBe('0');

    wrapper.unmount();
  });

  it('drops the highlight when the selected entity disappears', async () => {
    const store = seedAllKinds();
    const wrapper = mount(ResourceTree);

    store.select({ kind: 'point', name: 'P-1' });
    await wrapper.vm.$nextTick();
    expect(wrapper.get('[data-kind="point"][data-name="P-1"]').attributes('aria-selected')).toBe(
      'true',
    );

    // Simulate the cascade that store.deleteSelected() performs.
    store.points.splice(
      store.points.findIndex((p) => p.name === 'P-1'),
      1,
    );
    store.select(null);
    await wrapper.vm.$nextTick();

    expect(wrapper.find('[data-kind="point"][data-name="P-1"]').exists()).toBe(false);
    expect(wrapper.findAll('.leaf.is-selected')).toHaveLength(0);
  });
});
