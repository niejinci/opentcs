// SPDX-FileCopyrightText: The openTCS Authors
// SPDX-License-Identifier: MIT
package org.opentcs.bff;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;

import com.fasterxml.jackson.databind.ObjectMapper;
import io.javalin.testtools.JavalinTest;
import java.net.http.HttpRequest.BodyPublishers;
import java.nio.file.Files;
import java.nio.file.Path;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import org.opentcs.bff.charging.ChargingPileHandler;
import org.opentcs.bff.charging.ChargingPileStore;
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
import org.opentcs.bff.vehicle.RerouteVehicleHandler;
import org.opentcs.bff.warehouse.WarehouseHandler;
import org.opentcs.bff.warehouse.WarehouseStore;

/**
 * JavalinTest-driven coverage of the charging pile registry CRUD endpoints.
 */
class ChargingPileHandlerTest {

  private static final ObjectMapper JSON = new ObjectMapper();

  @TempDir
  private Path workspace;

  private BffApplication newApp() {
    KernelClient kernelClient = mock(KernelClient.class);
    SseEventBridge sse = new SseEventBridge();
    ProjectStore projectStore = new ProjectStore(workspace, 1024L * 1024L);
    return new BffApplication(
        TestConfigurations.bff("127.0.0.1", 0),
        new AccessKeyAuthenticator(TestConfigurations.security("")),
        new HealthHandler(),
        new PlantModelSummaryHandler(kernelClient),
        new ListVehiclesHandler(kernelClient),
        new GetVehicleHandler(kernelClient),
        new org.opentcs.bff.vehicle.UpdateVehicleIntegrationLevelHandler(kernelClient),
        new RerouteVehicleHandler(kernelClient),
        new org.opentcs.bff.vehicle.PostInstantActionHandler(kernelClient),
        new CreateTransportOrderHandler(kernelClient),
        new ProjectsHandler(projectStore),
        new ProjectAssetsHandler(projectStore),
        new WarehouseHandler(new WarehouseStore(workspace)),
        new ChargingPileHandler(new ChargingPileStore(workspace)),
        org.mockito.Mockito.mock(org.opentcs.bff.publish.PublishHandler.class),
        new OpenApiSpecHandler(),
        sse,
        new org.opentcs.bff.events.SsePingHandler(sse),
        new KernelEventPoller(
            kernelClient,
            sse,
            org.mockito.Mockito.mock(org.opentcs.bff.charging.ChargingPileRuntimeProjector.class)
        ),
        new org.opentcs.bff.events.SseHeartbeatScheduler(sse)
    );
  }

  @Test
  void listCreatesEmptyWrappedChargingPileFile()
      throws Exception {
    JavalinTest.test(newApp().javalin(), (server, client) -> {
      var response = client.get("/api/v1/charging-piles");

      assertThat(response.code()).isEqualTo(200);
      assertThat(response.body().string()).isEqualTo("[]");
    });

    Path pileFile = workspace
        .resolve(ChargingPileStore.CHARGING_DIRNAME)
        .resolve(ChargingPileStore.PILES_FILENAME);
    assertThat(Files.exists(pileFile)).isTrue();
    assertThat(JSON.readTree(Files.readString(pileFile)).path("ChargingPiles").isArray())
        .isTrue();
  }

  @Test
  void createPileWritesChargingJsonFileWithDefaults()
      throws Exception {
    String body = """
        {
          "id":"cp-001",
          "name":"CP-A01",
          "region":"焊装一区",
          "mapName":"HZ27",
          "boundPointName":"P-CHARGE-A01",
          "enabled":true
        }
        """;

    JavalinTest.test(newApp().javalin(), (server, client) -> {
      var response = client.request(
          "/api/v1/charging-piles",
          b -> b.header("Content-Type", "application/json").post(BodyPublishers.ofString(body))
      );

      assertThat(response.code()).isEqualTo(201);
      assertThat(response.headers().get("Location"))
          .containsExactly("/api/v1/charging-piles/cp-001");
      String responseBody = response.body().string();
      assertThat(responseBody).contains("\"id\":\"cp-001\"");
      assertThat(responseBody).contains("\"locationName\":\"CP-A01\"");
      assertThat(responseBody).contains("\"locationTypeName\":\"CHARGER\"");
      assertThat(responseBody).contains("\"operation\":\"CHARGE\"");
      assertThat(responseBody).contains("\"runtimeStatus\":\"UNKNOWN\"");
      assertThat(responseBody).contains("\"occupancyStatus\":\"FREE\"");
      assertThat(responseBody).contains("\"requiresPublish\":true");
    });

    Path pileFile = workspace
        .resolve(ChargingPileStore.CHARGING_DIRNAME)
        .resolve(ChargingPileStore.PILES_FILENAME);
    var root = JSON.readTree(Files.readString(pileFile));
    assertThat(root.path("ChargingPiles").toString()).contains("CP-A01");
  }

