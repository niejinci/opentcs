// SPDX-FileCopyrightText: The openTCS Authors
// SPDX-License-Identifier: MIT
package org.opentcs.bff.warehouse;

import static java.util.Objects.requireNonNull;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.SerializationFeature;
import com.fasterxml.jackson.datatype.jsr310.JavaTimeModule;
import com.google.inject.Singleton;
import jakarta.inject.Inject;
import java.io.IOException;
import java.io.InputStream;
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
 * Filesystem-backed warehouse type/rack store.
 *
 * <p>The type file deliberately keeps the BYD wrapper shape {@code {"WaresType": [...]}}. Rack
 * instances live in a separate file so runtime rack state does not pollute type definitions.
 */
@Singleton
public class WarehouseStore {

  /**
   * Workspace sub-directory for warehouse JSON files.
   */
  public static final String WAREHOUSE_DIRNAME = "warehouse";

  /**
   * BYD warehouse type file name under {@link #WAREHOUSE_DIRNAME}.
   */
  public static final String TYPES_FILENAME = "BYD-1500_ware_type.json";

  /**
   * Rack instance file name under {@link #WAREHOUSE_DIRNAME}.
   */
  public static final String RACKS_FILENAME = "warehouse-racks.json";

  private static final Logger LOG = LoggerFactory.getLogger(WarehouseStore.class);
  private static final String DEFAULT_VERSION = "1.0.1.0";
  private static final String DEFAULT_REGION = "深圳焊装";
  private static final String WAREHOUSE_KIND_RACK = "货架";
  private static final DateTimeFormatter TABLE_TIME_FORMATTER
      = DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss");

  private final ObjectMapper objectMapper;
  private final Path warehouseRoot;
  private final Path typesFile;
  private final Path racksFile;

  /**
   * Creates a new store under the configured BFF workspace directory.
   *
   * @param configuration The workspace configuration.
   */
  @Inject
  public WarehouseStore(BffWorkspaceConfiguration configuration) {
    this(Paths.get(requireNonNull(configuration, "configuration").dir()));
  }

  /**
   * Constructor for tests and advanced callers.
   *
   * @param workspaceRoot The BFF workspace root.
   */
  public WarehouseStore(Path workspaceRoot) {
    Path root = requireNonNull(workspaceRoot, "workspaceRoot").toAbsolutePath().normalize();
    this.warehouseRoot = root.resolve(WAREHOUSE_DIRNAME).normalize();
    this.typesFile = warehouseRoot.resolve(TYPES_FILENAME);
    this.racksFile = warehouseRoot.resolve(RACKS_FILENAME);
    this.objectMapper = new ObjectMapper()
        .registerModule(new JavaTimeModule())
        .disable(SerializationFeature.WRITE_DATES_AS_TIMESTAMPS)
        .enable(SerializationFeature.INDENT_OUTPUT);
    try {
      Files.createDirectories(warehouseRoot);
    }
    catch (IOException e) {
      throw new WarehouseFileException("Failed to create warehouse directory: " + warehouseRoot, e);
    }
    LOG.info("Warehouse workspace root: {}", warehouseRoot);
  }

  /**
   * Lists all warehouse types.
   *
   * @return The warehouse types sorted by type id descending.
   */
  public synchronized List<WarehouseTypeDto> listTypes() {
    List<WarehouseTypeDto> result = new ArrayList<>(readTypesEnvelope().waresType());
    result.sort(Comparator.comparingInt((WarehouseTypeDto type) -> parseTypeId(type.id())).reversed());
    return result;
  }

  /**
   * Creates a warehouse type and persists the BYD JSON file.
   *
   * @param request The requested warehouse type.
   * @return The persisted warehouse type.
   */
  public synchronized WarehouseTypeDto createType(WarehouseTypeDto request) {
    WarehouseTypesEnvelope envelope = readTypesEnvelope();
    List<WarehouseTypeDto> current = new ArrayList<>(envelope.waresType());
    WarehouseTypeDto record = normalizeType(request, null, current);
    ensureUniqueType(current, record, null);
    current.add(record);
    writeTypesEnvelope(new WarehouseTypesEnvelope(current, versionOf(envelope)));
    return record;
  }

