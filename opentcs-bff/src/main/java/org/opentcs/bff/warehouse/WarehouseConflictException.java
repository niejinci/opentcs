// SPDX-FileCopyrightText: The openTCS Authors
// SPDX-License-Identifier: MIT
package org.opentcs.bff.warehouse;

/**
 * Thrown when a warehouse create/update operation collides with existing data.
 */
public class WarehouseConflictException
    extends
      RuntimeException {

  private static final long serialVersionUID = 1L;

  /**
   * Creates a new instance.
   *
   * @param message The detail message.
   */
  public WarehouseConflictException(String message) {
    super(message);
  }
}
