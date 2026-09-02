// SPDX-FileCopyrightText: The openTCS Authors
// SPDX-License-Identifier: MIT
package org.opentcs.bff.charging;

import static java.util.Objects.requireNonNull;

import com.google.inject.Singleton;
import jakarta.inject.Inject;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;
import org.opentcs.data.TCSObject;
import org.opentcs.data.TCSObjectEvent;
import org.opentcs.data.model.Vehicle;
import org.opentcs.data.order.DriveOrder;
import org.opentcs.data.order.TransportOrder;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

/**
 * Projects kernel vehicle / transport-order events onto the charging-pile registry.
 *
 * <p>The BFF stores the business registry in {@code charging-piles.json}. This projector keeps
 * the runtime fields (occupancy, runtime status, charging start time) in sync with kernel events
 * so a browser refresh can still see the latest charging state.
 */
@Singleton
public class ChargingPileRuntimeProjector {

  private static final Logger LOG = LoggerFactory.getLogger(ChargingPileRuntimeProjector.class);

  private static final DateTimeFormatter TABLE_TIME_FORMATTER
      = DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss");

  private final ChargingPileStore store;
  private final Map<String, Vehicle> vehicles = new HashMap<>();
  private final Map<String, TransportOrder> transportOrders = new HashMap<>();

  /**
   * Creates a new projector.
   *
   * @param store The charging pile registry store to persist into.
   */
  @Inject
  public ChargingPileRuntimeProjector(ChargingPileStore store) {
    this.store = requireNonNull(store, "store");
  }

  /**
   * Applies a kernel event and persists any derived charging-pile runtime changes.
   *
   * @param event The kernel event to project.
   */
  public synchronized void apply(TCSObjectEvent event) {
    requireNonNull(event, "event");
    TCSObject<?> object = event.getCurrentOrPreviousObjectState();
    if (object instanceof Vehicle) {
      applyVehicleEvent(event);
    }
    else if (object instanceof TransportOrder) {
      applyTransportOrderEvent(event);
    }
  }

  private void applyVehicleEvent(TCSObjectEvent event) {
    Vehicle current = event.getCurrentObjectState() instanceof Vehicle vehicle ? vehicle : null;
    Vehicle previous = event.getPreviousObjectState() instanceof Vehicle vehicle ? vehicle : null;

    if (current != null) {
      vehicles.put(current.getName(), current);
    }
    else if (previous != null) {
      vehicles.remove(previous.getName());
    }

    reconcile();
  }

  private void applyTransportOrderEvent(TCSObjectEvent event) {
    TransportOrder current
        = event.getCurrentObjectState() instanceof TransportOrder order ? order : null;
    TransportOrder previous
        = event.getPreviousObjectState() instanceof TransportOrder order ? order : null;

    if (current != null && isActiveOrder(current)) {
      transportOrders.put(current.getName(), current);
    }
    else if (current != null) {
      transportOrders.remove(current.getName());
    }
    else if (previous != null) {
      transportOrders.remove(previous.getName());
    }

    reconcile();
  }

  private void reconcile() {
    List<ChargingPileDto> current = store.list();
    if (current.isEmpty()) {
      return;
    }

    String now = nowForTable();
    List<TransportOrder> activeOrders = activeOrders();
    List<Vehicle> chargingVehicles = chargingVehicles();
    boolean changed = false;
    List<ChargingPileDto> projected = new ArrayList<>(current.size());
    for (ChargingPileDto record : current) {
      ChargingPileDto next = project(record, now, activeOrders, chargingVehicles);
      projected.add(next);
      if (!next.equals(record)) {
        changed = true;
      }
    }

    if (changed) {
      store.replaceAllRecords(projected);
      LOG.debug("Projected charging-pile runtime state for {} records.", projected.size());
    }
  }

