// SPDX-FileCopyrightText: The openTCS Authors
// SPDX-License-Identifier: MIT
package org.opentcs.bff.transportorder;

import static java.util.Objects.requireNonNull;

import io.javalin.http.Context;
import io.javalin.http.Handler;
import jakarta.inject.Inject;
import org.opentcs.bff.api.v1.model.TransportOrderRequest;
import org.opentcs.bff.kernel.KernelClient;

/**
 * Handles {@code POST /api/v1/transport-orders}: deserializes the request body into a
 * {@link TransportOrderRequest}, converts it to a {@link
 * org.opentcs.access.to.order.TransportOrderCreationTO} and asks the kernel to create the order.
 *
 * <p>On success, returns the freshly created order as JSON with HTTP 200.
 */
public class CreateTransportOrderHandler
    implements
      Handler {

  private final KernelClient kernelClient;

  /**
   * Creates a new instance.
   *
   * @param kernelClient The Kernel client used to create the order.
   */
  @Inject
  public CreateTransportOrderHandler(KernelClient kernelClient) {
    this.kernelClient = requireNonNull(kernelClient, "kernelClient");
  }

  @Override
  public void handle(Context ctx) {
    requireNonNull(ctx, "ctx");
    TransportOrderRequest request;
    try {
      request = ctx.bodyAsClass(TransportOrderRequest.class);
    }
    catch (Exception e) {
      throw new IllegalArgumentException("Invalid JSON in request body.", e);
    }
    if (request == null) {
      throw new IllegalArgumentException("Request body must not be empty.");
    }

    var created = kernelClient.createTransportOrder(TransportOrderConverter.toCreationTO(request));
    ctx.status(200);
    ctx.json(TransportOrderConverter.toDto(created));
  }
}
