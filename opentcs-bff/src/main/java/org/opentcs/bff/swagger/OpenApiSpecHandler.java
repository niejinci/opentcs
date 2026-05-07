// SPDX-FileCopyrightText: The openTCS Authors
// SPDX-License-Identifier: MIT
package org.opentcs.bff.swagger;

import static java.util.Objects.requireNonNull;

import io.javalin.http.Context;
import io.javalin.http.Handler;
import io.javalin.http.HttpStatus;
import java.io.IOException;
import java.io.InputStream;

/**
 * Serves the BFF's OpenAPI specification file (loaded from the classpath) at a fixed URL so
 * the Swagger UI page can fetch it.
 */
public class OpenApiSpecHandler
    implements
      Handler {

  /**
   * The classpath location of the OpenAPI specification.
   */
  static final String SPEC_RESOURCE = "/openapi/bff.yaml";

  /**
   * The MIME type used for serving YAML.
   */
  static final String YAML_MIME = "application/yaml";

  private final String resourcePath;

  /**
   * Creates a new instance using the default classpath spec location.
   */
  public OpenApiSpecHandler() {
    this(SPEC_RESOURCE);
  }

  /**
   * Creates a new instance.
   *
   * @param resourcePath The classpath location of the spec to serve.
   */
  public OpenApiSpecHandler(String resourcePath) {
    this.resourcePath = requireNonNull(resourcePath, "resourcePath");
  }

  @Override
  public void handle(Context ctx)
      throws IOException {
    requireNonNull(ctx, "ctx");
    try (InputStream in = OpenApiSpecHandler.class.getResourceAsStream(resourcePath)) {
      if (in == null) {
        ctx.status(HttpStatus.NOT_FOUND);
        ctx.result("OpenAPI specification not found on the classpath.");
        return;
      }
      ctx.status(200);
      ctx.contentType(YAML_MIME);
      ctx.result(in.readAllBytes());
    }
  }
}
