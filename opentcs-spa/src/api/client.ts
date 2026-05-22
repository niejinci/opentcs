// SPDX-FileCopyrightText: The openTCS Authors
// SPDX-License-Identifier: MIT
//
// HTTP client used by every `src/api/endpoints/*` module.
//
// Responsibilities:
//   1. Resolve a relative path against `runtimeConfig.bffBaseUrl`.
//   2. Inject the `X-Api-Access-Key` header when configured.
//   3. JSON-encode the request body and add the `Accept` header.
//   4. Map non-2xx responses to a typed `HttpError` (parsing the BFF
//      `ErrorResponse` schema when present) and `fetch`-throws to a
//      `NetworkError`.
//   5. Optionally emit a global toast on failures (controlled per-call via
//      `RequestOptions.toastOnError`, default `true`).
//
// What it intentionally does NOT do:
//   - Retries (the SSE client has its own backoff; HTTP retries are call-
//     specific and belong on top of this layer).
//   - Auto-401 refresh / login redirect (out of MVP scope; see roadmap S2
//     "运行时配置" — access-key is injected from runtime config only).

import { bffUrl, getRuntimeConfig } from '@/config/runtime';
import { HttpError, NetworkError, ParseError } from './errors';
import type { BffErrorResponse } from './types/bff';
import { toastError } from '@/ui/toast/toastBus';

const ACCESS_KEY_HEADER = 'X-Api-Access-Key';
const TRACE_ID_HEADER = 'X-Trace-Id';
const JSON_CONTENT_TYPE = 'application/json';

export interface RequestOptions {
  /** Optional `AbortSignal` to cancel the request. */
  signal?: AbortSignal;
  /** Extra headers (merged after default headers, so callers can override). */
  headers?: Record<string, string>;
  /**
   * Whether to surface failures via the global toast bus.
   * Defaults to `true` for HTTP errors and network errors.
   */
  toastOnError?: boolean;
}

interface RequestInternal extends RequestOptions {
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  path: string;
  body?: unknown;
  /** Raw body (e.g. FormData). Mutually exclusive with `body`. */
  rawBody?: BodyInit;
}

function buildHeaders(extra?: Record<string, string>): Headers {
  const headers = new Headers();
  headers.set('Accept', JSON_CONTENT_TYPE);
  const { bffAccessKey } = getRuntimeConfig();
  if (bffAccessKey) {
    headers.set(ACCESS_KEY_HEADER, bffAccessKey);
  }
  if (extra) {
    for (const [k, v] of Object.entries(extra)) {
      headers.set(k, v);
    }
  }
  return headers;
}

async function parseBody(response: Response): Promise<{
  bodyText: string;
  json: unknown;
  jsonOk: boolean;
}> {
  const bodyText = await response.text();
  if (!bodyText) {
    return { bodyText, json: null, jsonOk: false };
  }
  try {
    return { bodyText, json: JSON.parse(bodyText) as unknown, jsonOk: true };
  } catch {
    return { bodyText, json: null, jsonOk: false };
  }
}

function looksLikeBffError(json: unknown): json is BffErrorResponse {
  return (
    typeof json === 'object' &&
    json !== null &&
    typeof (json as Record<string, unknown>).code === 'string' &&
    typeof (json as Record<string, unknown>).message === 'string'
  );
}

function buildToastMessage(err: HttpError | NetworkError): string {
  if (err instanceof NetworkError) {
    return err.message;
  }
  // err is HttpError
  const base = err.payload?.message ?? `HTTP ${err.status} ${err.statusText}`;
  return err.traceId ? `${base}\ntraceId=${err.traceId}` : base;
}

async function doRequest<T>(req: RequestInternal): Promise<T> {
  const url = bffUrl(req.path);
  const headers = buildHeaders(req.headers);
  const init: RequestInit = {
    method: req.method,
    headers,
    signal: req.signal,
  };
  if (req.body !== undefined) {
    headers.set('Content-Type', JSON_CONTENT_TYPE);
    init.body = JSON.stringify(req.body);
  } else if (req.rawBody !== undefined) {
    init.body = req.rawBody;
  }

  let response: Response;
  try {
    response = await fetch(url, init);
  } catch (cause) {
    // Distinguish "user aborted" from a real network failure: aborts re-throw
    // so callers using AbortController can detect them via DOMException.name.
    if (cause instanceof DOMException && cause.name === 'AbortError') {
      throw cause;
    }
    const networkErr = new NetworkError(
      `Network error while requesting ${req.method} ${req.path}: ${
        cause instanceof Error ? cause.message : String(cause)
      }`,
      cause,
    );
    if (req.toastOnError !== false) {
      toastError(buildToastMessage(networkErr), 'BFF unreachable');
    }
    throw networkErr;
  }

  const { bodyText, json, jsonOk } = await parseBody(response);
  const traceId = response.headers.get(TRACE_ID_HEADER);

  if (!response.ok) {
    const payload = jsonOk && looksLikeBffError(json) ? json : null;
    const httpErr = new HttpError(response.status, response.statusText, payload, bodyText, traceId);
    if (req.toastOnError !== false) {
      toastError(buildToastMessage(httpErr), `BFF ${response.status} ${response.statusText}`);
    }
    throw httpErr;
  }

  // 204 No Content / empty body: return undefined cast to T (callers asking
  // for `void` are happy; callers asking for an object with required fields
  // would have already failed type-check upstream).
  if (!bodyText) {
    return undefined as T;
  }
  if (!jsonOk) {
    throw new ParseError(
      `Expected JSON response from ${req.method} ${req.path} but got non-JSON body (${bodyText.length} bytes)`,
    );
  }
  return json as T;
}

/* ------------------------------ Public API ------------------------------ */

export const apiClient = {
  get<T>(path: string, options?: RequestOptions): Promise<T> {
    return doRequest<T>({ method: 'GET', path, ...options });
  },
  post<T>(path: string, body?: unknown, options?: RequestOptions): Promise<T> {
    return doRequest<T>({ method: 'POST', path, body, ...options });
  },
  put<T>(path: string, body?: unknown, options?: RequestOptions): Promise<T> {
    return doRequest<T>({ method: 'PUT', path, body, ...options });
  },
  patch<T>(path: string, body?: unknown, options?: RequestOptions): Promise<T> {
    return doRequest<T>({ method: 'PATCH', path, body, ...options });
  },
  delete<T>(path: string, options?: RequestOptions): Promise<T> {
    return doRequest<T>({ method: 'DELETE', path, ...options });
  },
  /**
   * POST with a raw {@link BodyInit} (e.g. {@link FormData} for multipart uploads).
   * The `Content-Type` header is intentionally left unset so the browser supplies
   * the correct multipart boundary.
   */
  postRaw<T>(path: string, rawBody: BodyInit, options?: RequestOptions): Promise<T> {
    return doRequest<T>({ method: 'POST', path, rawBody, ...options });
  },
} as const;

export type ApiClient = typeof apiClient;
