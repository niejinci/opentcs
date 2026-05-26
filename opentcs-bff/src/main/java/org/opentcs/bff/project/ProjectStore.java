// SPDX-FileCopyrightText: The openTCS Authors
// SPDX-License-Identifier: MIT
package org.opentcs.bff.project;

import static java.util.Objects.requireNonNull;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.SerializationFeature;
import com.fasterxml.jackson.datatype.jsr310.JavaTimeModule;
import com.google.inject.Singleton;
import jakarta.inject.Inject;
import java.io.IOException;
import java.io.InputStream;
import java.io.UncheckedIOException;
import java.nio.file.AtomicMoveNotSupportedException;
import java.nio.file.DirectoryStream;
import java.nio.file.Files;
import java.nio.file.NoSuchFileException;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.nio.file.StandardCopyOption;
import java.nio.file.attribute.BasicFileAttributes;
import java.nio.file.attribute.FileTime;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Locale;
import java.util.Optional;
import java.util.regex.Pattern;
import java.util.stream.Stream;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

/**
 * Filesystem-backed project store (S7 — ADR-0002 "no DB; everything on disk").
 *
 * <p>Layout (from {@code spa-frontend-architecture.md} §6):
 * <pre>
 * ${bff.workspace.dir}/
 * └── projects/
 * └── {projectId}/
 * ├── meta.json
 * ├── draft.json (DraftEnvelope JSON, optional)
 * └── assets/
 * ├── {name}.png
 * ├── {name}.pgm
 * └── {name}.yaml
 * </pre>
 *
 * <p>All writes that mutate {@code meta.json} / {@code draft.json} go through a temp-file +
 * {@link Files#move(Path, Path, java.nio.file.CopyOption...) atomic rename}; asset uploads are
 * streamed (no full-file buffering). Path-traversal attempts are rebuffed both by validating
 * {@link ProjectId} / asset names and by re-checking that the resolved absolute path stays
 * underneath the workspace root.
 */
@Singleton
public class ProjectStore {

  /**
   * Allowed characters in an asset filename (incl. exactly one dot before the extension).
   * Identical character class to {@link ProjectId#PATTERN} for the stem, plus one of the
   * whitelisted extensions.
   */
  static final Pattern ASSET_NAME_PATTERN
      = Pattern.compile("^[a-zA-Z0-9][a-zA-Z0-9_-]{0,127}\\.(png|pgm|yaml|yml)$");

  static final String META_FILENAME = "meta.json";
  static final String DRAFT_FILENAME = "draft.json";
  static final String ASSETS_DIRNAME = "assets";
  static final String PROJECTS_DIRNAME = "projects";

  private static final Logger LOG = LoggerFactory.getLogger(ProjectStore.class);

  private final ObjectMapper objectMapper;
  private final Path workspaceRoot;
  private final Path projectsRoot;
  private final long assetMaxBytes;

  /**
   * Creates a new instance.
   *
   * @param configuration The workspace configuration (root dir + asset size limit).
   */
  @Inject
  public ProjectStore(BffWorkspaceConfiguration configuration) {
    this(
        Paths.get(requireNonNull(configuration, "configuration").dir()),
        configuration.assetMaxBytes()
    );
  }

  /**
   * Constructor used by tests / advanced callers that already hold a resolved workspace path.
   *
   * @param workspaceRoot The (possibly relative) root directory.
   * @param assetMaxBytes Maximum bytes accepted for a single asset upload.
   */
  public ProjectStore(Path workspaceRoot, long assetMaxBytes) {
    this.workspaceRoot = requireNonNull(workspaceRoot, "workspaceRoot").toAbsolutePath()
        .normalize();
    this.projectsRoot = this.workspaceRoot.resolve(PROJECTS_DIRNAME);
    this.assetMaxBytes = assetMaxBytes;
    this.objectMapper = new ObjectMapper()
        .registerModule(new JavaTimeModule())
        .disable(SerializationFeature.WRITE_DATES_AS_TIMESTAMPS)
        .enable(SerializationFeature.INDENT_OUTPUT);
    try {
      Files.createDirectories(projectsRoot);
    }
    catch (IOException e) {
      throw new UncheckedIOException(
          "Failed to create BFF workspace directory: " + projectsRoot, e
      );
    }
    LOG.info("Project workspace root: {}", projectsRoot);
  }

