// SPDX-FileCopyrightText: The openTCS Authors
// SPDX-License-Identifier: MIT
package org.opentcs.bff.health;

import static org.assertj.core.api.Assertions.assertThat;

import io.javalin.Javalin;
import io.javalin.testtools.JavalinTest;
import org.junit.jupiter.api.Test;

/**
 * Unit tests for {@link HealthHandler}.
 */
class HealthHandlerTest {

  @Test
  void respondsWith200AndStatusUp() {
    Javalin app = Javalin.create(cfg -> cfg.routes.apiBuilder(() -> {
      io.javalin.apibuilder.ApiBuilder.get("/health", new HealthHandler());
    }));

    JavalinTest.test(
        app, (server, client) -> {
          var response = client.get("/health");

          assertThat(response.code()).isEqualTo(200);
          assertThat(response.body()).isNotNull();
          assertThat(response.body().string()).isEqualTo("{\"status\":\"UP\"}");
        }
    );
  }
}
