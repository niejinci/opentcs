// SPDX-FileCopyrightText: The openTCS Authors
// SPDX-License-Identifier: MIT
package org.opentcs.bff.publish;

import com.fasterxml.jackson.annotation.JsonProperty;

/**
 * Request body of {@code POST /api/v1/plant-models/publish}.
 *
 * @param projectId The project id whose draft should be published.
 * @param modelName Optional model name; falls back to the project's meta name.
 * @param dryRun If true, only run BFF-side validation; do not contact the kernel.
 */
public record PublishRequest(
    @JsonProperty("projectId") String projectId,
    @JsonProperty("modelName") String modelName,
    @JsonProperty("dryRun") Boolean dryRun
) {
}
