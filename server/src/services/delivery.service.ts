import { Prisma, OrderStatus, ShipmentStatus } from '@prisma/client';
import { WAREHOUSE, deriveDestination, estimateArrival, noteForStatus, DEFAULT_COURIER } from '../config/delivery';

/**
 * A delivery provider abstracts *how* a shipment is created and tracked, so the
 * order system never touches courier specifics. A real courier API (LBC, J&T,
 * Ninja Van…) can implement this later WITHOUT changing order creation — and,
 * per our security rules, any secret keys it needs live only in server env.
 */
export interface DeliveryProvider {
  /**
   * Build the shipment to attach to a newly-created order. Returned as a Prisma
   * nested-create input so it composes into the order's own `$transaction`.
   */
  newShipmentForOrder(city: string, orderNumber: string, now: Date): Prisma.ShipmentCreateWithoutOrderInput;
}

/**
 * The default provider for this build. It is honest about being a SIMULATION —
 * the "position" is a fixed reference route through Metro Manila (see
 * `config/delivery.ts`), never real GPS. Every shipment starts PENDING at the
 * warehouse with a single RECEIVED tracking entry; the fulfillment state-machine
 * advances it along the route as an admin moves the order forward.
 */
export class SimulatedDeliveryProvider implements DeliveryProvider {
  newShipmentForOrder(city: string, orderNumber: string, now: Date): Prisma.ShipmentCreateWithoutOrderInput {
    const dest = deriveDestination(city);
    return {
      status: ShipmentStatus.PENDING,
      courier: DEFAULT_COURIER,
      trackingCode: `IEX${orderNumber}`,
      originLat: WAREHOUSE.lat,
      originLng: WAREHOUSE.lng,
      destLat: dest.lat,
      destLng: dest.lng,
      currentLat: WAREHOUSE.lat,
      currentLng: WAREHOUSE.lng,
      estimatedArrival: estimateArrival(now),
      history: {
        create: [
          {
            status: OrderStatus.RECEIVED,
            note: noteForStatus(OrderStatus.RECEIVED),
            lat: WAREHOUSE.lat,
            lng: WAREHOUSE.lng,
          },
        ],
      },
    };
  }
}

/** Singleton used by the order service. Swap this line to change providers. */
export const deliveryProvider: DeliveryProvider = new SimulatedDeliveryProvider();
