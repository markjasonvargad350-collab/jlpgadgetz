/* eslint-disable no-console */
// ============================================================================
//  Transactional reset — clears the ORDER history so the shop can open on a
//  clean slate, without touching the catalog, the stock counts, or the accounts.
//
//  DRY RUN BY DEFAULT: with no --yes it only counts and prints. Nothing is
//  written until you pass --yes.
//
//  Why this exists: prisma/seed.ts is the only thing that deletes anything, and
//  it wipes EVERY table (products, prices, users, branches) and refuses
//  NODE_ENV=production — so it can never be used to tidy a database that's
//  already serving customers. prisma/catalog-sync.ts never deletes at all. This
//  is the missing third script.
//
//  Unlike seed.ts this does NOT refuse production, because running against the
//  live database is the entire point. Its safety comes from somewhere else:
//    • dry run unless --yes is passed explicitly,
//    • the DB host is printed before anything happens,
//    • and it may only touch the tables listed below — the catalog, accounts and
//      branches are never in scope, at any flag combination.
//
//  What the default run does:
//    1. Deletes TrackingHistory → Shipment → Payment → OrderItem → Order, in
//       that order (same order prisma/seed.ts wipes in, which respects the FKs).
//       Order numbering restarts on its own: nextOrderNumber() takes max+1 of the
//       numbers that exist, so with none left the next order is ORD-<date>-0001.
//    2. Rewrites the inventory ledger to agree with the stock that's on the
//       shelf: every InventoryTransaction is deleted and replaced with ONE
//       "Opening balance" row per variant that has stock. Stock itself is never
//       written — the ledger is re-derived FROM it, so the invariant the whole
//       inventory system rests on (Σ quantityChanged == stock, see
//       docs/DATA-MODEL.md) holds again afterwards. Deleting the ledger and
//       stopping there would silently break it.
//    3. Zeroes soldQty (lifetime units sold, bumped per sale in
//       order.service.ts) and reservedStock. With the orders gone, a non-zero
//       soldQty is a claim about sales that no longer exist, and it skews the
//       best-seller sort.
//
//  What it NEVER touches: Product, ProductVariant.price / installmentPrice /
//  stock / photos / condition, ProductImage, Category, User, Role, Branch.
//
//  Off by default, add if you want them cleared too (each still needs --yes):
//      --trade-ins       delete every TradeIn request
//      --installments    delete every InstallmentPlan and its payment schedule
//      --notifications   delete every back-office Notification
//
//  Preview (writes nothing):
//      DATABASE_URL="<live-connection-string>" npm --prefix server run reset:transactions
//
//  For real (the connection string is a secret — don't commit it or share it):
//      DATABASE_URL="<live-connection-string>" npm --prefix server run reset:transactions -- --yes
// ============================================================================
import { InventoryTxnType } from '@prisma/client';
import { prisma, disconnectPrisma } from '../src/config/prisma';
import { env } from '../src/config/env';

const APPLY = process.argv.includes('--yes');
const WITH_TRADE_INS = process.argv.includes('--trade-ins');
const WITH_INSTALLMENTS = process.argv.includes('--installments');
const WITH_NOTIFICATIONS = process.argv.includes('--notifications');

const OPENING_REASON = 'Opening balance (fresh deployment reset)';

