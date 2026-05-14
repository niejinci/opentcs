// SPDX-FileCopyrightText: The openTCS Authors
// SPDX-License-Identifier: MIT
package org.opentcs.bff.events;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.Mockito.atLeast;
import static org.mockito.Mockito.atLeastOnce;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import io.javalin.http.Context;
import io.javalin.http.sse.SseClient;
import java.util.List;
import java.util.Map;
import java.util.concurrent.atomic.AtomicInteger;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.opentcs.access.KernelRuntimeException;
import org.opentcs.bff.kernel.KernelClient;
import org.opentcs.data.TCSObjectEvent;
import org.opentcs.data.model.Vehicle;

/**
 * Tests {@link KernelEventPoller}'s background polling, idle skip and error backoff behaviour.
 */
class KernelEventPollerTest {

  private KernelClient kernelClient;
  private SseEventBridge bridge;
  private KernelEventPoller poller;

  @BeforeEach
  void setUp() {
    kernelClient = mock(KernelClient.class);
    bridge = new SseEventBridge();
    poller = new KernelEventPoller(kernelClient, bridge);
  }

  @AfterEach
  void tearDown() {
    poller.stop();
  }

  @Test
  void doesNotPollWhenNoSubscribers()
      throws Exception {
    when(kernelClient.fetchEvents(anyLong())).thenReturn(List.of());

    poller.start();
    Thread.sleep(150);

    verify(kernelClient, never()).fetchEvents(anyLong());
  }

  @Test
  void pollsAndDispatchesWhenSubscriberConnected()
      throws Exception {
    Vehicle vehicle = new Vehicle("V1");
    when(kernelClient.fetchEvents(anyLong()))
        .thenReturn(
            List.of(new TCSObjectEvent(vehicle, vehicle, TCSObjectEvent.Type.OBJECT_MODIFIED))
        )
        .thenReturn(List.of());

    SseClient client = mockClient(Map.of("vehicles", List.of("true")));
    bridge.register(client);

    poller.start();
    waitFor(() -> {
      try {
        verify(client, atLeastOnce())
            .sendEvent(
                org.mockito.ArgumentMatchers.eq(SseEventTypes.EVENT_TYPE_VEHICLES),
                org.mockito.ArgumentMatchers.any()
            );
        return true;
      }
      catch (AssertionError e) {
        return false;
      }
    }, 3000);
  }

  @Test
  void backsOffAfterKernelError()
      throws Exception {
    AtomicInteger calls = new AtomicInteger();
    when(kernelClient.fetchEvents(anyLong())).thenAnswer(inv -> {
      calls.incrementAndGet();
      throw new KernelRuntimeException("boom");
    });

    SseClient client = mockClient(Map.of("vehicles", List.of("true")));
    bridge.register(client);

    poller.start();
    waitFor(() -> calls.get() >= 1, 2000);

    // The poller backs off for ERROR_SLEEP_MS (5s) after a failure, so a 300 ms observation
    // window should see no more than one extra poll.
    int observed = calls.get();
    Thread.sleep(300);
    assertThat(calls.get()).isLessThanOrEqualTo(observed + 1);
  }

  @Test
  void startAndStopAreIdempotent() {
    poller.start();
    poller.start();
    assertThat(poller.isRunning()).isTrue();
    poller.stop();
    poller.stop();
    assertThat(poller.isRunning()).isFalse();
  }

  @Test
  void ignoresNonObjectEvents()
      throws Exception {
    when(kernelClient.fetchEvents(anyLong()))
        .thenReturn(List.of(new Object()))
        .thenReturn(List.of());

    SseClient client = mockClient(Map.of("vehicles", List.of("true")));
    bridge.register(client);

    poller.start();
    Thread.sleep(150);

    // Verifies the poll happened at least once but no event was dispatched.
    verify(kernelClient, atLeast(1)).fetchEvents(anyLong());
    verify(client, times(0))
        .sendEvent(
            org.mockito.ArgumentMatchers.anyString(),
            org.mockito.ArgumentMatchers.any()
        );
  }

  private SseClient mockClient(Map<String, List<String>> queryParams) {
    SseClient client = mock(SseClient.class);
    Context ctx = mock(Context.class);
    when(client.ctx()).thenReturn(ctx);
    when(ctx.queryParamMap()).thenReturn(queryParams);
    when(ctx.ip()).thenReturn("test-client");
    return client;
  }

  private static void waitFor(java.util.function.BooleanSupplier condition, long timeoutMs)
      throws InterruptedException {
    long deadline = System.currentTimeMillis() + timeoutMs;
    while (System.currentTimeMillis() < deadline) {
      if (condition.getAsBoolean()) {
        return;
      }
      Thread.sleep(25);
    }
    if (!condition.getAsBoolean()) {
      throw new AssertionError("Condition not met within " + timeoutMs + " ms");
    }
  }
}
