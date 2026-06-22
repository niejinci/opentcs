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
    const templates = findInstantActionTemplatesByActionType('cmd_vel');

    expect(templates).toHaveLength(1);
    expect(templates[0].templateId).toBe('cmd_vel');
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
});
