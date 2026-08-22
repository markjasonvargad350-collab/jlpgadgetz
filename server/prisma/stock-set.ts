/* eslint-disable no-console */
// ============================================================================
//  Physical stock count — reads a filled-in worksheet and sets each variant's
//  on-hand stock to the real number, one ledger row per change.
//
//  DRY RUN BY DEFAULT: with no --yes it only reads, compares and prints.
//
//  Why this exists: after catalog-sync the shop is stocked with *placeholder*
//  counts (1 per pre-owned unit, 3 per standard/new) because the price sheet the
//  owner supplied had no quantities. Setting 48 variants by hand through
//  Admin → Inventory → Adjust is 48 modals; this does the same thing in one pass
//  and — crucially — through the SAME code path, so nothing about the result is
//  special: every change is an ADJUSTMENT in the inventory ledger with a reason,
//  exactly as if it had been typed in the back office.
//
//  It goes through recordInventoryChange() (src/services/inventory.service.ts),
//  the one sanctioned way to move stock, with expectedStock set as a
//  compare-and-set. So the invariant the whole inventory system rests on
//  (Σ quantityChanged == stock, see docs/DATA-MODEL.md) still holds afterwards,
//  and a count that's gone stale between the read and the write is REJECTED
//  rather than silently clobbering someone else's adjustment.
//
//  The worksheet is the CSV written for the owner at the repo root:
//
//      SKU,Model,Storage,Condition,CashPrice,CurrentStock,REAL_QTY
//      IP11-128-PRE,iPhone 11,128GB,Pre-owned,13990,1,4
//
//  Only the SKU and REAL_QTY columns are read — the rest are there so the person
//  filling it in can see what they're counting. Columns are matched by NAME, so
//  reordering them in Excel is harmless.
//
//    • REAL_QTY blank  → left alone (the placeholder stands).
//    • REAL_QTY 0      → set to zero, i.e. "counted, none in stock".
//    • REAL_QTY == current stock → no ledger row (nothing moved).
//
//  Anything that isn't a whole number ≥ 0, and any SKU that isn't in the
//  database, is collected and reported and then the run REFUSES to apply. A
//  half-applied physical count is worse than none.
//
//  Preview (writes nothing):
//      npm --prefix server run stock:set
//
//  For real:
//      npm --prefix server run stock:set -- --yes
//
//  Elsewhere / renamed file:
//      npm --prefix server run stock:set -- --file=../counts.csv --yes
//
//  DATABASE_URL comes from server/.env (or the environment). It's a secret —
//  don't put it on the command line, where it lands in shell history.
// ============================================================================
import fs from 'node:fs';
import path from 'node:path';
import { InventoryTxnType } from '@prisma/client';
import { prisma, disconnectPrisma } from '../src/config/prisma';
import { env } from '../src/config/env';
import { recordInventoryChange } from '../src/services/inventory.service';

const APPLY = process.argv.includes('--yes');
const FILE_ARG = process.argv.find((a) => a.startsWith('--file='))?.slice('--file='.length);
const DEFAULT_FILE = 'stock-worksheet.csv';

const REASON = 'Physical stock count (worksheet)';

/** Host only — never print the connection string itself, it carries the password. */
function dbHost(): string {
  if (!env.DATABASE_URL) return '(DATABASE_URL not set)';
  try {
    return new URL(env.DATABASE_URL.replace(/^postgres(ql)?:\/\//, 'http://')).host;
  } catch {
    return '(unparsed)';
  }
}

/**
 * Find the worksheet whether the script was started from the repo root or from
 * server/ (npm --prefix changes the cwd), so the owner can't get it wrong.
 */
function resolveWorksheet(): string {
  const candidates = FILE_ARG
    ? [path.resolve(process.cwd(), FILE_ARG)]
    : [
        path.resolve(process.cwd(), DEFAULT_FILE),
        path.resolve(process.cwd(), '..', DEFAULT_FILE),
      ];
  const found = candidates.find((p) => fs.existsSync(p));
  if (!found) {
    throw new Error(
      `Worksheet not found. Looked in:\n      ${candidates.join('\n      ')}\n` +
        '   Pass --file=<path> if it lives somewhere else.',
    );
  }
  return found;
}

/**
 * One CSV line → fields. Quote-aware because Excel quotes any field it feels
 * like quoting on save, and "" is an escaped quote inside a quoted field.
 */
function splitCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = '';
  let quoted = false;
  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i];
    if (quoted) {
      if (ch === '"') {
        if (line[i + 1] === '"') {
          cur += '"';
          i += 1;
        } else {
          quoted = false;
        }
      } else {
        cur += ch;
      }
    } else if (ch === '"') {
      quoted = true;
    } else if (ch === ',') {
      out.push(cur);
      cur = '';
    } else {
      cur += ch;
    }
  }
  out.push(cur);
  return out.map((f) => f.trim());
}

