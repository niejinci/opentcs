// SPDX-FileCopyrightText: The openTCS Authors
// SPDX-License-Identifier: MIT
package org.opentcs.bff.project;

/**
 * Body for {@code POST /api/v1/projects}. {@link #id()} is optional; if omitted, the server
 * derives an id from {@link #name()}.
 *
 * @param name The new project's display name.
 * @param id Optional explicit id; must match {@link ProjectId#PATTERN} if provided.
 */
public record CreateProjectRequest(String name, String id) {
}
