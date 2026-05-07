// SPDX-FileCopyrightText: The openTCS Authors
// SPDX-License-Identifier: MIT
package org.opentcs.bff.kernel;

import org.opentcs.configuration.ConfigurationEntry;
import org.opentcs.configuration.ConfigurationPrefix;

/**
 * Configuration for the BFF's connection to the openTCS Kernel via RMI.
 *
 * <p>Bound by Gestalt at startup using the {@link #PREFIX} prefix.
 */
@ConfigurationPrefix(BffKernelConfiguration.PREFIX)
public interface BffKernelConfiguration {

  /**
   * This configuration's prefix.
   */
  String PREFIX = "bff.kernel";

  @ConfigurationEntry(
      type = "String",
      description = "The host the openTCS Kernel's RMI registry is reachable at.",
      changesApplied = ConfigurationEntry.ChangesApplied.ON_APPLICATION_START,
      orderKey = "0_address_0"
  )
  String host();

  @ConfigurationEntry(
      type = "Integer",
      description = "The TCP port the openTCS Kernel's RMI registry is reachable at.",
      changesApplied = ConfigurationEntry.ChangesApplied.ON_APPLICATION_START,
      orderKey = "0_address_1"
  )
  int port();

  @ConfigurationEntry(
      type = "String",
      description = "The user name to log in to the Kernel with.",
      changesApplied = ConfigurationEntry.ChangesApplied.ON_APPLICATION_START,
      orderKey = "1_credentials_0"
  )
  String userName();

  @ConfigurationEntry(
      type = "String",
      description = "The password to log in to the Kernel with.",
      changesApplied = ConfigurationEntry.ChangesApplied.ON_APPLICATION_START,
      orderKey = "1_credentials_1"
  )
  String password();
}