  /**
   * Updates an existing warehouse type and persists the BYD JSON file.
   *
   * @param id The type id path parameter.
   * @param request The requested replacement.
   * @return The persisted warehouse type.
   */
  public synchronized WarehouseTypeDto updateType(String id, WarehouseTypeDto request) {
    String safeId = requireText(id, "id");
    WarehouseTypesEnvelope envelope = readTypesEnvelope();
    List<WarehouseTypeDto> current = new ArrayList<>(envelope.waresType());
    int index = indexOfTypeId(current, safeId)
        .orElseThrow(() -> new WarehouseNotFoundException("Warehouse type '" + safeId + "' not found."));
    WarehouseTypeDto previous = current.get(index);
    WarehouseTypeDto record = normalizeType(withTypeId(request, previous.id()), previous.id(), current);
    ensureUniqueType(current, record, previous.id());
    current.set(index, record);
    writeTypesEnvelope(new WarehouseTypesEnvelope(current, versionOf(envelope)));
    if (!equalsIgnoreCase(previous.name(), record.name()) || !safe(previous.wareModel()).equals(record.wareModel())) {
      rewriteRacksForType(previous.name(), record.name(), record.wareModel());
    }
    return record;
  }

  /**
   * Deletes a warehouse type if no rack instance references it.
   *
   * @param id The type id path parameter.
   */
  public synchronized void deleteType(String id) {
    String safeId = requireText(id, "id");
    WarehouseTypesEnvelope envelope = readTypesEnvelope();
    List<WarehouseTypeDto> current = new ArrayList<>(envelope.waresType());
    int index = indexOfTypeId(current, safeId)
        .orElseThrow(() -> new WarehouseNotFoundException("Warehouse type '" + safeId + "' not found."));
    WarehouseTypeDto record = current.get(index);
    if (readRacksEnvelope().wareRacks().stream().anyMatch(rack -> equalsIgnoreCase(rack.typeCode(), record.name()))) {
      throw new WarehouseConflictException(
          "Warehouse type '" + record.name() + "' is referenced by rack instances."
      );
    }
    current.remove(index);
    writeTypesEnvelope(new WarehouseTypesEnvelope(current, versionOf(envelope)));
  }

  /**
   * Lists all persisted rack instances.
   *
   * @return The rack instances sorted by update time descending.
   */
  public synchronized List<WarehouseRackDto> listRacks() {
    List<WarehouseRackDto> result = new ArrayList<>(readRacksEnvelope().wareRacks());
    result.sort(Comparator.comparing(WarehouseRackDto::updatedAt).reversed());
    return result;
  }

  /**
   * Creates a rack instance and persists the rack JSON file.
   *
   * @param request The requested rack instance.
   * @return The persisted rack instance.
   */
  public synchronized WarehouseRackDto createRack(WarehouseRackDto request) {
    WarehouseRacksEnvelope envelope = readRacksEnvelope();
    List<WarehouseRackDto> current = new ArrayList<>(envelope.wareRacks());
    WarehouseRackDto record = normalizeRack(request, null);
    ensureUniqueRack(current, record, null);
    current.add(record);
    writeRacksEnvelope(new WarehouseRacksEnvelope(current));
    return record;
  }

  /**
   * Updates a rack instance and persists the rack JSON file.
   *
   * @param id The rack id path parameter.
   * @param request The requested replacement.
   * @return The persisted rack instance.
   */
  public synchronized WarehouseRackDto updateRack(String id, WarehouseRackDto request) {
    String safeId = requireText(id, "id");
    WarehouseRacksEnvelope envelope = readRacksEnvelope();
    List<WarehouseRackDto> current = new ArrayList<>(envelope.wareRacks());
    int index = indexOfRackId(current, safeId)
        .orElseThrow(() -> new WarehouseNotFoundException("Warehouse rack '" + safeId + "' not found."));
    WarehouseRackDto record = normalizeRack(withRackId(request, safeId), safeId);
    ensureUniqueRack(current, record, safeId);
    current.set(index, record);
    writeRacksEnvelope(new WarehouseRacksEnvelope(current));
    return record;
  }

  /**
   * Deletes a rack instance.
   *
   * @param id The rack id path parameter.
   */
  public synchronized void deleteRack(String id) {
    String safeId = requireText(id, "id");
    WarehouseRacksEnvelope envelope = readRacksEnvelope();
    List<WarehouseRackDto> current = new ArrayList<>(envelope.wareRacks());
    int index = indexOfRackId(current, safeId)
        .orElseThrow(() -> new WarehouseNotFoundException("Warehouse rack '" + safeId + "' not found."));
    current.remove(index);
    writeRacksEnvelope(new WarehouseRacksEnvelope(current));
  }

