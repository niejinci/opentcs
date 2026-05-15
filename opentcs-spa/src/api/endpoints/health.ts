// SPDX-FileCopyrightText: The openTCS Authors
// SPDX-License-Identifier: MIT
import { apiClient } from '../client';
import type { HealthResponse } from '../types/bff';

/**
 * Calls `GET /health`. Always sent without `toastOnError` because the
 * Debug page wants to display failures inline rather than as a toast.
 */
export function getHealth(): Promise<HealthResponse> {
  return apiClient.get<HealthResponse>('/health', { toastOnError: false });
}
