// SPDX-FileCopyrightText: The openTCS Authors
// SPDX-License-Identifier: MIT
package org.opentcs.bff.charging;

/**
 * Thrown when the charging pile JSON file cannot be read or written safely.
 */
public class ChargingPileFileException
    extends
      RuntimeException {

  private static final long serialVersionUID = 1L;

  /**
   * Creates a new instance.
   *
   * @param message The detail message.
   * @param cause The root cause.
   */
  public ChargingPileFileException(String message, Throwable cause) {
    super(message, cause);
  }
}
