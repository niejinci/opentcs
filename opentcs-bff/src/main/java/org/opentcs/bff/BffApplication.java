// SPDX-FileCopyrightText: The openTCS Authors
// SPDX-License-Identifier: MIT
package org.opentcs.bff;

import static io.javalin.apibuilder.ApiBuilder.get;
import static io.javalin.apibuilder.ApiBuilder.path;
import static java.util.Objects.requireNonNull;

import io.javalin.Javalin;
import io.javalin.http.staticfiles.Location;
import jakarta.inject.Inject;
import org.opentcs.bff.health.HealthHandler;
import org.opentcs.bff.plantmodel.PlantModelSummaryHandler;
import org.opentcs.bff.swagger.OpenApiSpecHandler;
import org.opentcs.bff.vehicle.GetVehicleHandler;
import org.opentcs.bff.vehicle.ListVehiclesHandler;
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

  /**
   * Path on the classpath where the {@code swagger-ui} webjar's static assets live. Must be kept
   * in sync with the {@code swagger-ui} version declared in {@code gradle/libs.versions.toml}.
   */
  static final String SWAGGER_UI_WEBJAR_DIR
      = "/META-INF/resources/webjars/swagger-ui/5.32.0";
  /**
   * Classpath directory whose contents take precedence over the webjar (for our own
   * {@code swagger-initializer.js}).
   */
  static final String SWAGGER_UI_OVERRIDES_DIR = "/swagger-ui-overrides";
  /**
   * URL path under which Swagger UI is hosted.
   */
  static final String SWAGGER_UI_HOSTED_PATH = "/swagger-ui";
  /**
   * URL path at which the OpenAPI spec is exposed.
   */
  static final String OPENAPI_SPEC_PATH = "/openapi/bff.yaml";

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
   * @param listVehiclesHandler The handler serving {@code GET /api/v1/vehicles}.
   * @param getVehicleHandler The handler serving {@code GET /api/v1/vehicles/{name}}.
   * @param openApiSpecHandler The handler serving the OpenAPI specification.
   */
  @Inject
  public BffApplication(
      BffConfiguration configuration,
      HealthHandler healthHandler,
      PlantModelSummaryHandler plantModelSummaryHandler,
      ListVehiclesHandler listVehiclesHandler,
      GetVehicleHandler getVehicleHandler,
      OpenApiSpecHandler openApiSpecHandler
  ) {
    this.configuration = requireNonNull(configuration, "configuration");
    requireNonNull(healthHandler, "healthHandler");
    requireNonNull(plantModelSummaryHandler, "plantModelSummaryHandler");
    requireNonNull(listVehiclesHandler, "listVehiclesHandler");
    requireNonNull(getVehicleHandler, "getVehicleHandler");
    requireNonNull(openApiSpecHandler, "openApiSpecHandler");
    this.javalin = Javalin.create(cfg -> {
      cfg.startup.showJavalinBanner = false;
      cfg.jetty.host = configuration.bindAddress();
      cfg.jetty.port = configuration.bindPort();
      // Overrides (our customised swagger-initializer.js) take precedence; the webjar fills in
      // the rest of the swagger-ui assets (HTML, JS, CSS).
      cfg.staticFiles.add(staticFiles -> {
        staticFiles.hostedPath = SWAGGER_UI_HOSTED_PATH;
        staticFiles.directory = SWAGGER_UI_OVERRIDES_DIR;
        staticFiles.location = Location.CLASSPATH;
      });
      cfg.staticFiles.add(staticFiles -> {
        staticFiles.hostedPath = SWAGGER_UI_HOSTED_PATH;
        staticFiles.directory = SWAGGER_UI_WEBJAR_DIR;
        staticFiles.location = Location.CLASSPATH;
      });
      cfg.routes.apiBuilder(() -> {
        get("/health", healthHandler);
        get(OPENAPI_SPEC_PATH, openApiSpecHandler);
        path("/api/v1", () -> {
          path("/plant-model", () -> {
            get("/summary", plantModelSummaryHandler);
          });
          path("/vehicles", () -> {
            get(listVehiclesHandler);
            get("/{" + GetVehicleHandler.NAME_PARAM + "}", getVehicleHandler);
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
