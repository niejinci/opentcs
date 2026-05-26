// SPDX-FileCopyrightText: The openTCS Authors
// SPDX-License-Identifier: MIT
package org.opentcs.bff.publish;

/**
 * Thrown by {@link PublishHandler} when the kernel RMI portal cannot be reached / the publish call
 * fails. Mapped to HTTP {@code 502 Bad Gateway} by the global exception handler.
 */
public class KernelUnreachableException
    extends
      RuntimeException {

  private static final long serialVersionUID = 1L;

  /**
   * Creates a new instance.
   *
   * @param message A human-readable explanation (e.g. {@code "Kernel unreachable"}).
   * @param cause The underlying RMI / connection failure.
   */
  public KernelUnreachableException(String message, Throwable cause) {
    super(message, cause);
  }
}
