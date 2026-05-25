// SPDX-FileCopyrightText: The openTCS Authors
// SPDX-License-Identifier: MIT
package org.opentcs.bff.project;

import static java.util.Objects.requireNonNull;

import io.javalin.http.Context;
import io.javalin.http.Handler;
import io.javalin.http.HttpStatus;
import io.javalin.http.UploadedFile;
import jakarta.inject.Inject;
import jakarta.inject.Singleton;
import java.io.IOException;
import java.io.InputStream;
import java.io.UncheckedIOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;

/**
 * Bundle of {@link Handler}s for asset endpoints under
 * {@code /api/v1/projects/{id}/assets}.
 */
@Singleton
public class ProjectAssetsHandler {

  /**
   * The path parameter for the asset filename.
   */
  public static final String NAME_PARAM = "name";

  private final ProjectStore store;

  /**
   * Creates a new instance.
   *
   * @param store The project store backing all endpoints.
   */
  @Inject
  public ProjectAssetsHandler(ProjectStore store) {
    this.store = requireNonNull(store, "store");
  }

  /**
   * {@code GET /api/v1/projects/{id}/assets} — list asset descriptors.
   *
   * @return The handler.
   */
  public Handler list() {
    return ctx -> {
      ProjectId id = pathId(ctx);
      ctx.json(store.listAssets(id));
    };
  }

  /**
   * {@code POST /api/v1/projects/{id}/assets} — multipart upload of one or more files. The
   * form-field name is ignored; every uploaded file is written under {@code assets/}.
   *
   * @return The handler.
   */
  public Handler upload() {
    return ctx -> {
      ProjectId id = pathId(ctx);
      List<UploadedFile> uploaded = ctx.uploadedFiles();
      if (uploaded.isEmpty()) {
        throw new IllegalArgumentException(
            "Multipart request must contain at least one file part."
        );
      }
      List<ProjectAssetDto> written = new ArrayList<>(uploaded.size());
      for (UploadedFile file : uploaded) {
        try (InputStream content = file.content()) {
          written.add(store.writeAsset(id, file.filename(), content));
        }
        catch (IOException e) {
          throw new UncheckedIOException("Failed to read upload stream for " + file.filename(), e);
        }
      }
      ctx.status(HttpStatus.CREATED);
      ctx.json(written);
    };
  }

  /**
   * {@code GET /api/v1/projects/{id}/assets/{name}} — stream the asset file back.
   *
   * @return The handler.
   */
  public Handler download() {
    return ctx -> {
      ProjectId id = pathId(ctx);
      String name = ctx.pathParam(NAME_PARAM);
      Path target = store.resolveAsset(id, name);
      ctx.contentType(contentTypeFor(name));
      ctx.header("Cache-Control", "no-cache");
      try {
        ctx.result(Files.newInputStream(target));
      }
      catch (IOException e) {
        throw new UncheckedIOException("Failed to open asset " + name, e);
      }
    };
  }

  /**
   * {@code DELETE /api/v1/projects/{id}/assets/{name}} — delete the asset.
   *
   * @return The handler.
   */
  public Handler delete() {
    return ctx -> {
      ProjectId id = pathId(ctx);
      String name = ctx.pathParam(NAME_PARAM);
      store.deleteAsset(id, name);
      ctx.status(HttpStatus.NO_CONTENT);
    };
  }

  private ProjectId pathId(Context ctx) {
    return ProjectId.of(ctx.pathParam(ProjectsHandler.ID_PARAM));
  }

  private static String contentTypeFor(String name) {
    String lower = name.toLowerCase(Locale.ROOT);
    if (lower.endsWith(".png")) {
      return "image/png";
    }
    if (lower.endsWith(".pgm")) {
      return "image/x-portable-graymap";
    }
    if (lower.endsWith(".yaml") || lower.endsWith(".yml")) {
      return "application/yaml";
    }
    return "application/octet-stream";
  }
}
