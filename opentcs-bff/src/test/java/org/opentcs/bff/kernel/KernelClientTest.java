// SPDX-FileCopyrightText: The openTCS Authors
// SPDX-License-Identifier: MIT
package org.opentcs.bff.kernel;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.util.LinkedHashSet;
import java.util.Optional;
import java.util.Set;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.opentcs.access.CredentialsException;
import org.opentcs.access.KernelRuntimeException;
import org.opentcs.access.KernelServicePortal;
import org.opentcs.components.kernel.services.PlantModelService;
import org.opentcs.components.kernel.services.VehicleService;
import org.opentcs.data.model.PlantModel;
import org.opentcs.data.model.Vehicle;

/**
 * Tests for {@link KernelClient}.
 */
class KernelClientTest {

  private KernelServicePortal portal;
  private PlantModelService plantModelService;
  private VehicleService vehicleService;
  private KernelServicePortalFactory portalFactory;
  private BffKernelConfiguration configuration;
  private KernelClient kernelClient;

  @BeforeEach
  void setUp() {
    portal = mock(KernelServicePortal.class);
    plantModelService = mock(PlantModelService.class);
    when(portal.getPlantModelService()).thenReturn(plantModelService);
    vehicleService = mock(VehicleService.class);
    when(portal.getVehicleService()).thenReturn(vehicleService);

    portalFactory = mock(KernelServicePortalFactory.class);
    when(portalFactory.create(anyString(), anyString())).thenReturn(portal);

    configuration = mock(BffKernelConfiguration.class);
    when(configuration.host()).thenReturn("localhost");
    when(configuration.port()).thenReturn(1099);
    when(configuration.userName()).thenReturn("Alice");
    when(configuration.password()).thenReturn("xyz");

    kernelClient = new KernelClient(configuration, portalFactory);
  }

  @Test
  void logsInLazilyOnFirstUse() {
    PlantModel model = new PlantModel("test");
    when(plantModelService.getPlantModel()).thenReturn(model);

    verify(portalFactory, never()).create(anyString(), anyString());
    verify(portal, never()).login(anyString(), anyInt());

    PlantModel result = kernelClient.getPlantModel();

    assertThat(result).isSameAs(model);
    verify(portalFactory, times(1)).create("Alice", "xyz");
    verify(portal, times(1)).login("localhost", 1099);
  }

  @Test
  void reusesPortalOnSubsequentCalls() {
    when(plantModelService.getPlantModel()).thenReturn(new PlantModel("test"));

    kernelClient.getPlantModel();
    kernelClient.getPlantModel();
    kernelClient.getPlantModel();

    verify(portalFactory, times(1)).create(anyString(), anyString());
    verify(portal, times(1)).login(anyString(), anyInt());
    verify(plantModelService, times(3)).getPlantModel();
  }

  @Test
  void closeLogsOutAndAllowsReconnect() {
    when(plantModelService.getPlantModel()).thenReturn(new PlantModel("test"));

    kernelClient.getPlantModel();
    kernelClient.close();

    verify(portal, times(1)).logout();

    kernelClient.getPlantModel();

    verify(portalFactory, times(2)).create(anyString(), anyString());
    verify(portal, times(2)).login(anyString(), anyInt());
  }

  @Test
  void closeWithoutConnectionIsNoOp() {
    kernelClient.close();

    verify(portal, never()).logout();
    verify(portalFactory, never()).create(anyString(), anyString());
  }

  @Test
  void closeSwallowsKernelExceptions() {
    when(plantModelService.getPlantModel()).thenReturn(new PlantModel("test"));
    kernelClient.getPlantModel();
    org.mockito.Mockito.doThrow(new KernelRuntimeException("boom")).when(portal).logout();

    kernelClient.close();

    verify(portal, times(1)).logout();
  }

  @Test
  void propagatesLoginFailures() {
    org.mockito.Mockito.doThrow(new KernelRuntimeException("nope"))
        .when(portal).login(anyString(), anyInt());

    assertThatThrownBy(() -> kernelClient.getPlantModel())
        .isInstanceOf(KernelRuntimeException.class)
        .hasMessageContaining("nope");
  }

