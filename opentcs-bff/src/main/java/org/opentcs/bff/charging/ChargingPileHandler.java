// SPDX-FileCopyrightText: The openTCS Authors
// SPDX-License-Identifier: MIT
package org.opentcs.bff.charging;

import static java.util.Objects.requireNonNull;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.SerializationFeature;
import com.fasterxml.jackson.datatype.jsr310.JavaTimeModule;
import io.javalin.http.Context;
import io.javalin.http.Handler;
import io.javalin.http.HttpStatus;
import jakarta.inject.Inject;
import jakarta.inject.Singleton;

/**
 * Handler bundle for charging pile registry CRUD endpoints.
 */
@Singleton
public class ChargingPileHandler {

  /**
   * Path parameter name for charging pile ids.
   */
  public static final String ID_PARAM = "id";

  private static final ObjectMapper JSON = new ObjectMapper()
      .registerModule(new JavaTimeModule())
      .disable(SerializationFeature.WRITE_DATES_AS_TIMESTAMPS);

  private final ChargingPileStore store;

  /**
   * Creates a new instance.
   *
   * @param store The charging pile store backing all endpoints.
   */
  @Inject
  public ChargingPileHandler(ChargingPileStore store) {
    this.store = requireNonNull(store, "store");
  }

  /**
   * {@code GET /api/v1/charging-piles}.
   *
   * @return The handler.
   */
  public Handler list() {
    return ctx -> ctx.json(store.list());
  }

  /**
   * {@code POST /api/v1/charging-piles}.
   *
   * @return The handler.
   */
  public Handler create() {
    return ctx -> {
      ChargingPileDto record = store.create(parseBody(ctx, ChargingPileDto.class));
      ctx.status(HttpStatus.CREATED);
      ctx.header("Location", "/api/v1/charging-piles/" + record.id());
      ctx.json(record);
    };
  }

  /**
   * {@code PUT /api/v1/charging-piles/{id}}.
   *
   * @return The handler.
   */
  public Handler update() {
    return ctx -> ctx.json(
        store.update(ctx.pathParam(ID_PARAM), parseBody(ctx, ChargingPileDto.class))
    );
  }

  /**
   * {@code DELETE /api/v1/charging-piles/{id}}.
   *
   * @return The handler.
   */
  public Handler delete() {
    return ctx -> {
      store.delete(ctx.pathParam(ID_PARAM));
      ctx.status(HttpStatus.NO_CONTENT);
    };
  }

  private <T> T parseBody(Context ctx, Class<T> type) {
    T body;
    try {
      body = JSON.readValue(ctx.body(), type);
    }
    catch (JsonProcessingException e) {
      throw new IllegalArgumentException("Invalid JSON in request body.", e);
    }
    if (body == null) {
      throw new IllegalArgumentException("Request body must not be empty.");
    }
    return body;
  }
}
