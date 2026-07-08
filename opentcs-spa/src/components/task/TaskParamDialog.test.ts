import { mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { beforeEach, describe, expect, it } from 'vitest';

import TaskParamDialog from './TaskParamDialog.vue';
import {
  CHARGE_DURATION_VALIDATION_MESSAGE,
  createEmptyTaskParams,
  type TaskParams,
} from '@/domain/tasks/createTask';

function params(patch: Partial<TaskParams> = {}): TaskParams {
  return {
    ...createEmptyTaskParams(),
    ...patch,
  };
}

describe('TaskParamDialog', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    localStorage.clear();
  });

  it('keeps the dialog open and shows an error for invalid charge duration', async () => {
    const wrapper = mount(TaskParamDialog, {
      props: {
        modelValue: params({ chargeDurationMinutes: '500' }),
      },
    });

    await wrapper.find('.confirm-button').trigger('click');

    expect(wrapper.text()).toContain(CHARGE_DURATION_VALIDATION_MESSAGE);
    expect(wrapper.emitted('update:modelValue')).toBeUndefined();
    expect(wrapper.emitted('close')).toBeUndefined();
  });

  it('accepts numeric input values and emits charge duration as a string', async () => {
    const wrapper = mount(TaskParamDialog, {
      props: {
        modelValue: params(),
      },
    });

    await wrapper.find('input[type="number"]').setValue(120);
    await wrapper.find('.confirm-button').trigger('click');

    expect(wrapper.emitted('update:modelValue')?.[0]).toEqual([
      params({ chargeDurationMinutes: '120' }),
    ]);
    expect(wrapper.emitted('close')).toHaveLength(1);
  });

  it('binds warehouse type display name to the submitted type code', async () => {
    const wrapper = mount(TaskParamDialog, {
      props: {
        modelValue: params(),
      },
    });

    expect(wrapper.find('select').text()).toContain('后地板面板总成货架');

    await wrapper.find('select').setValue('HJ27HDBMBZC');
    await wrapper.find('.confirm-button').trigger('click');

    expect(wrapper.emitted('update:modelValue')?.[0]).toEqual([
      params({ loadType: 'HJ27HDBMBZC' }),
    ]);
  });

  it('emits updated params for empty or valid charge duration', async () => {
    const wrapper = mount(TaskParamDialog, {
      props: {
        modelValue: params({ chargeDurationMinutes: '480' }),
      },
    });

    await wrapper.find('.confirm-button').trigger('click');

    expect(wrapper.emitted('update:modelValue')?.[0]).toEqual([
      params({ chargeDurationMinutes: '480' }),
    ]);
    expect(wrapper.emitted('close')).toHaveLength(1);
  });
});
