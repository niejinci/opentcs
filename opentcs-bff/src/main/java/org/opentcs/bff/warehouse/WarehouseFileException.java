// SPDX-FileCopyrightText: The openTCS Authors
// SPDX-License-Identifier: MIT
package org.opentcs.bff.warehouse;

/**
 * Thrown when the warehouse JSON files cannot be read or written safely.
 */
public class WarehouseFileException
    extends
      RuntimeException {

  private static final long serialVersionUID = 1L;

  /**
   * Creates a new instance.
   *
   * @param message The detail message.
   * @param cause The root cause.
   */
  public WarehouseFileException(String message, Throwable cause) {
    super(message, cause);
  }
}
