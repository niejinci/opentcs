// SPDX-FileCopyrightText: The openTCS Authors
// SPDX-License-Identifier: MIT
package org.opentcs.bff.project;

import static java.util.Objects.requireNonNull;

import com.fasterxml.jackson.databind.JsonNode;
import io.javalin.http.Context;
import io.javalin.http.Handler;
import io.javalin.http.HttpStatus;
import jakarta.inject.Inject;
import jakarta.inject.Singleton;

/**
 * Bundle of {@link Handler}s for the project CRUD endpoints under
 * {@code /api/v1/projects}.
 *
 * <p>Wiring lives in {@link org.opentcs.bff.BffApplication}; this class deliberately exposes one
 * named {@link Handler} per route so the {@code apiBuilder} block stays concise.
 */
@Singleton
public class ProjectsHandler {

  /**
   * The path parameter for the project id.
   */
  public static final String ID_PARAM = "id";

  private final ProjectStore store;

  /**
   * Creates a new instance.
   *
   * @param store The project store backing all endpoints.
   */
  @Inject
  public ProjectsHandler(ProjectStore store) {
    this.store = requireNonNull(store, "store");
  }

  /**
   * {@code GET /api/v1/projects} — returns the full list of projects.
   *
   * @return The handler.
   */
  public Handler list() {
    return ctx -> ctx.json(store.list());
  }

  /**
   * {@code POST /api/v1/projects} — creates a new project (201 + Location header).
   *
   * @return The handler.
   */
  public Handler create() {
    return ctx -> {
      CreateProjectRequest req = parseBody(ctx, CreateProjectRequest.class);
      if (req.name() == null || req.name().isBlank()) {
        throw new IllegalArgumentException("Field 'name' is required.");
      }
      ProjectMetaDto meta = store.create(req.name(), req.id());
      ctx.status(HttpStatus.CREATED);
      ctx.header("Location", "/api/v1/projects/" + meta.id());
      ctx.json(meta);
    };
  }

  /**
   * {@code GET /api/v1/projects/{id}} — returns metadata for a single project.
   *
   * @return The handler.
   */
  public Handler get() {
    return ctx -> {
      ProjectId id = pathId(ctx);
      ProjectMetaDto meta = store.find(id)
          .orElseThrow(() -> new ProjectNotFoundException("Project '" + id + "' not found."));
      ctx.json(meta);
    };
  }

  /**
   * {@code PATCH /api/v1/projects/{id}} — renames a project.
   *
   * @return The handler.
   */
  public Handler rename() {
    return ctx -> {
      ProjectId id = pathId(ctx);
      RenameProjectRequest req = parseBody(ctx, RenameProjectRequest.class);
      if (req.name() == null || req.name().isBlank()) {
        throw new IllegalArgumentException("Field 'name' is required.");
      }
      ctx.json(store.rename(id, req.name()));
    };
  }

  /**
   * {@code DELETE /api/v1/projects/{id}} — recursively deletes a project.
   *
   * @return The handler.
   */
  public Handler delete() {
    return ctx -> {
      ProjectId id = pathId(ctx);
      store.delete(id);
      ctx.status(HttpStatus.NO_CONTENT);
    };
  }

  /**
   * {@code POST /api/v1/projects/{id}/copy} — clones a project ("Save As").
   *
   * @return The handler.
   */
  public Handler copy() {
    return ctx -> {
      ProjectId source = pathId(ctx);
      CopyProjectRequest req = parseBody(ctx, CopyProjectRequest.class);
      if (req.newName() == null || req.newName().isBlank()) {
        throw new IllegalArgumentException("Field 'newName' is required.");
      }
      ProjectMetaDto meta = store.copy(source, req.newName(), req.newId());
      ctx.status(HttpStatus.CREATED);
      ctx.header("Location", "/api/v1/projects/" + meta.id());
      ctx.json(meta);
    };
  }

  /**
   * {@code GET /api/v1/projects/{id}/draft} — returns the latest draft envelope (404 if none).
   *
   * @return The handler.
   */
  public Handler getDraft() {
    return ctx -> {
      ProjectId id = pathId(ctx);
      JsonNode draft = store.readDraft(id)
          .orElseThrow(() -> new ProjectNotFoundException("No draft for project '" + id + "'."));
      ctx.status(HttpStatus.OK);
      ctx.contentType("application/json");
      ctx.result(draft.toString());
    };
  }

  /**
   * {@code PUT /api/v1/projects/{id}/draft} — replaces the draft. Body must be a {@code
   * DraftEnvelope} with an integer {@code version} field; {@code payload} is opaque to the BFF.
   *
   * @return The handler.
   */
  public Handler putDraft() {
    return ctx -> {
      ProjectId id = pathId(ctx);
      JsonNode envelope = parseBody(ctx, JsonNode.class);
      store.writeDraft(id, envelope);
      ctx.status(HttpStatus.NO_CONTENT);
    };
  }

  private ProjectId pathId(Context ctx) {
    return ProjectId.of(ctx.pathParam(ID_PARAM));
  }

  private <T> T parseBody(Context ctx, Class<T> type) {
    T body;
    try {
      body = ctx.bodyAsClass(type);
    }
    catch (Exception e) {
      throw new IllegalArgumentException("Invalid JSON in request body.", e);
    }
    if (body == null) {
      throw new IllegalArgumentException("Request body must not be empty.");
    }
    return body;
  }
}
