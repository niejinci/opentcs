// SPDX-FileCopyrightText: The openTCS Authors
// SPDX-License-Identifier: MIT
package org.opentcs.bff;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import io.javalin.testtools.JavalinTest;
import java.net.http.HttpRequest.BodyPublishers;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import org.opentcs.bff.events.KernelEventPoller;
import org.opentcs.bff.events.SseEventBridge;
import org.opentcs.bff.health.HealthHandler;
import org.opentcs.bff.kernel.KernelClient;
import org.opentcs.bff.plantmodel.PlantModelSummaryHandler;
import org.opentcs.bff.project.ProjectAssetsHandler;
import org.opentcs.bff.project.ProjectStore;
import org.opentcs.bff.project.ProjectsHandler;
import org.opentcs.bff.security.AccessKeyAuthenticator;
import org.opentcs.bff.swagger.OpenApiSpecHandler;
import org.opentcs.bff.transportorder.CreateTransportOrderHandler;
import org.opentcs.bff.vehicle.GetVehicleHandler;
import org.opentcs.bff.vehicle.ListVehiclesHandler;

/**
 * JavalinTest-driven coverage of the {@code /api/v1/projects} endpoints.
 */
class ProjectsHandlerTest {

  private static final ObjectMapper JSON = new ObjectMapper();

  @TempDir
  private Path workspace;

  private BffApplication newApp() {
    KernelClient kernelClient = mock(KernelClient.class);
    SseEventBridge sse = new SseEventBridge();
    ProjectStore store = new ProjectStore(workspace, 1024L * 1024L);
    return new BffApplication(
        TestConfigurations.bff("127.0.0.1", 0),
        new AccessKeyAuthenticator(TestConfigurations.security("")),
        new HealthHandler(),
        new PlantModelSummaryHandler(kernelClient),
        new ListVehiclesHandler(kernelClient),
        new GetVehicleHandler(kernelClient),
        new org.opentcs.bff.vehicle.UpdateVehicleIntegrationLevelHandler(kernelClient),
        new CreateTransportOrderHandler(kernelClient),
        new ProjectsHandler(store),
        new ProjectAssetsHandler(store),
        org.mockito.Mockito.mock(org.opentcs.bff.publish.PublishHandler.class),
        new OpenApiSpecHandler(),
        sse,
        new org.opentcs.bff.events.SsePingHandler(sse),
        new KernelEventPoller(kernelClient, sse),
        new org.opentcs.bff.events.SseHeartbeatScheduler(sse)
    );
  }

  @Test
  void crudFlow() {
    JavalinTest.test(newApp().javalin(), (server, client) -> {
      var r0 = client.get("/api/v1/projects");
      assertThat(r0.code()).isEqualTo(200);
      assertThat(r0.body().string()).isEqualTo("[]");

      var rc = client.request(
          "/api/v1/projects", b -> b
              .header("Content-Type", "application/json")
              .post(BodyPublishers.ofString("{\"name\":\"Demo\",\"id\":\"demo\"}"))
      );
      assertThat(rc.code()).isEqualTo(201);
      assertThat(rc.headers().get("Location")).containsExactly("/api/v1/projects/demo");

      assertThat(client.get("/api/v1/projects/demo").code()).isEqualTo(200);

      var rr = client.request(
          "/api/v1/projects/demo", b -> b
              .header("Content-Type", "application/json")
              .patch(BodyPublishers.ofString("{\"name\":\"Renamed\"}"))
      );
      assertThat(rr.code()).isEqualTo(200);

      var rcopy = client.request(
          "/api/v1/projects/demo/copy", b -> b
              .header("Content-Type", "application/json")
              .post(BodyPublishers.ofString("{\"newName\":\"Clone\",\"newId\":\"clone1\"}"))
      );
      assertThat(rcopy.code()).isEqualTo(201);

      var rd = client.request(
          "/api/v1/projects/clone1", b -> b
              .delete(BodyPublishers.noBody())
      );
      assertThat(rd.code()).isEqualTo(204);
    });
  }

  @Test
  void pathTraversalRejected() {
    JavalinTest.test(newApp().javalin(), (server, client) -> {
      var r = client.get("/api/v1/projects/..%2Fetc");
      assertThat(r.code()).isEqualTo(400);
    });
  }

  @Test
  void duplicateIdConflict() {
    JavalinTest.test(newApp().javalin(), (server, client) -> {
      client.request(
          "/api/v1/projects", b -> b
              .header("Content-Type", "application/json")
              .post(BodyPublishers.ofString("{\"name\":\"A\",\"id\":\"dup\"}"))
      );
      var r = client.request(
          "/api/v1/projects", b -> b
              .header("Content-Type", "application/json")
              .post(BodyPublishers.ofString("{\"name\":\"B\",\"id\":\"dup\"}"))
      );
      assertThat(r.code()).isEqualTo(409);
    });
  }

  @Test
  void draftRoundTripsGoldenFixture()
      throws Exception {
    Path fixture = Paths.get("..", "docs", "fixtures", "opentcs-spa.draftV1.json").toAbsolutePath();
    assertThat(Files.exists(fixture))
        .as("Golden fixture %s must exist", fixture).isTrue();
    String draftV1 = Files.readString(fixture, StandardCharsets.UTF_8);
    ObjectNode envelope = JSON.createObjectNode();
    envelope.put("version", 1);
    envelope.put("savedAt", "2026-05-22T08:00:00Z");
    envelope.set("payload", JSON.readTree(draftV1));
    String envelopeJson = JSON.writeValueAsString(envelope);

    JavalinTest.test(newApp().javalin(), (server, client) -> {
      client.request(
          "/api/v1/projects", b -> b
              .header("Content-Type", "application/json")
              .post(BodyPublishers.ofString("{\"name\":\"Plant\",\"id\":\"p1\"}"))
      );
      var put = client.request(
          "/api/v1/projects/p1/draft", b -> b
              .header("Content-Type", "application/json")
              .put(BodyPublishers.ofString(envelopeJson))
      );
      assertThat(put.code()).isEqualTo(204);
      var get = client.get("/api/v1/projects/p1/draft");
      assertThat(get.code()).isEqualTo(200);
      assertThat(JSON.readTree(get.body().string())).isEqualTo(envelope);
    });
  }

  @Test
  void missingDraftReturns404() {
    JavalinTest.test(newApp().javalin(), (server, client) -> {
      client.request(
          "/api/v1/projects", b -> b
              .header("Content-Type", "application/json")
              .post(BodyPublishers.ofString("{\"name\":\"X\",\"id\":\"q1\"}"))
      );
      assertThat(client.get("/api/v1/projects/q1/draft").code()).isEqualTo(404);
    });
  }

  @Test
  void putDraftWithoutVersionField400() {
    JavalinTest.test(newApp().javalin(), (server, client) -> {
      client.request(
          "/api/v1/projects", b -> b
              .header("Content-Type", "application/json")
              .post(BodyPublishers.ofString("{\"name\":\"X\",\"id\":\"r1\"}"))
      );
      var r = client.request(
          "/api/v1/projects/r1/draft", b -> b
              .header("Content-Type", "application/json")
              .put(BodyPublishers.ofString("{\"savedAt\":\"x\"}"))
      );
      assertThat(r.code()).isEqualTo(400);
    });
  }
}
