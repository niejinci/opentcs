// SPDX-FileCopyrightText: The openTCS Authors
// SPDX-License-Identifier: MIT
package org.opentcs.bff.security;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import io.javalin.http.Context;
import org.junit.jupiter.api.Test;

/**
 * Unit tests for {@link AccessKeyAuthenticator}.
 */
class AccessKeyAuthenticatorTest {

  @Test
  void allowsAllRequestsWhenAccessKeyIsEmpty() {
    AccessKeyAuthenticator auth = new AccessKeyAuthenticator(() -> "");

    Context ctx = mock(Context.class);
    assertThat(auth.isEnabled()).isFalse();
    assertThat(auth.isAuthenticated(ctx)).isTrue();
  }

  @Test
  void allowsAllRequestsWhenAccessKeyIsNull() {
    AccessKeyAuthenticator auth = new AccessKeyAuthenticator(() -> null);

    Context ctx = mock(Context.class);
    assertThat(auth.isEnabled()).isFalse();
    assertThat(auth.isAuthenticated(ctx)).isTrue();
  }

  @Test
  void rejectsRequestsWithoutAccessKeyHeader() {
    AccessKeyAuthenticator auth = new AccessKeyAuthenticator(() -> "secret");

    Context ctx = mock(Context.class);
    when(ctx.header(AccessKeyAuthenticator.ACCESS_KEY_HEADER)).thenReturn(null);

    assertThat(auth.isEnabled()).isTrue();
    assertThat(auth.isAuthenticated(ctx)).isFalse();
  }

  @Test
  void rejectsRequestsWithWrongAccessKey() {
    AccessKeyAuthenticator auth = new AccessKeyAuthenticator(() -> "secret");

    Context ctx = mock(Context.class);
    when(ctx.header(AccessKeyAuthenticator.ACCESS_KEY_HEADER)).thenReturn("nope");

    assertThat(auth.isAuthenticated(ctx)).isFalse();
  }

  @Test
  void allowsRequestsWithMatchingAccessKey() {
    AccessKeyAuthenticator auth = new AccessKeyAuthenticator(() -> "secret");

    Context ctx = mock(Context.class);
    when(ctx.header(AccessKeyAuthenticator.ACCESS_KEY_HEADER)).thenReturn("secret");

    assertThat(auth.isAuthenticated(ctx)).isTrue();
  }
}
