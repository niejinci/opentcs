// SPDX-FileCopyrightText: The openTCS Authors
// SPDX-License-Identifier: MIT
package org.opentcs.bff.project;

import static java.util.Objects.requireNonNull;

import java.util.Locale;
import java.util.UUID;
import java.util.regex.Pattern;

/**
 * Strongly-typed, path-traversal-safe identifier for a project on disk.
 *
 * <p>An identifier consists of lowercase ASCII letters, digits, hyphens and underscores, starts
 * with a letter or digit and is at most 64 characters long. Concretely it must match
 * {@link #PATTERN}. This precludes any of {@code .}, {@code ..}, {@code /}, {@code \},
 * {@code :} and Unicode whitespace, which is the primary defence against
 * {@code GET /api/v1/projects/../etc/passwd}-style escapes.
 *
 * <p>{@link #fromName(String)} derives an id from a user-supplied display name (slugifying it and
 * appending a short UUID-derived suffix to keep collisions unlikely). Callers that already have a
 * candidate id should use {@link #of(String)} which validates and returns it unchanged.
 */
public final class ProjectId {

  /**
   * The regular expression every valid {@link ProjectId} must match.
   */
  public static final Pattern PATTERN = Pattern.compile("^[a-z0-9][a-z0-9_-]{0,63}$");

  private final String value;

  private ProjectId(String value) {
    this.value = value;
  }

  /**
   * Returns a {@link ProjectId} wrapping {@code value} if it is well-formed.
   *
   * @param value The candidate id.
   * @return The validated id.
   * @throws IllegalArgumentException If {@code value} does not match {@link #PATTERN}.
   */
  public static ProjectId of(String value) {
    requireNonNull(value, "value");
    if (!PATTERN.matcher(value).matches()) {
      throw new IllegalArgumentException(
          "Invalid project id '" + value + "': must match " + PATTERN.pattern()
      );
    }
    return new ProjectId(value);
  }

  /**
   * Derives a {@link ProjectId} from a user-supplied display name by slugifying it and appending a
   * short UUID-derived suffix to keep collisions unlikely.
   *
   * @param displayName The user-supplied name.
   * @return A valid, unique-by-construction project id.
   * @throws IllegalArgumentException If {@code displayName} is null/blank.
   */
  public static ProjectId fromName(String displayName) {
    requireNonNull(displayName, "displayName");
    String trimmed = displayName.trim();
    if (trimmed.isEmpty()) {
      throw new IllegalArgumentException("displayName must not be blank.");
    }
    StringBuilder slug = new StringBuilder(trimmed.length());
    for (int i = 0; i < trimmed.length(); i++) {
      char c = Character.toLowerCase(trimmed.charAt(i));
      if ((c >= 'a' && c <= 'z') || (c >= '0' && c <= '9')) {
        slug.append(c);
      }
      else if (c == '-' || c == '_' || c == ' ') {
        if (slug.length() > 0 && slug.charAt(slug.length() - 1) != '-') {
          slug.append('-');
        }
      }
    }
    while (slug.length() > 0
        && (slug.charAt(slug.length() - 1) == '-' || slug.charAt(slug.length() - 1) == '_')) {
      slug.deleteCharAt(slug.length() - 1);
    }
    if (slug.length() == 0) {
      slug.append("p");
    }
    if (slug.length() > 57) {
      slug.setLength(57);
    }
    String suffix = UUID.randomUUID().toString().toLowerCase(Locale.ROOT).replace("-", "")
        .substring(0, 6);
    return of(slug.toString() + "-" + suffix);
  }

  /**
   * Returns the id's string form.
   *
   * @return The id as a {@link String}.
   */
  public String value() {
    return value;
  }

  @Override
  public String toString() {
    return value;
  }

  @Override
  public boolean equals(Object o) {
    return o instanceof ProjectId other && other.value.equals(value);
  }

  @Override
  public int hashCode() {
    return value.hashCode();
  }
}
