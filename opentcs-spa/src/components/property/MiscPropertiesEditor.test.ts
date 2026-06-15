// SPDX-FileCopyrightText: The openTCS Authors
// SPDX-License-Identifier: MIT

import { beforeEach, describe, expect, it } from 'vitest';
import { mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';

import MiscPropertiesEditor from '@/components/property/MiscPropertiesEditor.vue';
import type { DraftPoint } from '@/domain/model/types';
import { useProjectStore } from '@/stores/project';

function point(name: string): DraftPoint {
  return {
    name,
    type: 'HALT_POSITION',
    pose: { position: { x: 0, y: 0, z: 0 }, orientationAngle: Number.NaN },
    layout: { pixelX: 0, pixelY: 0 },
    properties: {
      'vda5050:orientationType.forward': 'GLOBAL',
    },
  };
}

describe('MiscPropertiesEditor', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    localStorage.clear();
  });

  it('exposes full property keys and values via native hover titles', async () => {
    const store = useProjectStore();
    store.points.push(point('Point-1'));

    const wrapper = mount(MiscPropertiesEditor, {
      props: { kind: 'point', name: 'Point-1' },
    });

    const existingInputs = wrapper.findAll('li.row input');
    expect(existingInputs[0].attributes('title')).toBe('vda5050:orientationType.forward');
    expect(existingInputs[1].attributes('title')).toBe('GLOBAL');

    const addInputs = wrapper.findAll('.row--add input');
    await addInputs[0].setValue('custom:very.long.property.key');
    await addInputs[1].setValue('custom long property value');

    expect(addInputs[0].attributes('title')).toBe('custom:very.long.property.key');
    expect(addInputs[1].attributes('title')).toBe('custom long property value');
  });
});
