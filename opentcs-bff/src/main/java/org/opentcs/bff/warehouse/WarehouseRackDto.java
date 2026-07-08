// SPDX-FileCopyrightText: The openTCS Authors
// SPDX-License-Identifier: MIT
package org.opentcs.bff.warehouse;

/**
 * A persisted warehouse rack instance shown on the warehouse rack list page.
 *
 * @param id Stable UI/API id.
 * @param name Display name.
 * @param code Rack instance code.
 * @param carrierBottomCode Carrier bottom code.
 * @param typeCode Referenced warehouse type code.
 * @param typeName Referenced warehouse type display name.
 * @param warehouseKind The kind label, currently fixed to rack.
 * @param region The region label.
 * @param mapName The map name.
 * @param storageCode Optional storage code.
 * @param locationName Optional map location/point name.
 * @param lockStatus Lock status label.
 * @param emptyStatus Empty/full status label.
 * @param vehicleName Optional owning vehicle.
 * @param containerInfo Optional container info.
 * @param enabled Whether this rack is enabled.
 * @param updatedAt Last update time, formatted for the SPA table.
 */
public record WarehouseRackDto(
    String id,
    String name,
    String code,
    String carrierBottomCode,
    String typeCode,
    String typeName,
    String warehouseKind,
    String region,
    String mapName,
    String storageCode,
    String locationName,
    String lockStatus,
    String emptyStatus,
    String vehicleName,
    String containerInfo,
    boolean enabled,
    String updatedAt
) {
}
