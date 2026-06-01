// SPDX-FileCopyrightText: The openTCS Authors
// SPDX-License-Identifier: MIT
package org.opentcs.bff.events;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.atLeast;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;

import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;

/**
 * Unit tests for {@link SseHeartbeatScheduler}: lifecycle and tick-driven heartbeat broadcast.
 */
class SseHeartbeatSchedulerTest {

  private SseHeartbeatScheduler scheduler;

  @AfterEach
  void tearDown() {
    if (scheduler != null) {
      scheduler.stop();
    }
  }

  @Test
  void startIsIdempotent() {
    SseEventBridge bridge = mock(SseEventBridge.class);
    scheduler = new SseHeartbeatScheduler(bridge, 50L);

    scheduler.start();
    scheduler.start();

    assertThat(scheduler.isRunning()).isTrue();
  }

  @Test
  void stopIsIdempotentAndSafeBeforeStart() {
    SseEventBridge bridge = mock(SseEventBridge.class);
    scheduler = new SseHeartbeatScheduler(bridge, 50L);

    scheduler.stop();
    scheduler.stop();

    assertThat(scheduler.isRunning()).isFalse();
  }

  @Test
  void tickInvokesBridgeBroadcastHeartbeat()
      throws InterruptedException {
    SseEventBridge bridge = mock(SseEventBridge.class);
    scheduler = new SseHeartbeatScheduler(bridge, 30L);

    scheduler.start();
    // Wait long enough for at least 2 ticks to be scheduled and the bridge to be invoked.
    Thread.sleep(200L);
    scheduler.stop();

    verify(bridge, atLeast(2)).broadcastHeartbeat();
  }

  @Test
  void rejectsNonPositiveInterval() {
    SseEventBridge bridge = mock(SseEventBridge.class);

    assertThatThrownBy(() -> new SseHeartbeatScheduler(bridge, 0L))
        .isInstanceOf(IllegalArgumentException.class);
    assertThatThrownBy(() -> new SseHeartbeatScheduler(bridge, -1L))
        .isInstanceOf(IllegalArgumentException.class);
  }
}
