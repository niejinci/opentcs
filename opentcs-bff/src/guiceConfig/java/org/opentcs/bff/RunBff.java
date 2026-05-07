// SPDX-FileCopyrightText: The openTCS Authors
// SPDX-License-Identifier: MIT
package org.opentcs.bff;

import com.google.inject.Guice;
import com.google.inject.Injector;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

/**
 * Default entry point for the openTCS SPA backend (BFF) process.
 *
 * <p>Wires up Guice with {@link BffModule}, obtains a {@link BffApplication} instance and starts
 * it. A JVM shutdown hook stops the application cleanly on SIGTERM/SIGINT.
 *
 * <p>The pattern mirrors {@code RunModelEditor} in the {@code opentcs-modeleditor} module.
 */
public final class RunBff {

  private static final Logger LOG = LoggerFactory.getLogger(RunBff.class);

  private RunBff() {
  }

  /**
   * The BFF process entry point.
   *
   * @param args Command line arguments (currently ignored).
   */
  public static void main(String[] args) {
    LOG.info("Starting openTCS BFF...");

    Injector injector = Guice.createInjector(new BffModule(BffConfiguration.defaults()));
    BffApplication app = injector.getInstance(BffApplication.class);

    Runtime.getRuntime().addShutdownHook(new Thread(app::stop, "bff-shutdown"));

    app.start();
  }
}
