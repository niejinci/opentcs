// SPDX-FileCopyrightText: The openTCS Authors
// SPDX-License-Identifier: MIT
package org.opentcs.bff.charging;

import static org.assertj.core.api.Assertions.assertThat;

import java.nio.file.Path;
import java.util.List;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import org.opentcs.data.TCSObjectEvent;
import org.opentcs.data.model.Location;
import org.opentcs.data.model.LocationType;
import org.opentcs.data.model.Point;
import org.opentcs.data.model.Vehicle;
import org.opentcs.data.order.DriveOrder;
import org.opentcs.data.order.TransportOrder;

/**
 * Tests for {@link ChargingPileRuntimeProjector}.
 */
class ChargingPileRuntimeProjectorTest {

  @TempDir
  private Path workspace;

  private ChargingPileStore store;
  private ChargingPileRuntimeProjector projector;

  @BeforeEach
  void setUp() {
    store = new ChargingPileStore(workspace);
    projector = new ChargingPileRuntimeProjector(store);
    store.create(
        new ChargingPileDto(
            "cp-001",
            "CP-A01",
            "深圳焊装",
            "HZ27",
            "Point-1",
            "CP-A01",
            "CHARGER",
            "CHARGE",
            "",
            "",
            "",
            true,
            "UNKNOWN",
            "FREE",
            "",
            "",
            "",
            false,
            ""
        )
    );
  }

  @Test
  void projectsChargeOccupancyAndPersistsReleaseTransitions() {
    LocationType chargerType = new LocationType("CHARGER");
    Location chargerLocation = new Location("CP-A01", chargerType.getReference());
    Point chargerPoint = new Point("Point-1");

    TransportOrder activeOrder = new TransportOrder(
        "TO-01",
        List.of(
            new DriveOrder(
                "drive-1",
                new DriveOrder.Destination(chargerLocation.getReference()).withOperation("CHARGE")
            )
        )
    )
        .withState(TransportOrder.State.ACTIVE)
        .withIntendedVehicle(new Vehicle("AGV-01").getReference());

    Vehicle chargingVehicle = new Vehicle("AGV-01")
        .withState(Vehicle.State.CHARGING)
        .withCurrentPosition(chargerPoint.getReference());

    projector.apply(new TCSObjectEvent(activeOrder, null, TCSObjectEvent.Type.OBJECT_CREATED));
    ChargingPileDto occupied = store.list().get(0);
    assertThat(occupied.occupancyStatus()).isEqualTo("OCCUPIED");
    assertThat(occupied.runtimeStatus()).isEqualTo("IDLE");
    assertThat(occupied.occupiedByVehicle()).isEqualTo("AGV-01");
    assertThat(occupied.activeOrderName()).isEqualTo("TO-01");
    assertThat(occupied.chargingSince()).isNotBlank();

    projector.apply(new TCSObjectEvent(chargingVehicle, null, TCSObjectEvent.Type.OBJECT_CREATED));
    ChargingPileDto charging = store.list().get(0);
    assertThat(charging.occupancyStatus()).isEqualTo("OCCUPIED");
    assertThat(charging.runtimeStatus()).isEqualTo("CHARGING");
    assertThat(charging.chargingSince()).isEqualTo(occupied.chargingSince());

    projector.apply(new TCSObjectEvent(null, activeOrder, TCSObjectEvent.Type.OBJECT_REMOVED));
    ChargingPileDto stillOccupied = store.list().get(0);
    assertThat(stillOccupied.occupancyStatus()).isEqualTo("OCCUPIED");
    assertThat(stillOccupied.runtimeStatus()).isEqualTo("CHARGING");
    assertThat(stillOccupied.activeOrderName()).isEqualTo("TO-01");

    projector.apply(new TCSObjectEvent(null, chargingVehicle, TCSObjectEvent.Type.OBJECT_REMOVED));
    ChargingPileDto released = store.list().get(0);
    assertThat(released.occupancyStatus()).isEqualTo("FREE");
    assertThat(released.runtimeStatus()).isEqualTo("IDLE");
    assertThat(released.occupiedByVehicle()).isEmpty();
    assertThat(released.activeOrderName()).isEmpty();
    assertThat(released.chargingSince()).isEmpty();
  }
}
