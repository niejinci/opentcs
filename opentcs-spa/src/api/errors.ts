// SPDX-FileCopyrightText: The openTCS Authors
// SPDX-License-Identifier: MIT
//
// Error types thrown by the API client. Distinguishing transport / HTTP /
// parse failures lets callers branch on the failure mode without parsing
// `error.message` strings.

import type { BffErrorResponse } from './types/bff';

/** Base class for all errors thrown by `src/api/`. */
export class ApiError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ApiError';
  }
}

/**
 * Thrown when `fetch` itself fails (DNS / network / TLS / aborted), i.e.
 * no HTTP response was received. The `cause` is the original error.
 */
export class NetworkError extends ApiError {
  constructor(
    message: string,
    public readonly cause?: unknown,
  ) {
    super(message);
    this.name = 'NetworkError';
  }
}

/**
 * Thrown for any non-2xx HTTP response. When the body parses as a BFF
 * `ErrorResponse`, `payload` is set; otherwise the raw text body is
 * exposed via `bodyText`.
 */
export class HttpError extends ApiError {
  constructor(
    public readonly status: number,
    public readonly statusText: string,
    public readonly payload: BffErrorResponse | null,
    public readonly bodyText: string,
    public readonly traceId: string | null,
  ) {
    super(
      payload?.message
        ? `HTTP ${status} ${statusText}: ${payload.message}`
        : `HTTP ${status} ${statusText}`,
    );
    this.name = 'HttpError';
  }
}

/** Thrown when a 2xx response body is expected to be JSON but isn't. */
export class ParseError extends ApiError {
  constructor(
    message: string,
    public readonly cause?: unknown,
  ) {
    super(message);
    this.name = 'ParseError';
  }
}

/** Type guard — convenient for `catch (e) { if (isApiError(e)) ... }`. */
export function isApiError(e: unknown): e is ApiError {
  return e instanceof ApiError;
}
