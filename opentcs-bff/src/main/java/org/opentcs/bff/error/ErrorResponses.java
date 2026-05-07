// SPDX-FileCopyrightText: The openTCS Authors
// SPDX-License-Identifier: MIT
package org.opentcs.bff.error;

import static java.util.Objects.requireNonNull;

import io.javalin.http.Context;
import io.javalin.http.HttpStatus;
import java.util.UUID;
import org.opentcs.bff.api.v1.model.ErrorResponse;

/**
 * Helpers for producing the BFF's unified {@link ErrorResponse} body.
 *
 * <p>Each response carries a correlation ID. The ID is taken from the request context attribute
 * {@value #TRACE_ID_ATTR} (set by the {@code beforeMatched} filter in {@code BffApplication}); if
 * the attribute is missing, a fresh UUID is generated.
 */
public final class ErrorResponses {

  /**
   * The {@link Context} attribute under which the per-request trace id is stored.
   */
  public static final String TRACE_ID_ATTR = "bff.traceId";
  /**
   * The HTTP response header echoing the request's trace id back to the caller.
   */
  public static final String TRACE_ID_HEADER = "X-Trace-Id";

  private ErrorResponses() {
  }

  /**
   * Writes an {@link ErrorResponse} to the given context with the given status, code and message.
   *
   * @param ctx The request context.
   * @param status The HTTP status to set.
   * @param code The machine-readable error code.
   * @param message The human-readable error message.
   */
  public static void write(Context ctx, HttpStatus status, String code, String message) {
    requireNonNull(ctx, "ctx");
    requireNonNull(status, "status");
    requireNonNull(code, "code");
    requireNonNull(message, "message");
    ErrorResponse body = new ErrorResponse();
    body.setCode(code);
    body.setMessage(message);
    body.setTraceId(traceIdFor(ctx));
    ctx.status(status);
    ctx.json(body);
  }

  /**
   * Returns (and lazily assigns) the trace id associated with the given request.
   *
   * @param ctx The request context.
   * @return The trace id associated with the given request.
   */
  public static String traceIdFor(Context ctx) {
    requireNonNull(ctx, "ctx");
    Object existing = ctx.attribute(TRACE_ID_ATTR);
    if (existing instanceof String s && !s.isEmpty()) {
      return s;
    }
    String generated = UUID.randomUUID().toString();
    ctx.attribute(TRACE_ID_ATTR, generated);
    return generated;
  }
}
