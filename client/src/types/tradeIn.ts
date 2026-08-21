// Trade-in types — mirror the server's TradeInDTO (services/tradein.service.ts)
// and createTradeInSchema exactly.
//
// A trade-in is an ONLINE APPLICATION: the customer describes their device and
// JLP staff inspect and price it in the back-office. There is deliberately no
// automatic valuation anywhere in this flow — `quotedValue`/`finalValue` are
// null until a staff member enters them.

import type { ProductCondition } from './api';

export type TradeInStatus =
  | 'SUBMITTED'
  | 'REVIEWING'
  | 'QUOTED'
  | 'ACCEPTED'
  | 'DECLINED'
  | 'COMPLETED'
  | 'CANCELLED';

/** Contact details of the (account-less) applicant. */
export interface TradeInCustomer {
  name: string;
  email: string;
  phone: string;
}

/** The customer's SELF-REPORTED device details — staff verify on inspection. */
export interface TradeInDeviceInput {
  brand: string;
  model: string;
  storage?: string;
  color?: string;
  condition?: ProductCondition;
  batteryHealth?: number;
  imei?: string;
  hasBox?: boolean;
  hasCharger?: boolean;
  issues?: string;
  photos?: string[];
}

/** Request body for POST /api/trade-ins. No valuation is ever sent by the client. */
export interface CreateTradeInRequest {
  customer: TradeInCustomer;
  device: TradeInDeviceInput;
  /** Preferred drop-off / inspection branch. */
  branchId?: string;
}

/** Branch summary embedded in a trade-in (null when none was chosen). */
export interface TradeInBranch {
  id: string;
  name: string;
  city: string | null;
  province: string | null;
}

export interface TradeInDevice {
  brand: string;
  model: string;
  storage: string | null;
  color: string | null;
  condition: ProductCondition;
  batteryHealth: number | null;
  imei: string | null;
  hasBox: boolean;
  hasCharger: boolean;
  issues: string | null;
  photos: string[];
}

/** Full trade-in record (public confirmation + the admin detail view). */
export interface TradeInDTO {
  id: string;
  reference: string;
  status: TradeInStatus;
  customer: TradeInCustomer;
  device: TradeInDevice;
  branch: TradeInBranch | null;
  /** Staff-entered offer — null until a staff member prices the device. */
  quotedValue: number | null;
  /** Staff-entered agreed settlement — null until the deal closes. */
  finalValue: number | null;
  staffNotes: string | null;
  createdAt: string;
  updatedAt: string;
}