  /* ------------------------------ CRUD: projects ------------------------------- */

  /**
   * Lists all projects in {@link #projectsRoot}, ordered by {@code updatedAt} descending.
   *
   * @return All known projects' metadata.
   */
  public List<ProjectMetaDto> list() {
    List<ProjectMetaDto> result = new ArrayList<>();
    try (DirectoryStream<Path> entries = Files.newDirectoryStream(projectsRoot)) {
      for (Path entry : entries) {
        if (!Files.isDirectory(entry)) {
          continue;
        }
        String name = entry.getFileName().toString();
        if (!ProjectId.PATTERN.matcher(name).matches()) {
          continue;
        }
        try {
          result.add(loadMeta(ProjectId.of(name)));
        }
        catch (IOException ioe) {
          LOG.warn("Skipping unreadable project directory: {}", entry, ioe);
        }
      }
    }
    catch (NoSuchFileException ignored) {
      // The directory was created in the constructor but may have been deleted out from under
      // us; treat as empty.
    }
    catch (IOException e) {
      throw new UncheckedIOException("Failed to list projects in " + projectsRoot, e);
    }
    result.sort(Comparator.comparing(ProjectMetaDto::updatedAt).reversed());
    return result;
  }

  /**
   * Returns the metadata for {@code id} if it exists.
   *
   * @param id The project's id.
   * @return The metadata, or {@link Optional#empty()} if the project does not exist.
   */
  public Optional<ProjectMetaDto> find(ProjectId id) {
    requireNonNull(id, "id");
    Path projectDir = resolveProjectDir(id);
    if (!Files.isDirectory(projectDir)) {
      return Optional.empty();
    }
    try {
      return Optional.of(loadMeta(id));
    }
    catch (IOException e) {
      throw new UncheckedIOException("Failed to read project meta for " + id, e);
    }
  }

  /**
   * Creates a new, empty project.
   *
   * @param name The display name.
   * @param maybeId An optional explicit id; if {@code null} or empty, an id is derived from
   * {@code name}.
   * @return The created project's metadata.
   * @throws IllegalArgumentException If {@code name} is blank or {@code maybeId} is malformed.
   * @throws ProjectAlreadyExistsException If a project with the resolved id already exists.
   */
  public ProjectMetaDto create(String name, String maybeId) {
    String displayName = sanitiseDisplayName(name);
    ProjectId id = (maybeId == null || maybeId.isBlank())
        ? ProjectId.fromName(displayName)
        : ProjectId.of(maybeId);
    Path projectDir = resolveProjectDir(id);
    if (Files.exists(projectDir)) {
      throw new ProjectAlreadyExistsException("Project '" + id + "' already exists.");
    }
    try {
      Files.createDirectories(projectDir.resolve(ASSETS_DIRNAME));
      Instant now = Instant.now();
      ProjectMetaDto meta = new ProjectMetaDto(id.value(), displayName, now, now, false, List.of());
      writeMeta(projectDir, meta);
      return meta;
    }
    catch (IOException e) {
      throw new UncheckedIOException("Failed to create project " + id, e);
    }
  }

