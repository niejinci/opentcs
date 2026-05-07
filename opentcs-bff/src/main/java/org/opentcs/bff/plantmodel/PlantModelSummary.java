// SPDX-FileCopyrightText: The openTCS Authors
// SPDX-License-Identifier: MIT
package org.opentcs.bff.plantmodel;

/**
 * A lightweight summary of a plant model: its name and the number of objects of each kind. Returned
 * by {@code GET /api/v1/plant-model/summary}.
 *
 * @param name The plant model's name.
 * @param pointCount The number of points in the plant model.
 * @param pathCount The number of paths in the plant model.
 * @param locationTypeCount The number of location types in the plant model.
 * @param locationCount The number of locations in the plant model.
 * @param blockCount The number of blocks in the plant model.
 * @param vehicleCount The number of vehicles in the plant model.
 */
public record PlantModelSummary(
    String name,
    int pointCount,
    int pathCount,
    int locationTypeCount,
    int locationCount,
    int blockCount,
    int vehicleCount
) {
}
