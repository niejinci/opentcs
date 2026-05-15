// SPDX-FileCopyrightText: The openTCS Authors
// SPDX-License-Identifier: MIT
//
// Runtime configuration for the SPA.
//
// All BFF-bound runtime knobs live here so that components / API client /
// SSE client never read `import.meta.env` directly. This keeps the surface
// area small enough to be re-pointed by a future "user logs in -> get
// access-key" flow without touching call sites.
//
// Conventions:
// - `VITE_BFF_BASE_URL`  empty in dev (Vite proxy makes BFF same-origin);
//                        in prod typically also empty (nginx reverse-proxy).
// - `VITE_BFF_ACCESS_KEY` empty disables auth (matches BFF default
//                        `bff.security.accessKey=""`); MVP dev default.

export interface RuntimeConfig {
  /** Absolute base URL for BFF requests. Empty string => same-origin. */
  bffBaseUrl: string;
  /** Value of the `X-Api-Access-Key` header. Empty => header omitted. */
  bffAccessKey: string;
}

function readEnv(): RuntimeConfig {
  // import.meta.env values are inlined by Vite at build-time. Trim to
  // tolerate trailing whitespace in `.env.local` files.
  const rawBase = (import.meta.env.VITE_BFF_BASE_URL ?? '').trim();
  const rawKey = (import.meta.env.VITE_BFF_ACCESS_KEY ?? '').trim();
  // Strip a single trailing slash so callers can safely concatenate "/api/...".
  const bffBaseUrl = rawBase.endsWith('/') ? rawBase.slice(0, -1) : rawBase;
  return { bffBaseUrl, bffAccessKey: rawKey };
}

const runtimeConfig: RuntimeConfig = readEnv();

/** Returns the (frozen) runtime configuration. */
export function getRuntimeConfig(): Readonly<RuntimeConfig> {
  return runtimeConfig;
}

/**
 * Builds an absolute URL for a BFF endpoint path (must start with "/").
 * When `bffBaseUrl` is empty (dev / nginx-same-origin), the path is returned
 * verbatim so the browser hits the current origin (and Vite's proxy).
 */
export function bffUrl(path: string): string {
  if (!path.startsWith('/')) {
    throw new Error(`bffUrl: path must start with "/", got: ${path}`);
  }
  return runtimeConfig.bffBaseUrl + path;
}
