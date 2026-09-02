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
 * JavalinTest-driven coverage of the warehouse JSON CRUD endpoints.
 */
class WarehouseHandlerTest {

  private static final ObjectMapper JSON = new ObjectMapper();

  @TempDir
  private Path workspace;

  private BffApplication newApp() {
    KernelClient kernelClient = mock(KernelClient.class);
    SseEventBridge sse = new SseEventBridge();
    ProjectStore projectStore = new ProjectStore(workspace, 1024L * 1024L);
    WarehouseStore warehouseStore = new WarehouseStore(workspace);
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
        new WarehouseHandler(warehouseStore),
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
  void listTypesSeedsBundledBydJsonAndWritesWrappedFile()
      throws Exception {
    JavalinTest.test(newApp().javalin(), (server, client) -> {
      var response = client.get("/api/v1/warehouse/types");

      assertThat(response.code()).isEqualTo(200);
      String body = response.body().string();
      assertThat(body).contains("\"Name\":\"HJ27HDBMBZC\"");
      assertThat(body).contains("\"WareModel\":\"后地板面板总成货架\"");
    });

    Path typeFile = workspace
        .resolve(WarehouseStore.WAREHOUSE_DIRNAME)
        .resolve(WarehouseStore.TYPES_FILENAME);
    assertThat(Files.exists(typeFile)).isTrue();
    assertThat(JSON.readTree(Files.readString(typeFile)).path("WaresType").isArray()).isTrue();
  }

  @Test
  void createRackWritesSeparateRackJsonFile()
      throws Exception {
    String body = """
        {
          "name":"测试货架001",
          "code":"TEST-RACK-001",
          "carrierBottomCode":"257",
          "typeCode":"HJ27HDBMBZC",
          "typeName":"",
          "warehouseKind":"货架",
          "region":"深圳焊装",
          "mapName":"HZ27",
          "storageCode":"",
          "locationName":"-",
          "lockStatus":"未锁定",
          "emptyStatus":"空",
          "vehicleName":"",
          "containerInfo":"",
          "enabled":true
        }
        """;

    JavalinTest.test(newApp().javalin(), (server, client) -> {
      var response = client.request(
          "/api/v1/warehouse/racks",
          b -> b.header("Content-Type", "application/json").post(BodyPublishers.ofString(body))
      );

      assertThat(response.code()).isEqualTo(201);
      String responseBody = response.body().string();
      assertThat(responseBody).contains("\"code\":\"TEST-RACK-001\"");
      assertThat(responseBody).contains("\"typeName\":\"后地板面板总成货架\"");
    });

    Path rackFile = workspace
        .resolve(WarehouseStore.WAREHOUSE_DIRNAME)
        .resolve(WarehouseStore.RACKS_FILENAME);
    assertThat(Files.exists(rackFile)).isTrue();
    var root = JSON.readTree(Files.readString(rackFile));
    assertThat(root.path("WareRacks").isArray()).isTrue();
    assertThat(root.path("WareRacks").toString()).contains("TEST-RACK-001");
  }

  @Test
  void duplicateWarehouseTypeCodeReturnsConflict() {
    String body = """
        {
          "LoadDetect":{"MinLoadingHeight":25,"LoadSensor":true,"LoadDetectType":-1,"QrCodeSensor":true,"QrCodeMin":0,"QrCodeMax":99999999},
          "WareModel":"重复型号",
          "LegLength":100,
          "PutHeight":730,
          "LegInnerWidth":1000,
          "CollisionAvoidanceAreaType":0,
          "LegInnerLength":1000,
          "Name":"HJ27HDBMBZC",
          "LegHeight":100,
          "QrCodeRectifyType":"NoRectify",
          "Length":1950,
          "LegWidth":100,
          "AllowRotate":false,
          "PickHeight":270,
          "Height":1000,
          "Id":"99",
          "DefaultOrientationType":"Front",
          "Width":1200,
          "Manageable":false
        }
        """;

    JavalinTest.test(newApp().javalin(), (server, client) -> {
      client.get("/api/v1/warehouse/types");
      var response = client.request(
          "/api/v1/warehouse/types",
          b -> b.header("Content-Type", "application/json").post(BodyPublishers.ofString(body))
      );

      assertThat(response.code()).isEqualTo(409);
      assertThat(response.body().string()).contains("WAREHOUSE_CONFLICT");
    });
  }
}
