// SPDX-FileCopyrightText: The openTCS Authors
// SPDX-License-Identifier: MIT
package org.opentcs.bff.vehicle;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import io.javalin.Javalin;
import io.javalin.apibuilder.ApiBuilder;
import io.javalin.http.HttpStatus;
import io.javalin.testtools.JavalinTest;
import java.net.http.HttpRequest.BodyPublishers;
import java.util.LinkedHashSet;
import java.util.Optional;
import java.util.Set;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.opentcs.bff.error.ErrorResponses;
import org.opentcs.bff.kernel.KernelClient;
import org.opentcs.data.ObjectUnknownException;
import org.opentcs.data.model.Vehicle;

/**
 * Tests for {@link ListVehiclesHandler} and {@link GetVehicleHandler}. The handlers are mounted
 * on a fresh Javalin instance so the JSON serialisation of the generated DTO and the routing
 * are exercised together.
 */
class VehicleHandlersTest {

  private KernelClient kernelClient;
  private Javalin app;

  @BeforeEach
  void setUp() {
    kernelClient = mock(KernelClient.class);
    ListVehiclesHandler listHandler = new ListVehiclesHandler(kernelClient);
    GetVehicleHandler getHandler = new GetVehicleHandler(kernelClient);
    UpdateVehicleIntegrationLevelHandler updateLevelHandler
        = new UpdateVehicleIntegrationLevelHandler(kernelClient);
    app = Javalin.create(cfg -> {
      cfg.startup.showJavalinBanner = false;
      cfg.routes.apiBuilder(() -> {
        ApiBuilder.path("/api/v1/vehicles", () -> {
          ApiBuilder.get(listHandler);
          ApiBuilder.path("/{" + GetVehicleHandler.NAME_PARAM + "}", () -> {
            ApiBuilder.get(getHandler);
            ApiBuilder.put("/integrationLevel", updateLevelHandler);
          });
        });
      });
      cfg.routes.exception(IllegalArgumentException.class, (e, ctx) -> {
        ErrorResponses.write(ctx, HttpStatus.BAD_REQUEST, "BAD_REQUEST", e.getMessage());
      });
      cfg.routes.exception(ObjectUnknownException.class, (e, ctx) -> {
        ErrorResponses.write(ctx, HttpStatus.NOT_FOUND, "NOT_FOUND", e.getMessage());
      });
    });
  }

  @Test
  void listReturnsAllVehiclesSortedByName() {
    Set<Vehicle> vehicles = new LinkedHashSet<>();
    vehicles.add(new Vehicle("zeta"));
    vehicles.add(new Vehicle("alpha"));
    vehicles.add(new Vehicle("mu"));
    when(kernelClient.listVehicles()).thenReturn(vehicles);

    JavalinTest.test(
        app, (server, client) -> {
          var response = client.get("/api/v1/vehicles");

          assertThat(response.code()).isEqualTo(200);
          assertThat(response.body()).isNotNull();
          JsonNode root = new ObjectMapper().readTree(response.body().string());
          assertThat(root.isArray()).isTrue();
          assertThat(root.size()).isEqualTo(3);
          assertThat(root.get(0).get("name").asText()).isEqualTo("alpha");
          assertThat(root.get(1).get("name").asText()).isEqualTo("mu");
          assertThat(root.get(2).get("name").asText()).isEqualTo("zeta");
          // Defaults from a freshly constructed Vehicle:
          assertThat(root.get(0).get("state").asText()).isEqualTo("UNKNOWN");
          assertThat(root.get(0).get("procState").asText()).isEqualTo("IDLE");
          assertThat(root.get(0).get("integrationLevel").asText())
              .isEqualTo("TO_BE_RESPECTED");
          assertThat(root.get(0).get("paused").asBoolean()).isFalse();
          assertThat(root.get(0).get("energyLevel").asInt()).isBetween(0, 100);
        }
    );
  }

  @Test
  void getByNameReturnsVehicleWhenPresent() {
    when(kernelClient.findVehicle("alpha")).thenReturn(Optional.of(new Vehicle("alpha")));

    JavalinTest.test(
        app, (server, client) -> {
          var response = client.get("/api/v1/vehicles/alpha");

          assertThat(response.code()).isEqualTo(200);
          assertThat(response.body()).isNotNull();
          JsonNode root = new ObjectMapper().readTree(response.body().string());
          assertThat(root.get("name").asText()).isEqualTo("alpha");
          assertThat(root.has("currentPosition")).isTrue();
          assertThat(root.get("currentPosition").isNull()).isTrue();
        }
    );
  }

