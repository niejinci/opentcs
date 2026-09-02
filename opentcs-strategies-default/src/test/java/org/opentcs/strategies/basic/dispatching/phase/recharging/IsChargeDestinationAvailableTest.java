// SPDX-FileCopyrightText: The openTCS Authors
// SPDX-License-Identifier: MIT
package org.opentcs.strategies.basic.dispatching.phase.recharging;

import static org.hamcrest.MatcherAssert.assertThat;
import static org.hamcrest.Matchers.empty;
import static org.hamcrest.Matchers.not;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import java.util.List;
import java.util.Optional;
import java.util.Set;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.opentcs.components.kernel.services.InternalPlantModelService;
import org.opentcs.data.model.Point;
import org.opentcs.data.model.Vehicle;
import org.opentcs.data.order.DriveOrder;
import org.opentcs.data.order.DriveOrder.Destination;
import org.opentcs.data.order.OrderConstants;
import org.opentcs.data.order.Route;
import org.opentcs.data.order.TransportOrder;
import org.opentcs.strategies.basic.dispatching.AssignmentCandidate;
import org.opentcs.strategies.basic.dispatching.phase.TargetedPointsSupplier;
import org.opentcs.strategies.basic.dispatching.selection.candidates.IsChargeDestinationAvailable;

class IsChargeDestinationAvailableTest {

  private InternalPlantModelService plantModelService;
  private TargetedPointsSupplier targetedPointsSupplier;
  private IsChargeDestinationAvailable filter;

  @BeforeEach
  void setUp() {
    plantModelService = mock(InternalPlantModelService.class);
    targetedPointsSupplier = mock(TargetedPointsSupplier.class);
    filter = new IsChargeDestinationAvailable(plantModelService, targetedPointsSupplier);
    when(targetedPointsSupplier.getTargetedPoints()).thenReturn(Set.of());
  }

  @Test
  void allowsChargeOrderWhenDestinationBlockIsFree() {
    Point targetPoint = new Point("target-point");

    when(plantModelService.fetch(Point.class, targetPoint.getReference()))
        .thenReturn(Optional.of(targetPoint));
    when(plantModelService.expandResources(Set.of(targetPoint.getReference())))
        .thenReturn(Set.of(targetPoint));

    assertThat(filter.apply(chargeCandidate(targetPoint)), empty());
  }

  @Test
  void ignoresNonChargeOrders() {
    assertThat(filter.apply(candidate(new Point("target-point"), OrderConstants.TYPE_ANY)), empty());
  }

  @Test
  void filtersChargeOrderWithOccupiedDestinationBlock() {
    Point targetPoint = new Point("target-point");
    Point blockedPoint = new Point("blocked-point")
        .withOccupyingVehicle(new Vehicle("other-vehicle").getReference());

    when(plantModelService.fetch(Point.class, targetPoint.getReference()))
        .thenReturn(Optional.of(targetPoint));
    when(plantModelService.expandResources(Set.of(targetPoint.getReference())))
        .thenReturn(Set.of(targetPoint, blockedPoint));

    assertThat(filter.apply(chargeCandidate(targetPoint)), not(empty()));
  }

  @Test
  void filtersChargeOrderWithTargetedDestinationBlock() {
    Point targetPoint = new Point("target-point");

    when(plantModelService.fetch(Point.class, targetPoint.getReference()))
        .thenReturn(Optional.of(targetPoint));
    when(plantModelService.expandResources(Set.of(targetPoint.getReference())))
        .thenReturn(Set.of(targetPoint));
    when(targetedPointsSupplier.getTargetedPoints()).thenReturn(Set.of(targetPoint));

    assertThat(filter.apply(chargeCandidate(targetPoint)), not(empty()));
  }

  private AssignmentCandidate candidate(Point targetPoint, String orderType) {
    Point currentPosition = new Point("current-position");
    Vehicle vehicle = new Vehicle("vehicle")
        .withCurrentPosition(currentPosition.getReference())
        .withRechargeOperation("CHARGE");
    DriveOrder driveOrder = new DriveOrder("drive-order", new Destination(targetPoint.getReference()))
        .withRoute(
            new Route(
                List.of(
                    new Route.Step(
                        null,
                        currentPosition,
                        targetPoint,
                        Vehicle.Orientation.FORWARD,
                        0,
                        10
                    )
                )
            )
        );
    TransportOrder transportOrder = new TransportOrder("order", List.of(driveOrder))
        .withType(orderType);

    return new AssignmentCandidate(vehicle, transportOrder, List.of(driveOrder));
  }

  private AssignmentCandidate chargeCandidate(Point targetPoint) {
    return candidate(targetPoint, OrderConstants.TYPE_CHARGE);
  }
}
