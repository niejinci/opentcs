// SPDX-FileCopyrightText: The openTCS Authors
// SPDX-License-Identifier: MIT
package org.opentcs.bff.publish;

import com.fasterxml.jackson.annotation.JsonInclude;
import java.time.Instant;

/**
 * Response of {@code POST /api/v1/plant-models/publish}.
 *
 * @param ok Whether the publish (or dry-run) succeeded.
 * @param modelName The model name that was used.
 * @param dryRun Whether the call was a dry-run.
 * @param publishedAt The publish timestamp (only present when {@code dryRun=false} and successful).
 * @param diff A summary of the draft contents.
 */
@JsonInclude(JsonInclude.Include.NON_NULL)
public record PublishResponse(
    boolean ok,
    String modelName,
    boolean dryRun,
    Instant publishedAt,
    PublishDiff diff
) {

  /**
   * Aggregate counts of each entity kind packed into the {@code PlantModelCreationTO}.
   *
   * @param points Number of points.
   * @param paths Number of paths.
   * @param locationTypes Number of location types.
   * @param locations Number of locations.
   * @param blocks Number of blocks.
   * @param vehicles Number of vehicles.
   */
  public record PublishDiff(
      int points,
      int paths,
      int locationTypes,
      int locations,
      int blocks,
      int vehicles
  ) {
  }
}
