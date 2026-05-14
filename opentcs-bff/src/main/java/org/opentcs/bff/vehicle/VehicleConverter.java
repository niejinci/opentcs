// SPDX-FileCopyrightText: The openTCS Authors
// SPDX-License-Identifier: MIT
package org.opentcs.bff.vehicle;

import static java.util.Objects.requireNonNull;

import org.opentcs.bff.api.v1.model.Vehicle;
import org.opentcs.bff.api.v1.model.VehicleIntegrationLevel;
import org.opentcs.bff.api.v1.model.VehicleProcState;
import org.opentcs.bff.api.v1.model.VehicleState;

/**
 * Converts between the openTCS kernel's {@link org.opentcs.data.model.Vehicle} domain object and
 * the BFF API's generated {@link Vehicle} DTO.
 */
public final class VehicleConverter {

  private VehicleConverter() {
  }

  /**
   * Converts a kernel {@link org.opentcs.data.model.Vehicle} to a {@link Vehicle} DTO.
   *
   * @param vehicle The kernel-side vehicle.
   * @return The corresponding DTO.
   */
  public static Vehicle toDto(org.opentcs.data.model.Vehicle vehicle) {
    requireNonNull(vehicle, "vehicle");
    Vehicle dto = new Vehicle();
    dto.setName(vehicle.getName());
    dto.setState(VehicleState.valueOf(vehicle.getState().name()));
    dto.setProcState(VehicleProcState.valueOf(vehicle.getProcState().name()));
    dto.setIntegrationLevel(
        VehicleIntegrationLevel.valueOf(vehicle.getIntegrationLevel().name())
    );
    dto.setPaused(vehicle.isPaused());
    dto.setEnergyLevel(vehicle.getEnergyLevel());
    dto.setCurrentPosition(
        vehicle.getCurrentPosition() == null ? null : vehicle.getCurrentPosition().getName()
    );
    return dto;
  }
}
