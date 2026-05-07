// SPDX-FileCopyrightText: The openTCS Authors
// SPDX-License-Identifier: MIT
package org.opentcs.bff;

import org.opentcs.configuration.ConfigurationEntry;
import org.opentcs.configuration.ConfigurationPrefix;

/**
 * Runtime configuration for the BFF process.
 *
 * <p>Bound by Gestalt at startup using the {@link #PREFIX} prefix. Default values are shipped in
 * {@code opentcs-bff-defaults-baseline.properties}; users override them in a sibling
 * {@code opentcs-bff.properties} file.
 */
@ConfigurationPrefix(BffConfiguration.PREFIX)
public interface BffConfiguration {

  /**
   * This configuration's prefix.
   */
  String PREFIX = "bff";

  @ConfigurationEntry(
      type = "String",
      description = "The address the HTTP server binds to.",
      changesApplied = ConfigurationEntry.ChangesApplied.ON_APPLICATION_START,
      orderKey = "0_address_0"
  )
  String bindAddress();

  @ConfigurationEntry(
      type = "Integer",
      description = "The port the HTTP server binds to. Use 0 to let the OS pick a free port.",
      changesApplied = ConfigurationEntry.ChangesApplied.ON_APPLICATION_START,
      orderKey = "0_address_1"
  )
  int bindPort();
}
