// SPDX-FileCopyrightText: The openTCS Authors
// SPDX-License-Identifier: MIT
package org.opentcs.bff.warehouse;

import com.fasterxml.jackson.annotation.JsonInclude;
import com.fasterxml.jackson.annotation.JsonProperty;
import java.util.List;

/**
 * On-disk envelope for BYD warehouse type JSON files.
 *
 * @param waresType The type entries stored under the WaresType wrapper.
 * @param version Optional source-file version preserved when present.
 */
@JsonInclude(JsonInclude.Include.NON_NULL)
public record WarehouseTypesEnvelope(
    @JsonProperty("WaresType") List<WarehouseTypeDto> waresType,
    @JsonProperty("Version") String version
) {
}
