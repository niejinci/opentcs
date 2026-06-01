// SPDX-FileCopyrightText: The openTCS Authors
// SPDX-License-Identifier: MIT
package org.opentcs.bff.events;

import static java.util.Objects.requireNonNull;

import io.javalin.http.Context;
import io.javalin.http.Handler;
import jakarta.inject.Inject;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.TreeSet;

/**
 * Handles {@code GET /api/v1/sse/ping}: a no-side-effect health probe for the SSE endpoint.
 *
 * <p>Unlike opening an actual SSE connection (which is long-lived and creates a subscription),
 * this endpoint returns a short JSON payload describing the SSE channel's current state and the
 * set of supported event types. It is intended for monitoring systems and for client-side
 * pre-flight checks before opening an {@code EventSource}.
 *
 * <p>The endpoint sits behind the same authentication filter as the rest of {@code /api/v1/*},
 * so it can also be used to verify that an access key is correct without producing the
 * long-lived connection footprint of a real SSE handshake.
 */
public class SsePingHandler
    implements
      Handler {

  private final SseEventBridge bridge;

  /**
   * Creates a new instance.
   *
   * @param bridge The SSE bridge whose state should be reported.
   */
  @Inject
  public SsePingHandler(SseEventBridge bridge) {
    this.bridge = requireNonNull(bridge, "bridge");
  }

  @Override
  public void handle(Context ctx) {
    requireNonNull(ctx, "ctx");
    Map<String, Object> body = new LinkedHashMap<>();
    body.put("ok", true);
    body.put("connections", bridge.connectionCount());
    // TreeSet for deterministic, alphabetically ordered output.
    body.put("supportedEvents", new TreeSet<>(SseEventTypes.SUPPORTED_EVENTS));
    body.put("serverTime", System.currentTimeMillis());
    ctx.status(200);
    ctx.json(body);
  }
}
