// SPDX-FileCopyrightText: The openTCS Authors
// SPDX-License-Identifier: MIT
package org.opentcs.bff.project;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import org.junit.jupiter.api.Test;

/**
 * Tests for {@link ProjectId}.
 */
class ProjectIdTest {

  @Test
  void acceptsLowerCaseSlug() {
    assertThat(ProjectId.of("my-project_01").value()).isEqualTo("my-project_01");
  }

  @Test
  void rejectsLeadingHyphen() {
    assertThatThrownBy(() -> ProjectId.of("-bad"))
        .isInstanceOf(IllegalArgumentException.class);
  }

  @Test
  void rejectsPathSeparator() {
    assertThatThrownBy(() -> ProjectId.of("../etc"))
        .isInstanceOf(IllegalArgumentException.class);
    assertThatThrownBy(() -> ProjectId.of("a/b"))
        .isInstanceOf(IllegalArgumentException.class);
  }

  @Test
  void rejectsBlank() {
    assertThatThrownBy(() -> ProjectId.of(""))
        .isInstanceOf(IllegalArgumentException.class);
    assertThatThrownBy(() -> ProjectId.of(null))
        .isInstanceOf(NullPointerException.class);
  }

  @Test
  void rejectsTooLong() {
    assertThatThrownBy(() -> ProjectId.of("a".repeat(65)))
        .isInstanceOf(IllegalArgumentException.class);
  }

  @Test
  void fromNameSlugifiesAndAppendsUuidSuffix() {
    ProjectId id = ProjectId.fromName("Acme Plant #1");
    assertThat(id.value()).matches(ProjectId.PATTERN);
    // Stem derived from name, plus the 6-char uuid suffix.
    assertThat(id.value()).startsWith("acme-plant");
  }

  @Test
  void fromNameFallsBackToPlaceholderForUnusableInput() {
    ProjectId id = ProjectId.fromName("###");
    assertThat(id.value()).matches(ProjectId.PATTERN);
    assertThat(id.value()).startsWith("p-");
  }
}
