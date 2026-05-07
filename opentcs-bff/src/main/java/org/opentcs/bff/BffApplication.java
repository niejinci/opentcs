// SPDX-FileCopyrightText: The openTCS Authors
// SPDX-License-Identifier: MIT
package org.opentcs.bff;

import static io.javalin.apibuilder.ApiBuilder.get;
import static io.javalin.apibuilder.ApiBuilder.path;
import static java.util.Objects.requireNonNull;

import io.javalin.Javalin;
import jakarta.inject.Inject;
import org.opentcs.bff.health.HealthHandler;
import org.opentcs.bff.plantmodel.PlantModelSummaryHandler;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

/**
 * The Backend-For-Frontend (BFF) HTTP server for the openTCS SPA.
 *
 * <p>Wraps a {@link Javalin} instance and exposes a small lifecycle ({@link #start()} /
 * {@link #stop()}) so the same object can be driven both from the {@code RunBff} entry point and
 * from {@code JavalinTest} in unit tests.
 */
public class BffApplication {

  private static final Logger LOG = LoggerFactory.getLogger(BffApplication.class);

  private final BffConfiguration configuration;
  private final Javalin javalin;
  private volatile boolean started;

  /**
   * Creates a new instance.
   *
   * @param configuration The configuration to bind the HTTP server with.
   * @param healthHandler The handler serving {@code GET /health}.
   * @param plantModelSummaryHandler The handler serving
   * {@code GET /api/v1/plant-model/summary}.
   */
  @Inject
  public BffApplication(
      BffConfiguration configuration,
      HealthHandler healthHandler,
      PlantModelSummaryHandler plantModelSummaryHandler
  ) {
    this.configuration = requireNonNull(configuration, "configuration");
    requireNonNull(healthHandler, "healthHandler");
    requireNonNull(plantModelSummaryHandler, "plantModelSummaryHandler");
    this.javalin = Javalin.create(cfg -> {
      cfg.startup.showJavalinBanner = false;
      cfg.jetty.host = configuration.bindAddress();
      cfg.jetty.port = configuration.bindPort();
      cfg.routes.apiBuilder(() -> {
        get("/health", healthHandler);
        path("/api/v1", () -> {
          path("/plant-model", () -> {
            get("/summary", plantModelSummaryHandler);
          });
        });
      });
    });
  }

  /**
   * Starts the embedded HTTP server. Idempotent.
   */
  public void start() {
    if (started) {
      return;
    }
    javalin.start();
    started = true;
    LOG.info(
        "BFF started on {}:{} (configured port: {})",
        configuration.bindAddress(),
        javalin.port(),
        configuration.bindPort()
    );
  }

  /**
   * Stops the embedded HTTP server. Idempotent.
   */
  public void stop() {
    if (!started) {
      return;
    }
    javalin.stop();
    started = false;
    LOG.info("BFF stopped");
  }

  /**
   * Returns the actual port the server is listening on. Useful when {@code bindPort == 0} and
   * the OS assigns an ephemeral port.
   *
   * @return The actual port the server is listening on, or {@code -1} if the server is not
   * running.
   */
  public int port() {
    return started ? javalin.port() : -1;
  }

  /**
   * Returns the underlying Javalin instance, primarily for use by {@code JavalinTest}.
   *
   * @return The underlying Javalin instance.
   */
  Javalin javalin() {
    return javalin;
  }
}
