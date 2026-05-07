// SPDX-FileCopyrightText: The openTCS Authors
// SPDX-License-Identifier: MIT
package org.opentcs.bff.kernel;

import org.opentcs.access.KernelServicePortal;

/**
 * Creates {@link KernelServicePortal} instances for use by the BFF.
 *
 * <p>Extracted as a SAM type so unit tests can substitute an in-memory portal without going through
 * RMI. The default implementation is {@link DefaultKernelServicePortalFactory}.
 */
@FunctionalInterface
public interface KernelServicePortalFactory {

  /**
   * Creates a new {@link KernelServicePortal} configured with the given credentials. The returned
   * portal is not yet logged in; callers are expected to invoke
   * {@link KernelServicePortal#login(String, int)} themselves.
   *
   * @param userName The user name to log in to the Kernel with.
   * @param password The password to log in to the Kernel with.
   * @return A new (unconnected) {@link KernelServicePortal}.
   */
  KernelServicePortal create(String userName, String password);
}
