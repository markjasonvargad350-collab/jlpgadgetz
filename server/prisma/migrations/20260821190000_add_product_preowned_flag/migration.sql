-- Listing-level "Pre-loved" merchandising flag. Independent of
-- ProductVariant.condition (the per-unit truth): this drives the storefront
-- badge, the homepage rail and the catalog filter. Additive and defaulted, so
-- every existing product stays untagged.

-- AlterTable
ALTER TABLE "Product" ADD COLUMN     "isPreOwned" BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex
CREATE INDEX "Product_isPreOwned_idx" ON "Product"("isPreOwned");
