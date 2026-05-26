// SPDX-FileCopyrightText: The openTCS Authors
// SPDX-License-Identifier: MIT
package org.opentcs.bff.transportorder;

import static java.util.Objects.requireNonNull;

import java.time.Instant;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import org.opentcs.access.to.order.DestinationCreationTO;
import org.opentcs.access.to.order.TransportOrderCreationTO;
import org.opentcs.bff.api.v1.model.Destination;
import org.opentcs.bff.api.v1.model.TransportOrder;
import org.opentcs.bff.api.v1.model.TransportOrderRequest;
import org.opentcs.data.order.OrderConstants;

/**
 * Converts between the OpenAPI-generated {@link TransportOrderRequest}/{@link TransportOrder} DTOs
 * and the kernel's {@link TransportOrderCreationTO}/{@link org.opentcs.data.order.TransportOrder}
 * domain types.
 */
public final class TransportOrderConverter {

  private TransportOrderConverter() {
  }

  /**
   * Converts the given request DTO into a {@link TransportOrderCreationTO} suitable for the
   * kernel.
   *
   * @param request The request DTO to convert.
   * @return The corresponding {@link TransportOrderCreationTO}.
   * @throws IllegalArgumentException If the request body fails BFF-level validation.
   */
  public static TransportOrderCreationTO toCreationTO(TransportOrderRequest request) {
    requireNonNull(request, "request");
    if (request.getName() == null || request.getName().isBlank()) {
      throw new IllegalArgumentException("'name' must not be empty.");
    }
    List<Destination> destinations = request.getDestinations();
    if (destinations == null || destinations.isEmpty()) {
      throw new IllegalArgumentException("'destinations' must contain at least one entry.");
    }

    List<DestinationCreationTO> destTos = new ArrayList<>(destinations.size());
    for (int i = 0; i < destinations.size(); i++) {
      Destination dest = destinations.get(i);
      if (dest == null) {
        throw new IllegalArgumentException("destinations[" + i + "] must not be null.");
      }
      if (dest.getLocationName() == null || dest.getLocationName().isBlank()) {
        throw new IllegalArgumentException(
            "destinations[" + i + "].locationName must not be empty."
        );
      }
      if (dest.getOperation() == null || dest.getOperation().isBlank()) {
        throw new IllegalArgumentException(
            "destinations[" + i + "].operation must not be empty."
        );
      }
      DestinationCreationTO destTo
          = new DestinationCreationTO(dest.getLocationName(), dest.getOperation());
      if (dest.getProperties() != null) {
        destTo = destTo.withProperties(dest.getProperties());
      }
      destTos.add(destTo);
    }

    Set<String> dependencies = request.getDependencies() == null
        ? Set.of()
        : new HashSet<>(request.getDependencies());

    String type = (request.getType() == null || request.getType().isBlank())
        ? OrderConstants.TYPE_NONE
        : request.getType();

    Instant deadline = request.getDeadline() == null
        ? Instant.MAX
        : request.getDeadline().toInstant();

    Map<String, String> props
        = request.getProperties() == null ? Map.of() : request.getProperties();

    return new TransportOrderCreationTO(request.getName(), destTos)
        .withIncompleteName(Boolean.TRUE.equals(request.getIncompleteName()))
        .withDispensable(Boolean.TRUE.equals(request.getDispensable()))
        .withIntendedVehicleName(request.getIntendedVehicle())
        .withDependencyNames(dependencies)
        .withDeadline(deadline)
        .withPeripheralReservationToken(request.getPeripheralReservationToken())
        .withWrappingSequence(request.getWrappingSequence())
        .withType(type)
        .withProperties(props);
  }

  /**
   * Converts a kernel-side {@link org.opentcs.data.order.TransportOrder} into the API DTO.
   *
   * @param order The kernel-side transport order to convert.
   * @return The corresponding {@link TransportOrder} DTO.
   */
  public static TransportOrder toDto(org.opentcs.data.order.TransportOrder order) {
    requireNonNull(order, "order");
    TransportOrder dto = new TransportOrder();
    dto.setName(order.getName());
    dto.setType(order.getType());
    dto.setState(
        org.opentcs.bff.api.v1.model.TransportOrderState.valueOf(order.getState().name())
    );
    if (order.getIntendedVehicle() != null) {
      dto.setIntendedVehicle(order.getIntendedVehicle().getName());
    }
    if (order.getProcessingVehicle() != null) {
      dto.setProcessingVehicle(order.getProcessingVehicle().getName());
    }
    List<Destination> dests = new ArrayList<>();
    order.getAllDriveOrders().forEach(driveOrder -> {
      Destination dest = new Destination();
      dest.setLocationName(driveOrder.getDestination().getDestination().getName());
      dest.setOperation(driveOrder.getDestination().getOperation());
      dests.add(dest);
    });
    dto.setDestinations(dests);
    return dto;
  }
}
