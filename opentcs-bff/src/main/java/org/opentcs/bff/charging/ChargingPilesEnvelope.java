// SPDX-FileCopyrightText: The openTCS Authors
// SPDX-License-Identifier: MIT
package org.opentcs.bff.charging;

import com.fasterxml.jackson.annotation.JsonProperty;
import java.util.List;

/**
 * On-disk envelope for charging pile registry entries.
 *
 * @param chargingPiles The persisted charging piles.
 */
public record ChargingPilesEnvelope(
    @JsonProperty("ChargingPiles")
    List<ChargingPileDto> chargingPiles
) {
}
