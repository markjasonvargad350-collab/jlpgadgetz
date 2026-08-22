/* eslint-disable no-console */
// ============================================================================
//  Admin account doctor — diagnoses (and optionally repairs) who can operate the
//  back office. READ-ONLY unless you pass both --grant-admin and --yes.
//
//  Why this exists: the destructive parts of the admin panel are gated on the
//  exact role name "ADMIN" (see `requireRole('ADMIN')` in
//  src/routes/admin.inventory.routes.ts and friends). If the account you log in
//  with sits on STAFF — or on a role someone renamed — then:
//
//    • Admin → Inventory shows a dash instead of the "Adjust" button,
//    • POST /admin/inventory/adjust answers 403,
//    • and there is no way to fix it from inside the app, because the only thing
//      that ever creates the ADMIN role row is prisma/seed.ts, which wipes every
//      table and refuses NODE_ENV=production.
//
//  So the repair has to come from outside. This is the roles counterpart to
//  reset-admin-password.mjs (which only ever touches a password hash).
//
//  What it will NEVER do:
//    • delete anything, ever
//    • change a password, an email, or a name
//    • touch products, orders, stock, or any other table
//    • write anything at all without BOTH --grant-admin=<email> AND --yes
//
//  Look, don't touch (safe to run any time):
//      DATABASE_URL="<live-connection-string>" npm --prefix server run admin:doctor
//
//  Put an account back on the ADMIN role (the connection string is a secret —
//  don't commit it or share it):
//      DATABASE_URL="<live-connection-string>" npm --prefix server run admin:doctor -- --grant-admin=owner@example.com --yes
// ============================================================================
import { prisma, disconnectPrisma } from '../src/config/prisma';
import { env } from '../src/config/env';

/** The role name `requireRole('ADMIN')` compares against — a literal, not an enum. */
const ADMIN_ROLE = 'ADMIN';
const STAFF_ROLE = 'STAFF';

/** Descriptions kept identical to prisma/seed.ts so a repaired row looks seeded. */
const ROLE_DESCRIPTIONS: Record<string, string> = {
  [ADMIN_ROLE]: 'Full back-office access',
  [STAFF_ROLE]: 'Limited back-office access',
};

const APPLY = process.argv.includes('--yes');
const grantArg = process.argv.find((a) => a.startsWith('--grant-admin='));
const grantEmail = grantArg ? grantArg.slice('--grant-admin='.length).trim().toLowerCase() : null;

