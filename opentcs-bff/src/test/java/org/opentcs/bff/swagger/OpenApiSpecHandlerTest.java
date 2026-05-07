// SPDX-FileCopyrightText: The openTCS Authors
// SPDX-License-Identifier: MIT
package org.opentcs.bff.swagger;

import static io.javalin.apibuilder.ApiBuilder.get;
import static org.assertj.core.api.Assertions.assertThat;

import io.javalin.Javalin;
import io.javalin.testtools.JavalinTest;
import org.junit.jupiter.api.Test;

/**
 * Tests for {@link OpenApiSpecHandler}.
 */
class OpenApiSpecHandlerTest {

  @Test
  void servesYamlSpecWith200() {
    Javalin app = appWithSpec("/openapi/bff.yaml");

    JavalinTest.test(
        app, (server, client) -> {
          var response = client.get("/spec");

          assertThat(response.code()).isEqualTo(200);
          assertThat(response.headers().get("Content-Type")).contains("application/yaml");
          assertThat(response.body()).isNotNull();
          assertThat(response.body().string()).contains("openapi: 3.0.3");
        }
    );
  }

  @Test
  void returns404WhenResourceMissing() {
    Javalin app = appWithSpec("/openapi/does-not-exist.yaml");

    JavalinTest.test(
        app, (server, client) -> {
          var response = client.get("/spec");

          assertThat(response.code()).isEqualTo(404);
        }
    );
  }

  private static Javalin appWithSpec(String resourcePath) {
    OpenApiSpecHandler handler = new OpenApiSpecHandler(resourcePath);
    return Javalin.create(cfg -> {
      cfg.startup.showJavalinBanner = false;
      cfg.routes.apiBuilder(() -> get("/spec", handler));
    });
  }
}