  private WarehouseTypesEnvelope readTypesEnvelope() {
    ensureSeedFiles();
    try {
      WarehouseTypesEnvelope envelope = objectMapper.readValue(
          Files.readAllBytes(typesFile), WarehouseTypesEnvelope.class
      );
      if (envelope.waresType() == null) {
        throw new WarehouseFileException("Warehouse type JSON must contain WaresType array.", null);
      }
      return new WarehouseTypesEnvelope(envelope.waresType(), versionOf(envelope));
    }
    catch (IOException e) {
      throw new WarehouseFileException("Failed to read warehouse type JSON: " + typesFile, e);
    }
  }

  private WarehouseRacksEnvelope readRacksEnvelope() {
    ensureSeedFiles();
    try {
      WarehouseRacksEnvelope envelope = objectMapper.readValue(
          Files.readAllBytes(racksFile), WarehouseRacksEnvelope.class
      );
      if (envelope.wareRacks() == null) {
        throw new WarehouseFileException("Warehouse rack JSON must contain WareRacks array.", null);
      }
      return envelope;
    }
    catch (IOException e) {
      throw new WarehouseFileException("Failed to read warehouse rack JSON: " + racksFile, e);
    }
  }

  private void ensureSeedFiles() {
    try {
      Files.createDirectories(warehouseRoot);
      if (!Files.exists(typesFile)) {
        writeTypesEnvelope(loadDefaultTypesEnvelope());
      }
      if (!Files.exists(racksFile)) {
        writeRacksEnvelope(new WarehouseRacksEnvelope(List.of(defaultRack())));
      }
    }
    catch (IOException e) {
      throw new WarehouseFileException("Failed to initialise warehouse JSON files.", e);
    }
  }

  private WarehouseTypesEnvelope loadDefaultTypesEnvelope() {
    try (InputStream input = getClass().getResourceAsStream("/org/opentcs/bff/warehouse/BYD-1500_ware_type.json")) {
      if (input != null) {
        WarehouseTypesEnvelope envelope = objectMapper.readValue(input, WarehouseTypesEnvelope.class);
        if (envelope.waresType() != null && !envelope.waresType().isEmpty()) {
          return new WarehouseTypesEnvelope(envelope.waresType(), versionOf(envelope));
        }
      }
    }
    catch (IOException e) {
      LOG.warn("Failed to load bundled warehouse type seed; falling back to the first sample.", e);
    }
    return new WarehouseTypesEnvelope(List.of(defaultType()), DEFAULT_VERSION);
  }

  private WarehouseTypeDto normalizeType(
      WarehouseTypeDto request,
      String existingId,
      List<WarehouseTypeDto> existing
  ) {
    requireNonNull(request, "request");
    WarehouseLoadDetectDto detect = normalizeLoadDetect(request.loadDetect());
    String id = safe(existingId).isBlank() ? safe(request.id()) : existingId;
    if (id.isBlank()) {
      id = String.valueOf(nextTypeId(existing));
    }
    String code = requireText(request.name(), "Name");
    String model = requireText(request.wareModel(), "WareModel");
    int idNumber = parseTypeId(id);
    if (idNumber < detect.qrCodeMin() || idNumber > detect.qrCodeMax()) {
      throw new IllegalArgumentException("Id must be within LoadDetect.QrCodeMin and LoadDetect.QrCodeMax.");
    }
    return new WarehouseTypeDto(
        request.qrCenterLeft(),
        detect,
        request.qrCenterBack(),
        model,
        positive(request.legLength(), "LegLength"),
        730,
        positive(request.legInnerWidth(), "LegInnerWidth"),
        0,
        positive(request.legInnerLength(), "LegInnerLength"),
        code,
        request.qrCenterFront(),
        positive(request.legHeight(), "LegHeight"),
        "NoRectify",
        positive(request.length(), "Length"),
        positive(request.legWidth(), "LegWidth"),
        false,
        270,
        positive(request.height(), "Height"),
        id,
        "Front",
        positive(request.width(), "Width"),
        false
    );
  }

  private WarehouseLoadDetectDto normalizeLoadDetect(WarehouseLoadDetectDto request) {
    boolean loadSensor = request == null || request.loadSensor();
    boolean qrSensor = request == null || request.qrCodeSensor();
    int qrMin = request == null ? 0 : request.qrCodeMin();
    int qrMax = request == null ? 99999999 : request.qrCodeMax();
    if (qrMin < 0 || qrMax < qrMin) {
      throw new IllegalArgumentException("LoadDetect QR code range is invalid.");
    }
    return new WarehouseLoadDetectDto(25, loadSensor, -1, qrSensor, qrMin, qrMax);
  }

