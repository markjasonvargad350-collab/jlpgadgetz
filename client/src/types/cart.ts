// A single line in the guest cart. Prices/labels are snapshots taken at
// add-time for display only — the server RE-DERIVES authoritative money and
// RE-VALIDATES stock at checkout (never trust these numbers for charging).
export interface CartItem {
  variantId: string;
  productId: string;
  slug: string;
  productName: string;
  /** Human label, e.g. "256GB · Blue Titanium". */
  variantLabel: string;
  colorHex: string | null;
  image: string | null;
  /** Display unit price at time of adding. */
  unitPrice: number;
  quantity: number;
  /** Stock snapshot used only to clamp the qty stepper in the UI. */
  maxStock: number;
}
