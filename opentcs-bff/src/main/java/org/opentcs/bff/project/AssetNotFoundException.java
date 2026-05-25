// SPDX-FileCopyrightText: The openTCS Authors
// SPDX-License-Identifier: MIT
package org.opentcs.bff.project;

/**
 * Thrown when an operation references an asset filename that does not exist on disk.
 * Mapped to HTTP 404 by {@link org.opentcs.bff.BffApplication}.
 */
public class AssetNotFoundException
    extends
      RuntimeException {

  private static final long serialVersionUID = 1L;

  /**
   * Creates a new instance with the given message.
   *
   * @param message The detail message.
   */
  public AssetNotFoundException(String message) {
    super(message);
  }
}
