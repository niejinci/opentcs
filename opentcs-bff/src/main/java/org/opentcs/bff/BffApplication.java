// SPDX-FileCopyrightText: The openTCS Authors
// SPDX-License-Identifier: MIT
package org.opentcs.bff;

import static io.javalin.apibuilder.ApiBuilder.delete;
import static io.javalin.apibuilder.ApiBuilder.get;
import static io.javalin.apibuilder.ApiBuilder.patch;
import static io.javalin.apibuilder.ApiBuilder.path;
import static io.javalin.apibuilder.ApiBuilder.post;
import static io.javalin.apibuilder.ApiBuilder.put;
import static io.javalin.apibuilder.ApiBuilder.sse;
import static java.util.Objects.requireNonNull;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.SerializationFeature;
import com.fasterxml.jackson.datatype.jsr310.JavaTimeModule;
import io.javalin.Javalin;
import io.javalin.http.HttpStatus;
import io.javalin.http.staticfiles.Location;
import io.javalin.json.JavalinJackson;
import jakarta.inject.Inject;
import org.opentcs.access.KernelRuntimeException;
import org.opentcs.bff.error.ErrorResponses;
import org.opentcs.bff.events.KernelEventPoller;
import org.opentcs.bff.events.SseEventBridge;
import org.opentcs.bff.events.SseHeartbeatScheduler;
import org.opentcs.bff.events.SsePingHandler;
import org.opentcs.bff.health.HealthHandler;
import org.opentcs.bff.plantmodel.PlantModelSummaryHandler;
import org.opentcs.bff.project.AssetNotFoundException;
import org.opentcs.bff.project.AssetTooLargeException;
import org.opentcs.bff.project.ProjectAlreadyExistsException;
import org.opentcs.bff.project.ProjectAssetsHandler;
import org.opentcs.bff.project.ProjectNotFoundException;
import org.opentcs.bff.project.ProjectsHandler;
import org.opentcs.bff.publish.KernelUnreachableException;
import org.opentcs.bff.publish.PublishHandler;
import org.opentcs.bff.publish.PublishValidationException;
import org.opentcs.bff.security.AccessKeyAuthenticator;
import org.opentcs.bff.security.UnauthorizedException;
import org.opentcs.bff.swagger.OpenApiSpecHandler;
import org.opentcs.bff.transportorder.CreateTransportOrderHandler;
import org.opentcs.bff.vehicle.GetVehicleHandler;
import org.opentcs.bff.vehicle.ListVehiclesHandler;
import org.opentcs.bff.vehicle.UpdateVehicleIntegrationLevelHandler;
import org.opentcs.data.ObjectExistsException;
import org.opentcs.data.ObjectUnknownException;
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

  /**
   * URL prefix for all paths that require authentication. The {@code /health} endpoint and the
   * Swagger UI / OpenAPI spec are intentionally not protected.
   */
  static final String API_PATH_PREFIX = "/api/";

  private static final Logger LOG = LoggerFactory.getLogger(BffApplication.class);

  private final BffConfiguration configuration;
  private final Javalin javalin;
  private final KernelEventPoller kernelEventPoller;
  private final SseEventBridge sseEventBridge;
  private final SseHeartbeatScheduler sseHeartbeatScheduler;
  private volatile boolean started;

  /**
   * Creates a new instance.
   *
   * @param configuration The configuration to bind the HTTP server with.
   * @param authenticator Authenticates incoming API requests.
   * @param healthHandler The handler serving {@code GET /health}.
   * @param plantModelSummaryHandler The handler serving
   * {@code GET /api/v1/plant-model/summary}.
   * @param listVehiclesHandler The handler serving {@code GET /api/v1/vehicles}.
   * @param getVehicleHandler The handler serving {@code GET /api/v1/vehicles/{name}}.
   * @param updateVehicleIntegrationLevelHandler The handler serving
   * {@code PUT /api/v1/vehicles/{name}/integrationLevel}.
   * @param createTransportOrderHandler The handler serving
   * {@code POST /api/v1/transport-orders}.
   * @param projectsHandler The handler bundle serving {@code /api/v1/projects} CRUD endpoints.
   * @param projectAssetsHandler The handler bundle serving
   * {@code /api/v1/projects/{id}/assets} endpoints.
   * @param openApiSpecHandler The handler serving the OpenAPI specification.
   * @param sseEventBridge The bridge that broadcasts kernel events to connected SSE clients.
   * @param ssePingHandler The handler serving {@code GET /api/v1/sse/ping}.
   * @param kernelEventPoller The poller that fetches kernel events and feeds the bridge.
   * @param sseHeartbeatScheduler Periodically broadcasts SSE keep-alive comments.
   */
  @Inject
  public BffApplication(
      BffConfiguration configuration,
      AccessKeyAuthenticator authenticator,
      HealthHandler healthHandler,
      PlantModelSummaryHandler plantModelSummaryHandler,
      ListVehiclesHandler listVehiclesHandler,
      GetVehicleHandler getVehicleHandler,
      UpdateVehicleIntegrationLevelHandler updateVehicleIntegrationLevelHandler,
      CreateTransportOrderHandler createTransportOrderHandler,
      ProjectsHandler projectsHandler,
      ProjectAssetsHandler projectAssetsHandler,
      PublishHandler publishHandler,
      OpenApiSpecHandler openApiSpecHandler,
      SseEventBridge sseEventBridge,
      SsePingHandler ssePingHandler,
      KernelEventPoller kernelEventPoller,
      SseHeartbeatScheduler sseHeartbeatScheduler
  ) {
    this.configuration = requireNonNull(configuration, "configuration");
    requireNonNull(authenticator, "authenticator");
    requireNonNull(healthHandler, "healthHandler");
    requireNonNull(plantModelSummaryHandler, "plantModelSummaryHandler");
    requireNonNull(listVehiclesHandler, "listVehiclesHandler");
    requireNonNull(getVehicleHandler, "getVehicleHandler");
    requireNonNull(
        updateVehicleIntegrationLevelHandler, "updateVehicleIntegrationLevelHandler"
    );
    requireNonNull(createTransportOrderHandler, "createTransportOrderHandler");
    requireNonNull(projectsHandler, "projectsHandler");
    requireNonNull(projectAssetsHandler, "projectAssetsHandler");
    requireNonNull(publishHandler, "publishHandler");
    requireNonNull(openApiSpecHandler, "openApiSpecHandler");
    requireNonNull(ssePingHandler, "ssePingHandler");
    this.sseEventBridge = requireNonNull(sseEventBridge, "sseEventBridge");
    this.kernelEventPoller = requireNonNull(kernelEventPoller, "kernelEventPoller");
    this.sseHeartbeatScheduler
        = requireNonNull(sseHeartbeatScheduler, "sseHeartbeatScheduler");
    this.javalin = Javalin.create(cfg -> {
      cfg.startup.showJavalinBanner = false;
      cfg.jetty.host = configuration.bindAddress();
      cfg.jetty.port = configuration.bindPort();
      cfg.jsonMapper(
          new JavalinJackson(
              new ObjectMapper()
                  .registerModule(new JavaTimeModule())
                  .disable(SerializationFeature.WRITE_DATES_AS_TIMESTAMPS),
              false
          )
      );
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
            path("/{" + GetVehicleHandler.NAME_PARAM + "}", () -> {
              get(getVehicleHandler);
              put("/integrationLevel", updateVehicleIntegrationLevelHandler);
            });
          });
          path("/transport-orders", () -> {
            post(createTransportOrderHandler);
          });
          path("/plant-models", () -> {
            post("/publish", publishHandler);
          });
          path("/projects", () -> {
            get(projectsHandler.list());
            post(projectsHandler.create());
            path("/{" + ProjectsHandler.ID_PARAM + "}", () -> {
              get(projectsHandler.get());
              patch(projectsHandler.rename());
              delete(projectsHandler.delete());
              post("/copy", projectsHandler.copy());
              path("/draft", () -> {
                get(projectsHandler.getDraft());
                put(projectsHandler.putDraft());
              });
              path("/assets", () -> {
                get(projectAssetsHandler.list());
                post(projectAssetsHandler.upload());
                path("/{" + ProjectAssetsHandler.NAME_PARAM + "}", () -> {
                  get(projectAssetsHandler.download());
                  delete(projectAssetsHandler.delete());
                });
              });
            });
          });
          sse("/sse", sseEventBridge::register);
          get("/sse/ping", ssePingHandler);
        });
      });

      cfg.routes.beforeMatched(ctx -> {
        // Echo a trace id back so callers can correlate logs even on success.
        ctx.header(ErrorResponses.TRACE_ID_HEADER, ErrorResponses.traceIdFor(ctx));
        if (ctx.path().startsWith(API_PATH_PREFIX) && !authenticator.isAuthenticated(ctx)) {
          String provided = ctx.header(AccessKeyAuthenticator.ACCESS_KEY_HEADER);
          throw new UnauthorizedException(
              provided == null || provided.isEmpty()
                  ? "Missing API access key header."
                  : "Invalid API access key."
          );
        }
      });

      cfg.routes.exception(UnauthorizedException.class, (e, ctx) -> {
        ErrorResponses.write(ctx, HttpStatus.UNAUTHORIZED, "UNAUTHORIZED", e.getMessage());
      });
      cfg.routes.exception(IllegalArgumentException.class, (e, ctx) -> {
        ErrorResponses.write(ctx, HttpStatus.BAD_REQUEST, "BAD_REQUEST", e.getMessage());
      });
      cfg.routes.exception(ObjectUnknownException.class, (e, ctx) -> {
        ErrorResponses.write(ctx, HttpStatus.NOT_FOUND, "NOT_FOUND", e.getMessage());
      });
      cfg.routes.exception(ObjectExistsException.class, (e, ctx) -> {
        ErrorResponses.write(ctx, HttpStatus.CONFLICT, "ALREADY_EXISTS", e.getMessage());
      });
      cfg.routes.exception(ProjectNotFoundException.class, (e, ctx) -> {
        ErrorResponses.write(ctx, HttpStatus.NOT_FOUND, "PROJECT_NOT_FOUND", e.getMessage());
      });
      cfg.routes.exception(ProjectAlreadyExistsException.class, (e, ctx) -> {
        ErrorResponses.write(
            ctx, HttpStatus.CONFLICT, "PROJECT_ALREADY_EXISTS", e.getMessage()
        );
      });
      cfg.routes.exception(AssetNotFoundException.class, (e, ctx) -> {
        ErrorResponses.write(ctx, HttpStatus.NOT_FOUND, "ASSET_NOT_FOUND", e.getMessage());
      });
      cfg.routes.exception(AssetTooLargeException.class, (e, ctx) -> {
        ErrorResponses.write(
            ctx, HttpStatus.CONTENT_TOO_LARGE, "ASSET_TOO_LARGE", e.getMessage()
        );
      });
      cfg.routes.exception(PublishValidationException.class, (e, ctx) -> {
        ErrorResponses.write(
            ctx,
            HttpStatus.BAD_REQUEST,
            "PUBLISH_VALIDATION",
            e.getMessage(),
            e.getFieldPath()
        );
      });
      cfg.routes.exception(KernelUnreachableException.class, (e, ctx) -> {
        LOG.warn("Kernel unreachable (trace {})", ErrorResponses.traceIdFor(ctx), e);
        ErrorResponses.write(
            ctx,
            HttpStatus.BAD_GATEWAY,
            "KERNEL_UNREACHABLE",
            e.getMessage()
        );
      });
      cfg.routes.exception(KernelRuntimeException.class, (e, ctx) -> {
        LOG.warn("Kernel call failed (trace {})", ErrorResponses.traceIdFor(ctx), e);
        ErrorResponses.write(
            ctx,
            HttpStatus.SERVICE_UNAVAILABLE,
            "KERNEL_UNAVAILABLE",
            "Kernel call failed: " + e.getMessage()
        );
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
    kernelEventPoller.start();
    sseHeartbeatScheduler.start();
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
    kernelEventPoller.stop();
    sseHeartbeatScheduler.stop();
    sseEventBridge.closeAll();
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
