// ============================================================================
//  One-off: reset the ADMIN password on the LIVE (Neon Singapore) database.
//  Surgical — updates only "User".passwordHash for one email. No data wipe.
//
//  Run from the server/ directory so it can find pg + bcryptjs:
//
//    cd server
//    DATABASE_URL="<your Singapore Neon direct URL>" \
//    NEW_ADMIN_PASSWORD="<a strong new password>" \
//    node reset-admin-password.mjs
//
//  (ADMIN_EMAIL defaults to admin@gmail.com — override it if your admin
//   email is different; the script prints all user emails so you can check.)
// ============================================================================
import { Client } from 'pg';
import bcrypt from 'bcryptjs';

const url   = process.env.DATABASE_URL;
const email = (process.env.ADMIN_EMAIL || 'admin@gmail.com').trim();
const pw    = process.env.NEW_ADMIN_PASSWORD;

if (!url) {
  console.error('✗ DATABASE_URL is not set. Paste your Singapore Neon DIRECT string (ends with ?sslmode=require).');
  process.exit(1);
}
if (!pw || pw.length < 8) {
  console.error('✗ NEW_ADMIN_PASSWORD must be set and at least 8 characters.');
  process.exit(1);
}

// Safety: make sure we're pointed at the PRODUCTION (Singapore) DB, not local dev.
let host = '(unparsed)';
try { host = new URL(url.replace(/^postgres(ql)?:\/\//, 'http://')).host; } catch {}
if (host.includes('us-east-2')) {
  console.error(`✗ That DATABASE_URL is your DEV database (${host}), not the live Singapore one. Aborting.`);
  console.error('  Copy the Singapore string from Render → istore-api-mg84 → Environment → DATABASE_URL (or Neon).');
  process.exit(1);
}
console.log('DB host:', host, host.includes('ap-southeast-1') ? '(Singapore ✓)' : '');

const hash = await bcrypt.hash(pw, 12);
const client = new Client({ connectionString: url, ssl: { rejectUnauthorized: false }, connectionTimeoutMillis: 15000 });

try {
  await client.connect();

  const before = await client.query('SELECT email FROM "User" ORDER BY email');
  console.log('Users currently in DB:', before.rows.map((r) => r.email).join(', ') || '(none)');

  const res = await client.query(
    'UPDATE "User" SET "passwordHash" = $1, "isActive" = true, "updatedAt" = now() WHERE lower(email) = lower($2)',
    [hash, email],
  );

  if (res.rowCount === 1) {
    console.log(`\n✓ SUCCESS — password reset for ${email}. Log in at /admin with this email and your new password.`);
  } else if (res.rowCount === 0) {
    console.log(`\n⚠ No user with email "${email}" exists. Re-run with ADMIN_EMAIL set to one of the emails listed above.`);
  } else {
    console.log(`\n⚠ ${res.rowCount} rows updated (unexpected).`);
  }
} catch (e) {
  console.error('\n✗ FAILED:', e.code ? `${e.code} — ${e.message}` : e.message);
  process.exit(1);
} finally {
  await client.end().catch(() => {});
}
