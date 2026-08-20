import {
  Prisma,
  ProductStatus,
  InventoryTxnType,
  OrderStatus,
  type PaymentMethod,
  type ShipmentStatus,
} from '@prisma/client';
import { prisma } from '../config/prisma';
import { ApiError } from '../utils/ApiError';
import { money } from '../utils/money';
import { computeDeliveryFee } from '../config/order';
import { recordInventoryChange } from './inventory.service';
import { paymentProvider, paymentInstructions } from './payment.service';
import { deliveryProvider } from './delivery.service';
import { routeFor, type GeoPoint } from '../config/delivery';
import { logAudit } from './audit.service';
import { manilaDateStamp } from '../utils/time';

// ── Inputs (already validated + coerced by the order validator) ──────────────

export interface OrderItemInput {
  variantId: string;
  quantity: number;
}

export interface CreateOrderInput {
  customer: { name: string; email: string; phone: string };
  address: {
    addressLine: string;
    barangay: string;
    city: string;
    province: string;
    postalCode: string;
    addressNote?: string;
  };
  paymentMethod: PaymentMethod;
  items: OrderItemInput[];
}

// ── Order-number generation ──────────────────────────────────────────────────

/**
 * Next human-facing order number for today: ORD-YYYYMMDD-####. Sequence is the
 * count of today's orders + 1. Computed inside the transaction; a rare race
 * (two orders racing for the same number) surfaces as a P2002 on the unique
 * `orderNumber` and is retried by the caller.
 */
async function nextOrderNumber(tx: Prisma.TransactionClient, now: Date): Promise<string> {
  const stamp = manilaDateStamp(now);
  const prefix = `ORD-${stamp}-`;
  const todayCount = await tx.order.count({ where: { orderNumber: { startsWith: prefix } } });
  return `${prefix}${String(todayCount + 1).padStart(4, '0')}`;
}

// ── DTO shaping (Decimal → number for the client) ────────────────────────────

export const orderInclude = {
  items: {
    orderBy: { createdAt: 'asc' },
    include: {
      variant: {
        select: {
          imageUrl: true,
          product: { select: { slug: true, images: { orderBy: { position: 'asc' }, take: 1 } } },
        },
      },
    },
  },
  payment: true,
  // Fulfillment + tracking timeline (admin detail; guest lookup ignores it).
  shipment: { include: { history: { orderBy: { createdAt: 'asc' } } } },
} satisfies Prisma.OrderInclude;

type OrderRow = Prisma.OrderGetPayload<{ include: typeof orderInclude }>;

/** A {lat,lng} pair, or null when either coordinate is missing (nullable Float columns). */
function toPoint(lat: number | null, lng: number | null): GeoPoint | null {
  return lat !== null && lng !== null ? { lat, lng } : null;
}

/** Shape a shipment (with its history) into the client DTO, surfacing simulated geo. */
function toShipmentDTO(s: NonNullable<OrderRow['shipment']>): NonNullable<OrderDTO['shipment']> {
  const destination = toPoint(s.destLat, s.destLng);
  return {
    status: s.status,
    courier: s.courier,
    trackingCode: s.trackingCode,
    estimatedArrival: s.estimatedArrival?.toISOString() ?? null,
    deliveredAt: s.deliveredAt?.toISOString() ?? null,
    origin: toPoint(s.originLat, s.originLng),
    destination,
    current: toPoint(s.currentLat, s.currentLng),
    route: destination ? routeFor(destination) : [],
    history: s.history.map((h) => ({
      status: h.status,
      note: h.note,
      lat: h.lat,
      lng: h.lng,
      createdAt: h.createdAt.toISOString(),
    })),
  };
}

export interface OrderDTO {
  orderNumber: string;
  status: OrderStatus;
  paymentMethod: PaymentMethod;
  paymentStatus: string;
  placedAt: string;
  customer: { name: string; email: string; phone: string };
  address: {
    addressLine: string;
    barangay: string;
    city: string;
    province: string;
    postalCode: string;
    addressNote: string | null;
  };
  items: {
    productName: string;
    variantLabel: string;
    sku: string;
    slug: string | null;
    image: string | null;
    unitPrice: number;
    quantity: number;
    lineTotal: number;
  }[];
  subtotal: number;
  deliveryFee: number;
  discount: number;
  total: number;
  payment: { reference: string | null; instructions: string };
  updatedAt: string;
  /** Fulfillment + tracking timeline (+ simulated geo). Present once a shipment exists; null otherwise. */
  shipment: {
    status: ShipmentStatus;
    courier: string | null;
    trackingCode: string | null;
    estimatedArrival: string | null;
    deliveredAt: string | null;
    /** Simulated coordinates — NOT real GPS. Null when a shipment has no geo. */
    origin: GeoPoint | null;
    destination: GeoPoint | null;
    current: GeoPoint | null;
    /** The full simulated route toward the destination ([] when no destination). */
    route: { status: OrderStatus; note: string; lat: number; lng: number }[];
    history: { status: OrderStatus; note: string | null; lat: number | null; lng: number | null; createdAt: string }[];
  } | null;
}

