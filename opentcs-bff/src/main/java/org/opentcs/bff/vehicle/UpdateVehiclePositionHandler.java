// SPDX-FileCopyrightText: The openTCS Authors
// SPDX-License-Identifier: MIT
package org.opentcs.bff.vehicle;

import static java.util.Objects.requireNonNull;

import io.javalin.http.Context;
import io.javalin.http.Handler;
import jakarta.inject.Inject;
import org.opentcs.bff.api.v1.model.VehiclePositionUpdate;
import org.opentcs.bff.kernel.KernelClient;
import org.opentcs.data.model.Vehicle;

/**
 * Handles {@code PUT /api/v1/vehicles/{name}/currentPosition}: forwards an initial-position
 * change to the kernel (as a {@code tcs:virtualVehicle:setPosition} comm-adapter message) and
 * returns the updated vehicle DTO.
 *
 * <p>Errors are surfaced via the application-wide exception mappers:
 * {@link org.opentcs.data.ObjectUnknownException} for unknown vehicles (404),
 * {@link IllegalArgumentException} for malformed bodies or unknown points (400).
 */
public class UpdateVehiclePositionHandler
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
   * @param kernelClient The Kernel client used to update the vehicle.
   */
  @Inject
  public UpdateVehiclePositionHandler(KernelClient kernelClient) {
    this.kernelClient = requireNonNull(kernelClient, "kernelClient");
  }

  @Override
  public void handle(Context ctx) {
    requireNonNull(ctx, "ctx");
    String name = ctx.pathParam(NAME_PARAM);

    VehiclePositionUpdate body;
    try {
      body = ctx.bodyAsClass(VehiclePositionUpdate.class);
    }
    catch (Exception e) {
      throw new IllegalArgumentException("Invalid JSON in request body.", e);
    }
    if (body == null
        || body.getCurrentPosition() == null
        || body.getCurrentPosition().isBlank()) {
      throw new IllegalArgumentException(
          "Request body must contain a non-empty 'currentPosition'."
      );
    }

    Vehicle updated = kernelClient.updateVehiclePosition(name, body.getCurrentPosition());
    ctx.status(200);
    ctx.json(VehicleConverter.toDto(updated));
  }
}
