// SPDX-FileCopyrightText: The openTCS Authors
// SPDX-License-Identifier: MIT
package org.opentcs.bff.project;

import org.opentcs.configuration.ConfigurationEntry;
import org.opentcs.configuration.ConfigurationPrefix;

/**
 * Configuration for the BFF's on-disk project workspace (S7).
 *
 * <p>Bound by Gestalt at startup using the {@link #PREFIX} prefix. The workspace directory is the
 * root under which all project files (draft JSON, assets, publish history) live; per the SPA
 * architecture doc §6 the layout is {@code ${dir}/projects/{id}/...}.
 */
@ConfigurationPrefix(BffWorkspaceConfiguration.PREFIX)
public interface BffWorkspaceConfiguration {

  /**
   * This configuration's prefix.
   */
  String PREFIX = "bff.workspace";

  @ConfigurationEntry(
      type = "String",
      description = {
          "Root directory under which the BFF persists project drafts and assets.",
          "May be absolute or relative to the process working directory."
      },
      changesApplied = ConfigurationEntry.ChangesApplied.ON_APPLICATION_START,
      orderKey = "0_storage_0"
  )
  String dir();

  @ConfigurationEntry(
      type = "Long",
      description = {
          "Maximum size (in bytes) accepted for a single uploaded asset.",
          "Requests exceeding this limit are rejected with HTTP 413."
      },
      changesApplied = ConfigurationEntry.ChangesApplied.ON_APPLICATION_START,
      orderKey = "1_limits_0"
  )
  long assetMaxBytes();
}