interface WorksheetRow {
  line: number;
  sku: string;
  label: string;
  /** null = the cell was left blank, i.e. "don't touch this one". */
  target: number | null;
  raw: string;
}

function parseWorksheet(file: string) {
  // Excel writes CRLF and sometimes a UTF-8 BOM; neither should reach the parser.
  const text = fs.readFileSync(file, 'utf8').replace(/^﻿/, '');
  const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length < 2) throw new Error(`${file} has a header but no rows.`);

  const header = splitCsvLine(lines[0]).map((h) => h.toUpperCase());
  const skuAt = header.indexOf('SKU');
  const qtyAt = header.indexOf('REAL_QTY');
  if (skuAt === -1 || qtyAt === -1) {
    throw new Error(
      `${file} needs both a SKU and a REAL_QTY column. Found: ${header.join(', ') || '(nothing)'}`,
    );
  }
  const modelAt = header.indexOf('MODEL');
  const storageAt = header.indexOf('STORAGE');
  const condAt = header.indexOf('CONDITION');

  const rows: WorksheetRow[] = [];
  const bad: string[] = [];
  const seen = new Map<string, number>();

  lines.slice(1).forEach((line, i) => {
    const lineNo = i + 2; // 1-based, and the header is line 1
    const f = splitCsvLine(line);
    const sku = (f[skuAt] ?? '').toUpperCase();
    if (!sku) {
      bad.push(`line ${lineNo}: no SKU`);
      return;
    }
    const dupeAt = seen.get(sku);
    if (dupeAt !== undefined) {
      bad.push(`line ${lineNo}: ${sku} appears twice (also on line ${dupeAt})`);
      return;
    }
    seen.set(sku, lineNo);

    const label =
      [f[modelAt] ?? '', f[storageAt] ?? '', f[condAt] ?? ''].filter(Boolean).join(' · ') || sku;

    const raw = f[qtyAt] ?? '';
    let target: number | null = null;
    if (raw !== '') {
      // Tolerate "1,200" and "12 " from a spreadsheet; reject anything else
      // loudly rather than guessing what the person meant.
      const cleaned = raw.replace(/[\s,]/g, '');
      if (!/^\d+$/.test(cleaned)) {
        bad.push(`line ${lineNo}: ${sku} — REAL_QTY "${raw}" is not a whole number ≥ 0`);
        return;
      }
      target = Number(cleaned);
      if (!Number.isSafeInteger(target)) {
        bad.push(`line ${lineNo}: ${sku} — REAL_QTY "${raw}" is out of range`);
        return;
      }
    }
    rows.push({ line: lineNo, sku, label, target, raw });
  });

  return { rows, bad };
}

