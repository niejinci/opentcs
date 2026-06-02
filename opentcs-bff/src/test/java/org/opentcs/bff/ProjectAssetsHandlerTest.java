// SPDX-FileCopyrightText: The openTCS Authors
// SPDX-License-Identifier: MIT
package org.opentcs.bff;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;

import io.javalin.testtools.JavalinTest;
import java.net.http.HttpRequest.BodyPublishers;
import java.nio.file.Path;
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
 * JavalinTest-driven coverage of {@code /api/v1/projects/{id}/assets} endpoints.
 */
class ProjectAssetsHandlerTest {

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
  void illegalAssetName400() {
    JavalinTest.test(newApp().javalin(), (server, client) -> {
      client.request(
          "/api/v1/projects", b -> b
              .header("Content-Type", "application/json")
              .post(BodyPublishers.ofString("{\"name\":\"X\",\"id\":\"a1\"}"))
      );
      var r = client.get("/api/v1/projects/a1/assets/..%2Fpasswd");
      assertThat(r.code()).isEqualTo(400);
    });
  }

  @Test
  void missingAsset404() {
    JavalinTest.test(newApp().javalin(), (server, client) -> {
      client.request(
          "/api/v1/projects", b -> b
              .header("Content-Type", "application/json")
              .post(BodyPublishers.ofString("{\"name\":\"X\",\"id\":\"a2\"}"))
      );
      var r = client.get("/api/v1/projects/a2/assets/map.yaml");
      assertThat(r.code()).isEqualTo(404);
    });
  }

  @Test
  void listEmpty() {
    JavalinTest.test(newApp().javalin(), (server, client) -> {
      client.request(
          "/api/v1/projects", b -> b
              .header("Content-Type", "application/json")
              .post(BodyPublishers.ofString("{\"name\":\"X\",\"id\":\"a3\"}"))
      );
      var r = client.get("/api/v1/projects/a3/assets");
      assertThat(r.code()).isEqualTo(200);
      assertThat(r.body().string()).isEqualTo("[]");
    });
  }
}
