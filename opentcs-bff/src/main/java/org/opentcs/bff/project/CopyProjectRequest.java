// SPDX-FileCopyrightText: The openTCS Authors
// SPDX-License-Identifier: MIT
package org.opentcs.bff.project;

/**
 * Body for {@code POST /api/v1/projects/{id}/copy}.
 *
 * @param newName The display name for the new project.
 * @param newId Optional explicit id for the new project; derived from {@link #newName()} when
 * null or blank.
 */
public record CopyProjectRequest(String newName, String newId) {
}
