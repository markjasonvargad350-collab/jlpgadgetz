/**
 * Product photos are plain URLs the owner pastes into the back office — there's
 * no upload pipeline, so nothing resizes them on the way in. A 1000 px PNG shot
 * of a phone is ~200-800 KB, and a 12-card catalogue page was pulling roughly
 * 2.2 MB of images to fill squares a few hundred pixels wide.
 *
 * Imgur — where the shop's photos live — will do the resizing for us. Append a
 * single size letter to the image id and its CDN returns a scaled, re-encoded
 * copy. Measured on the heaviest photo in the catalogue:
 *
 *     i.imgur.com/CZZGiWE.png    793 KB   original PNG
 *     i.imgur.com/CZZGiWEh.png    76 KB   1024 px, re-encoded to JPEG
 *     i.imgur.com/CZZGiWEl.png    34 KB    640 px
 *     i.imgur.com/CZZGiWEm.png    10 KB    320 px
 *
 * Anything hosted elsewhere is returned untouched, so a Cloudinary, S3 or
 * placehold.co URL keeps working — it just doesn't get the free resize.
 */

/**
 * Only the aspect-preserving suffixes. Imgur's other three (`s`, `b`, `t`) crop
 * to a square, which would fight the `object-cover` the layouts already use and
 * double-crop tall photos.
 */
const IMGUR_SUFFIX = {
  /** 320 px — line items, table rows, gallery thumbnails. */
  sm: 'm',
  /** 640 px — catalogue cards. */
  md: 'l',
  /** 1024 px — the product page's main photo. */
  lg: 'h',
} as const;

export type ImageSize = keyof typeof IMGUR_SUFFIX;

/** Rendered width of each size, for the `srcSet` descriptors below. */
const IMGUR_WIDTH: Record<ImageSize, number> = { sm: 320, md: 640, lg: 1024 };

/**
 * `i.imgur.com/<id>.<ext>`. Imgur ids are 5 or 7 characters; an 8-character one
 * is already a resized copy (`CZZGiWEl`), and appending a second letter to that
 * would 404 — so those are deliberately left alone.
 */
const IMGUR = /^(https?:\/\/i\.imgur\.com\/)([A-Za-z0-9]{5,7})(\.(?:jpe?g|png|gif|webp))$/i;

/**
 * A URL for the same image at roughly `size`, or the original URL when the host
 * can't resize. Imgur never upscales, so asking for 1024 px from a 500 px
 * upload just returns the 500 px original.
 */
export function sized(url: string, size: ImageSize): string {
  const m = IMGUR.exec(url);
  if (!m) return url;
  return `${m[1]}${m[2]}${IMGUR_SUFFIX[size]}${m[3]}`;
}

/**
 * A `srcSet` letting the browser pick by viewport and pixel density — for the
 * one image big enough to be worth it (the product page's main photo, which is
 * also the page's largest paint). `undefined` when the host can't resize, so the
 * attribute is omitted rather than listing the same URL at two widths.
 */
export function srcSetFor(url: string, sizes: ImageSize[] = ['md', 'lg']): string | undefined {
  if (!IMGUR.test(url)) return undefined;
  return sizes.map((s) => `${sized(url, s)} ${IMGUR_WIDTH[s]}w`).join(', ');
}
