// SPDX-FileCopyrightText: The openTCS Authors
// SPDX-License-Identifier: MIT
package org.opentcs.bff;

import static java.util.Objects.requireNonNull;

import com.google.inject.AbstractModule;

/**
 * Guice bindings for the BFF process.
 *
 * <p>Kept intentionally small for milestone M1: only the configuration value is bound here.
 * Subsequent milestones will add bindings for the kernel client (M2), generated OpenAPI handlers
 * (M3), authentication (M4) and the SSE bridge (M5).
 */
public class BffModule
    extends
      AbstractModule {

  private final BffConfiguration configuration;

  /**
   * Creates a new instance.
   *
   * @param configuration The runtime configuration to expose to injected components.
   */
  public BffModule(BffConfiguration configuration) {
    this.configuration = requireNonNull(configuration, "configuration");
  }

  @Override
  protected void configure() {
    bind(BffConfiguration.class).toInstance(configuration);
  }
}