async function main() {
  console.log(
    APPLY ? '\n📦 Physical stock count\n' : '\n📋 Physical stock count — DRY RUN (nothing will be written)\n',
  );
  console.log(`   DB host: ${dbHost()}`);

  const file = resolveWorksheet();
  console.log(`   Worksheet: ${file}`);

  const { rows, bad } = parseWorksheet(file);
  const filled = rows.filter((r) => r.target !== null);
  const blank = rows.length - filled.length;

  console.log(`   Read ${rows.length} row(s): ${filled.length} with a count, ${blank} left blank.`);

  if (filled.length === 0 && bad.length === 0) {
    console.log('\n   Nothing to do — the REAL_QTY column is empty on every row.');
    console.log('   Fill it in (use 0 for "none in stock"; blank means "leave as is") and re-run.\n');
    return;
  }

  const variants = await prisma.productVariant.findMany({
    where: { sku: { in: filled.map((r) => r.sku) } },
    select: {
      id: true,
      sku: true,
      stock: true,
      price: true,
      isActive: true,
      product: { select: { name: true, status: true } },
    },
  });
  const bySku = new Map(variants.map((v) => [v.sku.toUpperCase(), v]));

  const unknown = filled.filter((r) => !bySku.has(r.sku));
  unknown.forEach((r) => bad.push(`line ${r.line}: SKU ${r.sku} is not in the database`));

  if (bad.length > 0) {
    console.log(`\n   ❌ ${bad.length} problem(s) in the worksheet:`);
    bad.forEach((b) => console.log(`      • ${b}`));
    console.log('\n   Nothing was written — fix these and re-run. A half-applied count is');
    console.log('   worse than no count, so this refuses to apply any of it.\n');
    process.exitCode = 1;
    return;
  }

  const changes = filled
    .map((r) => {
      const v = bySku.get(r.sku)!;
      return { row: r, variant: v, delta: r.target! - v.stock };
    })
    .sort((a, b) => a.row.sku.localeCompare(b.row.sku));

  const moving = changes.filter((c) => c.delta !== 0);
  const unchanged = changes.length - moving.length;
  const unitsBefore = changes.reduce((n, c) => n + c.variant.stock, 0);
  const unitsAfter = changes.reduce((n, c) => n + c.row.target!, 0);

  console.log('\n   Counts to apply:');
  if (moving.length === 0) {
    console.log('      (none — every counted variant already holds the right number)');
  }
  moving.forEach((c) => {
    const sign = c.delta > 0 ? '+' : '';
    console.log(
      `      ${c.row.sku.padEnd(16)} ${String(c.variant.stock).padStart(4)} → ${String(c.row.target).padStart(4)}  (${sign}${c.delta})  ${c.row.label}`,
    );
  });
  if (unchanged > 0) {
    console.log(`      …and ${unchanged} already correct (no ledger row written for those).`);
  }
  console.log(
    `\n   Total across the ${changes.length} counted variant(s): ${unitsBefore} → ${unitsAfter} unit(s).`,
  );
  console.log(`   Variants not in the worksheet (accessories included) are untouched.`);

  // A count on something the storefront can't sell is almost certainly not what
  // the owner expects to see, so say it out loud either way.
  const hidden = moving.filter(
    (c) => c.row.target! > 0 && (!c.variant.isActive || c.variant.product.status !== 'ACTIVE'),
  );
  hidden.forEach((c) =>
    console.log(
      `   ⚠ ${c.row.sku} gets ${c.row.target} unit(s) but is ${!c.variant.isActive ? 'an inactive variant' : `on a ${c.variant.product.status} product`} — stock is recorded, but it won't show in the shop until that's fixed.`,
    ),
  );
  const unpriced = moving.filter((c) => c.row.target! > 0 && Number(c.variant.price) <= 0);
  unpriced.forEach((c) => console.log(`   ⚠ ${c.row.sku} has no price set.`));

  if (!APPLY) {
    console.log('\n   Nothing was written. Re-run with --yes to apply:');
    console.log('      npm --prefix server run stock:set -- --yes\n');
    return;
  }

  if (moving.length === 0) {
    console.log('\n✅ Nothing to write — stock already matches the worksheet.\n');
    return;
  }

  // All or nothing: one transaction, so a conflict or a dropped connection
  // half-way through leaves the shelf exactly as it was.
  await prisma.$transaction(
    async (tx) => {
      for (const c of moving) {
        // Re-read inside the transaction so expectedStock is as fresh as it can
        // be; the guarded UPDATE inside recordInventoryChange still rejects
        // anything that a concurrent adjustment commits after this read.
        const current = await tx.productVariant.findUnique({
          where: { id: c.variant.id },
          select: { stock: true },
        });
        if (!current) throw new Error(`${c.row.sku} disappeared mid-run`);
        const delta = c.row.target! - current.stock;
        if (delta === 0) continue;
        await recordInventoryChange(tx, {
          variantId: c.variant.id,
          type: InventoryTxnType.ADJUSTMENT,
          quantityChanged: delta,
          reason: REASON,
          expectedStock: current.stock,
        });
      }
    },
    { maxWait: 15_000, timeout: 120_000 },
  );

  await prisma.auditLog.create({
    data: {
      action: 'system.stock.set',
      entityType: 'ProductVariant',
      meta: {
        worksheet: path.basename(file),
        variantsCounted: changes.length,
        variantsChanged: moving.length,
        unitsBefore,
        unitsAfter,
      },
    },
  });

  const after = await prisma.productVariant.aggregate({
    where: { sku: { in: moving.map((c) => c.row.sku) } },
    _sum: { stock: true },
  });
  const expected = moving.reduce((n, c) => n + c.row.target!, 0);

  console.log(`\n✅ Set stock on ${moving.length} variant(s), each through the inventory ledger.`);
  console.log(`   Counted variants now hold ${unitsAfter} unit(s) (was ${unitsBefore}).`);
  if ((after._sum.stock ?? 0) !== expected) {
    console.log(
      `   ⚠ Read back ${after._sum.stock ?? 0} unit(s) on the changed variants, expected ${expected}. Investigate before selling.`,
    );
    process.exitCode = 1;
  }
  console.log('   No price, photo, product or order was touched.\n');
}

main()
  .catch((err) => {
    console.error('\n❌ Stock count failed:', err instanceof Error ? err.message : err);
    process.exitCode = 1;
  })
  .finally(disconnectPrisma);
