/**
 * Shared animation tokens for Framer Motion.
 *
 * `SPRING_EASE` is the app's signature easing curve — a gentle overshoot-free
 * "spring out" that mirrors the CSS `--ease-spring` custom property in
 * `index.css`, so JS-driven (Framer Motion) and CSS-driven transitions feel
 * identical. Kept in one place instead of the four inline `[0.22, 1, 0.36, 1]`
 * literals that used to live across Modal, AdminLayout, HomePage, and the order
 * confirmation page.
 */
export const SPRING_EASE = [0.22, 1, 0.36, 1] as const;
