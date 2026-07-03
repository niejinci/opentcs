import { mount } from '@vue/test-utils';
import { describe, expect, it } from 'vitest';

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
