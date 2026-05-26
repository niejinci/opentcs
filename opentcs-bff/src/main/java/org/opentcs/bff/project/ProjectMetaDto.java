// SPDX-FileCopyrightText: The openTCS Authors
// SPDX-License-Identifier: MIT
package org.opentcs.bff.project;

import com.fasterxml.jackson.annotation.JsonInclude;
import java.time.Instant;
import java.util.List;

/**
 * On-disk metadata for a single project. Hand-written DTO (kept separate from the OpenAPI-generated
 * model) so {@link ProjectStore} doesn't depend on generated code.
 *
 * @param id The (immutable) project id.
 * @param name The display name.
 * @param createdAt When the project was first created.
 * @param updatedAt When the project (or any of its files) was last modified.
 * @param hasDraft Whether a {@code draft.json} exists.
 * @param assets The list of asset filenames currently on disk.
 * @param lastPublishedAt When the project was last successfully published to the kernel, or
 * {@code null} if it has never been published. Field is omitted from JSON when {@code null} so
 * meta files written before S8 stay backward-compatible.
 */
@JsonInclude(JsonInclude.Include.NON_NULL)
public record ProjectMetaDto(
    String id,
    String name,
    Instant createdAt,
    Instant updatedAt,
    boolean hasDraft,
    List<String> assets,
    Instant lastPublishedAt
) {
  /**
   * Compact 6-arg constructor for pre-S8 callers — leaves {@code lastPublishedAt} unset.
   *
   * @param id The project id.
   * @param name The display name.
   * @param createdAt When the project was first created.
   * @param updatedAt When the project (or any of its files) was last modified.
   * @param hasDraft Whether a {@code draft.json} exists.
   * @param assets The list of asset filenames currently on disk.
   */
  public ProjectMetaDto(
      String id,
      String name,
      Instant createdAt,
      Instant updatedAt,
      boolean hasDraft,
      List<String> assets
  ) {
    this(id, name, createdAt, updatedAt, hasDraft, assets, null);
  }
  /**
   * Returns a copy with a different display name.
   *
   * @param newName The new name.
   * @return A new {@link ProjectMetaDto}.
   */
  public ProjectMetaDto withName(String newName) {
    return new ProjectMetaDto(id, newName, createdAt, updatedAt, hasDraft, assets, lastPublishedAt);
  }

  /**
   * Returns a copy with a different {@code updatedAt}.
   *
   * @param newUpdatedAt The new timestamp.
   * @return A new {@link ProjectMetaDto}.
   */
  public ProjectMetaDto withUpdatedAt(Instant newUpdatedAt) {
    return new ProjectMetaDto(id, name, createdAt, newUpdatedAt, hasDraft, assets, lastPublishedAt);
  }

  /**
   * Returns a copy with a different {@code hasDraft}.
   *
   * @param newHasDraft The new flag.
   * @return A new {@link ProjectMetaDto}.
   */
  public ProjectMetaDto withHasDraft(boolean newHasDraft) {
    return new ProjectMetaDto(id, name, createdAt, updatedAt, newHasDraft, assets, lastPublishedAt);
  }

  /**
   * Returns a copy with a different asset list.
   *
   * @param newAssets The new asset list.
   * @return A new {@link ProjectMetaDto}.
   */
  public ProjectMetaDto withAssets(List<String> newAssets) {
    return new ProjectMetaDto(id, name, createdAt, updatedAt, hasDraft, newAssets, lastPublishedAt);
  }

  /**
   * Returns a copy with a different {@code lastPublishedAt}.
   *
   * @param newLastPublishedAt The new timestamp (may be {@code null}).
   * @return A new {@link ProjectMetaDto}.
   */
  public ProjectMetaDto withLastPublishedAt(Instant newLastPublishedAt) {
    return new ProjectMetaDto(
        id, name, createdAt, updatedAt, hasDraft, assets, newLastPublishedAt
    );
  }
}
