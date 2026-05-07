// SPDX-FileCopyrightText: The openTCS Authors
// SPDX-License-Identifier: MIT
package org.opentcs.bff.security;

/**
 * Thrown when an incoming HTTP request is missing or carries an invalid API access key.
 *
 * <p>Mapped to HTTP 401 by the BFF's exception handler.
 */
public class UnauthorizedException
    extends
      RuntimeException {

  /**
   * Creates a new instance with the given detail message.
   *
   * @param message The detail message.
   */
  public UnauthorizedException(String message) {
    super(message);
  }
}
