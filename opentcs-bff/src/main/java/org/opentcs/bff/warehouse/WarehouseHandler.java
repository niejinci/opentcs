// SPDX-FileCopyrightText: The openTCS Authors
// SPDX-License-Identifier: MIT
package org.opentcs.bff.warehouse;

import static java.util.Objects.requireNonNull;

import io.javalin.http.Context;
import io.javalin.http.Handler;
import io.javalin.http.HttpStatus;
import jakarta.inject.Inject;
import jakarta.inject.Singleton;

/**
 * Handler bundle for warehouse type and rack-instance CRUD endpoints.
 */
@Singleton
public class WarehouseHandler {

  /**
   * Path parameter name for warehouse type ids.
   */
  public static final String TYPE_ID_PARAM = "id";

  /**
   * Path parameter name for rack instance ids.
   */
  public static final String RACK_ID_PARAM = "id";

  private final WarehouseStore store;

  /**
   * Creates a new instance.
   *
   * @param store The warehouse store backing all endpoints.
   */
  @Inject
  public WarehouseHandler(WarehouseStore store) {
    this.store = requireNonNull(store, "store");
  }

  /**
   * {@code GET /api/v1/warehouse/types}.
   *
   * @return The handler.
   */
  public Handler listTypes() {
    return ctx -> ctx.json(store.listTypes());
  }

  /**
   * {@code POST /api/v1/warehouse/types}.
   *
   * @return The handler.
   */
  public Handler createType() {
    return ctx -> {
      WarehouseTypeDto record = store.createType(parseBody(ctx, WarehouseTypeDto.class));
      ctx.status(HttpStatus.CREATED);
      ctx.header("Location", "/api/v1/warehouse/types/" + record.id());
      ctx.json(record);
    };
  }

  /**
   * {@code PUT /api/v1/warehouse/types/{id}}.
   *
   * @return The handler.
   */
  public Handler updateType() {
    return ctx -> ctx.json(
        store.updateType(ctx.pathParam(TYPE_ID_PARAM), parseBody(ctx, WarehouseTypeDto.class))
    );
  }

  /**
   * {@code DELETE /api/v1/warehouse/types/{id}}.
   *
   * @return The handler.
   */
  public Handler deleteType() {
    return ctx -> {
      store.deleteType(ctx.pathParam(TYPE_ID_PARAM));
      ctx.status(HttpStatus.NO_CONTENT);
    };
  }

  /**
   * {@code GET /api/v1/warehouse/racks}.
   *
   * @return The handler.
   */
  public Handler listRacks() {
    return ctx -> ctx.json(store.listRacks());
  }

  /**
   * {@code POST /api/v1/warehouse/racks}.
   *
   * @return The handler.
   */
  public Handler createRack() {
    return ctx -> {
      WarehouseRackDto record = store.createRack(parseBody(ctx, WarehouseRackDto.class));
      ctx.status(HttpStatus.CREATED);
      ctx.header("Location", "/api/v1/warehouse/racks/" + record.id());
      ctx.json(record);
    };
  }

  /**
   * {@code PUT /api/v1/warehouse/racks/{id}}.
   *
   * @return The handler.
   */
  public Handler updateRack() {
    return ctx -> ctx.json(
        store.updateRack(ctx.pathParam(RACK_ID_PARAM), parseBody(ctx, WarehouseRackDto.class))
    );
  }

  /**
   * {@code DELETE /api/v1/warehouse/racks/{id}}.
   *
   * @return The handler.
   */
  public Handler deleteRack() {
    return ctx -> {
      store.deleteRack(ctx.pathParam(RACK_ID_PARAM));
      ctx.status(HttpStatus.NO_CONTENT);
    };
  }

  private <T> T parseBody(Context ctx, Class<T> type) {
    T body;
    try {
      body = ctx.bodyAsClass(type);
    }
    catch (Exception e) {
      throw new IllegalArgumentException("Invalid JSON in request body.", e);
    }
    if (body == null) {
      throw new IllegalArgumentException("Request body must not be empty.");
    }
    return body;
  }
}
