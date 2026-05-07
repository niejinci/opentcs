// SPDX-FileCopyrightText: The openTCS Authors
// SPDX-License-Identifier: MIT
package org.opentcs.bff.health;

import static java.util.Objects.requireNonNull;

import io.javalin.http.Context;
import io.javalin.http.Handler;
import jakarta.inject.Inject;
import java.util.Map;

/**
 * Handles requests to the {@code /health} liveness endpoint.
 *
 * <p>Returns a JSON object of the form {@code {"status":"UP"}} with HTTP 200. Intended for
 * Kubernetes liveness probes, Docker health checks and basic smoke testing.
 */
public class HealthHandler
    implements
      Handler {

  /**
   * Creates a new instance.
   */
  @Inject
  public HealthHandler() {
  }

  @Override
  public void handle(Context ctx) {
    requireNonNull(ctx, "ctx");
    ctx.status(200);
    ctx.json(Map.of("status", "UP"));
  }
}
