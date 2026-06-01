// SPDX-FileCopyrightText: The openTCS Authors
// SPDX-License-Identifier: MIT
package org.opentcs.bff.kernel;

import static java.util.Objects.requireNonNull;

import com.google.inject.Singleton;
import jakarta.inject.Inject;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import org.opentcs.access.KernelRuntimeException;
import org.opentcs.access.KernelServicePortal;
import org.opentcs.access.to.order.TransportOrderCreationTO;
import org.opentcs.data.ObjectUnknownException;
import org.opentcs.data.model.PlantModel;
import org.opentcs.data.model.Point;
import org.opentcs.data.model.Vehicle;
import org.opentcs.data.order.TransportOrder;
import org.opentcs.drivers.vehicle.VehicleCommAdapterMessage;
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
   * Updates the named vehicle's integration level via
   * {@link org.opentcs.components.kernel.services.VehicleService#updateVehicleIntegrationLevel}
   * and returns the resulting vehicle state.
   *
   * @param name The name of the vehicle to update.
   * @param integrationLevel The new integration level.
   * @return The updated vehicle.
   * @throws org.opentcs.data.ObjectUnknownException If no such vehicle exists.
   * @throws IllegalArgumentException If the kernel rejects the transition (e.g. lowering the
   * level while the vehicle is processing an order).
   * @throws KernelRuntimeException If the Kernel cannot be reached or the request fails.
   */
  public Vehicle updateVehicleIntegrationLevel(
      String name,
      Vehicle.IntegrationLevel integrationLevel
  ) {
    requireNonNull(name, "name");
    requireNonNull(integrationLevel, "integrationLevel");
    var portal = ensureConnected();
    var service = portal.getVehicleService();
    Vehicle current = service.fetch(Vehicle.class, name)
        .orElseThrow(
            () -> new org.opentcs.data.ObjectUnknownException(
                "No vehicle named '" + name + "' exists."
            )
        );
    service.updateVehicleIntegrationLevel(current.getReference(), integrationLevel);
    return service.fetch(Vehicle.class, name).orElse(current);
  }

  /**
   * Sets the named vehicle's current position by sending the loopback / virtual-vehicle
   * comm-adapter message of type {@code tcs:virtualVehicle:setPosition} via
   * {@link org.opentcs.components.kernel.services.VehicleService#sendCommAdapterMessage}.
   *
   * <p>The point name is validated against the kernel's currently loaded plant model and
   * an {@link IllegalArgumentException} is thrown for unknown points <em>before</em> the
   * message is dispatched. Real (non-virtual) comm adapters that do not implement this
   * message will silently ignore it; this endpoint is therefore primarily intended for
   * commissioning a virtual vehicle on its starting point.
   *
   * @param name The name of the vehicle to position.
   * @param pointName The name of the point at which to place the vehicle.
   * @return The vehicle as known to the kernel after the message was dispatched. Note that
   * the kernel's reported {@code currentPosition} is updated asynchronously by the
   * vehicle controller; callers may need to await an SSE update for it to reflect the
   * new position.
   * @throws ObjectUnknownException If no vehicle with the given name exists.
   * @throws IllegalArgumentException If no point with the given name exists in the plant
   * model.
   * @throws KernelRuntimeException If the Kernel cannot be reached or the request fails.
   */
  public Vehicle updateVehiclePosition(String name, String pointName) {
    requireNonNull(name, "name");
    requireNonNull(pointName, "pointName");
    var portal = ensureConnected();
    var service = portal.getVehicleService();
    Vehicle current = service.fetch(Vehicle.class, name)
        .orElseThrow(
            () -> new ObjectUnknownException("No vehicle named '" + name + "' exists.")
        );
    if (service.fetch(Point.class, pointName).isEmpty()) {
      throw new IllegalArgumentException(
          "No point named '" + pointName + "' exists in the plant model."
      );
    }
    service.sendCommAdapterMessage(
        current.getReference(),
        new VehicleCommAdapterMessage(
            "tcs:virtualVehicle:setPosition",
            Map.of("position", pointName)
        )
    );
    return service.fetch(Vehicle.class, name).orElse(current);
  }

  /**
   * Creates a new transport order in the Kernel from the given creation TO.
   *
   * @param to The transport order to create.
   * @return The created transport order.
   * @throws KernelRuntimeException If the Kernel cannot be reached or the request fails (e.g. a
   * referenced object does not exist or the order's name is already taken).
   */
  public TransportOrder createTransportOrder(TransportOrderCreationTO to) {
    requireNonNull(to, "to");
    return ensureConnected().getTransportOrderService().createTransportOrder(to);
  }

  /**
   * Fetches events buffered for this client at the kernel side.
   *
   * <p>If the underlying portal call fails (e.g. because the kernel went away), the cached portal
   * is invalidated so that the next call to {@link #ensureConnected()} reconnects from scratch.
   *
   * @param timeout Maximum time (in ms) to wait for events to arrive.
   * @return The list of events that arrived.
   * @throws KernelRuntimeException If the Kernel cannot be reached or the request fails.
   */
  public List<Object> fetchEvents(long timeout) {
    try {
      return ensureConnected().fetchEvents(timeout);
    }
    catch (KernelRuntimeException e) {
      invalidate();
      throw e;
    }
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

  /**
   * Drops the cached portal without attempting to log out, so that the next call to
   * {@link #ensureConnected()} re-establishes the connection. Used internally when a request
   * fails so that subsequent operations can transparently reconnect.
   */
  private void invalidate() {
    synchronized (lock) {
      portal = null;
    }
  }
}
