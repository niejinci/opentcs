// SPDX-FileCopyrightText: The openTCS Authors
// SPDX-License-Identifier: MIT
package org.opentcs.bff.publish;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.atLeastOnce;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import io.javalin.Javalin;
import io.javalin.apibuilder.ApiBuilder;
import io.javalin.http.HttpStatus;
import io.javalin.testtools.JavalinTest;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.Map;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.opentcs.access.KernelServicePortal;
import org.opentcs.bff.error.ErrorResponses;
import org.opentcs.bff.kernel.BffKernelConfiguration;
import org.opentcs.bff.kernel.KernelServicePortalFactory;
import org.opentcs.bff.project.ProjectId;
import org.opentcs.bff.project.ProjectNotFoundException;
import org.opentcs.bff.project.ProjectStore;
import org.opentcs.components.kernel.services.PlantModelService;

/**
 * Tests for {@link PublishHandler}, covering the four scenarios called out by S8:
 * dry-run success / validation failure / project-not-found / kernel-unreachable.
 */
class PublishHandlerTest {

  private Path workspace;
  private ProjectStore projectStore;
  private KernelServicePortalFactory portalFactory;
  private BffKernelConfiguration kernelConfig;
  private KernelServicePortal portal;
  private PlantModelService plantModelService;
  private Javalin app;

  @BeforeEach
  void setUp()
      throws IOException {
    workspace = Files.createTempDirectory("publish-handler-test-");
    projectStore = new ProjectStore(workspace, 16L * 1024 * 1024);
    portal = mock(KernelServicePortal.class);
    plantModelService = mock(PlantModelService.class);
    when(portal.getPlantModelService()).thenReturn(plantModelService);
    portalFactory = mock(KernelServicePortalFactory.class);
    when(portalFactory.create(anyString(), anyString())).thenReturn(portal);
    kernelConfig = mock(BffKernelConfiguration.class);
    when(kernelConfig.host()).thenReturn("localhost");
    when(kernelConfig.port()).thenReturn(1099);
    when(kernelConfig.userName()).thenReturn("Alice");
    when(kernelConfig.password()).thenReturn("xyz");

    PublishHandler handler = new PublishHandler(
        projectStore, portalFactory, kernelConfig, new ObjectMapper()
    );

    app = Javalin.create(cfg -> {
      cfg.startup.showJavalinBanner = false;
      cfg.routes.apiBuilder(() -> {
        ApiBuilder.path("/api/v1/plant-models", () -> {
          ApiBuilder.post("/publish", handler);
        });
      });
      cfg.routes.exception(IllegalArgumentException.class, (e, ctx) -> {
        ErrorResponses.write(ctx, HttpStatus.BAD_REQUEST, "BAD_REQUEST", e.getMessage());
      });
      cfg.routes.exception(ProjectNotFoundException.class, (e, ctx) -> {
        ErrorResponses.write(ctx, HttpStatus.NOT_FOUND, "PROJECT_NOT_FOUND", e.getMessage());
      });
      cfg.routes.exception(PublishValidationException.class, (e, ctx) -> {
        ErrorResponses.write(
            ctx, HttpStatus.BAD_REQUEST, "PUBLISH_VALIDATION",
            e.getMessage(), e.getFieldPath()
        );
      });
      cfg.routes.exception(KernelUnreachableException.class, (e, ctx) -> {
        ErrorResponses.write(
            ctx, HttpStatus.BAD_GATEWAY, "KERNEL_UNREACHABLE", e.getMessage()
        );
      });
    });
  }

  @AfterEach
  void tearDown()
      throws IOException {
    if (workspace != null) {
      // Best-effort cleanup; tests are short-lived.
      try (var stream = Files.walk(workspace)) {
        stream.sorted((a, b) -> b.compareTo(a)).forEach(p -> {
          try {
            Files.deleteIfExists(p);
          }
          catch (IOException ignored) {
            // ignore
          }
        });
      }
    }
  }

  private ProjectId seedProjectWithDraft()
      throws IOException {
    var meta = projectStore.create("demo", null);
    ProjectId id = ProjectId.of(meta.id());
    String envelope = """
        {"version": 2, "payload": {
          "v": 2,
          "points": [
            {"name": "P1", "type": "HALT_POSITION",
             "pose": {"position": {"x": 100, "y": 200, "z": 0}, "orientationAngle": "NaN"},
             "layout": {"pixelX": 0, "pixelY": 0}, "properties": {}}
          ],
          "paths": [], "locationTypes": [], "locations": [], "blocks": [],
          "vehicles": [
            {"name": "V1",
             "boundingBox": {"length": 1000, "width": 600, "height": 400},
             "energyLevelThresholdSet": {"energyLevelCritical": 30, "energyLevelGood": 90,
                                          "energyLevelSufficientlyRecharged": 30,
                                          "energyLevelFullyRecharged": 90},
             "maxVelocity": 1000, "maxReverseVelocity": 500, "envelopeKey": "",
             "layout": {"pixelX": 0, "pixelY": 0, "orientationDeg": 0,
                        "routeColorRgb": "#3366cc"},
             "properties": {}}
          ]
        }}
        """;
    projectStore.writeDraft(id, new ObjectMapper().readTree(envelope));
    return id;
  }

