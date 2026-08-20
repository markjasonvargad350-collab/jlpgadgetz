/**
 * Delivery-domain simulation rules — the SINGLE source of truth for the
 * simulated courier geo/route, shared by the seed, order creation, and the
 * fulfillment state-machine so they can never drift.
 *
 * ⚠️  SIMULATED — NOT REAL GPS. Coordinates are fixed Metro-Manila reference
 * points and a curated per-city *centroid* table (not a geocoder). A real
 * courier API can later replace `delivery.service.ts` without touching the
 * order system. Everything here is deterministic and side-effect free.
 */
import { OrderStatus, ShipmentStatus } from '@prisma/client';

export interface GeoPoint {
  lat: number;
  lng: number;
}

interface NamedPlace extends GeoPoint {
  label: string;
}

/** One milestone on the simulated route: a status, its note, and where it sits. */
export interface RouteWaypoint {
  status: OrderStatus;
  note: string;
  lat: number;
  lng: number;
}

// ── Fixed reference points (Metro Manila) ────────────────────────────────────

export const WAREHOUSE: NamedPlace = { lat: 14.5995, lng: 120.9842, label: 'iStore Warehouse — Manila' };
export const HUB: NamedPlace = { lat: 14.6349, lng: 121.0177, label: 'Distribution Hub — San Juan' };

/** Fallback destination (~geographic centre of Metro Manila) for unknown cities. */
export const METRO_CENTER: GeoPoint = { lat: 14.5833, lng: 121.0 };

/**
 * Curated Metro-Manila city centroids (lowercased keys). These are approximate
 * *centres*, deliberately NOT precise addresses — this is a simulation, not a
 * geocoding service. Unknown cities fall back to `METRO_CENTER`.
 */
const CITY_COORDS: Record<string, GeoPoint> = {
  'quezon city': { lat: 14.676, lng: 121.0437 },
  makati: { lat: 14.5547, lng: 121.0244 },
  mandaluyong: { lat: 14.5794, lng: 121.0359 },
  manila: { lat: 14.5995, lng: 120.9842 },
  pasig: { lat: 14.5764, lng: 121.0851 },
  taguig: { lat: 14.5176, lng: 121.0509 },
  'san juan': { lat: 14.6019, lng: 121.0355 },
  pasay: { lat: 14.5378, lng: 120.9896 },
  paranaque: { lat: 14.4793, lng: 121.0198 },
  'parañaque': { lat: 14.4793, lng: 121.0198 },
  'las pinas': { lat: 14.4499, lng: 120.9833 },
  'las piñas': { lat: 14.4499, lng: 120.9833 },
  muntinlupa: { lat: 14.3832, lng: 121.0409 },
  marikina: { lat: 14.6507, lng: 121.1029 },
  valenzuela: { lat: 14.7011, lng: 120.983 },
  malabon: { lat: 14.6626, lng: 120.9568 },
  navotas: { lat: 14.6663, lng: 120.9414 },
  caloocan: { lat: 14.6499, lng: 120.9809 },
  pateros: { lat: 14.5451, lng: 121.0664 },
};

/**
 * Simulated delivery destination for a city name. A curated centroid if known,
 * otherwise the Metro-Manila centre. NOT a geocode — approximate by design.
 */
export function deriveDestination(city: string): GeoPoint {
  const key = city.trim().toLowerCase();
  return CITY_COORDS[key] ?? METRO_CENTER;
}

// ── Milestones, notes & the route ─────────────────────────────────────────────

/** Ordered forward milestones (no CANCELLED — that's a terminal off-route state). */
export const MILESTONE_ORDER: OrderStatus[] = [
  OrderStatus.RECEIVED,
  OrderStatus.PROCESSING,
  OrderStatus.PACKED,
  OrderStatus.SHIPPED,
  OrderStatus.IN_TRANSIT,
  OrderStatus.OUT_FOR_DELIVERY,
  OrderStatus.DELIVERED,
];

/** Canonical customer-facing note for a fulfillment milestone (one shared copy). */
export function noteForStatus(status: OrderStatus): string {
  switch (status) {
    case OrderStatus.RECEIVED:
      return 'Order placed and confirmed.';
    case OrderStatus.PROCESSING:
      return 'Preparing your order.';
    case OrderStatus.PACKED:
      return 'Packed at the warehouse.';
    case OrderStatus.SHIPPED:
      return 'Handed to the courier.';
    case OrderStatus.IN_TRANSIT:
      return 'Arrived at the distribution hub.';
    case OrderStatus.OUT_FOR_DELIVERY:
      return 'Out for delivery.';
    case OrderStatus.DELIVERED:
      return 'Delivered — thank you!';
    case OrderStatus.CANCELLED:
      return 'Order cancelled — inventory restocked.';
  }
}

/**
 * Where the courier sits at a given milestone: warehouse for the pre-dispatch
 * steps, the hub in transit, near-then-at the destination for the last legs.
 */
export function waypointForStatus(status: OrderStatus, dest: GeoPoint): GeoPoint {
  switch (status) {
    case OrderStatus.RECEIVED:
    case OrderStatus.PROCESSING:
    case OrderStatus.PACKED:
    case OrderStatus.SHIPPED:
      return { lat: WAREHOUSE.lat, lng: WAREHOUSE.lng };
    case OrderStatus.IN_TRANSIT:
      return { lat: HUB.lat, lng: HUB.lng };
    case OrderStatus.OUT_FOR_DELIVERY:
      return { lat: dest.lat - 0.02, lng: dest.lng - 0.015 };
    case OrderStatus.DELIVERED:
      return { lat: dest.lat, lng: dest.lng };
    case OrderStatus.CANCELLED:
      // Off-route terminal state — stay put at origin (callers don't move current).
      return { lat: WAREHOUSE.lat, lng: WAREHOUSE.lng };
  }
}

/** The full ordered set of route waypoints toward a destination. */
export function routeFor(dest: GeoPoint): RouteWaypoint[] {
  return MILESTONE_ORDER.map((status) => {
    const wp = waypointForStatus(status, dest);
    return { status, note: noteForStatus(status), lat: wp.lat, lng: wp.lng };
  });
}

/** Map an order's fulfillment status onto the (coarser) shipment lifecycle. */
export function orderToShipmentStatus(status: OrderStatus): ShipmentStatus {
  switch (status) {
    case OrderStatus.RECEIVED:
      return ShipmentStatus.PENDING;
    case OrderStatus.PROCESSING:
    case OrderStatus.PACKED:
      return ShipmentStatus.PREPARING;
    case OrderStatus.SHIPPED:
    case OrderStatus.IN_TRANSIT:
      return ShipmentStatus.IN_TRANSIT;
    case OrderStatus.OUT_FOR_DELIVERY:
      return ShipmentStatus.OUT_FOR_DELIVERY;
    case OrderStatus.DELIVERED:
      return ShipmentStatus.DELIVERED;
    case OrderStatus.CANCELLED:
      return ShipmentStatus.FAILED;
  }
}

// ── Courier + ETA ─────────────────────────────────────────────────────────────

export const DEFAULT_COURIER = 'iStore Express';

/** Simulated lead time from dispatch to arrival. */
export const ETA_HOURS = 72;

/** Estimated arrival = now + ETA_HOURS (simulated, fixed lead time). */
export function estimateArrival(now: Date): Date {
  return new Date(now.getTime() + ETA_HOURS * 60 * 60 * 1000);
}
