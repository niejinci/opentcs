// SPDX-FileCopyrightText: The openTCS Authors
// SPDX-License-Identifier: MIT
package org.opentcs.bff.project;

/**
 * Thrown when a project create / copy operation collides with an existing project id.
 * Mapped to HTTP 409 by {@link org.opentcs.bff.BffApplication}.
 */
public class ProjectAlreadyExistsException
    extends
      RuntimeException {

  private static final long serialVersionUID = 1L;

  /**
   * Creates a new instance with the given message.
   *
   * @param message The detail message.
   */
  public ProjectAlreadyExistsException(String message) {
    super(message);
  }
}
