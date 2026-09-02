// SPDX-FileCopyrightText: The openTCS Authors
// SPDX-License-Identifier: MIT
package org.opentcs.strategies.basic.dispatching.phase.recharging;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

import java.util.List;
import java.util.Optional;
import java.util.Set;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.opentcs.access.to.order.TransportOrderCreationTO;
import org.opentcs.components.kernel.services.InternalTransportOrderService;
import org.opentcs.data.model.Point;
import org.opentcs.data.model.Vehicle;
import org.opentcs.data.order.DriveOrder;
import org.opentcs.data.order.DriveOrder.Destination;
import org.opentcs.data.order.OrderConstants;
import org.opentcs.data.order.Route;
import org.opentcs.data.order.TransportOrder;
import org.opentcs.strategies.basic.dispatching.DefaultDispatcherConfiguration;
import org.opentcs.strategies.basic.dispatching.DriveOrderRouteAssigner;
import org.opentcs.strategies.basic.dispatching.TransportOrderUtil;
import org.opentcs.strategies.basic.dispatching.selection.candidates.CompositeAssignmentCandidateSelectionFilter;
import org.opentcs.strategies.basic.dispatching.selection.vehicles.CompositeRechargeVehicleSelectionFilter;

class RechargeIdleVehiclesPhaseTest {

  private InternalTransportOrderService orderService;
  private RechargePositionSupplier rechargePosSupplier;
  private CompositeAssignmentCandidateSelectionFilter assignmentCandidateSelectionFilter;
  private CompositeRechargeVehicleSelectionFilter vehicleSelectionFilter;
  private TransportOrderUtil transportOrderUtil;
  private DefaultDispatcherConfiguration configuration;
  private DriveOrderRouteAssigner driveOrderRouteAssigner;
  private RechargeIdleVehiclesPhase phase;

  @BeforeEach
  void setUp() {
    orderService = mock(InternalTransportOrderService.class);
    rechargePosSupplier = mock(RechargePositionSupplier.class);
    assignmentCandidateSelectionFilter = mock(CompositeAssignmentCandidateSelectionFilter.class);
    vehicleSelectionFilter = mock(CompositeRechargeVehicleSelectionFilter.class);
    transportOrderUtil = mock(TransportOrderUtil.class);
    configuration = mock(DefaultDispatcherConfiguration.class);
    driveOrderRouteAssigner = mock(DriveOrderRouteAssigner.class);
    phase = new RechargeIdleVehiclesPhase(
        orderService,
        rechargePosSupplier,
        assignmentCandidateSelectionFilter,
        vehicleSelectionFilter,
        transportOrderUtil,
        configuration,
        driveOrderRouteAssigner
    );
    phase.initialize();
    when(configuration.rechargeIdleVehicles()).thenReturn(true);
    when(configuration.maxRoutesToConsider()).thenReturn(1);
  }

  @Test
  void marksRechargeOrderFailedIfCandidateIsFiltered() {
    Point currentPosition = new Point("current-position");
    Point targetPoint = new Point("target-point");
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
    TransportOrder rechargeOrder = new TransportOrder("Recharge-1", List.of(driveOrder))
        .withType(OrderConstants.TYPE_CHARGE)
        .withIntendedVehicle(vehicle.getReference());

    when(orderService.fetch(Vehicle.class)).thenReturn(Set.of(vehicle));
    when(vehicleSelectionFilter.apply(vehicle)).thenReturn(List.of());
    when(rechargePosSupplier.findRechargeSequence(vehicle))
        .thenReturn(List.of(new Destination(targetPoint.getReference()).withOperation("CHARGE")));
    when(orderService.createTransportOrder(any(TransportOrderCreationTO.class)))
        .thenReturn(rechargeOrder);
    when(orderService.fetch(Point.class, currentPosition.getReference()))
        .thenReturn(Optional.of(currentPosition));
    when(driveOrderRouteAssigner.tryAssignRoutes(eq(rechargeOrder), eq(vehicle), eq(currentPosition)))
        .thenReturn(Optional.of(List.of(driveOrder)));
    when(assignmentCandidateSelectionFilter.apply(any())).thenReturn(List.of("filtered"));

    phase.run();

    verify(orderService).updateTransportOrderState(
        rechargeOrder.getReference(),
        TransportOrder.State.FAILED
    );
    verifyNoInteractions(transportOrderUtil);
  }
}
