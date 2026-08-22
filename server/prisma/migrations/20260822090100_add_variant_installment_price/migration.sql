-- Installment base price, per variant. JLP prices a phone higher on a monthly
-- plan than in cash, so the two figures can't share one column: `price` stays
-- the cash price (cart, checkout, orders), `installmentPrice` is what the
-- installment schedule divides.
--
-- Nullable with no default on purpose — NULL means "finance this at the cash
-- price", so accessories and every pre-existing variant need no backfill and
-- behave exactly as they did before.

-- AlterTable
ALTER TABLE "ProductVariant" ADD COLUMN     "installmentPrice" DECIMAL(12,2);
