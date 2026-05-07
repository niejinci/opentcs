// SPDX-FileCopyrightText: The openTCS Authors
// SPDX-License-Identifier: MIT
package org.opentcs.bff.kernel;

import jakarta.inject.Inject;
import org.opentcs.access.KernelServicePortal;
import org.opentcs.access.rmi.KernelServicePortalBuilder;

/**
 * Default {@link KernelServicePortalFactory}: builds a {@link KernelServicePortal} via
 * {@link KernelServicePortalBuilder} with the standard (non-SSL) socket factory.
 */
public class DefaultKernelServicePortalFactory
    implements
      KernelServicePortalFactory {

  /**
   * Creates a new instance.
   */
  @Inject
  public DefaultKernelServicePortalFactory() {
  }

  @Override
  public KernelServicePortal create(String userName, String password) {
    return new KernelServicePortalBuilder(userName, password).build();
  }
}
