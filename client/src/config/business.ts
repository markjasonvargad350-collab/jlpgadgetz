// Real JLP Gadgetz Center business details — the single source of truth for the
// storefront footer, the About page, and the application forms. Keep this in
// sync with the owner's actual details.
//
// IMPORTANT: only the Passi branch has a real street address (provided by the
// owner). Do NOT invent street addresses for the other branches — those are
// managed (name + city/province) in the admin branch list and surfaced from
// GET /api/branches on the About page.
export const BUSINESS = {
  name: 'JLP Gadgetz Center',
  tagline: 'We buy, sell & trade phones and gadgets — brand-new and pre-owned.',
  phone: '0930 119 7407',
  // tel: link uses the E.164 form of the same number.
  phoneHref: 'tel:+639301197407',
  email: 'jlpgadgetzcenter@gmail.com',
  // The Facebook page is named "JLP Gadgetz Center". We don't hardcode a guessed
  // vanity URL (it might 404) — this search link reliably lands on the page.
  // Replace with the exact page URL once known (one-line change).
  facebookUrl: 'https://www.facebook.com/search/top?q=JLP%20Gadgetz%20Center',
  facebookLabel: 'JLP Gadgetz Center',
  // The only branch with a real street address.
  mainAddress: 'Dorillo Street, Passi City, Passi, Philippines, 5037',
  // Genuine social proof from the page — do NOT fabricate additional reviews.
  recommendation: '100% recommend (5 reviews)',
} as const;
