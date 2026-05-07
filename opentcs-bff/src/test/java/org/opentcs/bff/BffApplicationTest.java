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
import org.opentcs.bff.security.AccessKeyAuthenticator;
import org.opentcs.bff.security.BffSecurityConfiguration;
import org.opentcs.bff.swagger.OpenApiSpecHandler;
import org.opentcs.bff.transportorder.CreateTransportOrderHandler;
import org.opentcs.bff.vehicle.GetVehicleHandler;
import org.opentcs.bff.vehicle.ListVehiclesHandler;
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
  void exposesOpenApiSpecOnConfiguredPath() {
    BffApplication app = newApp();

    JavalinTest.test(
        app.javalin(), (server, client) -> {
          var response = client.get("/openapi/bff.yaml");

          assertThat(response.code()).isEqualTo(200);
          assertThat(response.body()).isNotNull();
          String body = response.body().string();
          assertThat(body).contains("openapi: 3.0.3");
          assertThat(body).contains("/api/v1/vehicles");
        }
    );
  }

  @Test
  void servesSwaggerUiInitializerOverride() {
    BffApplication app = newApp();

    JavalinTest.test(
        app.javalin(), (server, client) -> {
          var response = client.get("/swagger-ui/swagger-initializer.js");

          assertThat(response.code()).isEqualTo(200);
          assertThat(response.body()).isNotNull();
          assertThat(response.body().string()).contains("/openapi/bff.yaml");
        }
    );
  }

  @Test
  void portIsMinusOneBeforeStart() {
    BffApplication app = newApp();

    assertThat(app.port()).isEqualTo(-1);
  }

  @Test
  void echoesTraceIdHeaderOnSuccess() {
    BffApplication app = newApp();

    JavalinTest.test(
        app.javalin(), (server, client) -> {
          var response = client.get("/api/v1/vehicles");

          assertThat(response.code()).isEqualTo(200);
          assertThat(response.headers().get("X-Trace-Id")).isNotEmpty();
        }
    );
  }

  @Test
  void rejectsUnauthorisedRequestsWith401AndErrorBody() {
    BffApplication app = newAppWithSecurity("secret");

    JavalinTest.test(
        app.javalin(), (server, client) -> {
          var response = client.get("/api/v1/vehicles");

          assertThat(response.code()).isEqualTo(401);
          assertThat(response.body()).isNotNull();
          String body = response.body().string();
          assertThat(body).contains("\"code\":\"UNAUTHORIZED\"");
          assertThat(body).contains("\"traceId\":");
        }
    );
  }

  @Test
  void allowsAuthorisedRequestsWith200() {
    BffApplication app = newAppWithSecurity("secret");

    JavalinTest.test(
        app.javalin(), (server, client) -> {
          var response = client.get(
              "/api/v1/vehicles",
              builder -> builder.header("X-Api-Access-Key", "secret")
          );

          assertThat(response.code()).isEqualTo(200);
        }
    );
  }

  @Test
  void doesNotProtectHealthEndpoint() {
    BffApplication app = newAppWithSecurity("secret");

    JavalinTest.test(
        app.javalin(), (server, client) -> {
          var response = client.get("/health");

          assertThat(response.code()).isEqualTo(200);
        }
    );
  }

  private static BffApplication newApp() {
    return newAppWithSecurity("");
  }

  private static BffApplication newAppWithSecurity(String accessKey) {
    KernelClient kernelClient = mock(KernelClient.class);
    when(kernelClient.getPlantModel()).thenReturn(new PlantModel("empty"));
    when(kernelClient.listVehicles()).thenReturn(java.util.Set.of());
    BffSecurityConfiguration securityConfig = TestConfigurations.security(accessKey);
    return new BffApplication(
        bff("127.0.0.1", 0),
        new AccessKeyAuthenticator(securityConfig),
        new HealthHandler(),
        new PlantModelSummaryHandler(kernelClient),
        new ListVehiclesHandler(kernelClient),
        new GetVehicleHandler(kernelClient),
        new CreateTransportOrderHandler(kernelClient),
        new OpenApiSpecHandler()
    );
  }
}