  /**
   * Renames a project (display name only — the id is immutable).
   *
   * @param id The project to rename.
   * @param newName The new display name.
   * @return The updated metadata.
   * @throws ProjectNotFoundException If {@code id} doesn't exist.
   */
  public ProjectMetaDto rename(ProjectId id, String newName) {
    requireNonNull(id, "id");
    String displayName = sanitiseDisplayName(newName);
    Path projectDir = requireProjectDir(id);
    try {
      ProjectMetaDto current = loadMeta(id);
      ProjectMetaDto updated = current
          .withName(displayName)
          .withUpdatedAt(Instant.now())
          .withAssets(listAssetNames(id))
          .withHasDraft(Files.exists(projectDir.resolve(DRAFT_FILENAME)));
      writeMeta(projectDir, updated);
      return updated;
    }
    catch (IOException e) {
      throw new UncheckedIOException("Failed to rename project " + id, e);
    }
  }

  /**
   * Recursively deletes a project.
   *
   * @param id The project to delete.
   * @throws ProjectNotFoundException If {@code id} doesn't exist.
   */
  public void delete(ProjectId id) {
    Path projectDir = requireProjectDir(id);
    try (Stream<Path> walk = Files.walk(projectDir)) {
      walk
          .sorted(Comparator.reverseOrder())
          .forEach(p -> {
            try {
              Files.delete(p);
            }
            catch (IOException e) {
              throw new UncheckedIOException("Failed to delete " + p, e);
            }
          });
    }
    catch (IOException e) {
      throw new UncheckedIOException("Failed to delete project " + id, e);
    }
  }

  /**
   * Copies a project ("Save As"). Copies {@code meta.json} (with the new name + fresh timestamps),
   * {@code draft.json} (if present) and all assets. Any {@code publishHistory/} directory is
   * intentionally not copied.
   *
   * @param sourceId The id of the project to copy.
   * @param newName The display name for the new project.
   * @param maybeNewId An optional explicit id for the new project; derived from {@code newName}
   * when null/blank.
   * @return The new project's metadata.
   */
  public ProjectMetaDto copy(ProjectId sourceId, String newName, String maybeNewId) {
    Path srcDir = requireProjectDir(sourceId);
    String displayName = sanitiseDisplayName(newName);
    ProjectId newId = (maybeNewId == null || maybeNewId.isBlank())
        ? ProjectId.fromName(displayName)
        : ProjectId.of(maybeNewId);
    if (newId.equals(sourceId)) {
      throw new ProjectAlreadyExistsException("Target project id must differ from source id.");
    }
    Path dstDir = resolveProjectDir(newId);
    if (Files.exists(dstDir)) {
      throw new ProjectAlreadyExistsException("Project '" + newId + "' already exists.");
    }
    try {
      Files.createDirectories(dstDir.resolve(ASSETS_DIRNAME));
      // Copy draft.json (optional).
      Path srcDraft = srcDir.resolve(DRAFT_FILENAME);
      if (Files.exists(srcDraft)) {
        Files.copy(srcDraft, dstDir.resolve(DRAFT_FILENAME), StandardCopyOption.REPLACE_EXISTING);
      }
      // Copy assets/* (skip publishHistory/ and anything else).
      Path srcAssets = srcDir.resolve(ASSETS_DIRNAME);
      if (Files.isDirectory(srcAssets)) {
        try (DirectoryStream<Path> ds = Files.newDirectoryStream(srcAssets)) {
          for (Path asset : ds) {
            if (Files.isRegularFile(asset)
                && ASSET_NAME_PATTERN.matcher(asset.getFileName().toString()).matches()) {
              Files.copy(
                  asset,
                  dstDir.resolve(ASSETS_DIRNAME).resolve(asset.getFileName().toString()),
                  StandardCopyOption.REPLACE_EXISTING
              );
            }
          }
        }
      }
      Instant now = Instant.now();
      ProjectMetaDto newMeta = new ProjectMetaDto(
          newId.value(),
          displayName,
          now,
          now,
          Files.exists(dstDir.resolve(DRAFT_FILENAME)),
          listAssetNames(newId)
      );
      writeMeta(dstDir, newMeta);
      return newMeta;
    }
    catch (IOException e) {
      throw new UncheckedIOException("Failed to copy project " + sourceId + " -> " + newId, e);
    }
  }

