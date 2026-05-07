// SPDX-FileCopyrightText: The openTCS Authors
// SPDX-License-Identifier: MIT
package org.opentcs.bff.security;

import static java.util.Objects.requireNonNull;

import com.google.inject.Singleton;
import io.javalin.http.Context;
import jakarta.inject.Inject;

/**
 * Authenticates incoming HTTP requests by comparing the {@value #ACCESS_KEY_HEADER} request header
 * against the access key configured via {@link BffSecurityConfiguration#accessKey()}.
 *
 * <p>If the configured access key is empty (the default), authentication is disabled and every
 * request is considered authenticated.
 */
@Singleton
public class AccessKeyAuthenticator {

  /**
   * The HTTP header expected to carry the access key.
   */
  public static final String ACCESS_KEY_HEADER = "X-Api-Access-Key";

  private final BffSecurityConfiguration configuration;

  /**
   * Creates a new instance.
   *
   * @param configuration The security configuration.
   */
  @Inject
  public AccessKeyAuthenticator(BffSecurityConfiguration configuration) {
    this.configuration = requireNonNull(configuration, "configuration");
  }

  /**
   * Returns whether authentication is enabled (i.e. a non-empty access key is configured).
   *
   * @return Whether authentication is enabled.
   */
  public boolean isEnabled() {
    String configured = configuration.accessKey();
    return configured != null && !configured.isEmpty();
  }

  /**
   * Returns whether the given request carries the expected access key (or whether authentication
   * is disabled altogether).
   *
   * @param ctx The request context to check.
   * @return {@code true} iff the request is allowed.
   */
  public boolean isAuthenticated(Context ctx) {
    requireNonNull(ctx, "ctx");
    if (!isEnabled()) {
      return true;
    }
    String provided = ctx.header(ACCESS_KEY_HEADER);
    return configuration.accessKey().equals(provided);
  }
}
