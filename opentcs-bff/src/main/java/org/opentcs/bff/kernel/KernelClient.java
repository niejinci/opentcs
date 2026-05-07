// SPDX-FileCopyrightText: The openTCS Authors
// SPDX-License-Identifier: MIT
package org.opentcs.bff.kernel;

import static java.util.Objects.requireNonNull;

import com.google.inject.Singleton;
import jakarta.inject.Inject;
import java.util.Optional;
import java.util.Set;
import org.opentcs.access.KernelRuntimeException;
import org.opentcs.access.KernelServicePortal;
import org.opentcs.data.model.PlantModel;
import org.opentcs.data.model.Vehicle;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

/**
 * Thin façade over a single, shared {@link KernelServicePortal}.
 *
 * <p>The portal is created and logged in lazily on the first call to {@link #getPlantModel()} (or
 * {@link #ensureConnected()}). Subsequent calls reuse the same portal. {@link #close()} performs an
 * idempotent logout and is intended to be invoked from a JVM shutdown hook.
 *
 * <p>This class is intentionally focused on M2's read-only needs (plant model). Subsequent
 * milestones will broaden it (e.g. transport orders in M4, event subscription for SSE in M5).
 */
@Singleton
public class KernelClient {

  private static final Logger LOG = LoggerFactory.getLogger(KernelClient.class);

  private final BffKernelConfiguration configuration;
  private final KernelServicePortalFactory portalFactory;
  private final Object lock = new Object();
  private volatile KernelServicePortal portal;

  /**
   * Creates a new instance.
   *
   * @param configuration The Kernel connection configuration.
   * @param portalFactory The factory used to instantiate the {@link KernelServicePortal}.
   */
  @Inject
  public KernelClient(
      BffKernelConfiguration configuration,
      KernelServicePortalFactory portalFactory
  ) {
    this.configuration = requireNonNull(configuration, "configuration");
    this.portalFactory = requireNonNull(portalFactory, "portalFactory");
  }

  /**
   * Returns the plant model currently loaded in the Kernel.
   *
   * @return The plant model currently loaded in the Kernel.
   * @throws KernelRuntimeException If the Kernel cannot be reached or the request fails.
   */
  public PlantModel getPlantModel() {
    return ensureConnected().getPlantModelService().getPlantModel();
  }

  /**
   * Returns all vehicles currently known to the Kernel.
   *
   * @return All vehicles currently known to the Kernel.
   * @throws KernelRuntimeException If the Kernel cannot be reached or the request fails.
   */
  public Set<Vehicle> listVehicles() {
    return ensureConnected().getVehicleService().fetch(Vehicle.class);
  }

  /**
   * Returns the vehicle with the given name, if it exists.
   *
   * @param name The name of the vehicle to look up.
   * @return An {@link Optional} containing the vehicle, or empty if no such vehicle exists.
   * @throws KernelRuntimeException If the Kernel cannot be reached or the request fails.
   */
  public Optional<Vehicle> findVehicle(String name) {
    requireNonNull(name, "name");
    return ensureConnected().getVehicleService().fetch(Vehicle.class, name);
  }

  /**
   * Ensures the underlying portal is logged in, creating and connecting it on first use.
   *
   * @return The (now logged-in) portal.
   * @throws KernelRuntimeException If logging in to the Kernel fails.
   */
  public KernelServicePortal ensureConnected() {
    KernelServicePortal local = portal;
    if (local != null) {
      return local;
    }
    synchronized (lock) {
      if (portal == null) {
        LOG.info(
            "Connecting to openTCS Kernel at {}:{} as user '{}'...",
            configuration.host(),
            configuration.port(),
            configuration.userName()
        );
        KernelServicePortal newPortal
            = portalFactory.create(configuration.userName(), configuration.password());
        newPortal.login(configuration.host(), configuration.port());
        portal = newPortal;
        LOG.info("Connected to openTCS Kernel.");
      }
      return portal;
    }
  }

  /**
   * Logs out from the Kernel, if currently connected. Idempotent and exception-safe.
   */
  public void close() {
    KernelServicePortal local;
    synchronized (lock) {
      local = portal;
      portal = null;
    }
    if (local == null) {
      return;
    }
    try {
      local.logout();
      LOG.info("Disconnected from openTCS Kernel.");
    }
    catch (KernelRuntimeException e) {
      LOG.warn("Error while logging out from the Kernel; ignoring.", e);
    }
  }
}
