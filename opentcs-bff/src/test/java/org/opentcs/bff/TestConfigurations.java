// SPDX-FileCopyrightText: The openTCS Authors
// SPDX-License-Identifier: MIT
package org.opentcs.bff;

/**
 * Test fixtures for BFF unit tests.
 */
final class TestConfigurations {

  private TestConfigurations() {
  }

  /**
   * Returns a {@link BffConfiguration} bound to the given address and port.
   *
   * @param bindAddress The bind address.
   * @param bindPort The bind port.
   * @return A {@link BffConfiguration} bound to the given address and port.
   */
  static BffConfiguration bff(String bindAddress, int bindPort) {
    return new BffConfiguration() {
      @Override
      public String bindAddress() {
        return bindAddress;
      }

      @Override
      public int bindPort() {
        return bindPort;
      }
    };
  }
}
