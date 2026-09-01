// SPDX-FileCopyrightText: The openTCS Authors
// SPDX-License-Identifier: MIT
package org.opentcs.bff.charging;

/**
 * Thrown when a requested charging pile does not exist.
 */
public class ChargingPileNotFoundException
    extends
      RuntimeException {

  private static final long serialVersionUID = 1L;

  /**
   * Creates a new instance.
   *
   * @param message The detail message.
   */
  public ChargingPileNotFoundException(String message) {
    super(message);
  }
}