  /* -------------------------------- Draft IO ----------------------------------- */

  /**
   * Reads {@code draft.json} for {@code id} if it exists.
   *
   * @param id The project id.
   * @return The parsed JSON node, or {@link Optional#empty()} when no draft has been saved yet.
   * @throws ProjectNotFoundException If the project does not exist.
   * @throws IllegalArgumentException If the on-disk draft is not valid JSON.
   */
  public Optional<JsonNode> readDraft(ProjectId id) {
    Path projectDir = requireProjectDir(id);
    Path draft = projectDir.resolve(DRAFT_FILENAME);
    if (!Files.exists(draft)) {
      return Optional.empty();
    }
    try {
      return Optional.of(objectMapper.readTree(Files.readAllBytes(draft)));
    }
    catch (IOException e) {
      throw new IllegalArgumentException(
          "Stored draft for project " + id + " is not valid JSON: " + e.getMessage(), e
      );
    }
  }

  /**
   * Writes a new draft envelope. Performs a write-temp + atomic-rename so the on-disk file is
   * either fully the old or fully the new content. Updates {@code meta.json#updatedAt} as a side
   * effect.
   *
   * @param id The project id.
   * @param envelope The full draft envelope (must contain a numeric {@code version} field).
   * @throws ProjectNotFoundException If the project doesn't exist.
   * @throws IllegalArgumentException If the envelope is malformed.
   */
  public void writeDraft(ProjectId id, JsonNode envelope) {
    requireNonNull(envelope, "envelope");
    Path projectDir = requireProjectDir(id);
    JsonNode versionNode = envelope.get("version");
    if (versionNode == null || !versionNode.isInt()) {
      throw new IllegalArgumentException(
          "Draft envelope must contain an integer 'version' field."
      );
    }
    Path draft = projectDir.resolve(DRAFT_FILENAME);
    try {
      writeAtomically(draft, objectMapper.writeValueAsBytes(envelope));
      // Update meta timestamp; ignore any concurrent meta edits — last writer wins.
      ProjectMetaDto current = loadMeta(id);
      writeMeta(
          projectDir,
          current
              .withUpdatedAt(Instant.now())
              .withHasDraft(true)
              .withAssets(listAssetNames(id))
      );
    }
    catch (IOException e) {
      throw new UncheckedIOException("Failed to write draft for project " + id, e);
    }
  }

  /**
   * Records a successful publish of the project's draft to the kernel.
   *
   * <p>Updates {@code meta.json#lastPublishedAt} (and {@code updatedAt}) atomically. The on-disk
   * draft is intentionally not touched — publish is a strictly read-only operation as far as the
   * draft is concerned.
   *
   * @param id The project id.
   * @param publishedAt The publish timestamp to record.
   * @return The updated metadata.
   * @throws ProjectNotFoundException If the project doesn't exist.
   */
  public ProjectMetaDto markPublished(ProjectId id, Instant publishedAt) {
    requireNonNull(id, "id");
    requireNonNull(publishedAt, "publishedAt");
    Path projectDir = requireProjectDir(id);
    try {
      ProjectMetaDto current = loadMeta(id);
      ProjectMetaDto updated = current
          .withUpdatedAt(publishedAt)
          .withLastPublishedAt(publishedAt);
      writeMeta(projectDir, updated);
      return updated;
    }
    catch (IOException e) {
      throw new UncheckedIOException("Failed to record publish for project " + id, e);
    }
  }

  /* -------------------------------- Assets ------------------------------------- */

