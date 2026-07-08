import { describe, expect, it } from 'vitest';

import {
  createBlankInstantActionFormState,
  createBlankParameter,
  findInstantActionTemplatesByActionType,
  formStateToInstantActionsRequest,
  templateToFormState,
} from './instantActions';

describe('instant actions', () => {
  it('builds a request from a manually entered action type and dynamic parameters', () => {
    let nextId = 1;
    const form = createBlankInstantActionFormState(() => nextId++);

    form.actionType = 'vendorAction';
    form.actionId = 'action-1';
    form.actionDescription = 'Vendor extension';
    form.parameters = [
      { ...createBlankParameter(nextId++), key: 'mode', kind: 'string', valueText: 'fast' },
      { ...createBlankParameter(nextId++), key: 'enabled', kind: 'boolean', valueText: 'true' },
      createBlankParameter(nextId++),
    ];

    expect(formStateToInstantActionsRequest(form)).toEqual({
      actions: [
        {
          actionType: 'vendorAction',
          actionId: 'action-1',
          actionDescription: 'Vendor extension',
          blockingType: 'NONE',
          actionParameters: [
            { key: 'mode', value: 'fast' },
            { key: 'enabled', value: true },
          ],
        },
      ],
    });
  });

  it('rejects a parameter value without a key', () => {
    let nextId = 1;
    const form = createBlankInstantActionFormState(() => nextId++);

    form.actionType = 'vendorAction';
    form.actionId = 'action-1';
    form.parameters = [
      { ...createBlankParameter(nextId++), key: '', kind: 'string', valueText: 'fast' },
    ];

    expect(() => formStateToInstantActionsRequest(form)).toThrow('参数 key 不能为空');
  });

  it('rejects duplicate parameter keys', () => {
    let nextId = 1;
    const form = createBlankInstantActionFormState(() => nextId++);

    form.actionType = 'vendorAction';
    form.actionId = 'action-1';
    form.parameters = [
      { ...createBlankParameter(nextId++), key: 'mode', kind: 'string', valueText: 'fast' },
      { ...createBlankParameter(nextId++), key: 'mode', kind: 'string', valueText: 'slow' },
    ];

    expect(() => formStateToInstantActionsRequest(form)).toThrow('参数 key 重复：mode');
  });

  it('finds templates by action type without relying on template id', () => {
    const templates = findInstantActionTemplatesByActionType('controlMode');

    expect(templates).toHaveLength(1);
    expect(templates[0].templateId).toBe('controlMode');
    expect(templates[0].blockingType).toBe('HARD');
  });

  it('keeps template parameters editable after template conversion', () => {
    const template = findInstantActionTemplatesByActionType('setDO')[0];
    let nextId = 1;
    const form = templateToFormState(template, () => nextId++);

    form.parameters.push({
      ...createBlankParameter(nextId++),
      key: 'vendorFlag',
      kind: 'number',
      valueText: '7',
    });

    const request = formStateToInstantActionsRequest(form);
    expect(request.actions[0].actionParameters).toContainEqual({ key: 'vendorFlag', value: 7 });
  });

  it('provides dual-arm robot templates with numeric defaults', () => {
    const actionTypes = [
      'dualArmEnable',
      'dualArmSwitchFrame',
      'dualArmSwitchTool',
      'dualArmManualControl',
      'ONE_CLICK_HOMING',
    ];

    expect(
      actionTypes.map(
        (actionType) => findInstantActionTemplatesByActionType(actionType)[0]?.blockingType,
      ),
    ).toEqual(['HARD', 'HARD', 'HARD', 'HARD', 'HARD']);

    const manualControlTemplate = findInstantActionTemplatesByActionType('dualArmManualControl')[0];
    let nextId = 1;
    const manualControlForm = templateToFormState(manualControlTemplate, () => nextId++);
    manualControlForm.actionId = 'manual-control-1';

    expect(formStateToInstantActionsRequest(manualControlForm)).toMatchObject({
      actions: [
        {
          actionType: 'dualArmManualControl',
          blockingType: 'HARD',
          actionParameters: [
            { key: 'is_jogging', value: 0 },
            { key: 'type', value: 1 },
            { key: 'index', value: 1 },
            { key: 'positive', value: 1 },
            { key: 'speed', value: 21 },
          ],
        },
      ],
    });
  });
});
