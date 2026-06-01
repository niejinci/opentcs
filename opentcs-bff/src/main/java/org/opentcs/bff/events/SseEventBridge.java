// SPDX-FileCopyrightText: The openTCS Authors
// SPDX-License-Identifier: MIT
package org.opentcs.bff.events;

import static java.util.Objects.requireNonNull;

import com.google.inject.Singleton;
import io.javalin.http.sse.SseClient;
import jakarta.inject.Inject;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.ConcurrentLinkedQueue;
import java.util.stream.Collectors;
import org.opentcs.bff.transportorder.TransportOrderConverter;
import org.opentcs.bff.vehicle.VehicleConverter;
import org.opentcs.data.TCSObject;
import org.opentcs.data.TCSObjectEvent;
import org.opentcs.data.model.Vehicle;
import org.opentcs.data.order.TransportOrder;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

/**
 * Maintains the set of currently subscribed Server-Sent-Event clients and broadcasts kernel
 * {@link TCSObjectEvent}s converted to BFF DTOs.
 *
 * <p>Each connection records the set of event types it subscribed to via query parameters at
 * connect time (e.g. {@code ?vehicles=true&transportOrders=true}). Events whose type is not in
 * the connection's subscription set are silently skipped for that connection.
 */
@Singleton
public class SseEventBridge {

  private static final Logger LOG = LoggerFactory.getLogger(SseEventBridge.class);

  private final ConcurrentLinkedQueue<Subscription> subscriptions = new ConcurrentLinkedQueue<>();

  /**
   * Creates a new instance.
   */
  @Inject
  public SseEventBridge() {
  }

  /**
   * Registers a new SSE client with the given event-type subscription set.
   *
   * <p>The client's connection is kept open via {@link SseClient#keepAlive()}. When the client
   * disconnects, its subscription is removed automatically.
   *
   * @param client The Javalin SSE client representing the new connection.
   */
  public void register(SseClient client) {
    requireNonNull(client, "client");
    Set<String> eventTypes = queryParamsToEventTypes(client.ctx().queryParamMap());
    LOG.info(
        "SSE client connected: subscriptions={} (remote={})",
        eventTypes,
        client.ctx().ip()
    );
    Subscription subscription = new Subscription(client, eventTypes);
    subscriptions.add(subscription);
    // Send an immediate SSE comment so:
    //   1. EventSource.onopen fires right away on the client side, and
    //   2. any reverse-proxy (e.g. Nginx) write buffer is flushed even if it ignores
    //      `X-Accel-Buffering: no` (already set by Javalin's SseHandler).
    // Comments are lines starting with ':' per the SSE spec and are ignored by EventSource,
    // so they cannot collide with regular event types.
    try {
      client.sendComment(
          "connected ts=" + System.currentTimeMillis() + " subs=" + eventTypes
      );
    }
    catch (RuntimeException e) {
      LOG.debug("Failed to send initial SSE handshake comment.", e);
    }
    client.keepAlive();
    client.onClose(() -> {
      LOG.info("SSE client disconnected (remote={})", client.ctx().ip());
      subscriptions.remove(subscription);
    });
  }

  /**
   * Sends an SSE comment line ({@code :keepalive ts=N}) to every currently subscribed client.
   *
   * <p>This is intended to be called periodically by a background scheduler to keep the
   * underlying TCP connection alive across reverse proxies and stateful firewalls that may
   * otherwise drop idle connections. SSE comments are silently ignored by the
   * {@code EventSource} client, so they have no observable effect on the application stream.
   */
  public void broadcastHeartbeat() {
    if (subscriptions.isEmpty()) {
      return;
    }
    String comment = "keepalive ts=" + System.currentTimeMillis();
    for (Subscription subscription : subscriptions) {
      try {
        subscription.client().sendComment(comment);
      }
      catch (RuntimeException e) {
        LOG.debug(
            "Failed to send SSE heartbeat to client (remote={}): {}",
            subscription.client().ctx().ip(),
            e.getMessage()
        );
      }
    }
  }

  /**
   * Returns the number of currently connected SSE clients.
   *
   * @return The current connection count.
   */
  public int connectionCount() {
    return subscriptions.size();
  }

  /**
   * Closes all currently subscribed SSE clients and clears the subscription set. Intended for
   * use during application shutdown.
   */
  public void closeAll() {
    for (Subscription subscription : subscriptions) {
      try {
        subscription.client().close();
      }
      catch (RuntimeException e) {
        LOG.debug("Failed to close SSE client during shutdown.", e);
      }
    }
    subscriptions.clear();
  }

  /**
   * Converts the given kernel {@link TCSObjectEvent} to a BFF DTO and broadcasts it to all
   * subscribed clients whose subscription set contains the resulting event type. Events for
   * objects of types other than {@link Vehicle} and {@link TransportOrder} are silently ignored.
   *
   * @param event The kernel event to dispatch.
   */
  public void dispatch(TCSObjectEvent event) {
    requireNonNull(event, "event");
    TCSObject<?> object = event.getCurrentOrPreviousObjectState();
    if (object instanceof Vehicle) {
      broadcast(
          SseEventTypes.EVENT_TYPE_VEHICLES,
          new SseEventEnvelope<>(
              event.getCurrentObjectState() == null
                  ? null
                  : VehicleConverter.toDto((Vehicle) event.getCurrentObjectState()),
              event.getPreviousObjectState() == null
                  ? null
                  : VehicleConverter.toDto((Vehicle) event.getPreviousObjectState())
          )
      );
    }
    else if (object instanceof TransportOrder) {
      broadcast(
          SseEventTypes.EVENT_TYPE_TRANSPORT_ORDERS,
          new SseEventEnvelope<>(
              event.getCurrentObjectState() == null
                  ? null
                  : TransportOrderConverter.toDto((TransportOrder) event.getCurrentObjectState()),
              event.getPreviousObjectState() == null
                  ? null
                  : TransportOrderConverter.toDto((TransportOrder) event.getPreviousObjectState())
          )
      );
    }
  }

  private void broadcast(String eventType, Object payload) {
    for (Subscription subscription : subscriptions) {
      if (!subscription.eventTypes().contains(eventType)) {
        continue;
      }
      try {
        subscription.client().sendEvent(eventType, payload);
      }
      catch (RuntimeException e) {
        LOG.warn(
            "Failed to send '{}' event to SSE client (remote={}): {}",
            eventType,
            subscription.client().ctx().ip(),
            e.getMessage()
        );
      }
    }
  }

  private static Set<String> queryParamsToEventTypes(Map<String, List<String>> queryParamMap) {
    if (queryParamMap == null || queryParamMap.isEmpty()) {
      return Set.of();
    }
    return queryParamMap.entrySet().stream()
        .filter(entry -> SseEventTypes.QUERY_PARAM_TO_EVENT_TYPE.containsKey(entry.getKey()))
        .filter(entry -> {
          List<String> values = entry.getValue();
          return values != null
              && !values.isEmpty()
              && Boolean.parseBoolean(values.get(0));
        })
        .map(entry -> SseEventTypes.QUERY_PARAM_TO_EVENT_TYPE.get(entry.getKey()))
        .collect(Collectors.toUnmodifiableSet());
  }

  private record Subscription(SseClient client, Set<String> eventTypes) {

    private Subscription {
      requireNonNull(client, "client");
      requireNonNull(eventTypes, "eventTypes");
    }
  }
}