  private WarehouseRackDto normalizeRack(WarehouseRackDto request, String existingId) {
    requireNonNull(request, "request");
    String id = safe(existingId).isBlank() ? safe(request.id()) : existingId;
    if (id.isBlank()) {
      id = "wr-" + Long.toString(System.currentTimeMillis(), 36);
    }
    String typeCode = requireText(request.typeCode(), "typeCode");
    WarehouseTypeDto type = findTypeByCode(typeCode)
        .orElseThrow(() -> new IllegalArgumentException("Unknown warehouse type: " + typeCode));
    return new WarehouseRackDto(
        id,
        requireText(request.name(), "name"),
        requireText(request.code(), "code"),
        safe(request.carrierBottomCode()),
        type.name(),
        type.wareModel(),
        WAREHOUSE_KIND_RACK,
        safe(request.region()).isBlank() ? DEFAULT_REGION : safe(request.region()),
        requireText(request.mapName(), "mapName"),
        safe(request.storageCode()),
        safe(request.locationName()).isBlank() ? "-" : safe(request.locationName()),
        safe(request.lockStatus()).isBlank() ? "未锁定" : safe(request.lockStatus()),
        safe(request.emptyStatus()).isBlank() ? "空" : safe(request.emptyStatus()),
        safe(request.vehicleName()),
        safe(request.containerInfo()),
        request.enabled(),
        nowForTable()
    );
  }

  private Optional<WarehouseTypeDto> findTypeByCode(String code) {
    String normalized = safe(code).toLowerCase(Locale.ROOT);
    return readTypesEnvelope().waresType().stream()
        .filter(type -> safe(type.name()).toLowerCase(Locale.ROOT).equals(normalized))
        .findFirst();
  }

  private void rewriteRacksForType(String oldTypeCode, String newTypeCode, String newTypeName) {
    WarehouseRacksEnvelope envelope = readRacksEnvelope();
    List<WarehouseRackDto> rewritten = envelope.wareRacks().stream()
        .map(rack -> equalsIgnoreCase(rack.typeCode(), oldTypeCode)
            ? new WarehouseRackDto(
                rack.id(),
                rack.name(),
                rack.code(),
                rack.carrierBottomCode(),
                newTypeCode,
                newTypeName,
                rack.warehouseKind(),
                rack.region(),
                rack.mapName(),
                rack.storageCode(),
                rack.locationName(),
                rack.lockStatus(),
                rack.emptyStatus(),
                rack.vehicleName(),
                rack.containerInfo(),
                rack.enabled(),
                nowForTable()
            )
            : rack)
        .toList();
    writeRacksEnvelope(new WarehouseRacksEnvelope(rewritten));
  }

  private void ensureUniqueType(
      List<WarehouseTypeDto> records,
      WarehouseTypeDto candidate,
      String exceptId
  ) {
    for (WarehouseTypeDto record : records) {
      if (safe(record.id()).equals(safe(exceptId))) {
        continue;
      }
      if (equalsIgnoreCase(record.id(), candidate.id())) {
        throw new WarehouseConflictException("Warehouse type id '" + candidate.id() + "' already exists.");
      }
      if (equalsIgnoreCase(record.name(), candidate.name())) {
        throw new WarehouseConflictException("Warehouse type code '" + candidate.name() + "' already exists.");
      }
    }
  }

  private void ensureUniqueRack(
      List<WarehouseRackDto> records,
      WarehouseRackDto candidate,
      String exceptId
  ) {
    for (WarehouseRackDto record : records) {
      if (safe(record.id()).equals(safe(exceptId))) {
        continue;
      }
      if (equalsIgnoreCase(record.id(), candidate.id())) {
        throw new WarehouseConflictException("Warehouse rack id '" + candidate.id() + "' already exists.");
      }
      if (equalsIgnoreCase(record.code(), candidate.code())) {
        throw new WarehouseConflictException("Warehouse rack code '" + candidate.code() + "' already exists.");
      }
    }
  }

  private Optional<Integer> indexOfTypeId(List<WarehouseTypeDto> records, String id) {
    for (int i = 0; i < records.size(); i++) {
      if (safe(records.get(i).id()).equals(id)) {
        return Optional.of(i);
      }
    }
    return Optional.empty();
  }