  /**
   * Lists all assets for {@code id}.
   *
   * @param id The project id.
   * @return The asset descriptors, ordered by name.
   * @throws ProjectNotFoundException If the project doesn't exist.
   */
  public List<ProjectAssetDto> listAssets(ProjectId id) {
    Path projectDir = requireProjectDir(id);
    Path assetsDir = projectDir.resolve(ASSETS_DIRNAME);
    if (!Files.isDirectory(assetsDir)) {
      return List.of();
    }
    List<ProjectAssetDto> result = new ArrayList<>();
    try (DirectoryStream<Path> ds = Files.newDirectoryStream(assetsDir)) {
      for (Path asset : ds) {
        if (!Files.isRegularFile(asset)) {
          continue;
        }
        String name = asset.getFileName().toString();
        if (!ASSET_NAME_PATTERN.matcher(name).matches()) {
          continue;
        }
        BasicFileAttributes attrs = Files.readAttributes(asset, BasicFileAttributes.class);
        result.add(
            new ProjectAssetDto(
                name,
                attrs.size(),
                contentTypeFor(name),
                attrs.lastModifiedTime().toInstant()
            )
        );
      }
    }
    catch (IOException e) {
      throw new UncheckedIOException("Failed to list assets for project " + id, e);
    }
    result.sort(Comparator.comparing(ProjectAssetDto::name));
    return result;
  }

  /**
   * Streams an uploaded asset to disk (with size enforcement). Overwrites any existing file of
   * the same name.
   *
   * @param id The project id.
   * @param assetName The (validated) asset filename.
   * @param input The upload stream. Must not be {@code null}; will be drained but not closed.
   * @return The descriptor of the freshly written asset.
   * @throws ProjectNotFoundException If the project doesn't exist.
   * @throws IllegalArgumentException If {@code assetName} is malformed.
   * @throws AssetTooLargeException If the stream exceeds {@code bff.workspace.assetMaxBytes}.
   */
  public ProjectAssetDto writeAsset(ProjectId id, String assetName, InputStream input) {
    requireNonNull(input, "input");
    String safeName = requireValidAssetName(assetName);
    Path projectDir = requireProjectDir(id);
    Path assetsDir = projectDir.resolve(ASSETS_DIRNAME);
    Path target = assetsDir.resolve(safeName);
    // Defence in depth: the resolved path must still live under the assets dir.
    if (!target.normalize().startsWith(assetsDir.normalize())) {
      throw new IllegalArgumentException("Resolved asset path escapes assets dir: " + safeName);
    }
    Path tmp;
    try {
      Files.createDirectories(assetsDir);
      tmp = Files.createTempFile(assetsDir, ".upload-", ".tmp");
    }
    catch (IOException e) {
      throw new UncheckedIOException("Failed to create temp file for upload", e);
    }
    try {
      long bytes = copyWithLimit(input, tmp, assetMaxBytes);
      try {
        Files.move(
            tmp, target, StandardCopyOption.ATOMIC_MOVE, StandardCopyOption.REPLACE_EXISTING
        );
      }
      catch (AtomicMoveNotSupportedException ame) {
        Files.move(tmp, target, StandardCopyOption.REPLACE_EXISTING);
      }
      // Refresh meta.json so updatedAt reflects the upload + assets list grows.
      ProjectMetaDto current = loadMeta(id);
      writeMeta(
          projectDir,
          current
              .withUpdatedAt(Instant.now())
              .withHasDraft(Files.exists(projectDir.resolve(DRAFT_FILENAME)))
              .withAssets(listAssetNames(id))
      );
      FileTime lm = Files.getLastModifiedTime(target);
      return new ProjectAssetDto(safeName, bytes, contentTypeFor(safeName), lm.toInstant());
    }
    catch (AssetTooLargeException tooBig) {
      deleteQuietly(tmp);
      throw tooBig;
    }
    catch (IOException e) {
      deleteQuietly(tmp);
      throw new UncheckedIOException("Failed to write asset " + safeName + " for " + id, e);
    }
  }

