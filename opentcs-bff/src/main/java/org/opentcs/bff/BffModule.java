// SPDX-FileCopyrightText: The openTCS Authors
// SPDX-License-Identifier: MIT
package org.opentcs.bff;

import static java.util.Objects.requireNonNull;

import com.google.inject.AbstractModule;
import org.opentcs.bff.kernel.BffKernelConfiguration;
import org.opentcs.bff.kernel.DefaultKernelServicePortalFactory;
import org.opentcs.bff.kernel.KernelServicePortalFactory;

/**
 * Guice bindings for the BFF process.
 *
 * <p>Binds the runtime configuration values (resolved by the entry point from a
 * {@link org.opentcs.configuration.ConfigurationBindingProvider}) and the kernel client wiring.
 * Subsequent milestones will add bindings for the generated OpenAPI handlers (M3),
 * authentication (M4) and the SSE bridge (M5).
 */
public class BffModule
    extends
      AbstractModule {

  private final BffConfiguration configuration;
  private final BffKernelConfiguration kernelConfiguration;

  /**
   * Creates a new instance.
   *
   * @param configuration The runtime configuration to expose to injected components.
   * @param kernelConfiguration The Kernel connection configuration.
   */
  public BffModule(
      BffConfiguration configuration,
      BffKernelConfiguration kernelConfiguration
  ) {
    this.configuration = requireNonNull(configuration, "configuration");
    this.kernelConfiguration = requireNonNull(kernelConfiguration, "kernelConfiguration");
  }

  @Override
  protected void configure() {
    bind(BffConfiguration.class).toInstance(configuration);
    bind(BffKernelConfiguration.class).toInstance(kernelConfiguration);
    bind(KernelServicePortalFactory.class).to(DefaultKernelServicePortalFactory.class);
  }
}