  @Test
  void duplicateBoundPointReturnsConflict() {
    String first = """
        {
          "id":"cp-001",
          "name":"CP-A01",
          "region":"焊装一区",
          "mapName":"HZ27",
          "boundPointName":"P-CHARGE-A01",
          "enabled":true
        }
        """;
    String second = """
        {
          "id":"cp-002",
          "name":"CP-A02",
          "region":"焊装一区",
          "mapName":"HZ27",
          "boundPointName":"P-CHARGE-A01",
          "enabled":true
        }
        """;

    JavalinTest.test(newApp().javalin(), (server, client) -> {
      client.request(
          "/api/v1/charging-piles",
          b -> b.header("Content-Type", "application/json").post(BodyPublishers.ofString(first))
      );
      var response = client.request(
          "/api/v1/charging-piles",
          b -> b.header("Content-Type", "application/json").post(BodyPublishers.ofString(second))
      );

      assertThat(response.code()).isEqualTo(409);
      assertThat(response.body().string()).contains("CHARGING_PILE_CONFLICT");
    });
  }

  @Test
  void disablingPileForcesDisabledOccupancyAndClearsOccupancyDetails() {
    String create = """
        {
          "id":"cp-001",
          "name":"CP-A01",
          "region":"焊装一区",
          "mapName":"HZ27",
          "boundPointName":"P-CHARGE-A01",
          "occupancyStatus":"OCCUPIED",
          "occupiedByVehicle":"AGV-01",
          "activeOrderName":"TO-01",
          "chargingSince":"2026-08-31 10:00:00",
          "enabled":true
        }
        """;
    String update = """
        {
          "id":"ignored",
          "name":"CP-A01",
          "region":"焊装一区",
          "mapName":"HZ27",
          "boundPointName":"P-CHARGE-A01",
          "occupancyStatus":"OCCUPIED",
          "occupiedByVehicle":"AGV-01",
          "activeOrderName":"TO-01",
          "chargingSince":"2026-08-31 10:00:00",
          "enabled":false
        }
        """;

    JavalinTest.test(newApp().javalin(), (server, client) -> {
      client.request(
          "/api/v1/charging-piles",
          b -> b.header("Content-Type", "application/json").post(BodyPublishers.ofString(create))
      );
      var response = client.request(
          "/api/v1/charging-piles/cp-001",
          b -> b.header("Content-Type", "application/json").put(BodyPublishers.ofString(update))
      );

      assertThat(response.code()).isEqualTo(200);
      String responseBody = response.body().string();
      assertThat(responseBody).contains("\"id\":\"cp-001\"");
      assertThat(responseBody).contains("\"enabled\":false");
      assertThat(responseBody).contains("\"occupancyStatus\":\"DISABLED\"");
      assertThat(responseBody).contains("\"occupiedByVehicle\":\"\"");
      assertThat(responseBody).contains("\"activeOrderName\":\"\"");
    });
  }

  @Test
  void missingPileReturnsNotFound() {
    JavalinTest.test(newApp().javalin(), (server, client) -> {
      var response = client.request(
          "/api/v1/charging-piles/missing",
          b -> b.delete(BodyPublishers.noBody())
      );

      assertThat(response.code()).isEqualTo(404);
      assertThat(response.body().string()).contains("CHARGING_PILE_NOT_FOUND");
    });
  }
}
