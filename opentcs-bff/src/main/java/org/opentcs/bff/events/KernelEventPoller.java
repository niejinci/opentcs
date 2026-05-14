// SPDX-FileCopyrightText: The openTCS Authors
// SPDX-License-Identifier: MIT
package org.opentcs.bff.events;

import static java.util.Objects.requireNonNull;

import com.google.inject.Singleton;
import jakarta.inject.Inject;
import java.util.List;
import org.opentcs.access.KernelRuntimeException;
import org.opentcs.bff.kernel.KernelClient;
import org.opentcs.data.TCSObjectEvent;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

/**
 * Continuously polls the openTCS Kernel for events on a dedicated background thread and forwards
 * any received {@link TCSObjectEvent}s to the {@link SseEventBridge} for broadcasting.
 *
 * <p>The poller is started via {@link #start()} when the BFF application boots, and stopped via
 * {@link #stop()} during shutdown. Both methods are idempotent.
 *
 * <p>To avoid burning RMI cycles when no SSE clients are connected, the poller simply sleeps for
 * {@link #IDLE_SLEEP_MS} ms between probes whenever {@link SseEventBridge#connectionCount()}
 * reports zero.
 *
 * <p>Errors raised by the kernel call (e.g. the kernel went away) are logged and the poller backs
 * off for {@link #ERROR_SLEEP_MS} ms before retrying. {@link KernelClient#fetchEvents(long)}
 * automatically invalidates the cached portal on error, so the next iteration will reconnect.
 */
@Singleton
public class KernelEventPoller {

  /**
   * Maximum time (ms) to wait for events on each kernel poll.
   */
  static final long FETCH_TIMEOUT_MS = 1000L;
  /**
   * Time (ms) to sleep between polls when no SSE clients are subscribed.
   */
  static final long IDLE_SLEEP_MS = 1000L;
  /**
   * Time (ms) to back off after an exception from the kernel poll.
   */
  static final long ERROR_SLEEP_MS = 5000L;

  private static final Logger LOG = LoggerFactory.getLogger(KernelEventPoller.class);

  private final KernelClient kernelClient;
  private final SseEventBridge bridge;
  private final Object lifecycleLock = new Object();
  private volatile boolean running;
  private Thread thread;

  /**
   * Creates a new instance.
   *
   * @param kernelClient The kernel client used to fetch events.
   * @param bridge The SSE bridge that broadcasts received events.
   */
  @Inject
  public KernelEventPoller(KernelClient kernelClient, SseEventBridge bridge) {
    this.kernelClient = requireNonNull(kernelClient, "kernelClient");
    this.bridge = requireNonNull(bridge, "bridge");
  }

  /**
   * Starts the background polling thread. Idempotent.
   */
  public void start() {
    synchronized (lifecycleLock) {
      if (running) {
        return;
      }
      running = true;
      thread = new Thread(this::pollLoop, "bff-kernel-event-poller");
      thread.setDaemon(true);
      thread.start();
    }
    LOG.info("Kernel event poller started.");
  }

  /**
   * Signals the polling thread to stop and waits briefly for it to terminate. Idempotent.
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
    LOG.info("Kernel event poller stopped.");
  }

  /**
   * Returns whether the poller's background thread is currently running.
   *
   * @return Whether the poller is running.
   */
  public boolean isRunning() {
    return running;
  }

  private void pollLoop() {
    while (running) {
      if (bridge.connectionCount() == 0) {
        if (sleepQuietly(IDLE_SLEEP_MS)) {
          continue;
        }
        return;
      }
      try {
        List<Object> events = kernelClient.fetchEvents(FETCH_TIMEOUT_MS);
        for (Object event : events) {
          if (event instanceof TCSObjectEvent objectEvent) {
            try {
              bridge.dispatch(objectEvent);
            }
            catch (RuntimeException e) {
              LOG.warn("Failed to dispatch SSE event; continuing.", e);
            }
          }
        }
      }
      catch (KernelRuntimeException e) {
        LOG.warn(
            "Kernel event fetch failed; backing off for {} ms before retrying.",
            ERROR_SLEEP_MS,
            e
        );
        if (!sleepQuietly(ERROR_SLEEP_MS)) {
          return;
        }
      }
    }
  }

  /**
   * Sleeps the given number of ms, returning false if interrupted (so the caller can exit).
   */
  private boolean sleepQuietly(long ms) {
    try {
      Thread.sleep(ms);
      return true;
    }
    catch (InterruptedException e) {
      Thread.currentThread().interrupt();
      return false;
    }
  }
}
