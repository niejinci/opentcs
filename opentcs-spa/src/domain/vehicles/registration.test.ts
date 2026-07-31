// SPDX-FileCopyrightText: The openTCS Authors
// SPDX-License-Identifier: MIT

import { describe, expect, it } from 'vitest';

import {
  BYD_AGV_PROPERTY_KEYS,
  TCS_PROPERTY_KEYS,
  VDA5050_COMM_ADAPTER_CLASS,
  VDA5050_PROPERTY_KEYS,
  VDA5050_VERSION,
  buildAgvVehicleProperties,
  effectiveTopicPrefixForForm,
  validateAgvRegistrationForm,
  validateVda5050VehicleProperties,
  type AgvRegistrationForm,
} from './registration';

function validForm(overrides: Partial<AgvRegistrationForm> = {}): AgvRegistrationForm {
  return {
    name: 'AGV-1',
    model: 'BYD-1500',
    region: '深圳焊装',
    macAddress: '00:11:22:33:44:55',
    topicPrefix: '',
    interfaceName: 'VDA',
    manufacturer: 'BYD_11',
    serialNumber: 'DP0055',
    ...overrides,
  };
}

describe('AGV registration validation', () => {
  it('derives a VDA5050 v2 topic prefix from interfaceName/manufacturer/serialNumber', () => {
    expect(effectiveTopicPrefixForForm(validForm())).toBe('VDA/v2/BYD_11/DP0055');
  });

  it('uses explicit topicPrefix before interfaceName', () => {
    expect(
      effectiveTopicPrefixForForm(
        validForm({ topicPrefix: 'VDA/V2.0.0/BYD_11/DP0055', interfaceName: 'IGNORED' }),
      ),
    ).toBe('VDA/V2.0.0/BYD_11/DP0055');
  });

  it('requires either topicPrefix or interfaceName', () => {
    const issues = validateAgvRegistrationForm(
      validForm({ topicPrefix: '', interfaceName: '' }),
      [],
    );

    expect(issues.map((issue) => issue.field)).toContain('effectiveTopicPrefix');
  });

  it('rejects duplicate MQTT identity, effective topic prefix and MAC address', () => {
    const existing = [
      {
        name: 'AGV-0',
        properties: buildAgvVehicleProperties(validForm({ name: 'AGV-0' })),
      },
    ];

    const issues = validateAgvRegistrationForm(validForm({ name: 'AGV-2' }), existing);

    expect(issues.map((issue) => issue.field)).toEqual(
      expect.arrayContaining(['macAddress', 'effectiveTopicPrefix', 'serialNumber']),
    );
  });

  it('writes only non-empty optional VDA5050 fields and preserves unrelated properties', () => {
    const properties = buildAgvVehicleProperties(validForm({ topicPrefix: '', macAddress: '' }), {
      'custom:key': 'kept',
      [VDA5050_PROPERTY_KEYS.topicPrefix]: 'old',
      [BYD_AGV_PROPERTY_KEYS.macAddress]: 'AA:BB:CC:DD:EE:FF',
    });

    expect(properties['custom:key']).toBe('kept');
    expect(properties[TCS_PROPERTY_KEYS.preferredAdapterClass]).toBe(VDA5050_COMM_ADAPTER_CLASS);
    expect(properties[VDA5050_PROPERTY_KEYS.version]).toBe(VDA5050_VERSION);
    expect(properties[VDA5050_PROPERTY_KEYS.interfaceName]).toBe('VDA');
    expect(properties[VDA5050_PROPERTY_KEYS.topicPrefix]).toBeUndefined();
    expect(properties[BYD_AGV_PROPERTY_KEYS.macAddress]).toBeUndefined();
  });

  it('validates VDA5050 properties without requiring BYD registry fields', () => {
    const issues = validateVda5050VehicleProperties('Vehicle-1', {
      [TCS_PROPERTY_KEYS.preferredAdapterClass]: VDA5050_COMM_ADAPTER_CLASS,
      [VDA5050_PROPERTY_KEYS.version]: '2.0',
      [VDA5050_PROPERTY_KEYS.interfaceName]: 'VDA',
      [VDA5050_PROPERTY_KEYS.manufacturer]: 'BYD_11',
      [VDA5050_PROPERTY_KEYS.serialNumber]: 'DP0055',
    });

    expect(issues).toEqual([]);
  });
});
