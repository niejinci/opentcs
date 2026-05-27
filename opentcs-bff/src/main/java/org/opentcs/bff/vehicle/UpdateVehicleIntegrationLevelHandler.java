// SPDX-FileCopyrightText: The openTCS Authors
// SPDX-License-Identifier: MIT
package org.opentcs.bff.vehicle;

import static java.util.Objects.requireNonNull;

import io.javalin.http.Context;
import io.javalin.http.Handler;
import jakarta.inject.Inject;
import org.opentcs.bff.api.v1.model.VehicleIntegrationLevel;
import org.opentcs.bff.api.v1.model.VehicleIntegrationLevelUpdate;
import org.opentcs.bff.kernel.KernelClient;
import org.opentcs.data.model.Vehicle;

/**
 * Handles {@code PUT /api/v1/vehicles/{name}/integrationLevel}: forwards an integration-level
 * change to the kernel and returns the updated vehicle DTO.
 *
 * <p>Errors are surfaced via the application-wide exception mappers:
 * {@link org.opentcs.data.ObjectUnknownException} for unknown vehicles (404),
 * {@link IllegalArgumentException} for transitions the kernel refuses (400).
 */
public class UpdateVehicleIntegrationLevelHandler
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
  public UpdateVehicleIntegrationLevelHandler(KernelClient kernelClient) {
    this.kernelClient = requireNonNull(kernelClient, "kernelClient");
  }

  @Override
  public void handle(Context ctx) {
    requireNonNull(ctx, "ctx");
    String name = ctx.pathParam(NAME_PARAM);

    VehicleIntegrationLevelUpdate body;
    try {
      body = ctx.bodyAsClass(VehicleIntegrationLevelUpdate.class);
    }
    catch (Exception e) {
      throw new IllegalArgumentException("Invalid JSON in request body.", e);
    }
    if (body == null || body.getIntegrationLevel() == null) {
      throw new IllegalArgumentException("Request body must contain an 'integrationLevel'.");
    }

    Vehicle.IntegrationLevel kernelLevel = toKernelLevel(body.getIntegrationLevel());
    Vehicle updated = kernelClient.updateVehicleIntegrationLevel(name, kernelLevel);
    ctx.status(200);
    ctx.json(VehicleConverter.toDto(updated));
  }

  private static Vehicle.IntegrationLevel toKernelLevel(VehicleIntegrationLevel dtoLevel) {
    return Vehicle.IntegrationLevel.valueOf(dtoLevel.name());
  }
}
