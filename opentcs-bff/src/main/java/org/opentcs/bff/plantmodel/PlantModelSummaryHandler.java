// SPDX-FileCopyrightText: The openTCS Authors
// SPDX-License-Identifier: MIT
package org.opentcs.bff.plantmodel;

import static java.util.Objects.requireNonNull;

import io.javalin.http.Context;
import io.javalin.http.Handler;
import jakarta.inject.Inject;
import org.opentcs.bff.kernel.KernelClient;
import org.opentcs.data.model.PlantModel;

/**
 * Handles {@code GET /api/v1/plant-model/summary}: fetches the plant model from the Kernel and
 * returns a {@link PlantModelSummary} (model name + per-type object counts) as JSON.
 */
public class PlantModelSummaryHandler
    implements
      Handler {

  private final KernelClient kernelClient;

  /**
   * Creates a new instance.
   *
   * @param kernelClient The Kernel client to query the plant model from.
   */
  @Inject
  public PlantModelSummaryHandler(KernelClient kernelClient) {
    this.kernelClient = requireNonNull(kernelClient, "kernelClient");
  }

  @Override
  public void handle(Context ctx) {
    requireNonNull(ctx, "ctx");
    PlantModel plantModel = kernelClient.getPlantModel();
    PlantModelSummary summary = new PlantModelSummary(
        plantModel.getName(),
        plantModel.getPoints().size(),
        plantModel.getPaths().size(),
        plantModel.getLocationTypes().size(),
        plantModel.getLocations().size(),
        plantModel.getBlocks().size(),
        plantModel.getVehicles().size()
    );
    ctx.status(200);
    ctx.json(summary);
  }
}
