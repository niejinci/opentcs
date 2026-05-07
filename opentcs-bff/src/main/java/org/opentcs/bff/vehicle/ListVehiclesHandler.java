// SPDX-FileCopyrightText: The openTCS Authors
// SPDX-License-Identifier: MIT
package org.opentcs.bff.vehicle;

import static java.util.Objects.requireNonNull;

import io.javalin.http.Context;
import io.javalin.http.Handler;
import jakarta.inject.Inject;
import java.util.Comparator;
import java.util.List;
import org.opentcs.bff.api.v1.model.Vehicle;
import org.opentcs.bff.kernel.KernelClient;

/**
 * Handles {@code GET /api/v1/vehicles}: returns all vehicles known to the Kernel as JSON,
 * sorted by name for stable output.
 */
public class ListVehiclesHandler
    implements
      Handler {

  private final KernelClient kernelClient;

  /**
   * Creates a new instance.
   *
   * @param kernelClient The Kernel client to query vehicles from.
   */
  @Inject
  public ListVehiclesHandler(KernelClient kernelClient) {
    this.kernelClient = requireNonNull(kernelClient, "kernelClient");
  }

  @Override
  public void handle(Context ctx) {
    requireNonNull(ctx, "ctx");
    List<Vehicle> dtos = kernelClient.listVehicles().stream()
        .map(VehicleConverter::toDto)
        .sorted(Comparator.comparing(Vehicle::getName))
        .toList();
    ctx.status(200);
    ctx.json(dtos);
  }
}
