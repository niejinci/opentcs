// SPDX-FileCopyrightText: The openTCS Authors
// SPDX-License-Identifier: MIT
package org.opentcs.bff.kernel;

import static org.assertj.core.api.Assertions.assertThat;

import java.net.URISyntaxException;
import java.nio.file.Paths;
import org.junit.jupiter.api.Test;
import org.opentcs.bff.BffConfiguration;
import org.opentcs.configuration.ConfigurationBindingProvider;
import org.opentcs.configuration.gestalt.GestaltConfigurationBindingProvider;

/**
 * Verifies that {@link BffConfiguration} and {@link BffKernelConfiguration} can be resolved end-to-
 * end through Gestalt from a properties file.
 */
class BffKernelConfigurationTest {

  @Test
  void resolvesBffAndKernelEntriesFromGestalt()
      throws URISyntaxException {
    ConfigurationBindingProvider provider = new GestaltConfigurationBindingProvider(
        Paths.get(
            Thread.currentThread().getContextClassLoader()
                .getResource("org/opentcs/bff/kernel/test-config.properties").toURI()
        )
    );

    BffConfiguration bff = provider.get(BffConfiguration.PREFIX, BffConfiguration.class);
    assertThat(bff.bindAddress()).isEqualTo("127.0.0.1");
    assertThat(bff.bindPort()).isEqualTo(0);

    BffKernelConfiguration kernel
        = provider.get(BffKernelConfiguration.PREFIX, BffKernelConfiguration.class);
    assertThat(kernel.host()).isEqualTo("kernel.example.com");
    assertThat(kernel.port()).isEqualTo(1199);
    assertThat(kernel.userName()).isEqualTo("bob");
    assertThat(kernel.password()).isEqualTo("s3cret");
  }
}