  /**
   * Opens an asset for reading.
   *
   * @param id The project id.
   * @param assetName The asset filename.
   * @return The asset path on disk.
   * @throws ProjectNotFoundException If the project doesn't exist.
   * @throws AssetNotFoundException If the asset doesn't exist.
   * @throws IllegalArgumentException If {@code assetName} is malformed.
   */
  public Path resolveAsset(ProjectId id, String assetName) {
    String safe = requireValidAssetName(assetName);
    Path projectDir = requireProjectDir(id);
    Path target = projectDir.resolve(ASSETS_DIRNAME).resolve(safe);
    if (!target.normalize().startsWith(projectDir.resolve(ASSETS_DIRNAME).normalize())) {
      throw new IllegalArgumentException("Resolved asset path escapes assets dir: " + safe);
    }
    if (!Files.exists(target)) {
      throw new AssetNotFoundException("Asset '" + safe + "' not found in project " + id + ".");
    }
    return target;
  }

  /**
   * Deletes a single asset.
   *
   * @param id The project id.
   * @param assetName The asset filename.
   * @throws ProjectNotFoundException If the project doesn't exist.
   * @throws AssetNotFoundException If the asset doesn't exist.
   */
  public void deleteAsset(ProjectId id, String assetName) {
    Path target = resolveAsset(id, assetName);
    try {
      Files.delete(target);
      Path projectDir = requireProjectDir(id);
      ProjectMetaDto current = loadMeta(id);
      writeMeta(
          projectDir,
          current
              .withUpdatedAt(Instant.now())
              .withHasDraft(Files.exists(projectDir.resolve(DRAFT_FILENAME)))
              .withAssets(listAssetNames(id))
      );
    }
    catch (IOException e) {
      throw new UncheckedIOException("Failed to delete asset " + assetName + " from " + id, e);
    }
  }

  /**
   * Returns the configured per-asset size limit (bytes).
   *
   * @return The asset size limit.
   */
  public long assetMaxBytes() {
    return assetMaxBytes;
  }

  /* ----------------------------- Helpers --------------------------------------- */

  private Path resolveProjectDir(ProjectId id) {
    Path candidate = projectsRoot.resolve(id.value()).normalize();
    if (!candidate.startsWith(projectsRoot)) {
      throw new IllegalArgumentException("Resolved project path escapes workspace: " + id);
    }
    return candidate;
  }

  private Path requireProjectDir(ProjectId id) {
    Path dir = resolveProjectDir(id);
    if (!Files.isDirectory(dir)) {
      throw new ProjectNotFoundException("Project '" + id + "' not found.");
    }
    return dir;
  }

  private ProjectMetaDto loadMeta(ProjectId id)
      throws IOException {
    Path projectDir = resolveProjectDir(id);
    Path metaPath = projectDir.resolve(META_FILENAME);
    Instant fallback = Files.exists(projectDir)
        ? Files.getLastModifiedTime(projectDir).toInstant()
        : Instant.EPOCH;
    if (!Files.exists(metaPath)) {
      // Legacy / hand-created project dir: synthesise meta from the directory itself.
      return new ProjectMetaDto(
          id.value(),
          id.value(),
          fallback,
          fallback,
          Files.exists(projectDir.resolve(DRAFT_FILENAME)),
          listAssetNames(id)
      );
    }
    JsonNode root = objectMapper.readTree(Files.readAllBytes(metaPath));
    String name = root.path("name").asText(id.value());
    Instant createdAt = parseInstant(root.path("createdAt").asText(), fallback);
    Instant updatedAt = parseInstant(root.path("updatedAt").asText(), fallback);
    boolean hasDraft = Files.exists(projectDir.resolve(DRAFT_FILENAME));
    // S8: lastPublishedAt is optional/back-compat — missing field => null.
    JsonNode publishedNode = root.get("lastPublishedAt");
    Instant lastPublishedAt = (publishedNode == null || publishedNode.isNull())
        ? null
        : parseInstant(publishedNode.asText(), null);
    return new ProjectMetaDto(
        id.value(), name, createdAt, updatedAt, hasDraft, listAssetNames(id), lastPublishedAt
    );
  }

