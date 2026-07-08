// SPDX-FileCopyrightText: The openTCS Authors
// SPDX-License-Identifier: MIT
package org.opentcs.bff.warehouse;

import com.fasterxml.jackson.annotation.JsonProperty;
import java.util.List;

/**
 * On-disk envelope for warehouse rack instances.
 *
 * @param wareRacks The persisted rack instances.
 */
public record WarehouseRacksEnvelope(@JsonProperty("WareRacks") List<WarehouseRackDto> wareRacks) {
}
