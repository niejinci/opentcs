// SPDX-FileCopyrightText: The openTCS Authors
// SPDX-License-Identifier: MIT
package org.opentcs.bff.project;

/**
 * Body for {@code PATCH /api/v1/projects/{id}}.
 *
 * @param name The new display name.
 */
public record RenameProjectRequest(String name) {
}
