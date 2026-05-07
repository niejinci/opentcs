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

  /**
   * Returns a {@link org.opentcs.bff.security.BffSecurityConfiguration} configured with the given
   * access key. An empty / {@code null} key disables authentication.
   *
   * @param accessKey The configured access key.
   * @return The configuration.
   */
  static org.opentcs.bff.security.BffSecurityConfiguration security(String accessKey) {
    return () -> accessKey == null ? "" : accessKey;
  }
}
