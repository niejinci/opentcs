// SPDX-FileCopyrightText: The openTCS Authors
// SPDX-License-Identifier: MIT
package org.opentcs.bff.vehicle;

import static java.util.Objects.requireNonNull;

import io.javalin.http.Context;
import io.javalin.http.Handler;
import jakarta.inject.Inject;
import org.opentcs.bff.error.ErrorResponses;
import org.opentcs.bff.kernel.KernelClient;

/**
 * Handles {@code GET /api/v1/vehicles/{name}}: returns the named vehicle as JSON, or 404 with
 * an {@link ErrorResponse} body if no such vehicle exists.
 */
public class GetVehicleHandler
    implements
      Handler {

  /**
   * The path parameter for the vehicle's name.
   */
  public static final String NAME_PARAM = "name";

  private final KernelClient kernelClient;

  /**
   * Creates a new instance.
   *
   * @param kernelClient The Kernel client to query the vehicle from.
   */
  @Inject
  public GetVehicleHandler(KernelClient kernelClient) {
    this.kernelClient = requireNonNull(kernelClient, "kernelClient");
  }

  @Override
  public void handle(Context ctx) {
    requireNonNull(ctx, "ctx");
    String name = ctx.pathParam(NAME_PARAM);
    kernelClient.findVehicle(name)
        .ifPresentOrElse(
            vehicle -> {
              ctx.status(200);
              ctx.json(VehicleConverter.toDto(vehicle));
            },
            () -> ErrorResponses.write(
                ctx,
                io.javalin.http.HttpStatus.NOT_FOUND,
                "VEHICLE_NOT_FOUND",
                "No vehicle named '" + name + "' exists."
            )
        );
  }
}
