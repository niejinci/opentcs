// SPDX-FileCopyrightText: The openTCS Authors
// SPDX-License-Identifier: MIT
package org.opentcs.bff.security;

import org.opentcs.configuration.ConfigurationEntry;
import org.opentcs.configuration.ConfigurationPrefix;

/**
 * Configuration for the BFF's HTTP-level security.
 *
 * <p>Bound by Gestalt at startup using the {@link #PREFIX} prefix. When {@link #accessKey()} is
 * empty, authentication is disabled and all requests are allowed.
 */
@ConfigurationPrefix(BffSecurityConfiguration.PREFIX)
public interface BffSecurityConfiguration {

  /**
   * This configuration's prefix.
   */
  String PREFIX = "bff.security";

  @ConfigurationEntry(
      type = "String",
      description = {
          "The static access key required in the X-Api-Access-Key request header.",
          "If empty, authentication is disabled and all requests are allowed."
      },
      changesApplied = ConfigurationEntry.ChangesApplied.ON_APPLICATION_START,
      orderKey = "0_auth_0"
  )
  String accessKey();
}
