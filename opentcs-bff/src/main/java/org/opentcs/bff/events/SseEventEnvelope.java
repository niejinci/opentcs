// SPDX-FileCopyrightText: The openTCS Authors
// SPDX-License-Identifier: MIT
package org.opentcs.bff.events;

import com.fasterxml.jackson.annotation.JsonInclude;

/**
 * A small envelope for object-state SSE events.
 *
 * <p>The shape mirrors the openTCS Kernel's per-object SSE payload so SPA clients written against
 * the Kernel's HTTP service-web-api can consume BFF events with minimal changes:
 *
 * <pre>
 * {
 * "currentObjectState": &lt;DTO or null&gt;,
 * "previousObjectState": &lt;DTO or null&gt;
 * }
 * </pre>
 *
 * <p>{@code currentObjectState} is {@code null} for object-removed events; {@code
 * previousObjectState} is {@code null} for object-created events.
 *
 * @param <T> The DTO type carried in the envelope.
 * @param currentObjectState The object state after the change, or {@code null} on removal.
 * @param previousObjectState The object state before the change, or {@code null} on creation.
 */
@JsonInclude(JsonInclude.Include.ALWAYS)
public record SseEventEnvelope<T>(T currentObjectState, T previousObjectState) {
}
