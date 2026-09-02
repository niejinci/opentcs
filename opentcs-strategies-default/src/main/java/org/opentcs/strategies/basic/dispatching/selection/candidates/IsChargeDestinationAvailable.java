// SPDX-FileCopyrightText: The openTCS Authors
// SPDX-License-Identifier: MIT
package org.opentcs.strategies.basic.dispatching.selection.candidates;

import static java.util.Objects.requireNonNull;

import jakarta.inject.Inject;
import java.util.Collection;
import java.util.List;
import java.util.Set;
import org.opentcs.components.kernel.services.InternalPlantModelService;
import org.opentcs.data.model.Point;
import org.opentcs.data.model.Vehicle;
import org.opentcs.data.order.OrderConstants;
import org.opentcs.strategies.basic.dispatching.AssignmentCandidate;
import org.opentcs.strategies.basic.dispatching.phase.TargetedPointsSupplier;
import org.opentcs.strategies.basic.dispatching.selection.AssignmentCandidateSelectionFilter;

/**
 * Filters charge assignment candidates whose target access point is occupied or already targeted
 * by another vehicle.
 */
public class IsChargeDestinationAvailable
    implements
      AssignmentCandidateSelectionFilter {

  private static final String CHARGE_DESTINATION_UNAVAILABLE = "chargeDestinationUnavailable";

  private final InternalPlantModelService plantModelService;
  private final TargetedPointsSupplier targetedPointsSupplier;

  @Inject
  public IsChargeDestinationAvailable(
      InternalPlantModelService plantModelService,
      TargetedPointsSupplier targetedPointsSupplier
  ) {
    this.plantModelService = requireNonNull(plantModelService, "plantModelService");
    this.targetedPointsSupplier = requireNonNull(targetedPointsSupplier, "targetedPointsSupplier");
  }

  @Override
  public Collection<String> apply(AssignmentCandidate candidate) {
    requireNonNull(candidate, "candidate");

    if (!OrderConstants.TYPE_CHARGE.equals(candidate.getTransportOrder().getType())) {
      return List.of();
    }

    Point destinationPoint = candidate.getDriveOrders().getLast()
        .getRoute()
        .getFinalDestinationPoint();
    Point currentDestinationPoint = plantModelService
        .fetch(Point.class, destinationPoint.getReference())
        .orElse(destinationPoint);

    if (isPointUnoccupiedFor(currentDestinationPoint, candidate.getVehicle())) {
      return List.of();
    }

    return List.of(
        candidate.getVehicle().getName() + "(" + CHARGE_DESTINATION_UNAVAILABLE + ")"
    );
  }

  private boolean isPointUnoccupiedFor(Point accessPoint, Vehicle vehicle) {
    Set<Point> targetedPoints = targetedPointsSupplier.getTargetedPoints();

    return plantModelService.expandResources(Set.of(accessPoint.getReference())).stream()
        .filter(resource -> Point.class.equals(resource.getReference().getReferentClass()))
        .map(resource -> (Point) resource)
        .noneMatch(
            point -> pointOccupiedOrTargetedByOtherVehicle(
                point,
                vehicle,
                targetedPoints
            )
        );
  }

  private boolean pointOccupiedOrTargetedByOtherVehicle(
      Point pointToCheck,
      Vehicle vehicle,
      Set<Point> targetedPoints
  ) {
    return (pointToCheck.getOccupyingVehicle() != null
        && !pointToCheck.getOccupyingVehicle().equals(vehicle.getReference()))
        || targetedPoints.contains(pointToCheck);
  }
}
