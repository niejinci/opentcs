// SPDX-FileCopyrightText: The openTCS Authors
// SPDX-License-Identifier: MIT
package org.opentcs.bff.charging;

import static java.util.Objects.requireNonNull;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.SerializationFeature;
import com.fasterxml.jackson.datatype.jsr310.JavaTimeModule;
import com.google.inject.Singleton;
import jakarta.inject.Inject;
import java.io.IOException;
import java.nio.file.AtomicMoveNotSupportedException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.nio.file.StandardCopyOption;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Locale;
import java.util.Optional;
import org.opentcs.bff.project.BffWorkspaceConfiguration;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

/**
 * Filesystem-backed charging pile registry store.
 *
 * <p>PR1 stores charging-pile business metadata only. The openTCS Point/Location/LocType mapping
 * fields are persisted here so later PRs can materialise or validate them against the plant model.
 */
@Singleton
public class ChargingPileStore {

  /**
   * Workspace sub-directory for charging pile JSON files.
   */
  public static final String CHARGING_DIRNAME = "charging";

  /**
   * Charging pile registry file name under {@link #CHARGING_DIRNAME}.
   */
  public static final String PILES_FILENAME = "charging-piles.json";

  private static final Logger LOG = LoggerFactory.getLogger(ChargingPileStore.class);
  private static final String DEFAULT_LOCATION_TYPE_NAME = "CHARGER";
  private static final String DEFAULT_OPERATION = "CHARGE";
  private static final String DEFAULT_RUNTIME_STATUS = "UNKNOWN";
  private static final String DEFAULT_OCCUPANCY_STATUS = "FREE";
  private static final List<String> RUNTIME_STATUSES = List.of(
      "UNKNOWN",
      "IDLE",
      "CHARGING",
      "FAULT",
      "OFFLINE"
  );
  private static final List<String> OCCUPANCY_STATUSES = List.of(
      "FREE",
      "OCCUPIED",
      "DISABLED"
  );
  private static final DateTimeFormatter TABLE_TIME_FORMATTER
      = DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss");

  private final ObjectMapper objectMapper;
  private final Path chargingRoot;
  private final Path pilesFile;

  /**
   * Creates a new store under the configured BFF workspace directory.
   *
   * @param configuration The workspace configuration.
   */
  @Inject
  public ChargingPileStore(BffWorkspaceConfiguration configuration) {
    this(Paths.get(requireNonNull(configuration, "configuration").dir()));
  }

  /**
   * Constructor for tests and advanced callers.
   *
   * @param workspaceRoot The BFF workspace root.
   */
  public ChargingPileStore(Path workspaceRoot) {
    Path root = requireNonNull(workspaceRoot, "workspaceRoot").toAbsolutePath().normalize();
    this.chargingRoot = root.resolve(CHARGING_DIRNAME).normalize();
    this.pilesFile = chargingRoot.resolve(PILES_FILENAME);
    this.objectMapper = new ObjectMapper()
        .registerModule(new JavaTimeModule())
        .disable(SerializationFeature.WRITE_DATES_AS_TIMESTAMPS)
        .enable(SerializationFeature.INDENT_OUTPUT);
    try {
      Files.createDirectories(chargingRoot);
    }
    catch (IOException e) {
      throw new ChargingPileFileException(
          "Failed to create charging pile directory: " + chargingRoot, e
      );
    }
    LOG.info("Charging pile workspace root: {}", chargingRoot);
  }

  /**
   * Lists all persisted charging piles.
   *
   * @return The charging piles sorted by update time descending.
   */
  public synchronized List<ChargingPileDto> list() {
    List<ChargingPileDto> result = new ArrayList<>(readEnvelope().chargingPiles());
    result.sort(Comparator.comparing(ChargingPileDto::updatedAt).reversed());
    return result;
  }

