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

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.opentcs.access.KernelRuntimeException;
import org.opentcs.access.KernelServicePortal;
import org.opentcs.components.kernel.services.PlantModelService;
import org.opentcs.data.model.PlantModel;

/**
 * Tests for {@link KernelClient}.
 */
class KernelClientTest {

  private KernelServicePortal portal;
  private PlantModelService plantModelService;
  private KernelServicePortalFactory portalFactory;
  private BffKernelConfiguration configuration;
  private KernelClient kernelClient;

  @BeforeEach
  void setUp() {
    portal = mock(KernelServicePortal.class);
    plantModelService = mock(PlantModelService.class);
    when(portal.getPlantModelService()).thenReturn(plantModelService);

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
}
