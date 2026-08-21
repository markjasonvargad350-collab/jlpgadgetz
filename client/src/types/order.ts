// Order types — mirror the server's OrderDTO (services/order.service.ts) and the
// createOrderSchema validator exactly. Money fields are display numbers; the
// server always re-derives the authoritative totals at order time.

export type PaymentMethod = 'COD' | 'GCASH' | 'BANK_TRANSFER';

export type OrderStatus =
  | 'RECEIVED'
  | 'PROCESSING'
  | 'PACKED'
  | 'SHIPPED'
  | 'IN_TRANSIT'
  | 'OUT_FOR_DELIVERY'
  | 'DELIVERED'
  | 'CANCELLED';

export type PaymentStatus = 'PENDING' | 'PAID' | 'FAILED' | 'REFUNDED';

/** Shipment lifecycle (distinct from OrderStatus; Phase 9 drives it live). */
export type ShipmentStatus =
  | 'PENDING'
  | 'PREPARING'
  | 'IN_TRANSIT'
  | 'OUT_FOR_DELIVERY'
  | 'DELIVERED'
  | 'FAILED';

/** Contact + shipping details collected at checkout. */
export interface CheckoutCustomer {
  name: string;
  email: string;
  phone: string;
}

export interface CheckoutAddress {
  addressLine: string;
  barangay: string;
  city: string;
  province: string;
  postalCode: string;
  addressNote?: string;
}

/**
 * Request body for POST /api/orders. Note items carry ONLY { variantId,
 * quantity } — never prices or names. The server looks every variant up and
 * re-derives money, so the client cannot influence the amount charged.
 */
export interface CreateOrderRequest {
  customer: CheckoutCustomer;
  address: CheckoutAddress;
  paymentMethod: PaymentMethod;
  items: { variantId: string; quantity: number }[];
  /**
   * Preferred JLP branch. Optional and purely informational — stock is global,
   * so this never changes prices or availability.
   */
  branchId?: string;
}

export interface OrderItemDTO {
  productName: string;
  variantLabel: string;
  sku: string;
  slug: string | null;
  image: string | null;
  unitPrice: number;
  quantity: number;
  lineTotal: number;
}

/** One recorded step in an order's fulfillment history (append-only). */
export interface TrackingEntry {
  status: OrderStatus;
  note: string | null;
  /** Simulated coordinates — NOT real GPS. Null on entries without geo. */
  lat: number | null;
  lng: number | null;
  createdAt: string;
}

/** A simulated map coordinate (NOT real GPS). */
export interface GeoPoint {
  lat: number;
  lng: number;
}

/** One milestone on the simulated delivery route. */
export interface RouteWaypoint {
  status: OrderStatus;
  note: string;
  lat: number;
  lng: number;
}

/**
 * Shipment snapshot attached to an order. `status` follows ShipmentStatus,
 * driven live by the fulfillment state-machine. Coordinates are SIMULATED —
 * a fixed reference route through Metro Manila, not real GPS.
 */
export interface ShipmentDTO {
  status: ShipmentStatus;
  courier: string | null;
  trackingCode: string | null;
  estimatedArrival: string | null;
  deliveredAt: string | null;
  origin: GeoPoint | null;
  destination: GeoPoint | null;
  current: GeoPoint | null;
  route: RouteWaypoint[];
  history: TrackingEntry[];
}

export interface OrderDTO {
  orderNumber: string;
  status: OrderStatus;
  paymentMethod: PaymentMethod;
  paymentStatus: PaymentStatus;
  placedAt: string;
  customer: CheckoutCustomer;
  address: {
    addressLine: string;
    barangay: string;
    city: string;
    province: string;
    postalCode: string;
    addressNote: string | null;
  };
  items: OrderItemDTO[];
  subtotal: number;
  deliveryFee: number;
  discount: number;
  total: number;
  payment: { reference: string | null; instructions: string };
  updatedAt: string;
  shipment: ShipmentDTO | null;
}

/** Shape of the 409 `details` payload when an item is out of stock at checkout. */
export interface StockConflictDetails {
  variantId: string;
  sku: string;
  productName: string;
  requested: number;
  available: number;
}
