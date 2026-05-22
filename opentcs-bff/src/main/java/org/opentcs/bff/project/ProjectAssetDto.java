// SPDX-FileCopyrightText: The openTCS Authors
// SPDX-License-Identifier: MIT
package org.opentcs.bff.project;

import java.time.Instant;

/**
 * Descriptor for a single asset file stored under a project's {@code assets/} directory.
 *
 * @param name The asset filename (e.g. {@code SS27.png}).
 * @param size The size of the file in bytes.
 * @param contentType The MIME type inferred from the extension.
 * @param updatedAt When the file was last modified on disk.
 */
public record ProjectAssetDto(
    String name,
    long size,
    String contentType,
    Instant updatedAt
) {
}
