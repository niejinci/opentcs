// SPDX-FileCopyrightText: The openTCS Authors
// SPDX-License-Identifier: MIT
package org.opentcs.bff;

import com.google.inject.Guice;
import com.google.inject.Injector;
import java.nio.file.Paths;
import org.opentcs.bff.kernel.BffKernelConfiguration;
import org.opentcs.bff.kernel.KernelClient;
import org.opentcs.bff.project.BffWorkspaceConfiguration;
import org.opentcs.bff.security.BffSecurityConfiguration;
import org.opentcs.configuration.ConfigurationBindingProvider;
import org.opentcs.configuration.gestalt.GestaltConfigurationBindingProvider;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

/**
 * Default entry point for the openTCS SPA backend (BFF) process.
 *
 * <p>Resolves configuration via Gestalt (mirroring {@code RunModelEditor}), wires up Guice with
 * {@link BffModule}, obtains a {@link BffApplication} instance and starts it. A JVM shutdown hook
 * stops the application and closes the {@link KernelClient} cleanly on SIGTERM/SIGINT.
 */
public final class RunBff {

  private static final Logger LOG = LoggerFactory.getLogger(RunBff.class);

  private RunBff() {
  }

  /**
   * The BFF process entry point.
   *
   * @param args Command line arguments (currently ignored).
   */
  public static void main(String[] args) {
    LOG.info("Starting openTCS BFF...");

    ConfigurationBindingProvider bindingProvider = configurationBindingProvider();
    BffConfiguration bffConfig
        = bindingProvider.get(BffConfiguration.PREFIX, BffConfiguration.class);
    BffKernelConfiguration kernelConfig
        = bindingProvider.get(BffKernelConfiguration.PREFIX, BffKernelConfiguration.class);
    BffSecurityConfiguration securityConfig
        = bindingProvider.get(BffSecurityConfiguration.PREFIX, BffSecurityConfiguration.class);
    BffWorkspaceConfiguration workspaceConfig
        = bindingProvider.get(
            BffWorkspaceConfiguration.PREFIX, BffWorkspaceConfiguration.class
        );

    Injector injector
        = Guice.createInjector(
            new BffModule(bffConfig, kernelConfig, securityConfig, workspaceConfig)
        );
    BffApplication app = injector.getInstance(BffApplication.class);
    KernelClient kernelClient = injector.getInstance(KernelClient.class);

    Runtime.getRuntime().addShutdownHook(
        new Thread(
            () -> {
              app.stop();
              kernelClient.close();
            },
            "bff-shutdown"
        )
    );

    app.start();
  }

  private static ConfigurationBindingProvider configurationBindingProvider() {
    String chosenProvider = System.getProperty("opentcs.configuration.provider", "gestalt");
    switch (chosenProvider) {
      case "gestalt":
      default:
        LOG.info("Using gestalt as the configuration provider.");
        return gestaltConfigurationBindingProvider();
    }
  }

  private static ConfigurationBindingProvider gestaltConfigurationBindingProvider() {
    return new GestaltConfigurationBindingProvider(
        Paths.get(
            System.getProperty("opentcs.base", "."),
            "config",
            "opentcs-bff-defaults-baseline.properties"
        )
            .toAbsolutePath(),
        Paths.get(
            System.getProperty("opentcs.base", "."),
            "config",
            "opentcs-bff-defaults-custom.properties"
        )
            .toAbsolutePath(),
        Paths.get(
            System.getProperty("opentcs.home", "."),
            "config",
            "opentcs-bff.properties"
        )
            .toAbsolutePath()
    );
  }
}
