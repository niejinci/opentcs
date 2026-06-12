// SPDX-FileCopyrightText: The openTCS Authors
// SPDX-License-Identifier: MIT
package org.opentcs.bff.vehicle;

import static java.util.Objects.requireNonNull;

import io.javalin.http.Context;
import io.javalin.http.Handler;
import jakarta.inject.Inject;
import org.opentcs.bff.kernel.KernelClient;
import org.opentcs.data.order.ReroutingType;

/**
 * Handles {@code POST /api/v1/vehicles/{name}/rerouteRequest}: requests a regular or forced
 * reroute for the named vehicle.
 */
public class RerouteVehicleHandler
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
   * @param kernelClient The Kernel client used to request the reroute.
   */
  @Inject
  public RerouteVehicleHandler(KernelClient kernelClient) {
    this.kernelClient = requireNonNull(kernelClient, "kernelClient");
  }

  @Override
  public void handle(Context ctx) {
    requireNonNull(ctx, "ctx");
    String name = ctx.pathParam(NAME_PARAM);
    boolean forced = Boolean.parseBoolean(ctx.queryParam("forced"));

    kernelClient.rerouteVehicle(
        name,
        forced ? ReroutingType.FORCED : ReroutingType.REGULAR
    );
    ctx.status(200);
  }
}
