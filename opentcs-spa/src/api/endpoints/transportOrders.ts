// SPDX-FileCopyrightText: The openTCS Authors
// SPDX-License-Identifier: MIT
//
// S9 — `POST /api/v1/transport-orders`.
//
// Single endpoint for now; list / cancel / withdraw arrive when (and if)
// the BFF grows GET / DELETE counterparts. SPA-side "order history" in
// S9 is a live SSE-fed list — refresh on page reload is acceptable (see
// README "known limitations").

import { apiClient } from '../client';
import type { TransportOrder, TransportOrderRequest } from '../types/bff';

/** `POST /api/v1/transport-orders` — submit a new transport order. */
export function createTransportOrder(
  request: TransportOrderRequest,
  options?: { toastOnError?: boolean },
): Promise<TransportOrder> {
  return apiClient.post<TransportOrder>('/api/v1/transport-orders', request, options);
}
