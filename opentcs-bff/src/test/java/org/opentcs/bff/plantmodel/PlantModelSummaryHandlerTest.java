// SPDX-FileCopyrightText: The openTCS Authors
// SPDX-License-Identifier: MIT
package org.opentcs.bff.plantmodel;

import static io.javalin.apibuilder.ApiBuilder.get;
import static io.javalin.apibuilder.ApiBuilder.path;
import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import io.javalin.Javalin;
import io.javalin.testtools.JavalinTest;
import java.util.Set;
import org.junit.jupiter.api.Test;
import org.opentcs.bff.kernel.KernelClient;
import org.opentcs.data.model.Block;
import org.opentcs.data.model.PlantModel;
import org.opentcs.data.model.Point;
import org.opentcs.data.model.Vehicle;

/**
 * Unit tests for {@link PlantModelSummaryHandler}.
 */
class PlantModelSummaryHandlerTest {

  @Test
  void returnsCountsForLoadedModel() {
    KernelClient kernelClient = mock(KernelClient.class);
    PlantModel model = new PlantModel("demo")
        .withPoints(Set.of(new Point("p1"), new Point("p2"), new Point("p3")))
        .withVehicles(Set.of(new Vehicle("v1"), new Vehicle("v2")))
        .withBlocks(Set.of(new Block("b1")));
    when(kernelClient.getPlantModel()).thenReturn(model);

    Javalin app = newApp(new PlantModelSummaryHandler(kernelClient));

    JavalinTest.test(
        app, (server, client) -> {
          var response = client.get("/api/v1/plant-model/summary");

          assertThat(response.code()).isEqualTo(200);
          assertThat(response.body()).isNotNull();
          String body = response.body().string();
          assertThat(body).contains("\"name\":\"demo\"");
          assertThat(body).contains("\"pointCount\":3");
          assertThat(body).contains("\"pathCount\":0");
          assertThat(body).contains("\"locationTypeCount\":0");
          assertThat(body).contains("\"locationCount\":0");
          assertThat(body).contains("\"blockCount\":1");
          assertThat(body).contains("\"vehicleCount\":2");
        }
    );
  }

  @Test
  void returnsZeroCountsForEmptyModel() {
    KernelClient kernelClient = mock(KernelClient.class);
    when(kernelClient.getPlantModel()).thenReturn(new PlantModel("empty"));

    Javalin app = newApp(new PlantModelSummaryHandler(kernelClient));

    JavalinTest.test(
        app, (server, client) -> {
          var response = client.get("/api/v1/plant-model/summary");

          assertThat(response.code()).isEqualTo(200);
          assertThat(response.body()).isNotNull();
          assertThat(response.body().string())
              .isEqualTo(
                  "{\"name\":\"empty\","
                      + "\"pointCount\":0,"
                      + "\"pathCount\":0,"
                      + "\"locationTypeCount\":0,"
                      + "\"locationCount\":0,"
                      + "\"blockCount\":0,"
                      + "\"vehicleCount\":0}"
              );
        }
    );
  }

  private static Javalin newApp(PlantModelSummaryHandler handler) {
    return Javalin.create(cfg -> cfg.routes.apiBuilder(() -> {
      path("/api/v1", () -> {
        path("/plant-model", () -> {
          get("/summary", handler);
        });
      });
    }));
  }
}
