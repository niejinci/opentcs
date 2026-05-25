// SPDX-FileCopyrightText: The openTCS Authors
// SPDX-License-Identifier: MIT
//
// S7 — BFF project CRUD + draft persistence + assets.
//
// Wire-format note: the SPA's in-memory draft (the `{ v: 2, points, … }`
// envelope owned by `useProjectStore`) is sent verbatim as the
// `DraftEnvelope.payload`; the BFF stores it without interpreting any
// field. Top-level `version` here is the BFF envelope version (currently 1)
// and is unrelated to the SPA's per-payload `v`.

import { apiClient } from '../client';
import { bffUrl } from '@/config/runtime';

export interface ProjectSummary {
  id: string;
  name: string;
  updatedAt: string;
  hasDraft: boolean;
}

export interface ProjectMeta {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  hasDraft: boolean;
  assets: string[];
}

export interface DraftEnvelope {
  version: number;
  savedAt?: string;
  payload: Record<string, unknown>;
}

export interface ProjectAsset {
  name: string;
  size: number;
  contentType: string;
  updatedAt: string;
}

const BASE = '/api/v1/projects';

export function listProjects(): Promise<ProjectSummary[]> {
  return apiClient.get<ProjectSummary[]>(BASE);
}

export function createProject(name: string, id?: string): Promise<ProjectMeta> {
  return apiClient.post<ProjectMeta>(BASE, id ? { name, id } : { name });
}

export function getProject(id: string): Promise<ProjectMeta> {
  return apiClient.get<ProjectMeta>(`${BASE}/${encodeURIComponent(id)}`);
}

export function renameProject(id: string, name: string): Promise<ProjectMeta> {
  return apiClient.patch<ProjectMeta>(`${BASE}/${encodeURIComponent(id)}`, { name });
}

export function deleteProject(id: string): Promise<void> {
  return apiClient.delete<void>(`${BASE}/${encodeURIComponent(id)}`);
}

export function copyProject(
  id: string,
  newName: string,
  newId?: string,
): Promise<ProjectMeta> {
  return apiClient.post<ProjectMeta>(
    `${BASE}/${encodeURIComponent(id)}/copy`,
    newId ? { newName, newId } : { newName },
  );
}

export function getDraft(
  id: string,
  options?: { toastOnError?: boolean; signal?: AbortSignal },
): Promise<DraftEnvelope> {
  return apiClient.get<DraftEnvelope>(
    `${BASE}/${encodeURIComponent(id)}/draft`,
    options,
  );
}

export function putDraft(
  id: string,
  envelope: DraftEnvelope,
  options?: { toastOnError?: boolean; signal?: AbortSignal },
): Promise<void> {
  return apiClient.put<void>(
    `${BASE}/${encodeURIComponent(id)}/draft`,
    envelope,
    options,
  );
}

export function listAssets(id: string): Promise<ProjectAsset[]> {
  return apiClient.get<ProjectAsset[]>(`${BASE}/${encodeURIComponent(id)}/assets`);
}

export function uploadAssets(id: string, files: File[]): Promise<ProjectAsset[]> {
  const form = new FormData();
  for (const f of files) {
    form.append('file', f, f.name);
  }
  return apiClient.postRaw<ProjectAsset[]>(
    `${BASE}/${encodeURIComponent(id)}/assets`,
    form,
  );
}

export function deleteAsset(id: string, name: string): Promise<void> {
  return apiClient.delete<void>(
    `${BASE}/${encodeURIComponent(id)}/assets/${encodeURIComponent(name)}`,
  );
}

/**
 * Public URL for an asset, suitable for `<img src>` and other resource loaders.
 * Note: callers that need the `X-Api-Access-Key` header (e.g. when the BFF is
 * deployed with an enforced key) must fetch the asset via `apiClient` instead.
 */
export function assetUrl(id: string, name: string): string {
  return bffUrl(
    `${BASE}/${encodeURIComponent(id)}/assets/${encodeURIComponent(name)}`,
  );
}
