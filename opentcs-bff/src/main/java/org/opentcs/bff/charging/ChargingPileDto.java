// SPDX-FileCopyrightText: The openTCS Authors
// SPDX-License-Identifier: MIT
package org.opentcs.bff.charging;

/**
 * A persisted charging pile registry entry.
 *
 * <p>The Point/Location/LocType fields are only mapping metadata in PR1. Synchronising them to
 * the openTCS kernel plant model is handled by later iterations.
 *
 * @param id Stable UI/API id.
 * @param name Display name.
 * @param region Required business region label.
 * @param mapName Required map/model name.
 * @param boundPointName Required openTCS Point name the charging pile is bound to.
 * @param locationName openTCS Location name to create/link in a later model-sync PR.
 * @param locationTypeName openTCS LocationType name to create/reference in a later model-sync PR.
 * @param operation openTCS operation allowed on the charging LocationType.
 * @param chargerType Optional charger type label.
 * @param sn Optional charging pile serial number.
 * @param ip Optional charging pile IP address.
 * @param enabled Whether the charging pile can be used by scheduling/business flows.
 * @param runtimeStatus Business runtime status.
 * @param occupancyStatus Business occupancy status.
 * @param occupiedByVehicle Vehicle currently occupying the charger, when known.
 * @param activeOrderName Transport order currently using the charger, when known.
 * @param chargingSince Start time of the current charging occupancy, when known.
 * @param requiresPublish Whether mapping fields need to be published to the plant model.
 * @param updatedAt Last update time, formatted for the SPA table.
 */
public record ChargingPileDto(
    String id,
    String name,
    String region,
    String mapName,
    String boundPointName,
    String locationName,
    String locationTypeName,
    String operation,
    String chargerType,
    String sn,
    String ip,
    Boolean enabled,
    String runtimeStatus,
    String occupancyStatus,
    String occupiedByVehicle,
    String activeOrderName,
    String chargingSince,
    Boolean requiresPublish,
    String updatedAt
) {
}
