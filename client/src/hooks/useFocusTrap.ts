import { useEffect, useRef } from 'react';

const FOCUSABLE_SELECTOR = [
  'a[href]',
  'button:not([disabled])',
  'textarea:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',');

/**
 * Traps keyboard focus within a container while `active` is true: moves focus
 * inside on activation, keeps Tab / Shift+Tab cycling within it, and restores
 * focus to the previously-focused element (the trigger) on deactivation.
 *
 * Returns a ref to attach to the container element (the dialog / drawer panel).
 * Escape handling is intentionally left to the caller — each surface owns its
 * own close semantics (Modal already closes on Escape; the drawers add it).
 *
 * StrictMode-safe: the mount/unmount/mount double-invoke restores focus to the
 * trigger between passes and re-captures it, so focus lands inside either way.
 */
export function useFocusTrap<T extends HTMLElement = HTMLElement>(active: boolean) {
  const ref = useRef<T>(null);

  useEffect(() => {
    if (!active) return;
    const node = ref.current;
    if (!node) return;

    const previouslyFocused = document.activeElement as HTMLElement | null;

    // `getClientRects()` is a robust "is rendered" check that (unlike offsetParent)
    // also works for position:fixed panels like our modal.
    const visibleFocusables = (): HTMLElement[] =>
      Array.from(node.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)).filter(
        (el) => el.getClientRects().length > 0,
      );

    // Move focus into the panel: first focusable, else the panel itself.
    const first = visibleFocusables()[0];
    if (first) {
      first.focus();
    } else {
      node.setAttribute('tabindex', '-1');
      node.focus();
    }

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return;
      const items = visibleFocusables();
      if (items.length === 0) {
        e.preventDefault();
        return;
      }
      const firstEl = items[0];
      const lastEl = items[items.length - 1];
      const current = document.activeElement;
      if (e.shiftKey) {
        if (current === firstEl || !node.contains(current)) {
          e.preventDefault();
          lastEl.focus();
        }
      } else if (current === lastEl || !node.contains(current)) {
        e.preventDefault();
        firstEl.focus();
      }
    };

    node.addEventListener('keydown', onKeyDown);
    return () => {
      node.removeEventListener('keydown', onKeyDown);
      // Restore focus to the trigger if it's still in the document.
      if (previouslyFocused && document.contains(previouslyFocused)) {
        previouslyFocused.focus();
      }
    };
  }, [active]);

  return ref;
}