/** Host only — never print the connection string itself, it carries the password. */
function dbHost(): string {
  if (!env.DATABASE_URL) return '(DATABASE_URL not set)';
  try {
    return new URL(env.DATABASE_URL.replace(/^postgres(ql)?:\/\//, 'http://')).host;
  } catch {
    return '(unparsed)';
  }
}

const fmtDate = (d: Date | null) => (d ? d.toISOString().slice(0, 10) : 'never');

async function main() {
  console.log('\n🔎 Admin account check\n');
  console.log(`   DB host: ${dbHost()}`);

  // --- Roles ----------------------------------------------------------------
  const roles = await prisma.role.findMany({
    orderBy: { name: 'asc' },
    include: { _count: { select: { users: true } } },
  });

  console.log('\n   Roles:');
  if (roles.length === 0) {
    console.log('      (none — this database has never been seeded)');
  }
  for (const r of roles) {
    const known = r.name === ADMIN_ROLE || r.name === STAFF_ROLE;
    console.log(
      `      ${known ? '•' : '⚠'} ${r.name}${r.description ? ` — ${r.description}` : ''} ` +
        `(${r._count.users} user${r._count.users === 1 ? '' : 's'})${known ? '' : '  ← not a role the app checks for'}`,
    );
  }
  if (!roles.some((r) => r.name === ADMIN_ROLE)) {
    console.log(`      ⚠ There is no role named exactly "${ADMIN_ROLE}" — nothing can pass the admin gate.`);
  }

  // --- Users ----------------------------------------------------------------
  const users = await prisma.user.findMany({
    orderBy: { email: 'asc' },
    include: { role: { select: { name: true } } },
  });

  console.log('\n   Users:');
  if (users.length === 0) {
    console.log('      (none — nobody can sign in at /admin)');
  }
  let canAdjust = 0;
  for (const u of users) {
    const ok = u.role.name === ADMIN_ROLE && u.isActive;
    if (ok) canAdjust++;
    const why = !u.isActive ? 'no (account is deactivated)' : ok ? 'YES' : `no (role is ${u.role.name})`;
    console.log(
      `      • ${u.email} — ${u.name} · role ${u.role.name} · ${u.isActive ? 'active' : 'DEACTIVATED'} · last login ${fmtDate(u.lastLoginAt)}`,
    );
    console.log(`        can adjust stock / delete products: ${why}`);
  }

  console.log('');
  if (canAdjust > 0) {
    console.log(`   ✓ ${canAdjust} account${canAdjust === 1 ? '' : 's'} can adjust stock.`);
  } else {
    console.log('   ⚠ NO account can adjust stock, delete a product, or delete a branch.');
    console.log('     Admin → Inventory will show a dash where the "Adjust" button belongs.');
    console.log('     Fix it with:  npm --prefix server run admin:doctor -- --grant-admin=<email> --yes');
  }

  // --- Repair (opt-in) ------------------------------------------------------
  if (!grantEmail) {
    console.log('\n   Nothing was written (read-only run).\n');
    return;
  }

  const target = users.find((u) => u.email.toLowerCase() === grantEmail);
  if (!target) {
    console.log(`\n   ✗ No user with email "${grantEmail}".`);
    console.log(`     Pick one of: ${users.map((u) => u.email).join(', ') || '(no users exist)'}\n`);
    process.exitCode = 1;
    return;
  }

  const alreadyOk = target.role.name === ADMIN_ROLE && target.isActive;
  if (alreadyOk) {
    console.log(`\n   ✓ ${target.email} is already an active ${ADMIN_ROLE} — nothing to change.\n`);
    return;
  }

  if (!APPLY) {
    console.log(`\n   → Would move ${target.email} from ${target.role.name} to ${ADMIN_ROLE}${target.isActive ? '' : ' and reactivate it'}.`);
    console.log('     Nothing was written. Re-run with --yes to apply.\n');
    return;
  }

  // Create the role row if it's missing (a database seeded before roles existed,
  // or one where the row was renamed) — never rename an existing row, since other
  // users may be attached to it.
  const adminRole = await prisma.role.upsert({
    where: { name: ADMIN_ROLE },
    update: {},
    create: { name: ADMIN_ROLE, description: ROLE_DESCRIPTIONS[ADMIN_ROLE] },
  });

  await prisma.user.update({
    where: { id: target.id },
    data: { roleId: adminRole.id, isActive: true },
  });

  // Provenance for a change made outside the app. adminId stays null: a CLI run
  // has no signed-in actor.
  await prisma.auditLog.create({
    data: {
      action: 'admin.role.grant',
      entityType: 'User',
      entityId: target.id,
      meta: { email: target.email, from: target.role.name, to: ADMIN_ROLE, via: 'admin:doctor' },
    },
  });

  console.log(`\n   ✓ ${target.email} is now on the ${ADMIN_ROLE} role (was ${target.role.name}).`);
  console.log('     Reload /admin → Inventory and the "Adjust" button should be there.');
  console.log('     If it still says Forbidden, sign out and back in — server builds from before');
  console.log('     this fix read the role from the session cookie, which lasts 7 days.\n');
}

main()
  .catch((err) => {
    console.error('\n❌ Admin doctor failed:', err);
    process.exitCode = 1;
  })
  .finally(disconnectPrisma);
