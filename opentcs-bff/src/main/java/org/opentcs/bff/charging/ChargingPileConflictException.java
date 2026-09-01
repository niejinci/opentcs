// SPDX-FileCopyrightText: The openTCS Authors
// SPDX-License-Identifier: MIT
package org.opentcs.bff.charging;

/**
 * Thrown when a charging pile create/update operation collides with existing data.
 */
public class ChargingPileConflictException
    extends
      RuntimeException {

  private static final long serialVersionUID = 1L;

  /**
   * Creates a new instance.
   *
   * @param message The detail message.
   */
  public ChargingPileConflictException(String message) {
    super(message);
  }
}
