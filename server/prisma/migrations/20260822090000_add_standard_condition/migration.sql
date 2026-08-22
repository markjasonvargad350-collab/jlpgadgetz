-- New "STANDARD" grading tier on ProductCondition: JLP's shop-standard units —
-- tested in store, not sealed-new, priced between pre-owned and brand new. It
-- sits right after NEW so Postgres' own enum sort order stays best-first.
--
-- Additive only: no existing row changes, and the enum's default (NEW) is
-- untouched. Deliberately alone in its own migration — a value added by
-- ALTER TYPE cannot be USED in the same transaction, so nothing here may
-- reference 'STANDARD'.

-- AlterEnum
ALTER TYPE "ProductCondition" ADD VALUE 'STANDARD' AFTER 'NEW';
