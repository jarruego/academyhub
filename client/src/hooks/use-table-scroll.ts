import { useEffect, RefObject } from 'react';

type Options = {
  minHeight?: number;
  footerOffset?: number;
};

/**
 * Hook that computes an available table body height and keeps it updated on resize/load.
 * Returns the height as a number stored on a data-* attribute of the wrapper element so
 * it can be read synchronously by callers (avoids extra state wiring when not needed).
 */
export default function useTableScroll(
  wrapperRef: RefObject<HTMLElement | null>,
  controlsRef: RefObject<HTMLElement | null>,
  opts?: Options
) {
  const MIN_TABLE_HEIGHT = opts?.minHeight ?? 220;
  const FOOTER_AND_PAGINATION = opts?.footerOffset ?? 120;

  useEffect(() => {
    const compute = () => {
      const headerSelectors = ['.ant-layout-header', 'header', '.app-header'];
      let headerHeight = 0;
      for (const sel of headerSelectors) {
        const el = document.querySelector(sel) as Element | null;
        if (el) {
          headerHeight = el.getBoundingClientRect().height || 0;
          break;
        }
      }

      const wrapperTop = wrapperRef.current?.getBoundingClientRect().top ?? 0;
      const topOffset = headerHeight || wrapperTop || 0;

      const controlsH = controlsRef.current?.getBoundingClientRect().height ?? 0;
      const available = Math.max(window.innerHeight - topOffset - 16, MIN_TABLE_HEIGHT);
      const tableBody = Math.max(MIN_TABLE_HEIGHT, Math.floor(available - controlsH - FOOTER_AND_PAGINATION));

      if (wrapperRef.current) {
        // store the computed height as a number on a data attribute for synchronous read
        wrapperRef.current.dataset.tableScrollY = String(tableBody);
      }
    };

    // initial compute and listeners
    compute();
    window.addEventListener('load', compute);
    window.addEventListener('resize', compute);
    return () => {
      window.removeEventListener('resize', compute);
      window.removeEventListener('load', compute);
    };
  }, [wrapperRef, controlsRef, opts?.minHeight, opts?.footerOffset]);

  // synchronous getter that callers can use inside render to read the last computed value
  return Number(wrapperRef.current?.dataset.tableScrollY ?? 400);
}
