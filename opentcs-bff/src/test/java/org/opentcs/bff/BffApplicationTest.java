// SPDX-FileCopyrightText: The openTCS Authors
// SPDX-License-Identifier: MIT
package org.opentcs.bff;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;
import static org.opentcs.bff.TestConfigurations.bff;

import io.javalin.testtools.JavalinTest;
import org.junit.jupiter.api.Test;
import org.opentcs.bff.health.HealthHandler;
import org.opentcs.bff.kernel.KernelClient;
import org.opentcs.bff.plantmodel.PlantModelSummaryHandler;
import org.opentcs.data.model.PlantModel;

/**
 * End-to-end tests for {@link BffApplication}: drives the actual Javalin instance via
 * {@code JavalinTest} so the route registration is exercised together with the handlers.
 */
class BffApplicationTest {

  @Test
  void exposesHealthEndpoint() {
    BffApplication app = newApp();

    JavalinTest.test(
        app.javalin(), (server, client) -> {
          var response = client.get("/health");

          assertThat(response.code()).isEqualTo(200);
          assertThat(response.body()).isNotNull();
          assertThat(response.body().string()).isEqualTo("{\"status\":\"UP\"}");
        }
    );
  }

  @Test
  void exposesPlantModelSummaryEndpoint() {
    BffApplication app = newApp();

    JavalinTest.test(
        app.javalin(), (server, client) -> {
          var response = client.get("/api/v1/plant-model/summary");

          assertThat(response.code()).isEqualTo(200);
          assertThat(response.body()).isNotNull();
          assertThat(response.body().string()).contains("\"name\":\"empty\"");
        }
    );
  }

  @Test
  void portIsMinusOneBeforeStart() {
    BffApplication app = newApp();

    assertThat(app.port()).isEqualTo(-1);
  }

  private static BffApplication newApp() {
    KernelClient kernelClient = mock(KernelClient.class);
    when(kernelClient.getPlantModel()).thenReturn(new PlantModel("empty"));
    return new BffApplication(
        bff("127.0.0.1", 0),
        new HealthHandler(),
        new PlantModelSummaryHandler(kernelClient)
    );
  }
}
