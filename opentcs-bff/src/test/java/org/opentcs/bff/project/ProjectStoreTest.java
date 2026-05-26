// SPDX-FileCopyrightText: The openTCS Authors
// SPDX-License-Identifier: MIT
package org.opentcs.bff.project;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import java.io.ByteArrayInputStream;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

/**
 * Tests for {@link ProjectStore}'s filesystem layer (S7).
 */
class ProjectStoreTest {

  private static final ObjectMapper JSON = new ObjectMapper();

  @TempDir
  private Path workspace;
  private ProjectStore store;

  @BeforeEach
  void setUp() {
    store = new ProjectStore(workspace, 16L * 1024L);
  }

  @Test
  void createPersistsMetaAndAssetsDir() {
    ProjectMetaDto meta = store.create("Demo Plant", null);
    assertThat(meta.id()).matches(ProjectId.PATTERN);
    assertThat(meta.name()).isEqualTo("Demo Plant");
    Path dir = workspace.resolve("projects").resolve(meta.id());
    assertThat(Files.exists(dir.resolve("meta.json"))).isTrue();
    assertThat(Files.isDirectory(dir.resolve("assets"))).isTrue();
    assertThat(store.list()).hasSize(1).first().extracting(ProjectMetaDto::id)
        .isEqualTo(meta.id());
  }

  @Test
  void createRejectsBlankName() {
    assertThatThrownBy(() -> store.create("   ", null))
        .isInstanceOf(IllegalArgumentException.class);
  }

  @Test
  void createWithExplicitIdConflictsRaises() {
    store.create("First", "my-plant");
    assertThatThrownBy(() -> store.create("Second", "my-plant"))
        .isInstanceOf(ProjectAlreadyExistsException.class);
  }

  @Test
  void createRejectsMalformedExplicitId() {
    assertThatThrownBy(() -> store.create("OK", "../etc"))
        .isInstanceOf(IllegalArgumentException.class);
  }

  @Test
  void renameUpdatesName() {
    ProjectMetaDto meta = store.create("Old name", "p1");
    ProjectMetaDto renamed = store.rename(ProjectId.of("p1"), "New name");
    assertThat(renamed.name()).isEqualTo("New name");
    assertThat(renamed.id()).isEqualTo("p1");
    assertThat(renamed.updatedAt()).isAfterOrEqualTo(meta.updatedAt());
  }

  @Test
  void renameMissingProjectRaises() {
    assertThatThrownBy(() -> store.rename(ProjectId.of("ghost"), "x"))
        .isInstanceOf(ProjectNotFoundException.class);
  }

  @Test
  void deleteRemovesEverything() {
    store.create("X", "p1");
    store.writeAsset(ProjectId.of("p1"), "map.png", new ByteArrayInputStream(new byte[]{1, 2, 3}));
    store.delete(ProjectId.of("p1"));
    assertThat(Files.exists(workspace.resolve("projects").resolve("p1"))).isFalse();
  }

  @Test
  void draftRoundTripPreservesPayload()
      throws Exception {
    store.create("X", "p1");
    ObjectNode envelope = JSON.createObjectNode();
    envelope.put("version", 1);
    envelope.put("savedAt", "2026-05-22T08:00:00Z");
    ObjectNode payload = envelope.putObject("payload");
    payload.put("v", 2);
    payload.putArray("points");
    store.writeDraft(ProjectId.of("p1"), envelope);
    JsonNode read = store.readDraft(ProjectId.of("p1")).orElseThrow();
    assertThat(read).isEqualTo(envelope);
    assertThat(store.find(ProjectId.of("p1")).orElseThrow().hasDraft()).isTrue();
  }

  @Test
  void putDraftWithoutVersionFieldFails() {
    store.create("X", "p1");
    ObjectNode bad = JSON.createObjectNode();
    bad.put("payload", "ignored");
    assertThatThrownBy(() -> store.writeDraft(ProjectId.of("p1"), bad))
        .isInstanceOf(IllegalArgumentException.class);
  }

