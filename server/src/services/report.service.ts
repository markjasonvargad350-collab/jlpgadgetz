import { OrderStatus, PaymentMethod, PaymentStatus, Prisma } from '@prisma/client';
import { prisma } from '../config/prisma';
import { manilaDayStartUTC, manilaDateStamp } from '../utils/time';

/**
 * Reports summary — the numbers behind the admin dashboard + Reports page.
 *
 * Design choices that keep the figures honest:
 *  • **Revenue = SUM(total) where status ≠ CANCELLED.** COD counts as booked
 *    revenue the moment an order is placed; a cancelled order is fully removed
 *    (its stock was restocked, its payment refunded). `paidRevenueAllTime`
 *    (paymentStatus = PAID) is exposed separately as the "actually collected"
 *    figure.
 *  • **All "day" boundaries are Manila calendar days.** PH has no DST, so the
 *    UTC instant of a Manila start-of-day is exact arithmetic (see utils/time).
 *    Every window (today / 7d / 30d) and the daily series agree on where a day
 *    begins — no server-timezone drift.
 *  • **revenueByDay is bucketed in JS, not raw SQL.** Prisma hands back proper
 *    UTC instants regardless of the column's tz-ness, so bucketing with the
 *    shared Manila helpers is both correct and free of the raw-SQL
 *    numeric-as-string trap. The set is bounded (≤30 days of orders).
 */

/** Round JS-summed money to 2 dp so float addition can't leak sub-centavo drift. */
function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/** Orders + revenue for one window. `gte` omitted → all-time. Excludes cancelled. */
async function windowKpis(gte?: Date): Promise<{ orders: number; revenue: number }> {
  const where: Prisma.OrderWhereInput = { status: { not: OrderStatus.CANCELLED } };
  if (gte) where.createdAt = { gte };
  const agg = await prisma.order.aggregate({ _count: true, _sum: { total: true }, where });
  return { orders: agg._count, revenue: round2(agg._sum.total?.toNumber() ?? 0) };
}

export async function getReportSummary() {
  // KPI windows (Manila days): today, trailing 7 (incl. today), trailing 30, all-time.
  const [today, last7Days, last30Days, allTime, paidAgg] = await Promise.all([
    windowKpis(manilaDayStartUTC(0)),
    windowKpis(manilaDayStartUTC(6)),
    windowKpis(manilaDayStartUTC(29)),
    windowKpis(),
    prisma.order.aggregate({ _sum: { total: true }, where: { paymentStatus: PaymentStatus.PAID } }),
  ]);

  const paidRevenueAllTime = round2(paidAgg._sum.total?.toNumber() ?? 0);
  const averageOrderValue = allTime.orders ? round2(allTime.revenue / allTime.orders) : 0;

  // ── Status breakdown (all orders, every status zero-filled) ──
  const statusRows = await prisma.order.groupBy({ by: ['status'], _count: { _all: true } });
  const statusMap = new Map(statusRows.map((r) => [r.status, r._count._all]));
  const statusBreakdown = Object.values(OrderStatus).map((status) => ({
    status,
    count: statusMap.get(status) ?? 0,
  }));

  // ── Payment mix (non-cancelled; every method zero-filled) ──
  const payRows = await prisma.order.groupBy({
    by: ['paymentMethod'],
    where: { status: { not: OrderStatus.CANCELLED } },
    _count: { _all: true },
    _sum: { total: true },
  });
  const payMap = new Map(
    payRows.map((r) => [r.paymentMethod, { count: r._count._all, total: round2(r._sum.total?.toNumber() ?? 0) }]),
  );
  const paymentMix = Object.values(PaymentMethod).map((method) => ({
    method,
    count: payMap.get(method)?.count ?? 0,
    total: payMap.get(method)?.total ?? 0,
  }));

  // ── Top products by units sold (groups the snapshot productName → survives
  //    variant deletion; non-cancelled only) ──
  const topRows = await prisma.orderItem.groupBy({
    by: ['productName'],
    where: { order: { status: { not: OrderStatus.CANCELLED } } },
    _sum: { quantity: true, lineTotal: true },
    orderBy: { _sum: { quantity: 'desc' } },
    take: 5,
  });
  const topProducts = topRows.map((r) => ({
    productName: r.productName,
    quantity: r._sum.quantity ?? 0,
    revenue: round2(r._sum.lineTotal?.toNumber() ?? 0),
  }));

  // ── Revenue by day — exactly 30 Manila days, oldest → newest, zero-filled ──
  const since = manilaDayStartUTC(29);
  const recent = await prisma.order.findMany({
    where: { status: { not: OrderStatus.CANCELLED }, createdAt: { gte: since } },
    select: { createdAt: true, total: true },
  });
  const buckets = new Map<string, { revenue: number; orders: number }>();
  for (const o of recent) {
    const key = manilaDateStamp(o.createdAt); // YYYYMMDD (Manila)
    const b = buckets.get(key) ?? { revenue: 0, orders: 0 };
    b.revenue += o.total.toNumber();
    b.orders += 1;
    buckets.set(key, b);
  }
  const revenueByDay = [];
  for (let daysAgo = 29; daysAgo >= 0; daysAgo--) {
    const stamp = manilaDateStamp(manilaDayStartUTC(daysAgo)); // YYYYMMDD for that Manila day
    const b = buckets.get(stamp) ?? { revenue: 0, orders: 0 };
    revenueByDay.push({
      date: `${stamp.slice(0, 4)}-${stamp.slice(4, 6)}-${stamp.slice(6, 8)}`, // YYYY-MM-DD
      revenue: round2(b.revenue),
      orders: b.orders,
    });
  }

  return {
    kpis: { today, last7Days, last30Days, allTime },
    paidRevenueAllTime,
    averageOrderValue,
    statusBreakdown,
    paymentMix,
    revenueByDay,
    topProducts,
  };
}
