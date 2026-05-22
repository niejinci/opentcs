// SPDX-FileCopyrightText: The openTCS Authors
// SPDX-License-Identifier: MIT
package org.opentcs.bff.project;

/**
 * Thrown by {@link ProjectStore#writeAsset} when the upload exceeds the configured per-file size
 * limit. Mapped to HTTP 413 by {@link org.opentcs.bff.BffApplication}.
 */
public class AssetTooLargeException
    extends
      RuntimeException {

  private static final long serialVersionUID = 1L;

  /**
   * Creates a new instance with the given message.
   *
   * @param message The detail message.
   */
  public AssetTooLargeException(String message) {
    super(message);
  }
}
