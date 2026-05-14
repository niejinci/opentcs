// SPDX-FileCopyrightText: The openTCS Authors
// SPDX-License-Identifier: MIT
package org.opentcs.bff.events;

import java.util.Map;
import java.util.Set;

/**
 * Constants describing the Server-Sent-Event types broadcast by {@link SseEventBridge}.
 *
 * <p>Event names mirror the openTCS Kernel's own SSE convention (see
 * {@code org.opentcs.kernel.extensions.servicewebapi.v1.SseConstants}) so that an SPA written
 * against the Kernel's HTTP service-web-api can connect to the BFF without changing event handler
 * names.
 */
public final class SseEventTypes {

  /**
   * The SSE event name (the {@code event:} field) for events about vehicles.
   */
  public static final String EVENT_TYPE_VEHICLES = "/events/vehicles";
  /**
   * The SSE event name for events about transport orders.
   */
  public static final String EVENT_TYPE_TRANSPORT_ORDERS = "/events/transportOrders";

  /**
   * The set of event types currently supported by the BFF SSE endpoint.
   */
  public static final Set<String> SUPPORTED_EVENTS = Set.of(
      EVENT_TYPE_VEHICLES,
      EVENT_TYPE_TRANSPORT_ORDERS
  );

  /**
   * Maps an event-subscription query parameter (e.g. {@code vehicles}, {@code transportOrders})
   * to the corresponding SSE event type. The parameter names match the kernel's SSE API.
   */
  public static final Map<String, String> QUERY_PARAM_TO_EVENT_TYPE = Map.of(
      "vehicles", EVENT_TYPE_VEHICLES,
      "transportOrders", EVENT_TYPE_TRANSPORT_ORDERS
  );

  private SseEventTypes() {
  }
}