  private ChargingPileDto project(
      ChargingPileDto record,
      String now,
      List<TransportOrder> activeOrders,
      List<Vehicle> chargingVehicles
  ) {
    if (!Boolean.TRUE.equals(record.enabled())
        || "DISABLED".equalsIgnoreCase(record.occupancyStatus())) {
      return record;
    }

    String targetLocationName = targetLocationName(record);
    TransportOrder activeOrder = activeOrders.stream()
        .filter(order -> order.getAllDriveOrders().stream().anyMatch(
            driveOrder -> matchesChargeDestination(driveOrder, targetLocationName)
        ))
        .findFirst()
        .orElse(null);
    Vehicle chargingVehicle = chargingVehicles.stream()
        .filter(vehicle -> matchesChargingVehicle(vehicle, record))
        .findFirst()
        .orElse(null);

    boolean occupied = activeOrder != null || chargingVehicle != null;
    boolean wasOccupied = "OCCUPIED".equalsIgnoreCase(record.occupancyStatus())
        || "CHARGING".equalsIgnoreCase(record.runtimeStatus())
        || hasText(record.occupiedByVehicle())
        || hasText(record.activeOrderName())
        || hasText(record.chargingSince());

    if (!occupied) {
      if (!wasOccupied) {
        return record;
      }
      String runtimeStatus = releaseRuntimeStatus(record.runtimeStatus());
      if ("FREE".equalsIgnoreCase(record.occupancyStatus())
          && runtimeStatus.equalsIgnoreCase(normalizeText(record.runtimeStatus()))
          && !hasText(record.occupiedByVehicle())
          && !hasText(record.activeOrderName())
          && !hasText(record.chargingSince())) {
        return record;
      }
      return new ChargingPileDto(
          record.id(),
          record.name(),
          record.region(),
          record.mapName(),
          record.boundPointName(),
          record.locationName(),
          record.locationTypeName(),
          record.operation(),
          record.chargerType(),
          record.sn(),
          record.ip(),
          record.enabled(),
          runtimeStatus,
          "FREE",
          "",
          "",
          "",
          record.requiresPublish(),
          now
      );
    }

    String occupiedByVehicle = normalizeText(
        chargingVehicle == null ? "" : chargingVehicle.getName()
    );
    if (occupiedByVehicle.isBlank()) {
      occupiedByVehicle = normalizeText(
          activeOrder.getProcessingVehicle() == null
              ? ""
              : activeOrder.getProcessingVehicle().getName()
      );
    }
    if (occupiedByVehicle.isBlank()) {
      occupiedByVehicle = normalizeText(
          activeOrder.getIntendedVehicle() == null
              ? ""
              : activeOrder.getIntendedVehicle().getName()
      );
    }
    if (occupiedByVehicle.isBlank()) {
      occupiedByVehicle = normalizeText(record.occupiedByVehicle());
    }

    String activeOrderName = activeOrder == null
        ? normalizeText(record.activeOrderName())
        : normalizeText(activeOrder.getName());
    if (activeOrderName.isBlank()) {
      activeOrderName = normalizeText(record.activeOrderName());
    }

    String chargingSince = normalizeText(record.chargingSince());
    if (chargingSince.isBlank()) {
      chargingSince = now;
    }

    String runtimeStatus = chargingVehicle != null
        ? "CHARGING"
        : idleRuntimeStatus(record.runtimeStatus());

    if ("OCCUPIED".equalsIgnoreCase(record.occupancyStatus())
        && runtimeStatus.equalsIgnoreCase(normalizeText(record.runtimeStatus()))
        && occupiedByVehicle.equalsIgnoreCase(normalizeText(record.occupiedByVehicle()))
        && activeOrderName.equalsIgnoreCase(normalizeText(record.activeOrderName()))
        && chargingSince.equalsIgnoreCase(normalizeText(record.chargingSince()))) {
      return record;
    }

    return new ChargingPileDto(
        record.id(),
        record.name(),
        record.region(),
        record.mapName(),
        record.boundPointName(),
        record.locationName(),
        record.locationTypeName(),
        record.operation(),
        record.chargerType(),
        record.sn(),
        record.ip(),
        record.enabled(),
        runtimeStatus,
        "OCCUPIED",
        occupiedByVehicle,
        activeOrderName,
        chargingSince,
        record.requiresPublish(),
        now
    );
  }

  private List<TransportOrder> activeOrders() {
    return transportOrders.values().stream()
        .filter(this::isActiveOrder)
        .sorted(Comparator.comparing(TransportOrder::getName, String.CASE_INSENSITIVE_ORDER))
        .collect(Collectors.toList());
  }

  private List<Vehicle> chargingVehicles() {
    return vehicles.values().stream()
        .filter(vehicle -> vehicle.getState() == Vehicle.State.CHARGING)
        .sorted(Comparator.comparing(Vehicle::getName, String.CASE_INSENSITIVE_ORDER))
        .collect(Collectors.toList());
  }

  private boolean isActiveOrder(TransportOrder order) {
    if (order == null || order.getState() == null) {
      return false;
    }
    return switch (order.getState()) {
      case FINISHED, FAILED, UNROUTABLE -> false;
      default -> true;
    };
  }

  private boolean matchesChargeDestination(DriveOrder driveOrder, String targetLocationName) {
    if (driveOrder == null || driveOrder.getDestination() == null) {
      return false;
    }
    String operation = normalizeText(driveOrder.getDestination().getOperation());
    String locationName = driveOrder.getDestination().getDestination() == null
        ? ""
        : normalizeText(driveOrder.getDestination().getDestination().getName());
    return operation.equalsIgnoreCase("CHARGE")
        && locationName.equalsIgnoreCase(targetLocationName);
  }

  private boolean matchesChargingVehicle(Vehicle vehicle, ChargingPileDto record) {
    if (vehicle == null || vehicle.getCurrentPosition() == null) {
      return false;
    }
    String currentPosition = normalizeText(vehicle.getCurrentPosition().getName());
    return currentPosition.equalsIgnoreCase(targetLocationName(record))
        || currentPosition.equalsIgnoreCase(normalizeText(record.boundPointName()));
  }

  private static String targetLocationName(ChargingPileDto record) {
    String locationName = normalizeText(record.locationName());
    return locationName.isBlank() ? normalizeText(record.name()) : locationName;
  }

  private static String releaseRuntimeStatus(String current) {
    if ("FAULT".equalsIgnoreCase(current) || "OFFLINE".equalsIgnoreCase(current)) {
      return normalizeText(current);
    }
    return "IDLE";
  }

  private static String idleRuntimeStatus(String current) {
    if ("FAULT".equalsIgnoreCase(current) || "OFFLINE".equalsIgnoreCase(current)) {
      return normalizeText(current);
    }
    return "IDLE";
  }

  private static boolean hasText(String value) {
    return !normalizeText(value).isBlank();
  }

  private static String normalizeText(String value) {
    return value == null ? "" : value.trim();
  }

  private static String nowForTable() {
    return LocalDateTime.now().format(TABLE_TIME_FORMATTER);
  }
}
