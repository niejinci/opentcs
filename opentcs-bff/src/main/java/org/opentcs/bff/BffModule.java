// SPDX-FileCopyrightText: The openTCS Authors
// SPDX-License-Identifier: MIT
package org.opentcs.bff;

import static java.util.Objects.requireNonNull;

import com.google.inject.AbstractModule;
import org.opentcs.bff.kernel.BffKernelConfiguration;
import org.opentcs.bff.kernel.DefaultKernelServicePortalFactory;
import org.opentcs.bff.kernel.KernelServicePortalFactory;
import org.opentcs.bff.security.BffSecurityConfiguration;

/**
 * Guice bindings for the BFF process.
 *
 * <p>Binds the runtime configuration values (resolved by the entry point from a
 * {@link org.opentcs.configuration.ConfigurationBindingProvider}) and the kernel client wiring.
 * The OpenAPI-driven handlers introduced in M3 are auto-wired by Guice via {@code @Inject} and do
 * not require explicit bindings here. Subsequent milestones will add the SSE bridge (M5).
 */
public class BffModule
    extends
      AbstractModule {

  private final BffConfiguration configuration;
  private final BffKernelConfiguration kernelConfiguration;
  private final BffSecurityConfiguration securityConfiguration;

  /**
   * Creates a new instance.
   *
   * @param configuration The runtime configuration to expose to injected components.
   * @param kernelConfiguration The Kernel connection configuration.
   * @param securityConfiguration The HTTP security configuration.
   */
  public BffModule(
      BffConfiguration configuration,
      BffKernelConfiguration kernelConfiguration,
      BffSecurityConfiguration securityConfiguration
  ) {
    this.configuration = requireNonNull(configuration, "configuration");
    this.kernelConfiguration = requireNonNull(kernelConfiguration, "kernelConfiguration");
    this.securityConfiguration = requireNonNull(securityConfiguration, "securityConfiguration");
  }

  @Override
  protected void configure() {
    bind(BffConfiguration.class).toInstance(configuration);
    bind(BffKernelConfiguration.class).toInstance(kernelConfiguration);
    bind(BffSecurityConfiguration.class).toInstance(securityConfiguration);
    bind(KernelServicePortalFactory.class).to(DefaultKernelServicePortalFactory.class);
  }
}