  /**
   * Creates a charging pile and persists the registry JSON file.
   *
   * @param request The requested charging pile.
   * @return The persisted charging pile.
   */
  public synchronized ChargingPileDto create(ChargingPileDto request) {
    ChargingPilesEnvelope envelope = readEnvelope();
    List<ChargingPileDto> current = new ArrayList<>(envelope.chargingPiles());
    ChargingPileDto record = normalizePile(request, null, null);
    ensureUnique(current, record, null);
    current.add(record);
    writeEnvelope(new ChargingPilesEnvelope(current));
    return record;
  }

  /**
   * Updates an existing charging pile and persists the registry JSON file.
   *
   * @param id The charging pile id path parameter.
   * @param request The requested replacement.
   * @return The persisted charging pile.
   */
  public synchronized ChargingPileDto update(String id, ChargingPileDto request) {
    String safeId = requireText(id, "id");
    ChargingPilesEnvelope envelope = readEnvelope();
    List<ChargingPileDto> current = new ArrayList<>(envelope.chargingPiles());
    int index = indexOfId(current, safeId)
        .orElseThrow(
            () -> new ChargingPileNotFoundException(
                "Charging pile '" + safeId + "' not found."
            )
        );
    ChargingPileDto previous = current.get(index);
    ChargingPileDto record = normalizePile(request, safeId, previous);
    ensureUnique(current, record, safeId);
    current.set(index, record);
    writeEnvelope(new ChargingPilesEnvelope(current));
    return record;
  }

  /**
   * Deletes a charging pile.
   *
   * @param id The charging pile id path parameter.
   */
  public synchronized void delete(String id) {
    String safeId = requireText(id, "id");
    ChargingPilesEnvelope envelope = readEnvelope();
    List<ChargingPileDto> current = new ArrayList<>(envelope.chargingPiles());
    int index = indexOfId(current, safeId)
        .orElseThrow(
            () -> new ChargingPileNotFoundException(
                "Charging pile '" + safeId + "' not found."
            )
        );
    current.remove(index);
    writeEnvelope(new ChargingPilesEnvelope(current));
  }

  /**
   * Replaces the full registry content with the given records.
   *
   * <p>Used by the runtime projector to persist occupancy/runtime state without touching the
   * mapping metadata managed by the CRUD endpoints.
   *
   * @param records The replacement registry content.
   */
  synchronized void replaceAllRecords(List<ChargingPileDto> records) {
    requireNonNull(records, "records");
    writeEnvelope(new ChargingPilesEnvelope(List.copyOf(records)));
  }

  private ChargingPilesEnvelope readEnvelope() {
    ensureFile();
    try {
      ChargingPilesEnvelope envelope = objectMapper.readValue(
          Files.readAllBytes(pilesFile), ChargingPilesEnvelope.class
      );
      if (envelope.chargingPiles() == null) {
        throw new ChargingPileFileException(
            "Charging pile JSON must contain ChargingPiles array.", null
        );
      }
      return envelope;
    }
    catch (IOException e) {
      throw new ChargingPileFileException("Failed to read charging pile JSON: " + pilesFile, e);
    }
  }

  private void ensureFile() {
    try {
      Files.createDirectories(chargingRoot);
      if (!Files.exists(pilesFile)) {
        writeEnvelope(new ChargingPilesEnvelope(List.of()));
      }
    }
    catch (IOException e) {
      throw new ChargingPileFileException("Failed to initialise charging pile JSON file.", e);
    }
  }