  @Test
  void getByNameReturns404WithErrorBodyWhenAbsent() {
    when(kernelClient.findVehicle("ghost")).thenReturn(Optional.empty());

    JavalinTest.test(
        app, (server, client) -> {
          var response = client.get("/api/v1/vehicles/ghost");

          assertThat(response.code()).isEqualTo(404);
          assertThat(response.body()).isNotNull();
          JsonNode root = new ObjectMapper().readTree(response.body().string());
          assertThat(root.get("code").asText()).isEqualTo("VEHICLE_NOT_FOUND");
          assertThat(root.get("message").asText()).contains("ghost");
        }
    );
  }

  @Test
  void putIntegrationLevelForwardsToKernelAndReturnsUpdatedDto() {
    Vehicle updated = new Vehicle("alpha")
        .withIntegrationLevel(Vehicle.IntegrationLevel.TO_BE_UTILIZED);
    when(
        kernelClient.updateVehicleIntegrationLevel(
            eq("alpha"), eq(Vehicle.IntegrationLevel.TO_BE_UTILIZED)
        )
    ).thenReturn(updated);

    JavalinTest.test(
        app, (server, client) -> {
          var response = client.request(
              "/api/v1/vehicles/alpha/integrationLevel",
              b -> b.put(
                  BodyPublishers.ofString("{\"integrationLevel\":\"TO_BE_UTILIZED\"}")
              ).header("Content-Type", "application/json")
          );

          assertThat(response.code()).isEqualTo(200);
          assertThat(response.body()).isNotNull();
          JsonNode root = new ObjectMapper().readTree(response.body().string());
          assertThat(root.get("name").asText()).isEqualTo("alpha");
          assertThat(root.get("integrationLevel").asText()).isEqualTo("TO_BE_UTILIZED");
          verify(kernelClient).updateVehicleIntegrationLevel(
              eq("alpha"), eq(Vehicle.IntegrationLevel.TO_BE_UTILIZED)
          );
        }
    );
  }

  @Test
  void putIntegrationLevelRejectsMalformedBody() {
    JavalinTest.test(
        app, (server, client) -> {
          var response = client.request(
              "/api/v1/vehicles/alpha/integrationLevel",
              b -> b.put(BodyPublishers.ofString("not-json")).header(
                  "Content-Type", "application/json"
              )
          );

          assertThat(response.code()).isEqualTo(400);
        }
    );
  }

  @Test
  void putIntegrationLevelRejectsMissingField() {
    JavalinTest.test(
        app, (server, client) -> {
          var response = client.request(
              "/api/v1/vehicles/alpha/integrationLevel",
              b -> b.put(BodyPublishers.ofString("{}")).header(
                  "Content-Type", "application/json"
              )
          );

          assertThat(response.code()).isEqualTo(400);
          assertThat(response.body()).isNotNull();
          JsonNode root = new ObjectMapper().readTree(response.body().string());
          assertThat(root.get("message").asText()).contains("integrationLevel");
        }
    );
  }

  @Test
  void putIntegrationLevelReturns404WhenVehicleAbsent() {
    when(
        kernelClient.updateVehicleIntegrationLevel(
            eq("ghost"), eq(Vehicle.IntegrationLevel.TO_BE_UTILIZED)
        )
    ).thenThrow(new ObjectUnknownException("No vehicle named 'ghost' exists."));

    JavalinTest.test(
        app, (server, client) -> {
          var response = client.request(
              "/api/v1/vehicles/ghost/integrationLevel",
              b -> b.put(
                  BodyPublishers.ofString("{\"integrationLevel\":\"TO_BE_UTILIZED\"}")
              ).header("Content-Type", "application/json")
          );

          assertThat(response.code()).isEqualTo(404);
          assertThat(response.body()).isNotNull();
          JsonNode root = new ObjectMapper().readTree(response.body().string());
          assertThat(root.get("code").asText()).isEqualTo("NOT_FOUND");
          assertThat(root.get("message").asText()).contains("ghost");
        }
    );
  }
}