  @Test
  void writeAssetEnforcesWhitelistAndSize() {
    store.create("X", "p1");
    assertThatThrownBy(
        () -> store.writeAsset(
            ProjectId.of("p1"), "evil.exe", new ByteArrayInputStream(new byte[1])
        )
    ).isInstanceOf(IllegalArgumentException.class);
    assertThatThrownBy(
        () -> store.writeAsset(
            ProjectId.of("p1"), "../escape.png", new ByteArrayInputStream(new byte[1])
        )
    ).isInstanceOf(IllegalArgumentException.class);
    // Over the configured 16 KiB limit.
    byte[] big = new byte[17 * 1024];
    assertThatThrownBy(
        () -> store.writeAsset(ProjectId.of("p1"), "map.png", new ByteArrayInputStream(big))
    ).isInstanceOf(AssetTooLargeException.class);
  }

  @Test
  void uploadDownloadDeleteAsset()
      throws Exception {
    store.create("X", "p1");
    byte[] bytes = "hello".getBytes(StandardCharsets.UTF_8);
    ProjectAssetDto asset = store.writeAsset(
        ProjectId.of("p1"), "map.yaml", new ByteArrayInputStream(bytes)
    );
    assertThat(asset.size()).isEqualTo(bytes.length);
    assertThat(asset.contentType()).isEqualTo("application/yaml");
    Path path = store.resolveAsset(ProjectId.of("p1"), "map.yaml");
    assertThat(Files.readAllBytes(path)).isEqualTo(bytes);
    assertThat(store.listAssets(ProjectId.of("p1")))
        .extracting(ProjectAssetDto::name).containsExactly("map.yaml");
    store.deleteAsset(ProjectId.of("p1"), "map.yaml");
    assertThatThrownBy(() -> store.resolveAsset(ProjectId.of("p1"), "map.yaml"))
        .isInstanceOf(AssetNotFoundException.class);
  }

  @Test
  void copyClonesDraftAndAssets()
      throws Exception {
    store.create("Src", "src1");
    ObjectNode env = JSON.createObjectNode();
    env.put("version", 1);
    env.putObject("payload");
    store.writeDraft(ProjectId.of("src1"), env);
    store.writeAsset(ProjectId.of("src1"), "map.png", new ByteArrayInputStream(new byte[]{9}));

    ProjectMetaDto dst = store.copy(ProjectId.of("src1"), "Clone", "dst1");

    assertThat(dst.id()).isEqualTo("dst1");
    assertThat(dst.name()).isEqualTo("Clone");
    assertThat(dst.hasDraft()).isTrue();
    assertThat(dst.assets()).containsExactly("map.png");
    JsonNode dstDraft = store.readDraft(ProjectId.of("dst1")).orElseThrow();
    assertThat(dstDraft).isEqualTo(env);
  }

  @Test
  void copyConflictRaises() {
    store.create("Src", "src1");
    store.create("Existing", "dst1");
    assertThatThrownBy(() -> store.copy(ProjectId.of("src1"), "Clone", "dst1"))
        .isInstanceOf(ProjectAlreadyExistsException.class);
  }

  @Test
  void findMissingReturnsEmpty() {
    assertThat(store.find(ProjectId.of("ghost"))).isEmpty();
  }

  @Test
  void writeDraftAtomicSurvivesRestart()
      throws Exception {
    store.create("X", "p1");
    ObjectNode env = JSON.createObjectNode();
    env.put("version", 7);
    store.writeDraft(ProjectId.of("p1"), env);
    // "Restart" by constructing a fresh store on the same workspace.
    ProjectStore restarted = new ProjectStore(workspace, 16L * 1024L);
    JsonNode read = restarted.readDraft(ProjectId.of("p1")).orElseThrow();
    assertThat(read.get("version").asInt()).isEqualTo(7);
  }
}