export function toOrderDTO(o: OrderRow): OrderDTO {
  return {
    orderNumber: o.orderNumber,
    status: o.status,
    paymentMethod: o.paymentMethod,
    paymentStatus: o.paymentStatus,
    placedAt: o.createdAt.toISOString(),
    customer: { name: o.customerName, email: o.customerEmail, phone: o.customerPhone },
    address: {
      addressLine: o.addressLine,
      barangay: o.barangay,
      city: o.city,
      province: o.province,
      postalCode: o.postalCode,
      addressNote: o.addressNote,
    },
    items: o.items.map((it) => ({
      productName: it.productName,
      variantLabel: it.variantLabel,
      sku: it.sku,
      slug: it.variant?.product.slug ?? null,
      image: it.variant?.imageUrl ?? it.variant?.product.images[0]?.url ?? null,
      unitPrice: it.unitPrice.toNumber(),
      quantity: it.quantity,
      lineTotal: it.lineTotal.toNumber(),
    })),
    subtotal: o.subtotal.toNumber(),
    deliveryFee: o.deliveryFee.toNumber(),
    discount: o.discount.toNumber(),
    total: o.total.toNumber(),
    // Instructions are re-derived (pure fn) rather than stored; reference is persisted.
    payment: {
      reference: o.payment?.reference ?? null,
      instructions: paymentInstructions(o.paymentMethod, o.total.toNumber()),
    },
    updatedAt: o.updatedAt.toISOString(),
    shipment: o.shipment ? toShipmentDTO(o.shipment) : null,
  };
}

// ── Create ───────────────────────────────────────────────────────────────────

/**
 * Create a guest order. This is the security-critical path:
 *
 *   1. The client sends only { variantId, quantity } per line — NEVER prices or
 *      names. We look every variant up server-side and re-derive money.
 *   2. Availability (active product + active variant + sufficient stock) is
 *      re-validated here, not trusted from the client.
 *   3. Order creation, inventory deduction (SALE ledger rows) and the soldQty
 *      bump all run inside ONE $transaction. `recordInventoryChange` re-reads
 *      on-hand stock inside the txn and refuses to go negative, so two orders
 *      racing for the last unit cannot oversell — the loser's transaction
 *      aborts and the whole order rolls back.
 */