  @Test
  void dryRunReturns200AndDoesNotLoginToKernel()
      throws Exception {
    ProjectId id = seedProjectWithDraft();
    JavalinTest.test(app, (server, client) -> {
      var response = client.post(
          "/api/v1/plant-models/publish",
          Map.of("projectId", id.value(), "dryRun", true)
      );
      assertThat(response.code()).isEqualTo(200);
      JsonNode root = new ObjectMapper().readTree(response.body().string());
      assertThat(root.get("ok").asBoolean()).isTrue();
      assertThat(root.get("dryRun").asBoolean()).isTrue();
      assertThat(root.get("diff").get("points").asInt()).isEqualTo(1);
      assertThat(root.get("diff").get("vehicles").asInt()).isEqualTo(1);
    });
    verify(portal, never()).login(anyString(), anyInt());
    verify(plantModelService, never()).createPlantModel(any());
  }

  @Test
  void realPublishCallsKernelAndRecordsLastPublishedAt()
      throws Exception {
    ProjectId id = seedProjectWithDraft();
    JavalinTest.test(app, (server, client) -> {
      var response = client.post(
          "/api/v1/plant-models/publish",
          Map.of("projectId", id.value(), "dryRun", false)
      );
      assertThat(response.code()).isEqualTo(200);
      JsonNode root = new ObjectMapper().readTree(response.body().string());
      assertThat(root.get("ok").asBoolean()).isTrue();
      assertThat(root.get("dryRun").asBoolean()).isFalse();
      assertThat(root.get("publishedAt").asText()).isNotEmpty();
    });
    verify(portal, atLeastOnce()).login("localhost", 1099);
    verify(plantModelService).createPlantModel(any());
    verify(portal).logout();
    assertThat(projectStore.find(id).orElseThrow().lastPublishedAt()).isNotNull();
  }

  @Test
  void validationFailureReturns400WithFieldPath()
      throws Exception {
    var meta = projectStore.create("demo", null);
    ProjectId id = ProjectId.of(meta.id());
    String envelope = """
        {"version": 2, "payload": {
          "v": 2,
          "points": [
            {"name": "P1", "type": "HALT_POSITION",
             "pose": {"position": {"x": 0, "y": 0, "z": 0}, "orientationAngle": "NaN"},
             "layout": {"pixelX": 0, "pixelY": 0}, "properties": {}}
          ],
          "paths": [
            {"name": "bad", "srcPointName": "Ghost", "destPointName": "P1",
             "length": 1, "maxVelocity": 0, "maxReverseVelocity": 0, "locked": false,
             "properties": {}}
          ],
          "locationTypes": [], "locations": [], "blocks": [], "vehicles": []
        }}
        """;
    projectStore.writeDraft(id, new ObjectMapper().readTree(envelope));
    JavalinTest.test(app, (server, client) -> {
      var response = client.post(
          "/api/v1/plant-models/publish",
          Map.of("projectId", id.value(), "dryRun", false)
      );
      assertThat(response.code()).isEqualTo(400);
      JsonNode root = new ObjectMapper().readTree(response.body().string());
      assertThat(root.get("code").asText()).isEqualTo("PUBLISH_VALIDATION");
      assertThat(root.get("fieldPath").asText()).isEqualTo("paths[0].srcPointName");
    });
    verify(portal, never()).login(anyString(), anyInt());
  }

  @Test
  void unknownProjectReturns404() {
    JavalinTest.test(app, (server, client) -> {
      var response = client.post(
          "/api/v1/plant-models/publish",
          Map.of("projectId", "00000000-0000-0000-0000-000000000000", "dryRun", true)
      );
      assertThat(response.code()).isEqualTo(404);
      JsonNode root = new ObjectMapper().readTree(response.body().string());
      assertThat(root.get("code").asText()).isEqualTo("PROJECT_NOT_FOUND");
    });
  }

  @Test
  void kernelUnreachableReturns502()
      throws Exception {
    ProjectId id = seedProjectWithDraft();
    // Simulate the RMI registry being down: portal.login throws.
    doThrowOnLogin();
    JavalinTest.test(app, (server, client) -> {
      var response = client.post(
          "/api/v1/plant-models/publish",
          Map.of("projectId", id.value(), "dryRun", false)
      );
      assertThat(response.code()).isEqualTo(502);
      JsonNode root = new ObjectMapper().readTree(response.body().string());
      assertThat(root.get("code").asText()).isEqualTo("KERNEL_UNREACHABLE");
      assertThat(root.get("message").asText()).contains("Kernel unreachable");
    });
    verify(portal).logout(); // even on failure, we always release the portal.
  }

  private void doThrowOnLogin() {
    org.mockito.Mockito.doThrow(new RuntimeException("connect refused"))
        .when(portal).login(anyString(), anyInt());
  }
}
