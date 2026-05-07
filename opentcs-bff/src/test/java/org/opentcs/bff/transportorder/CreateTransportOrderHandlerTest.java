// SPDX-FileCopyrightText: The openTCS Authors
// SPDX-License-Identifier: MIT
package org.opentcs.bff.transportorder;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import io.javalin.Javalin;
import io.javalin.apibuilder.ApiBuilder;
import io.javalin.http.HttpStatus;
import io.javalin.testtools.JavalinTest;
import java.net.http.HttpRequest;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.opentcs.access.KernelRuntimeException;
import org.opentcs.access.to.order.TransportOrderCreationTO;
import org.opentcs.bff.error.ErrorResponses;
import org.opentcs.bff.kernel.KernelClient;
import org.opentcs.data.ObjectUnknownException;
import org.opentcs.data.order.TransportOrder;

/**
 * Tests for {@link CreateTransportOrderHandler}, including the BFF's exception-to-status-code
 * mapping installed by {@link org.opentcs.bff.BffApplication}.
 */
class CreateTransportOrderHandlerTest {

  private KernelClient kernelClient;
  private Javalin app;

  @BeforeEach
  void setUp() {
    kernelClient = mock(KernelClient.class);
    CreateTransportOrderHandler handler = new CreateTransportOrderHandler(kernelClient);
    app = Javalin.create(cfg -> {
      cfg.startup.showJavalinBanner = false;
      cfg.routes.apiBuilder(() -> {
        ApiBuilder.path("/api/v1/transport-orders", () -> {
          ApiBuilder.post(handler);
        });
      });
      cfg.routes.exception(IllegalArgumentException.class, (e, ctx) -> {
        ErrorResponses.write(ctx, HttpStatus.BAD_REQUEST, "BAD_REQUEST", e.getMessage());
      });
      cfg.routes.exception(ObjectUnknownException.class, (e, ctx) -> {
        ErrorResponses.write(ctx, HttpStatus.NOT_FOUND, "NOT_FOUND", e.getMessage());
      });
      cfg.routes.exception(KernelRuntimeException.class, (e, ctx) -> {
        ErrorResponses.write(
            ctx, HttpStatus.SERVICE_UNAVAILABLE, "KERNEL_UNAVAILABLE", e.getMessage()
        );
      });
    });
  }

  @Test
  void returns200WithCreatedOrderOnSuccess() {
    TransportOrder created = new TransportOrder("order-1", java.util.List.of()).withType("Charge");
    when(kernelClient.createTransportOrder(any(TransportOrderCreationTO.class)))
        .thenReturn(created);

    JavalinTest.test(
        app, (server, client) -> {
          var response = client.post(
              "/api/v1/transport-orders",
              Map.of(
                  "name", "order-1",
                  "destinations", List.of(
                      Map.of("locationName", "Loc1", "operation", "NOP")
                  )
              )
          );

          assertThat(response.code()).isEqualTo(200);
          assertThat(response.body()).isNotNull();
          JsonNode root = new ObjectMapper().readTree(response.body().string());
          assertThat(root.get("name").asText()).isEqualTo("order-1");
          assertThat(root.get("type").asText()).isEqualTo("Charge");
        }
    );
  }

  @Test
  void returns400OnEmptyDestinations() {
    JavalinTest.test(
        app, (server, client) -> {
          var response = client.post(
              "/api/v1/transport-orders",
              Map.of("name", "order-1", "destinations", List.of())
          );

          assertThat(response.code()).isEqualTo(400);
          assertThat(response.body()).isNotNull();
          JsonNode root = new ObjectMapper().readTree(response.body().string());
          assertThat(root.get("code").asText()).isEqualTo("BAD_REQUEST");
          assertThat(root.get("message").asText()).contains("destinations");
          assertThat(root.has("traceId")).isTrue();
        }
    );
  }

  @Test
  void returns400OnMalformedJson() {
    JavalinTest.test(
        app, (server, client) -> {
          var response = client.request(
              "/api/v1/transport-orders",
              builder -> builder
                  .header("Content-Type", "application/json")
                  .post(HttpRequest.BodyPublishers.ofString("{ this is not json"))
          );

          assertThat(response.code()).isEqualTo(400);
          assertThat(response.body()).isNotNull();
          JsonNode root = new ObjectMapper().readTree(response.body().string());
          assertThat(root.get("code").asText()).isEqualTo("BAD_REQUEST");
        }
    );
  }

  @Test
  void returns404WhenKernelReportsObjectUnknown() {
    when(kernelClient.createTransportOrder(any(TransportOrderCreationTO.class)))
        .thenThrow(new ObjectUnknownException("Unknown vehicle: ghost"));

    JavalinTest.test(
        app, (server, client) -> {
          var response = client.post(
              "/api/v1/transport-orders",
              Map.of(
                  "name", "order-1",
                  "intendedVehicle", "ghost",
                  "destinations", List.of(
                      Map.of("locationName", "L", "operation", "NOP")
                  )
              )
          );

          assertThat(response.code()).isEqualTo(404);
          assertThat(response.body()).isNotNull();
          JsonNode root = new ObjectMapper().readTree(response.body().string());
          assertThat(root.get("code").asText()).isEqualTo("NOT_FOUND");
        }
    );
  }

  @Test
  void returns503WhenKernelIsUnavailable() {
    when(kernelClient.createTransportOrder(any(TransportOrderCreationTO.class)))
        .thenThrow(new KernelRuntimeException("RMI down"));

    JavalinTest.test(
        app, (server, client) -> {
          var response = client.post(
              "/api/v1/transport-orders",
              Map.of(
                  "name", "order-1",
                  "destinations", List.of(
                      Map.of("locationName", "L", "operation", "NOP")
                  )
              )
          );

          assertThat(response.code()).isEqualTo(503);
          assertThat(response.body()).isNotNull();
          JsonNode root = new ObjectMapper().readTree(response.body().string());
          assertThat(root.get("code").asText()).isEqualTo("KERNEL_UNAVAILABLE");
        }
    );
  }
}
