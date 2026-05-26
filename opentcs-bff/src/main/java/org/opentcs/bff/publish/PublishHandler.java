// SPDX-FileCopyrightText: The openTCS Authors
// SPDX-License-Identifier: MIT
package org.opentcs.bff.publish;

import static java.util.Objects.requireNonNull;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import io.javalin.http.Context;
import io.javalin.http.Handler;
import jakarta.inject.Inject;
import jakarta.inject.Singleton;
import java.time.Instant;
import org.opentcs.access.KernelServicePortal;
import org.opentcs.access.to.model.PlantModelCreationTO;
import org.opentcs.bff.kernel.BffKernelConfiguration;
import org.opentcs.bff.kernel.KernelServicePortalFactory;
import org.opentcs.bff.project.ProjectId;
import org.opentcs.bff.project.ProjectMetaDto;
import org.opentcs.bff.project.ProjectNotFoundException;
import org.opentcs.bff.project.ProjectStore;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

/**
 * Handles {@code POST /api/v1/plant-models/publish}.
 *
 * <p>Reads {@code projects/&lt;id&gt;/draft.json}, packs its {@code payload} into a
 * {@link PlantModelCreationTO} via {@link IntermediateJsonToPlantModelConverter}, and either:
 * <ul>
 * <li>{@code dryRun=true} → returns the validation result without touching the kernel,</li>
 * <li>{@code dryRun=false} → opens a fresh {@link KernelServicePortal}
 * ({@code login → createPlantModel → logout}), then records {@code lastPublishedAt} on
 * the project meta. The portal is <em>never</em> cached between requests.</li>
 * </ul>
 *
 * <p>Failure modes:
 * <ul>
 * <li>missing/invalid request → 400</li>
 * <li>project doesn't exist → 404</li>
 * <li>draft missing → 400 ({@code DRAFT_MISSING})</li>
 * <li>validation error → 400 with {@code fieldPath}</li>
 * <li>kernel unreachable / RMI failure → 502 ({@code KERNEL_UNREACHABLE})</li>
 * </ul>
 * No matter what fails, the on-disk draft is never modified.
 */
@Singleton
public class PublishHandler
    implements
      Handler {

  private static final Logger LOG = LoggerFactory.getLogger(PublishHandler.class);

  private final ProjectStore projectStore;
  private final KernelServicePortalFactory portalFactory;
  private final BffKernelConfiguration kernelConfig;
  private final ObjectMapper objectMapper;

  /**
   * Creates a new instance.
   *
   * @param projectStore Source of the draft + meta files.
   * @param portalFactory Factory for fresh kernel portals (one per publish).
   * @param kernelConfig Kernel host/port/credentials.
   * @param objectMapper Jackson mapper used to parse the incoming request body.
   */
  @Inject
  public PublishHandler(
      ProjectStore projectStore,
      KernelServicePortalFactory portalFactory,
      BffKernelConfiguration kernelConfig,
      ObjectMapper objectMapper
  ) {
    this.projectStore = requireNonNull(projectStore, "projectStore");
    this.portalFactory = requireNonNull(portalFactory, "portalFactory");
    this.kernelConfig = requireNonNull(kernelConfig, "kernelConfig");
    this.objectMapper = requireNonNull(objectMapper, "objectMapper");
  }

  @Override
  public void handle(Context ctx) {
    requireNonNull(ctx, "ctx");
    PublishRequest req;
    try {
      req = ctx.bodyAsClass(PublishRequest.class);
    }
    catch (Exception e) {
      throw new IllegalArgumentException("Invalid JSON in request body.", e);
    }
    if (req == null || req.projectId() == null || req.projectId().isBlank()) {
      throw new IllegalArgumentException("projectId is required.");
    }
    boolean dryRun = req.dryRun() != null && req.dryRun();
    ProjectId projectId = ProjectId.of(req.projectId());

    ProjectMetaDto meta = projectStore.find(projectId).orElseThrow(
        () -> new ProjectNotFoundException("Project '" + projectId.value() + "' not found.")
    );
    JsonNode envelope = projectStore.readDraft(projectId).orElseThrow(
        () -> new PublishValidationException(
            null, "Project '" + projectId.value() + "' has no draft to publish."
        )
    );
    JsonNode payload = envelope.path("payload");
    if (payload.isMissingNode() || payload.isNull()) {
      throw new PublishValidationException(
          "payload", "Draft envelope is missing the 'payload' field."
      );
    }
    String modelName = (req.modelName() != null && !req.modelName().isBlank())
        ? req.modelName()
        : meta.name();
    PlantModelCreationTO to = IntermediateJsonToPlantModelConverter.toCreationTO(
        payload, modelName
    );
    PublishResponse.PublishDiff diff = new PublishResponse.PublishDiff(
        to.getPoints().size(),
        to.getPaths().size(),
        to.getLocationTypes().size(),
        to.getLocations().size(),
        to.getBlocks().size(),
        to.getVehicles().size()
    );

    if (dryRun) {
      ctx.status(200);
      ctx.json(new PublishResponse(true, modelName, true, null, diff));
      return;
    }

    Instant publishedAt = sendToKernel(to);
    projectStore.markPublished(projectId, publishedAt);
    ctx.status(200);
    ctx.json(new PublishResponse(true, modelName, false, publishedAt, diff));
  }

  private Instant sendToKernel(PlantModelCreationTO to) {
    KernelServicePortal portal = portalFactory.create(
        kernelConfig.userName(), kernelConfig.password()
    );
    try {
      try {
        portal.login(kernelConfig.host(), kernelConfig.port());
      }
      catch (RuntimeException e) {
        throw new KernelUnreachableException(
            "Kernel unreachable at " + kernelConfig.host() + ":" + kernelConfig.port()
                + " (" + e.getMessage() + ")",
            e
        );
      }
      try {
        portal.getPlantModelService().createPlantModel(to);
      }
      catch (RuntimeException e) {
        throw new KernelUnreachableException(
            "Kernel rejected createPlantModel: " + e.getMessage(), e
        );
      }
      return Instant.now();
    }
    finally {
      try {
        portal.logout();
      }
      catch (RuntimeException e) {
        LOG.debug("Kernel portal logout failed (ignored): {}", e.toString());
      }
    }
  }
}