  private void writeMeta(Path projectDir, ProjectMetaDto meta)
      throws IOException {
    Path metaPath = projectDir.resolve(META_FILENAME);
    writeAtomically(metaPath, objectMapper.writeValueAsBytes(meta));
  }

  private void writeAtomically(Path target, byte[] bytes)
      throws IOException {
    Path dir = target.getParent();
    requireNonNull(dir, "target.getParent()");
    Files.createDirectories(dir);
    Path tmp = Files.createTempFile(dir, ".tmp-", ".swap");
    try {
      Files.write(tmp, bytes);
      try {
        Files.move(
            tmp, target, StandardCopyOption.ATOMIC_MOVE, StandardCopyOption.REPLACE_EXISTING
        );
      }
      catch (AtomicMoveNotSupportedException ignored) {
        Files.move(tmp, target, StandardCopyOption.REPLACE_EXISTING);
      }
    }
    catch (IOException e) {
      deleteQuietly(tmp);
      throw e;
    }
  }

  private List<String> listAssetNames(ProjectId id)
      throws IOException {
    Path assetsDir = resolveProjectDir(id).resolve(ASSETS_DIRNAME);
    if (!Files.isDirectory(assetsDir)) {
      return List.of();
    }
    List<String> names = new ArrayList<>();
    try (DirectoryStream<Path> ds = Files.newDirectoryStream(assetsDir)) {
      for (Path asset : ds) {
        if (!Files.isRegularFile(asset)) {
          continue;
        }
        String n = asset.getFileName().toString();
        if (ASSET_NAME_PATTERN.matcher(n).matches()) {
          names.add(n);
        }
      }
    }
    names.sort(Comparator.naturalOrder());
    return names;
  }

  private long copyWithLimit(InputStream input, Path target, long limit)
      throws IOException {
    byte[] buf = new byte[8192];
    long total = 0;
    try (var out = Files.newOutputStream(target)) {
      int n;
      while ((n = input.read(buf)) > 0) {
        total += n;
        if (limit > 0 && total > limit) {
          throw new AssetTooLargeException(
              "Upload exceeds configured limit of " + limit + " bytes."
          );
        }
        out.write(buf, 0, n);
      }
    }
    return total;
  }

  private static void deleteQuietly(Path p) {
    if (p == null) {
      return;
    }
    try {
      Files.deleteIfExists(p);
    }
    catch (IOException ignored) {
      // Best-effort cleanup; log nothing — this only runs after a real failure that's already
      // bubbling up.
    }
  }

  private static String sanitiseDisplayName(String name) {
    if (name == null) {
      throw new IllegalArgumentException("name must not be null");
    }
    String trimmed = name.trim();
    if (trimmed.isEmpty()) {
      throw new IllegalArgumentException("name must not be blank");
    }
    if (trimmed.length() > 128) {
      throw new IllegalArgumentException("name must be at most 128 characters");
    }
    // Reject control characters; everything else (incl. CJK) is allowed in the display name.
    for (int i = 0; i < trimmed.length(); i++) {
      char c = trimmed.charAt(i);
      if (c < 0x20 || c == 0x7F) {
        throw new IllegalArgumentException("name must not contain control characters");
      }
    }
    return trimmed;
  }

  private static String requireValidAssetName(String name) {
    if (name == null || !ASSET_NAME_PATTERN.matcher(name).matches()) {
      throw new IllegalArgumentException(
          "Invalid asset name '" + name + "': must match " + ASSET_NAME_PATTERN.pattern()
      );
    }
    return name;
  }

  private static Instant parseInstant(String value, Instant fallback) {
    if (value == null || value.isEmpty()) {
      return fallback;
    }
    try {
      return Instant.parse(value);
    }
    catch (Exception ignored) {
      return fallback;
    }
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
