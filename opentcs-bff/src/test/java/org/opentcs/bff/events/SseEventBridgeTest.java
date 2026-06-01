// SPDX-FileCopyrightText: The openTCS Authors
// SPDX-License-Identifier: MIT
package org.opentcs.bff.events;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;

import io.javalin.http.Context;
import io.javalin.http.sse.SseClient;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.opentcs.data.TCSObjectEvent;
import org.opentcs.data.model.Vehicle;
import org.opentcs.data.order.TransportOrder;

/**
 * Unit tests for {@link SseEventBridge}: subscription bookkeeping, event-type filtering and
 * envelope wrapping.
 */
class SseEventBridgeTest {

  private SseEventBridge bridge;

  @BeforeEach
  void setUp() {
    bridge = new SseEventBridge();
  }

  @Test
  void registerStartsKeepAliveAndReportsConnection() {
    SseClient client = mockClient(Map.of("vehicles", List.of("true")));

    bridge.register(client);

    assertThat(bridge.connectionCount()).isEqualTo(1);
    verify(client).keepAlive();
  }

  @Test
  void registerSendsHandshakeComment() {
    SseClient client = mockClient(Map.of("vehicles", List.of("true")));

    bridge.register(client);

    org.mockito.ArgumentCaptor<String> captor = org.mockito.ArgumentCaptor.forClass(String.class);
    verify(client).sendComment(captor.capture());
    assertThat(captor.getValue()).startsWith("connected ts=");
  }

  @Test
  void broadcastHeartbeatSendsCommentToEverySubscriber() {
    SseClient a = mockClient(Map.of("vehicles", List.of("true")));
    SseClient b = mockClient(Map.of("transportOrders", List.of("true")));
    bridge.register(a);
    bridge.register(b);

    bridge.broadcastHeartbeat();

    verify(a).sendComment(org.mockito.ArgumentMatchers.startsWith("keepalive ts="));
    verify(b).sendComment(org.mockito.ArgumentMatchers.startsWith("keepalive ts="));
  }

  @Test
  void broadcastHeartbeatIsNoOpWhenNoSubscribers() {
    // Must not throw and must not send anything.
    bridge.broadcastHeartbeat();

    assertThat(bridge.connectionCount()).isZero();
  }

  @Test
  void closeAllClosesEveryConnection() {
    SseClient a = mockClient(Map.of("vehicles", List.of("true")));
    SseClient b = mockClient(Map.of("transportOrders", List.of("true")));
    bridge.register(a);
    bridge.register(b);

    bridge.closeAll();

    assertThat(bridge.connectionCount()).isZero();
    verify(a).close();
    verify(b).close();
  }

  @Test
  void dispatchesVehicleEventOnlyToVehicleSubscribers() {
    SseClient vehicleSub = mockClient(Map.of("vehicles", List.of("true")));
    SseClient orderSub = mockClient(Map.of("transportOrders", List.of("true")));
    bridge.register(vehicleSub);
    bridge.register(orderSub);

    Vehicle prev = new Vehicle("V1");
    Vehicle curr = prev.withEnergyLevel(80);
    bridge.dispatch(
        new TCSObjectEvent(curr, prev, TCSObjectEvent.Type.OBJECT_MODIFIED)
    );

    verify(vehicleSub).sendEvent(
        eq(SseEventTypes.EVENT_TYPE_VEHICLES),
        any(SseEventEnvelope.class)
    );
    verify(orderSub, never()).sendEvent(any(), any());
  }

  @Test
  void dispatchesTransportOrderEventOnlyToOrderSubscribers() {
    SseClient vehicleSub = mockClient(Map.of("vehicles", List.of("true")));
    SseClient orderSub = mockClient(Map.of("transportOrders", List.of("true")));
    bridge.register(vehicleSub);
    bridge.register(orderSub);

    TransportOrder order = new TransportOrder("T1", List.of());
    bridge.dispatch(
        new TCSObjectEvent(order, order, TCSObjectEvent.Type.OBJECT_MODIFIED)
    );

    verify(orderSub).sendEvent(
        eq(SseEventTypes.EVENT_TYPE_TRANSPORT_ORDERS),
        any(SseEventEnvelope.class)
    );
    verify(vehicleSub, never()).sendEvent(any(), any());
  }

  @Test
  void ignoresEventsWithoutMappedDtoType() {
    SseClient anyClient = mockClient(
        Map.of("vehicles", List.of("true"), "transportOrders", List.of("true"))
    );
    bridge.register(anyClient);

    // OrderSequence has no DTO mapping in the BFF, so events must be silently ignored.
    org.opentcs.data.order.OrderSequence seq = new org.opentcs.data.order.OrderSequence("S1");
    bridge.dispatch(new TCSObjectEvent(seq, seq, TCSObjectEvent.Type.OBJECT_MODIFIED));

    verify(anyClient, never()).sendEvent(any(), any());
  }

  @Test
  void ignoresFalseSubscriptionFlag() {
    SseClient client = mockClient(Map.of("vehicles", List.of("false")));
    bridge.register(client);

    Vehicle v = new Vehicle("V1");
    bridge.dispatch(new TCSObjectEvent(v, v, TCSObjectEvent.Type.OBJECT_MODIFIED));

    verify(client, never()).sendEvent(any(), any());
  }

  @Test
  void envelopeContainsCurrentAndPreviousDto() {
    SseClient client = mockClient(Map.of("vehicles", List.of("true")));
    bridge.register(client);

    Vehicle prev = new Vehicle("V1");
    Vehicle curr = prev.withEnergyLevel(50);
    bridge.dispatch(new TCSObjectEvent(curr, prev, TCSObjectEvent.Type.OBJECT_MODIFIED));

    org.mockito.ArgumentCaptor<SseEventEnvelope<?>> captor
        = org.mockito.ArgumentCaptor.forClass(SseEventEnvelope.class);
    verify(client).sendEvent(eq(SseEventTypes.EVENT_TYPE_VEHICLES), captor.capture());
    SseEventEnvelope<?> envelope = captor.getValue();
    assertThat(envelope.currentObjectState()).isNotNull();
    assertThat(envelope.previousObjectState()).isNotNull();
  }

  private SseClient mockClient(Map<String, List<String>> queryParams) {
    SseClient client = mock(SseClient.class);
    Context ctx = mock(Context.class);
    lenient().when(client.ctx()).thenReturn(ctx);
    lenient().when(ctx.queryParamMap()).thenReturn(queryParams);
    lenient().when(ctx.ip()).thenReturn("test-client");
    return client;
  }
}
