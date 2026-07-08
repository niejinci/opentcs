// SPDX-FileCopyrightText: The openTCS Authors
// SPDX-License-Identifier: MIT
package org.opentcs.bff.warehouse;

import com.fasterxml.jackson.annotation.JsonProperty;

/**
 * The nested LoadDetect object used by BYD warehouse type JSON files.
 *
 * @param minLoadingHeight Minimum loading height in millimetres.
 * @param loadSensor Whether load-sensor validation is enabled.
 * @param loadDetectType The load-detection strategy id.
 * @param qrCodeSensor Whether QR-code validation is enabled.
 * @param qrCodeMin Minimum QR/id value accepted for this type.
 * @param qrCodeMax Maximum QR/id value accepted for this type.
 */
public record WarehouseLoadDetectDto(
    @JsonProperty("MinLoadingHeight") int minLoadingHeight,
    @JsonProperty("LoadSensor") boolean loadSensor,
    @JsonProperty("LoadDetectType") int loadDetectType,
    @JsonProperty("QrCodeSensor") boolean qrCodeSensor,
    @JsonProperty("QrCodeMin") int qrCodeMin,
    @JsonProperty("QrCodeMax") int qrCodeMax
) {
}