export async function createOrder(input: CreateOrderInput): Promise<OrderDTO> {
  if (input.items.length === 0) {
    throw ApiError.badRequest('Your cart is empty.');
  }

  // Merge duplicate variant lines (defensive — client shouldn't send dupes).
  const mergedQty = new Map<string, number>();
  for (const it of input.items) {
    mergedQty.set(it.variantId, (mergedQty.get(it.variantId) ?? 0) + it.quantity);
  }
  const variantIds = [...mergedQty.keys()];

  const now = new Date();

  // Retry only on an order-number collision (concurrent orders same day).
  const MAX_ATTEMPTS = 5;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      const orderId = await prisma.$transaction(
        async (tx) => {
          // Load every requested variant with the data we need to validate + snapshot.
          const variants = await tx.productVariant.findMany({
            where: { id: { in: variantIds } },
            select: {
              id: true,
              sku: true,
              storage: true,
              color: true,
              price: true,
              stock: true,
              isActive: true,
              product: { select: { name: true, status: true } },
            },
          });
          const byId = new Map(variants.map((v) => [v.id, v]));

          // Build validated, price-authoritative line items.
          const lines = variantIds.map((variantId) => {
            const v = byId.get(variantId);
            const quantity = mergedQty.get(variantId)!;

            if (!v || !v.isActive || v.product.status !== ProductStatus.ACTIVE) {
              throw ApiError.unprocessable('One or more items are no longer available.', {
                variantId,
                reason: 'unavailable',
              });
            }
            if (v.stock < quantity) {
              throw ApiError.conflict('Not enough stock for one or more items.', {
                variantId,
                sku: v.sku,
                productName: v.product.name,
                requested: quantity,
                available: v.stock,
              });
            }

            const unitPrice = v.price; // authoritative price from the DB
            return {
              variantId: v.id,
              productName: v.product.name,
              variantLabel: `${v.storage} · ${v.color}`,
              sku: v.sku,
              unitPrice,
              quantity,
              lineTotal: unitPrice.mul(quantity),
            };
          });

          const subtotal = lines.reduce((acc, l) => acc.add(l.lineTotal), new Prisma.Decimal(0));
          const deliveryFee = money(computeDeliveryFee(subtotal.toNumber()));
          const total = subtotal.add(deliveryFee);
          const orderNumber = await nextOrderNumber(tx, now);
          const pay = paymentProvider.initiate(input.paymentMethod, total.toNumber(), orderNumber);

          const order = await tx.order.create({
            data: {
              orderNumber,
              customerName: input.customer.name,
              customerEmail: input.customer.email,
              customerPhone: input.customer.phone,
              addressLine: input.address.addressLine,
              barangay: input.address.barangay,
              city: input.address.city,
              province: input.address.province,
              postalCode: input.address.postalCode,
              addressNote: input.address.addressNote ?? null,
              subtotal,
              deliveryFee,
              total,
              paymentMethod: input.paymentMethod,
              paymentStatus: pay.status,
              status: OrderStatus.RECEIVED,
              items: {
                create: lines.map((l) => ({
                  variantId: l.variantId,
                  productName: l.productName,
                  variantLabel: l.variantLabel,
                  sku: l.sku,
                  unitPrice: l.unitPrice,
                  quantity: l.quantity,
                  lineTotal: l.lineTotal,
                })),
              },
              payment: {
                create: {
                  method: input.paymentMethod,
                  status: pay.status,
                  amount: total,
                  reference: pay.reference,
                },
              },
              // Attach a simulated shipment (origin=warehouse, dest derived from
              // the delivery city) so every order is trackable from the moment
              // it's placed. SIMULATED — see delivery.service.ts.
              shipment: {
                create: deliveryProvider.newShipmentForOrder(input.address.city, orderNumber, now),
              },
            },
            select: { id: true },
          });

          // Deduct stock through the ledger (atomic guarded update, rejects
          // oversell) and bump lifetime soldQty for best-seller analytics — all
          // in this txn. Deduct in a stable variantId order (not cart order) so
          // two concurrent multi-line orders touching the same variants always
          // take row locks in the same sequence, avoiding ABBA deadlocks. Order
          // items keep their original display order — only lock acquisition is
          // reordered here.
          const deductionOrder = [...lines].sort((a, b) => a.variantId.localeCompare(b.variantId));
          for (const l of deductionOrder) {
            await recordInventoryChange(tx, {
              variantId: l.variantId,
              type: InventoryTxnType.SALE,
              quantityChanged: -l.quantity,
              reason: `Sale — ${orderNumber}`,
              orderId: order.id,
            });
            await tx.productVariant.update({
              where: { id: l.variantId },
              data: { soldQty: { increment: l.quantity } },
            });
          }

          return order.id;
        },
        // Neon is a networked/serverless Postgres: allow generous time both to
        // acquire a pooled connection (maxWait) and to run the multi-step order
        // transaction (timeout), instead of Prisma's tight 2s/5s defaults.
        { maxWait: 15_000, timeout: 30_000 },
      );

      // Best-effort audit (outside the txn — never blocks the order).
      const dto = await loadOrderById(orderId);
      await logAudit({
        action: 'order.create',
        entityType: 'Order',
        entityId: orderId,
        meta: { orderNumber: dto.orderNumber, total: dto.total, items: dto.items.length },
      });
      return dto;
    } catch (err) {
      const isNumberCollision =
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === 'P2002' &&
        String((err.meta as { target?: unknown } | undefined)?.target ?? '').includes('orderNumber');
      if (isNumberCollision && attempt < MAX_ATTEMPTS) {
        continue; // regenerate the number and try again
      }
      throw err;
    }
  }

  // Exhausted retries purely due to number collisions.
  throw ApiError.conflict('Could not allocate an order number, please try again.');
}

// ── Lookup ─────────────────────────────────────────────────────────────────

async function loadOrderById(id: string): Promise<OrderDTO> {
  const order = await prisma.order.findUniqueOrThrow({ where: { id }, include: orderInclude });
  return toOrderDTO(order);
}

/**
 * Load a full order DTO by its human-facing number, with NO email/PII guard.
 * For **session-gated admin** use only (the guest route keeps `getOrderForGuest`,
 * which additionally requires the customer's email to match).
 */
export async function loadOrderDTOByNumber(orderNumber: string): Promise<OrderDTO> {
  const order = await prisma.order.findUnique({ where: { orderNumber }, include: orderInclude });
  if (!order) {
    throw ApiError.notFound('Order not found');
  }
  return toOrderDTO(order);
}

/**
 * Look up an order for a guest. Requires the customer's email to match (case-
 * insensitive) — order numbers alone are somewhat guessable, and orders carry
 * PII (name, address, phone), so we never expose one on the order number only.
 * A mismatch returns 404 (not 403) so we don't confirm that a number exists.
 */
export async function getOrderForGuest(orderNumber: string, email: string): Promise<OrderDTO> {
  const order = await prisma.order.findUnique({
    where: { orderNumber },
    include: orderInclude,
  });
  if (!order || order.customerEmail.toLowerCase() !== email.trim().toLowerCase()) {
    throw ApiError.notFound('Order not found. Check the order number and email.');
  }
  return toOrderDTO(order);
}
