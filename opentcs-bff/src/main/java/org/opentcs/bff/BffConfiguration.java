// SPDX-FileCopyrightText: The openTCS Authors
// SPDX-License-Identifier: MIT
package org.opentcs.bff;

import static java.util.Objects.requireNonNull;

/**
 * Runtime configuration for the BFF process.
 *
 * <p>For milestone M1 this is a plain immutable value object; M2 will swap the bindings to a
 * Gestalt-backed {@code @ConfigurationPrefix("bff")} interface so the rest of the code does not
 * need to change.
 *
 * @param bindAddress The address the HTTP server binds to.
 * @param bindPort The port the HTTP server binds to. Use {@code 0} to let the OS pick a free port.
 */
public record BffConfiguration(String bindAddress, int bindPort) {

  /**
   * The default port the BFF binds to.
   */
  public static final int DEFAULT_PORT = 8090;
  /**
   * The default address the BFF binds to.
   */
  public static final String DEFAULT_BIND_ADDRESS = "0.0.0.0";

  /**
   * Creates a new instance.
   *
   * @param bindAddress The address the HTTP server binds to.
   * @param bindPort The port the HTTP server binds to. Use {@code 0} to let the OS pick a free
   * port.
   */
  public BffConfiguration {
    requireNonNull(bindAddress, "bindAddress");
    if (bindPort < 0 || bindPort > 65535) {
      throw new IllegalArgumentException("bindPort out of range: " + bindPort);
    }
  }

  /**
   * Returns a configuration with the default bind address and port.
   *
   * @return A configuration with the default bind address and port.
   */
  public static BffConfiguration defaults() {
    return new BffConfiguration(DEFAULT_BIND_ADDRESS, DEFAULT_PORT);
  }
}
