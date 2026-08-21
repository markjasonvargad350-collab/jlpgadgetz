import { useEffect } from 'react';

const BASE_TITLE = 'JLP Gadgetz Center — Buy, Sell & Trade';

/**
 * Sets `document.title` for the lifetime of the calling component and restores
 * the base title on unmount. Pass a falsy value to keep the base title (e.g. the
 * home page, or while a page's data is still loading).
 */
export function useDocumentTitle(title?: string | null) {
  useEffect(() => {
    document.title = title ? `${title} · JLP Gadgetz Center` : BASE_TITLE;
    return () => {
      document.title = BASE_TITLE;
    };
  }, [title]);
}
