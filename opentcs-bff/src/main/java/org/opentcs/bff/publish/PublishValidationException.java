// SPDX-FileCopyrightText: The openTCS Authors
// SPDX-License-Identifier: MIT
package org.opentcs.bff.publish;

/**
 * Thrown by {@link IntermediateJsonToPlantModelConverter} when the SPA-side intermediate JSON
 * cannot be packed into a {@link org.opentcs.access.to.model.PlantModelCreationTO}.
 *
 * <p>Carries a {@code fieldPath} (e.g. {@code paths[3].srcPointName}) so the SPA can hop back to
 * the offending entity in the editor.
 */
public class PublishValidationException
    extends
      RuntimeException {

  private static final long serialVersionUID = 1L;

  private final String fieldPath;

  /**
   * Creates a new instance.
   *
   * @param fieldPath The JSON path of the offending field (e.g. {@code paths[2].srcPointName}).
   * May be {@code null} for top-level errors.
   * @param message A human-readable explanation.
   */
  public PublishValidationException(String fieldPath, String message) {
    super(message);
    this.fieldPath = fieldPath;
  }

  /**
   * Returns the JSON path of the offending field, or {@code null} for top-level errors.
   *
   * @return The JSON path of the offending field, or {@code null}.
   */
  public String getFieldPath() {
    return fieldPath;
  }
}
