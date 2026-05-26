// SPDX-FileCopyrightText: The openTCS Authors
// SPDX-License-Identifier: MIT
//
// S8 — publish a project's draft to the openTCS Kernel.

import { apiClient } from '../client';

export interface PublishRequest {
  projectId: string;
  modelName?: string;
  dryRun?: boolean;
}

export interface PublishDiff {
  pointCount: number;
  pathCount: number;
  locationCount: number;
  locationTypeCount: number;
  blockCount: number;
  vehicleCount: number;
}

export interface PublishResponse {
  ok: boolean;
  modelName?: string;
  publishedAt?: string;
  diff?: PublishDiff;
}

const PUBLISH_URL = '/api/v1/plant-models/publish';

export function publishPlantModel(
  req: PublishRequest,
  options?: { toastOnError?: boolean; signal?: AbortSignal },
): Promise<PublishResponse> {
  return apiClient.post<PublishResponse>(PUBLISH_URL, req, options);
}
