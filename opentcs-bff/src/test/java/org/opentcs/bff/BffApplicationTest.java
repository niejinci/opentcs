// SPDX-FileCopyrightText: The openTCS Authors
// SPDX-License-Identifier: MIT
package org.opentcs.bff;

import static org.assertj.core.api.Assertions.assertThat;

import io.javalin.testtools.JavalinTest;
import org.junit.jupiter.api.Test;
import org.opentcs.bff.health.HealthHandler;

/**
 * End-to-end tests for {@link BffApplication}: drives the actual Javalin instance via
 * {@code JavalinTest} so the route registration is exercised together with the handler.
 */
class BffApplicationTest {

  @Test
  void exposesHealthEndpoint() {
    BffApplication app = new BffApplication(
        new BffConfiguration("127.0.0.1", 0),
        new HealthHandler()
    );

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
  void portIsMinusOneBeforeStart() {
    BffApplication app = new BffApplication(
        new BffConfiguration("127.0.0.1", 0),
        new HealthHandler()
    );

    assertThat(app.port()).isEqualTo(-1);
  }
}