  private Optional<Integer> indexOfRackId(List<WarehouseRackDto> records, String id) {
    for (int i = 0; i < records.size(); i++) {
      if (safe(records.get(i).id()).equals(id)) {
        return Optional.of(i);
      }
    }
    return Optional.empty();
  }

  private int nextTypeId(List<WarehouseTypeDto> records) {
    return records.stream()
        .map(WarehouseTypeDto::id)
        .mapToInt(id -> {
          try {
            return Integer.parseInt(safe(id));
          }
          catch (NumberFormatException ignored) {
            return 0;
          }
        })
        .max()
        .orElse(0) + 1;
  }

  private WarehouseTypeDto withTypeId(WarehouseTypeDto dto, String id) {
    return new WarehouseTypeDto(
        dto.qrCenterLeft(),
        dto.loadDetect(),
        dto.qrCenterBack(),
        dto.wareModel(),
        dto.legLength(),
        dto.putHeight(),
        dto.legInnerWidth(),
        dto.collisionAvoidanceAreaType(),
        dto.legInnerLength(),
        dto.name(),
        dto.qrCenterFront(),
        dto.legHeight(),
        dto.qrCodeRectifyType(),
        dto.length(),
        dto.legWidth(),
        dto.allowRotate(),
        dto.pickHeight(),
        dto.height(),
        id,
        dto.defaultOrientationType(),
        dto.width(),
        dto.manageable()
    );
  }

  private WarehouseRackDto withRackId(WarehouseRackDto dto, String id) {
    return new WarehouseRackDto(
        id,
        dto.name(),
        dto.code(),
        dto.carrierBottomCode(),
        dto.typeCode(),
        dto.typeName(),
        dto.warehouseKind(),
        dto.region(),
        dto.mapName(),
        dto.storageCode(),
        dto.locationName(),
        dto.lockStatus(),
        dto.emptyStatus(),
        dto.vehicleName(),
        dto.containerInfo(),
        dto.enabled(),
        dto.updatedAt()
    );
  }

  private WarehouseTypeDto defaultType() {
    return new WarehouseTypeDto(
        null,
        new WarehouseLoadDetectDto(25, true, -1, true, 0, 99999999),
        null,
        "后地板面板总成货架",
        100,
        730,
        1000,
        0,
        1000,
        "HJ27HDBMBZC",
        null,
        100,
        "NoRectify",
        1950,
        100,
        false,
        270,
        1000,
        "29",
        "Front",
        1200,
        false
    );
  }

  private WarehouseRackDto defaultRack() {
    WarehouseTypeDto type = loadDefaultTypesEnvelope().waresType().get(0);
    return new WarehouseRackDto(
        "1",
        type.wareModel() + "001",
        "HJ27_HDBMBZC_001",
        "257",
        type.name(),
        type.wareModel(),
        WAREHOUSE_KIND_RACK,
        DEFAULT_REGION,
        "HZ27",
        "",
        "-",
        "未锁定",
        "空",
        "",
        "",
        true,
        "2026-06-24 17:05:23"
    );
  }

  private void writeTypesEnvelope(WarehouseTypesEnvelope envelope) {
    try {
      writeAtomically(typesFile, objectMapper.writeValueAsBytes(envelope));
    }
    catch (IOException e) {
      throw new WarehouseFileException("Failed to write warehouse type JSON: " + typesFile, e);
    }
  }

  private void writeRacksEnvelope(WarehouseRacksEnvelope envelope) {
    try {
      writeAtomically(racksFile, objectMapper.writeValueAsBytes(envelope));
    }
    catch (IOException e) {
      throw new WarehouseFileException("Failed to write warehouse rack JSON: " + racksFile, e);
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
        Files.move(tmp, target, StandardCopyOption.ATOMIC_MOVE, StandardCopyOption.REPLACE_EXISTING);
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

  private String versionOf(WarehouseTypesEnvelope envelope) {
    return safe(envelope.version()).isBlank() ? DEFAULT_VERSION : envelope.version();
  }

  private int positive(int value, String field) {
    if (value <= 0) {
      throw new IllegalArgumentException(field + " must be greater than 0.");
    }
    return value;
  }

  private int parseTypeId(String value) {
    try {
      return Integer.parseInt(requireText(value, "Id"));
    }
    catch (NumberFormatException e) {
      throw new IllegalArgumentException("Id must be an integer string.", e);
    }
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