  @Test
  void listVehiclesDelegatesToVehicleService() {
    Set<Vehicle> vehicles = new LinkedHashSet<>();
    vehicles.add(new Vehicle("v1"));
    vehicles.add(new Vehicle("v2"));
    when(vehicleService.fetch(Vehicle.class)).thenReturn(vehicles);

    Set<Vehicle> result = kernelClient.listVehicles();

    assertThat(result).isSameAs(vehicles);
    verify(vehicleService, times(1)).fetch(Vehicle.class);
  }

  @Test
  void findVehicleDelegatesToVehicleService() {
    Vehicle v = new Vehicle("alpha");
    when(vehicleService.fetch(Vehicle.class, "alpha")).thenReturn(Optional.of(v));
    when(vehicleService.fetch(Vehicle.class, "ghost")).thenReturn(Optional.empty());

    assertThat(kernelClient.findVehicle("alpha")).contains(v);
    assertThat(kernelClient.findVehicle("ghost")).isEmpty();
    verify(vehicleService, times(1)).fetch(Vehicle.class, "alpha");
    verify(vehicleService, times(1)).fetch(Vehicle.class, "ghost");
  }

  @Test
  void fetchEventsDelegatesToPortal() {
    java.util.List<Object> events = java.util.List.of(new Object(), new Object());
    when(portal.fetchEvents(750L)).thenReturn(events);

    java.util.List<Object> result = kernelClient.fetchEvents(750L);

    assertThat(result).isSameAs(events);
    verify(portal, times(1)).fetchEvents(750L);
  }

  @Test
  void fetchEventsInvalidatesPortalOnError() {
    when(plantModelService.getPlantModel()).thenReturn(new PlantModel("test"));
    // Force an initial connection so we can verify a second login on the next call.
    kernelClient.getPlantModel();
    when(portal.fetchEvents(org.mockito.ArgumentMatchers.anyLong()))
        .thenThrow(new KernelRuntimeException("boom"));

    assertThatThrownBy(() -> kernelClient.fetchEvents(100L))
        .isInstanceOf(KernelRuntimeException.class);

    // The next call must re-create + re-login a fresh portal because the previous one was dropped.
    kernelClient.getPlantModel();
    verify(portalFactory, times(2)).create(anyString(), anyString());
    verify(portal, times(2)).login(anyString(), anyInt());
  }

  @Test
  void retriesOnceWhenKernelReportsCredentialsExceptionOnListVehicles() {
    // First call: kernel has forgotten our session → CredentialsException.
    // Second call (after re-login): success.
    Set<Vehicle> vehicles = new LinkedHashSet<>();
    vehicles.add(new Vehicle("v1"));
    when(vehicleService.fetch(Vehicle.class))
        .thenThrow(new CredentialsException("Client permissions insufficient."))
        .thenReturn(vehicles);

    Set<Vehicle> result = kernelClient.listVehicles();

    assertThat(result).isSameAs(vehicles);
    // Should have logged in twice (initial + after invalidate).
    verify(portalFactory, times(2)).create(anyString(), anyString());
    verify(portal, times(2)).login(anyString(), anyInt());
    // And called fetch twice (the failed attempt + the retry).
    verify(vehicleService, times(2)).fetch(Vehicle.class);
  }

  @Test
  void propagatesCredentialsExceptionWhenRetryAlsoFails() {
    when(vehicleService.fetch(Vehicle.class))
        .thenThrow(new CredentialsException("Client permissions insufficient."))
        .thenThrow(new CredentialsException("Client permissions insufficient."));

    assertThatThrownBy(() -> kernelClient.listVehicles())
        .isInstanceOf(CredentialsException.class);

    verify(vehicleService, times(2)).fetch(Vehicle.class);
  }

  @Test
  void retriesOnceWhenFetchEventsHitsCredentialsException() {
    // Force an initial connection so we can verify a second login on the retry.
    when(plantModelService.getPlantModel()).thenReturn(new PlantModel("test"));
    kernelClient.getPlantModel();

    java.util.List<Object> events = java.util.List.of(new Object());
    when(portal.fetchEvents(org.mockito.ArgumentMatchers.anyLong()))
        .thenThrow(new CredentialsException("Client permissions insufficient."))
        .thenReturn(events);

    java.util.List<Object> result = kernelClient.fetchEvents(100L);

    assertThat(result).isSameAs(events);
    verify(portalFactory, times(2)).create(anyString(), anyString());
    verify(portal, times(2)).login(anyString(), anyInt());
  }
}
