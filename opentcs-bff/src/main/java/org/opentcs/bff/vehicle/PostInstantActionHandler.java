// SPDX-FileCopyrightText: The openTCS Authors
// SPDX-License-Identifier: MIT
package org.opentcs.bff.vehicle;

import static java.util.Objects.requireNonNull;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import io.javalin.http.Context;
import io.javalin.http.Handler;
import jakarta.inject.Inject;
import java.util.Map;
import org.opentcs.bff.kernel.KernelClient;
import org.opentcs.drivers.vehicle.VehicleCommAdapterMessage;

/**
 * Handles {@code POST /api/v1/vehicles/{name}/instant-actions}.
 */
public class PostInstantActionHandler
    implements
      Handler {

  /**
   * The path parameter for the vehicle's name.
   */
  public static final String NAME_PARAM = "name";

  private static final String MESSAGE_TYPE = "vda5050:sendInstantActions";
  private static final String MESSAGE_PARAM_ACTIONS = "actions";

  private final KernelClient kernelClient;
  private final ObjectMapper objectMapper;
  private final InstantActionRequestValidator validator;

  /**
   * Creates a new instance.
   *
   * @param kernelClient The Kernel client used to send the adapter message.
   */
  @Inject
  public PostInstantActionHandler(KernelClient kernelClient) {
    this(kernelClient, new ObjectMapper(), new InstantActionRequestValidator());
  }

  PostInstantActionHandler(
      KernelClient kernelClient,
      ObjectMapper objectMapper,
      InstantActionRequestValidator validator
  ) {
    this.kernelClient = requireNonNull(kernelClient, "kernelClient");
    this.objectMapper = requireNonNull(objectMapper, "objectMapper");
    this.validator = requireNonNull(validator, "validator");
  }

  @Override
  public void handle(Context ctx) {
    requireNonNull(ctx, "ctx");

    JsonNode body = parseBody(ctx.body());
    validator.validate(body);

    JsonNode actions = body.get(MESSAGE_PARAM_ACTIONS);
    kernelClient.sendVehicleCommAdapterMessage(
        ctx.pathParam(NAME_PARAM),
        new VehicleCommAdapterMessage(
            MESSAGE_TYPE,
            Map.of(MESSAGE_PARAM_ACTIONS, toJson(actions))
        )
    );

    ctx.status(202);
  }

  private JsonNode parseBody(String body) {
    try {
      return objectMapper.readTree(body);
    }
    catch (JsonProcessingException exc) {
      throw new IllegalArgumentException("Invalid JSON in request body.", exc);
    }
  }

  private String toJson(JsonNode node) {
    try {
      return objectMapper.writeValueAsString(node);
    }
    catch (JsonProcessingException exc) {
      throw new IllegalArgumentException("Could not serialize instant actions.", exc);
    }
  }
}