  private ChargingPileDto normalizePile(
      ChargingPileDto request,
      String existingId,
      ChargingPileDto previous
  ) {
    requireNonNull(request, "request");
    String id = safe(existingId).isBlank() ? safe(request.id()) : existingId;
    if (id.isBlank()) {
      id = "cp-" + Long.toString(System.currentTimeMillis(), 36);
    }

    String name = requireText(request.name(), "name");
    String region = requireText(request.region(), "region");
    String mapName = requireText(request.mapName(), "mapName");
    String boundPointName = requireText(request.boundPointName(), "boundPointName");
    boolean enabled = request.enabled() == null || request.enabled();
    String locationName = safe(request.locationName()).isBlank()
        ? name
        : safe(request.locationName());
    String locationTypeName = safe(request.locationTypeName()).isBlank()
        ? DEFAULT_LOCATION_TYPE_NAME
        : safe(request.locationTypeName());
    String operation = safe(request.operation()).isBlank()
        ? DEFAULT_OPERATION
        : safe(request.operation());
    String runtimeStatus = normalizeEnum(
        request.runtimeStatus(), DEFAULT_RUNTIME_STATUS, RUNTIME_STATUSES, "runtimeStatus"
    );
    String occupancyStatus = normalizeOccupancyStatus(request.occupancyStatus(), enabled);
    String occupiedByVehicle = "OCCUPIED".equals(occupancyStatus)
        ? safe(request.occupiedByVehicle())
        : "";
    String activeOrderName = "OCCUPIED".equals(occupancyStatus)
        ? safe(request.activeOrderName())
        : "";
    String chargingSince = "OCCUPIED".equals(occupancyStatus)
        ? safe(request.chargingSince())
        : "";

    ChargingPileDto normalized = new ChargingPileDto(
        id,
        name,
        region,
        mapName,
        boundPointName,
        locationName,
        locationTypeName,
        operation,
        safe(request.chargerType()),
        safe(request.sn()),
        safe(request.ip()),
        enabled,
        runtimeStatus,
        occupancyStatus,
        occupiedByVehicle,
        activeOrderName,
        chargingSince,
        false,
        nowForTable()
    );
    return withRequiresPublish(normalized, requestedRequiresPublish(request), previous);
  }

  private String normalizeOccupancyStatus(String value, boolean enabled) {
    if (!enabled) {
      return "DISABLED";
    }
    String normalized = normalizeEnum(
        value, DEFAULT_OCCUPANCY_STATUS, OCCUPANCY_STATUSES, "occupancyStatus"
    );
    return "DISABLED".equals(normalized) ? DEFAULT_OCCUPANCY_STATUS : normalized;
  }

  private String normalizeEnum(
      String value,
      String defaultValue,
      List<String> allowedValues,
      String field
  ) {
    String normalized = safe(value);
    if (normalized.isBlank()) {
      return defaultValue;
    }
    String lower = normalized.toLowerCase(Locale.ROOT);
    for (String allowed : allowedValues) {
      if (allowed.toLowerCase(Locale.ROOT).equals(lower)) {
        return allowed;
      }
    }
    throw new IllegalArgumentException(
        "Field '" + field + "' must be one of: " + String.join(", ", allowedValues) + "."
    );
  }

  private ChargingPileDto withRequiresPublish(
      ChargingPileDto normalized,
      Boolean requestedRequiresPublish,
      ChargingPileDto previous
  ) {
    boolean requiresPublish = requestedRequiresPublish == null
        ? previous == null || Boolean.TRUE.equals(previous.requiresPublish())
        : requestedRequiresPublish;
    if (previous == null || mappingChanged(previous, normalized)) {
      requiresPublish = true;
    }
    return new ChargingPileDto(
        normalized.id(),
        normalized.name(),
        normalized.region(),
        normalized.mapName(),
        normalized.boundPointName(),
        normalized.locationName(),
        normalized.locationTypeName(),
        normalized.operation(),
        normalized.chargerType(),
        normalized.sn(),
        normalized.ip(),
        normalized.enabled(),
        normalized.runtimeStatus(),
        normalized.occupancyStatus(),
        normalized.occupiedByVehicle(),
        normalized.activeOrderName(),
        normalized.chargingSince(),
        requiresPublish,
        normalized.updatedAt()
    );
  }