/** Host only — never print the connection string itself, it carries the password. */
function dbHost(): string {
  if (!env.DATABASE_URL) return '(DATABASE_URL not set)';
  try {
    return new URL(env.DATABASE_URL.replace(/^postgres(ql)?:\/\//, 'http://')).host;
  } catch {
    return '(unparsed)';
  }
}

async function counts() {
  const [
    orders,
    orderItems,
    payments,
    shipments,
    tracking,
    ledger,
    tradeIns,
    plans,
    planPayments,
    notifications,
    stockedVariants,
    units,
    sold,
  ] = await Promise.all([
    prisma.order.count(),
    prisma.orderItem.count(),
    prisma.payment.count(),
    prisma.shipment.count(),
    prisma.trackingHistory.count(),
    prisma.inventoryTransaction.count(),
    prisma.tradeIn.count(),
    prisma.installmentPlan.count(),
    prisma.installmentPayment.count(),
    prisma.notification.count(),
    prisma.productVariant.count({ where: { stock: { not: 0 } } }),
    prisma.productVariant.aggregate({ _sum: { stock: true } }),
    prisma.productVariant.aggregate({ _sum: { soldQty: true } }),
  ]);
  return {
    orders,
    orderItems,
    payments,
    shipments,
    tracking,
    ledger,
    tradeIns,
    plans,
    planPayments,
    notifications,
    stockedVariants,
    units: units._sum.stock ?? 0,
    sold: sold._sum.soldQty ?? 0,
  };
}

async function main() {
  console.log(APPLY ? '\n🧹 Transactional reset\n' : '\n📋 Transactional reset — DRY RUN (nothing will be written)\n');
  console.log(`   DB host: ${dbHost()}`);

  const before = await counts();

  console.log('\n   Currently in the database:');
  console.log(`      Orders ${before.orders} · items ${before.orderItems} · payments ${before.payments} · shipments ${before.shipments} · tracking rows ${before.tracking}`);
  console.log(`      Inventory ledger rows ${before.ledger}`);
  console.log(`      Trade-ins ${before.tradeIns} · installment plans ${before.plans} (${before.planPayments} scheduled payments) · notifications ${before.notifications}`);
  console.log(`      Stock: ${before.units} unit(s) across ${before.stockedVariants} variant(s) · lifetime soldQty ${before.sold}`);

  const will = APPLY ? '' : 'would be ';
  console.log('\n   Plan:');
  console.log(`      • Orders, items, payments, shipments and tracking history ${will}deleted (${before.orders} order(s))`);
  console.log(`      • All ${before.ledger} ledger row(s) ${will}replaced with ${before.stockedVariants} "Opening balance" row(s)`);
  console.log(`      • soldQty and reservedStock ${will}reset to 0 on every variant`);
  console.log(`      • Trade-ins:      ${WITH_TRADE_INS ? `${will}DELETED (${before.tradeIns})` : 'kept'}`);
  console.log(`      • Installments:   ${WITH_INSTALLMENTS ? `${will}DELETED (${before.plans} plan(s))` : 'kept'}`);
  console.log(`      • Notifications:  ${WITH_NOTIFICATIONS ? `${will}DELETED (${before.notifications})` : 'kept'}`);
  console.log('      • Products, prices, photos, STOCK COUNTS, users, roles and branches: untouched');

  if (!APPLY) {
    console.log('\n   Nothing was written. Re-run with --yes to apply:');
    console.log('      npm --prefix server run reset:transactions -- --yes\n');
    return;
  }

  const openingRows = await prisma.productVariant.findMany({
    where: { stock: { not: 0 } },
    select: { id: true, sku: true, stock: true },
    orderBy: { sku: 'asc' },
  });

  await prisma.$transaction(
    async (tx) => {
      // 1. The order tree, children first. Order's own cascades would cover most
      //    of this; being explicit keeps the log honest about what went.
      await tx.trackingHistory.deleteMany();
      await tx.shipment.deleteMany();
      await tx.payment.deleteMany();
      await tx.orderItem.deleteMany();
      await tx.order.deleteMany();

      // 2. Opt-in extras.
      if (WITH_INSTALLMENTS) {
        await tx.installmentPayment.deleteMany();
        await tx.installmentPlan.deleteMany();
      }
      if (WITH_TRADE_INS) {
        await tx.tradeIn.deleteMany();
      }
      if (WITH_NOTIFICATIONS) {
        await tx.notification.deleteMany();
      }

      // 3. Rewrite the ledger so it sums back to the stock that's already there.
      //    This is the one place that writes an InventoryTransaction directly
      //    instead of going through recordInventoryChange(), and the reason it's
      //    allowed is that NO STOCK MOVES here: previousStock 0 → newStock =
      //    the variant's current stock, which is left exactly as it was.
      await tx.inventoryTransaction.deleteMany();
      if (openingRows.length > 0) {
        await tx.inventoryTransaction.createMany({
          data: openingRows.map((v) => ({
            variantId: v.id,
            type: InventoryTxnType.RESTOCK,
            previousStock: 0,
            quantityChanged: v.stock,
            newStock: v.stock,
            reason: OPENING_REASON,
          })),
        });
      }

      // 4. Counters that only orders are allowed to move.
      await tx.productVariant.updateMany({ data: { soldQty: 0, reservedStock: 0 } });
    },
    { maxWait: 15_000, timeout: 60_000 },
  );

  await prisma.auditLog.create({
    data: {
      action: 'system.reset.transactions',
      entityType: 'System',
      meta: {
        ordersDeleted: before.orders,
        ledgerRowsDeleted: before.ledger,
        openingRowsWritten: openingRows.length,
        unitsPreserved: before.units,
        tradeInsDeleted: WITH_TRADE_INS ? before.tradeIns : 0,
        plansDeleted: WITH_INSTALLMENTS ? before.plans : 0,
        notificationsDeleted: WITH_NOTIFICATIONS ? before.notifications : 0,
      },
    },
  });

  const after = await counts();

  console.log('\n✅ Reset complete.');
  console.log(`   Orders ${before.orders} → ${after.orders} · ledger ${before.ledger} → ${after.ledger} (opening balances) · soldQty ${before.sold} → ${after.sold}`);
  console.log(`   Stock preserved: ${after.units} unit(s) across ${after.stockedVariants} variant(s) — unchanged.`);

  if (after.units !== before.units) {
    // Can't happen — stock is never written here — but a loud check beats a
    // quiet discrepancy on a live shop.
    console.log(`   ⚠ Stock total changed (${before.units} → ${after.units}). Investigate before selling.`);
    process.exitCode = 1;
  }

  if (!WITH_NOTIFICATIONS && after.notifications > 0) {
    console.log(`   ℹ ${after.notifications} notification(s) kept — some may name orders that no longer exist.`);
    console.log('     They hold no foreign key, so nothing breaks; add --notifications to clear them too.');
  }
  if (!WITH_TRADE_INS && after.tradeIns > 0) {
    console.log(`   ℹ ${after.tradeIns} trade-in request(s) kept — add --trade-ins to clear them too.`);
  }
  if (!WITH_INSTALLMENTS && after.plans > 0) {
    console.log(`   ℹ ${after.plans} installment plan(s) kept — add --installments to clear them too.`);
  }
  console.log('   No product, price, photo, stock count, user, role or branch was changed.\n');
}

main()
  .catch((err) => {
    console.error('\n❌ Transactional reset failed:', err);
    process.exitCode = 1;
  })
  .finally(disconnectPrisma);
