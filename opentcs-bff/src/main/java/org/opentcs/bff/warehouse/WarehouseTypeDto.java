// SPDX-FileCopyrightText: The openTCS Authors
// SPDX-License-Identifier: MIT
package org.opentcs.bff.warehouse;

import com.fasterxml.jackson.annotation.JsonInclude;
import com.fasterxml.jackson.annotation.JsonProperty;

/**
 * A single warehouse type entry using the BYD-1500_ware_type.json field names.
 *
 * @param qrCenterLeft Optional QR center offset for rack types that define it.
 * @param loadDetect Load/QR detection settings.
 * @param qrCenterBack Optional QR center offset for rack types that define it.
 * @param wareModel The display name of the warehouse type.
 * @param legLength L2 in millimetres.
 * @param putHeight Fixed put/drop height in millimetres.
 * @param legInnerWidth W1 in millimetres.
 * @param collisionAvoidanceAreaType Fixed collision-avoidance area type.
 * @param legInnerLength L1 in millimetres.
 * @param name The warehouse type code.
 * @param qrCenterFront Optional QR center offset for rack types that define it.
 * @param legHeight H1 in millimetres.
 * @param qrCodeRectifyType QR-code rectification strategy.
 * @param length L in millimetres.
 * @param legWidth W2 in millimetres.
 * @param allowRotate Whether the rack is allowed to rotate.
 * @param pickHeight Fixed pick height in millimetres.
 * @param height H in millimetres.
 * @param id The warehouse type id.
 * @param defaultOrientationType Default orientation type.
 * @param width W in millimetres.
 * @param manageable Whether the type is individually manageable.
 */
@JsonInclude(JsonInclude.Include.NON_NULL)
public record WarehouseTypeDto(
    @JsonProperty("QrCenterLeft") Double qrCenterLeft,
    @JsonProperty("LoadDetect") WarehouseLoadDetectDto loadDetect,
    @JsonProperty("QrCenterBack") Double qrCenterBack,
    @JsonProperty("WareModel") String wareModel,
    @JsonProperty("LegLength") int legLength,
    @JsonProperty("PutHeight") int putHeight,
    @JsonProperty("LegInnerWidth") int legInnerWidth,
    @JsonProperty("CollisionAvoidanceAreaType") int collisionAvoidanceAreaType,
    @JsonProperty("LegInnerLength") int legInnerLength,
    @JsonProperty("Name") String name,
    @JsonProperty("QrCenterFront") Double qrCenterFront,
    @JsonProperty("LegHeight") int legHeight,
    @JsonProperty("QrCodeRectifyType") String qrCodeRectifyType,
    @JsonProperty("Length") int length,
    @JsonProperty("LegWidth") int legWidth,
    @JsonProperty("AllowRotate") boolean allowRotate,
    @JsonProperty("PickHeight") int pickHeight,
    @JsonProperty("Height") int height,
    @JsonProperty("Id") String id,
    @JsonProperty("DefaultOrientationType") String defaultOrientationType,
    @JsonProperty("Width") int width,
    @JsonProperty("Manageable") boolean manageable
) {
}
