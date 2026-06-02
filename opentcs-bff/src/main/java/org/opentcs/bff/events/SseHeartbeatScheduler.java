// SPDX-FileCopyrightText: The openTCS Authors
// SPDX-License-Identifier: MIT
package org.opentcs.bff.events;

import static java.util.Objects.requireNonNull;

import com.google.inject.Singleton;
import jakarta.inject.Inject;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

/**
 * Background scheduler that periodically calls {@link SseEventBridge#broadcastHeartbeat()} so
 * idle SSE connections stay alive across reverse proxies and stateful firewalls.
 *
 * <p>The scheduler runs on a single dedicated daemon thread and is idempotent on
 * {@link #start()} / {@link #stop()}. When no clients are connected the scheduler still ticks
 * but {@link SseEventBridge#broadcastHeartbeat()} short-circuits, so the cost is negligible.
 */
@Singleton
public class SseHeartbeatScheduler {

  /**
   * Interval (ms) between heartbeat ticks. 20 seconds is a safe value that stays well below the
   * default idle-timeouts of most reverse proxies (Nginx 60 s, AWS ALB 60 s, …) while keeping
   * traffic minimal (one comment line per client per tick).
   */
  static final long HEARTBEAT_INTERVAL_MS = 20_000L;

  private static final Logger LOG = LoggerFactory.getLogger(SseHeartbeatScheduler.class);

  private final SseEventBridge bridge;
  private final long intervalMs;
  private final Object lifecycleLock = new Object();
  private volatile boolean running;
  private Thread thread;

  /**
   * Creates a new instance.
   *
   * @param bridge The bridge whose connections should be kept alive.
   */
  @Inject
  public SseHeartbeatScheduler(SseEventBridge bridge) {
    this(bridge, HEARTBEAT_INTERVAL_MS);
  }

  /**
   * Creates a new instance with a custom interval. Visible for tests.
   *
   * @param bridge The bridge whose connections should be kept alive.
   * @param intervalMs The interval between heartbeat ticks in milliseconds.
   */
  SseHeartbeatScheduler(SseEventBridge bridge, long intervalMs) {
    this.bridge = requireNonNull(bridge, "bridge");
    if (intervalMs <= 0) {
      throw new IllegalArgumentException("intervalMs must be positive");
    }
    this.intervalMs = intervalMs;
  }

  /**
   * Starts the heartbeat thread. Idempotent.
   */
  public void start() {
    synchronized (lifecycleLock) {
      if (running) {
        return;
      }
      running = true;
      thread = new Thread(this::loop, "bff-sse-heartbeat");
      thread.setDaemon(true);
      thread.start();
    }
    LOG.info("SSE heartbeat scheduler started (interval={} ms).", intervalMs);
  }

  /**
   * Signals the heartbeat thread to stop and waits briefly for it to terminate. Idempotent.
   */
  public void stop() {
    Thread t;
    synchronized (lifecycleLock) {
      if (!running) {
        return;
      }
      running = false;
      t = thread;
      thread = null;
    }
    if (t != null) {
      t.interrupt();
      try {
        t.join(2000);
      }
      catch (InterruptedException e) {
        Thread.currentThread().interrupt();
      }
    }
    LOG.info("SSE heartbeat scheduler stopped.");
  }

  /**
   * Returns whether the scheduler's background thread is currently running.
   *
   * @return Whether the scheduler is running.
   */
  public boolean isRunning() {
    return running;
  }

  private void loop() {
    while (running) {
      try {
        Thread.sleep(intervalMs);
      }
      catch (InterruptedException e) {
        Thread.currentThread().interrupt();
        return;
      }
      try {
        bridge.broadcastHeartbeat();
      }
      catch (RuntimeException e) {
        LOG.warn("SSE heartbeat broadcast failed; continuing.", e);
      }
    }
  }
}
