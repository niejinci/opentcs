// SPDX-FileCopyrightText: The openTCS Authors
// SPDX-License-Identifier: MIT
package org.opentcs.bff.vehicle;

import static java.util.Objects.requireNonNull;

import com.fasterxml.jackson.databind.JsonNode;
import java.io.IOException;
import java.io.InputStream;
import org.everit.json.schema.Schema;
import org.everit.json.schema.ValidationException;
import org.everit.json.schema.loader.SchemaLoader;
import org.json.JSONException;
import org.json.JSONObject;
import org.json.JSONTokener;

/**
 * Validates the SPA-facing instant-action request body against a strict JSON schema.
 */
public class InstantActionRequestValidator {

  private static final String SCHEMA_PATH = "/json-schema/instant-actions-request.schema.json";

  private final Schema schema;

  /**
   * Creates a new instance.
   */
  public InstantActionRequestValidator() {
    this(loadSchema());
  }

  InstantActionRequestValidator(Schema schema) {
    this.schema = requireNonNull(schema, "schema");
  }

  /**
   * Validates the given request body.
   *
   * @param root The JSON request body.
   * @throws IllegalArgumentException If the request is invalid.
   */
  public void validate(JsonNode root) {
    requireNonNull(root, "root");

    try {
      schema.validate(new JSONObject(root.toString()));
    }
    catch (ValidationException exc) {
      throw new IllegalArgumentException(
          "JSON schema validation failed: " + String.join("; ", exc.getAllMessages()),
          exc
      );
    }
    catch (JSONException exc) {
      throw new IllegalArgumentException("Invalid JSON in request body.", exc);
    }
  }

  private static Schema loadSchema() {
    try (InputStream stream = InstantActionRequestValidator.class.getResourceAsStream(SCHEMA_PATH)) {
      if (stream == null) {
        throw new IllegalStateException("JSON schema not found: " + SCHEMA_PATH);
      }
      return SchemaLoader.load(new JSONObject(new JSONTokener(stream)));
    }
    catch (IOException exc) {
      throw new IllegalStateException("Could not read JSON schema: " + SCHEMA_PATH, exc);
    }
  }
}
