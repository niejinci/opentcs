// SPDX-FileCopyrightText: The openTCS Authors
// SPDX-License-Identifier: MIT
package org.opentcs.bff.warehouse;

/**
 * Thrown when a requested warehouse type or rack does not exist.
 */
public class WarehouseNotFoundException
    extends
      RuntimeException {

  private static final long serialVersionUID = 1L;

  /**
   * Creates a new instance.
   *
   * @param message The detail message.
   */
  public WarehouseNotFoundException(String message) {
    super(message);
  }
}