  private void ensureUnique(
      List<ChargingPileDto> records,
      ChargingPileDto candidate,
      String exceptId
  ) {
    for (ChargingPileDto record : records) {
      if (safe(record.id()).equals(safe(exceptId))) {
        continue;
      }
      if (equalsIgnoreCase(record.id(), candidate.id())) {
        throw new ChargingPileConflictException(
            "Charging pile id '" + candidate.id() + "' already exists."
        );
      }
      if (equalsIgnoreCase(record.name(), candidate.name())) {
        throw new ChargingPileConflictException(
            "Charging pile name '" + candidate.name() + "' already exists."
        );
      }
      if (equalsIgnoreCase(record.boundPointName(), candidate.boundPointName())) {
        throw new ChargingPileConflictException(
            "Charging pile point '" + candidate.boundPointName() + "' is already bound."
        );
      }
      if (!safe(candidate.sn()).isBlank() && equalsIgnoreCase(record.sn(), candidate.sn())) {
        throw new ChargingPileConflictException(
            "Charging pile SN '" + candidate.sn() + "' already exists."
        );
      }
      if (!safe(candidate.ip()).isBlank() && equalsIgnoreCase(record.ip(), candidate.ip())) {
        throw new ChargingPileConflictException(
            "Charging pile IP '" + candidate.ip() + "' already exists."
        );
      }
    }
  }

  private Optional<Integer> indexOfId(List<ChargingPileDto> records, String id) {
    for (int i = 0; i < records.size(); i++) {
      if (safe(records.get(i).id()).equals(id)) {
        return Optional.of(i);
      }
    }
    return Optional.empty();
  }

  private boolean mappingChanged(ChargingPileDto previous, ChargingPileDto next) {
    return !equalsIgnoreCase(previous.region(), next.region())
        || !equalsIgnoreCase(previous.mapName(), next.mapName())
        || !equalsIgnoreCase(previous.boundPointName(), next.boundPointName())
        || !equalsIgnoreCase(previous.locationName(), next.locationName())
        || !equalsIgnoreCase(previous.locationTypeName(), next.locationTypeName())
        || !equalsIgnoreCase(previous.operation(), next.operation());
  }

  private void writeEnvelope(ChargingPilesEnvelope envelope) {
    try {
      writeAtomically(pilesFile, objectMapper.writeValueAsBytes(envelope));
    }
    catch (IOException e) {
      throw new ChargingPileFileException("Failed to write charging pile JSON: " + pilesFile, e);
    }
  }

  private void writeAtomically(Path target, byte[] bytes)
      throws IOException {
    Path dir = requireNonNull(target.getParent(), "target.getParent()");
    Files.createDirectories(dir);
    Path tmp = Files.createTempFile(dir, ".tmp-", ".swap");
    try {
      Files.write(tmp, bytes);
      try {
        Files.move(
            tmp,
            target,
            StandardCopyOption.ATOMIC_MOVE,
            StandardCopyOption.REPLACE_EXISTING
        );
      }
      catch (AtomicMoveNotSupportedException ignored) {
        Files.move(tmp, target, StandardCopyOption.REPLACE_EXISTING);
      }
    }
    catch (IOException e) {
      Files.deleteIfExists(tmp);
      throw e;
    }
  }

  private Boolean requestedRequiresPublish(ChargingPileDto request) {
    return request.requiresPublish();
  }

  private String requireText(String value, String field) {
    String trimmed = safe(value);
    if (trimmed.isBlank()) {
      throw new IllegalArgumentException("Field '" + field + "' is required.");
    }
    return trimmed;
  }

  private static String safe(String value) {
    return value == null ? "" : value.trim();
  }

  private static boolean equalsIgnoreCase(String left, String right) {
    return safe(left).equalsIgnoreCase(safe(right));
  }

  private static String nowForTable() {
    return LocalDateTime.now().format(TABLE_TIME_FORMATTER);
  }
}
