import { useState, useMemo } from 'react';

export const PAGE_SIZE_OPTIONS = [5, 10, 25] as const;
export type PageSize = typeof PAGE_SIZE_OPTIONS[number];

export function usePagination<T>(items: T[], defaultSize: PageSize = 10) {
  const [page, setPage]     = useState(1);
  const [pageSize, setPageSize] = useState<PageSize>(defaultSize);

  const totalPages = Math.max(1, Math.ceil(items.length / pageSize));

  // Reset to page 1 when items or pageSize change
  const safePage = Math.min(page, totalPages);

  const paged = useMemo(() => {
    const start = (safePage - 1) * pageSize;
    return items.slice(start, start + pageSize);
  }, [items, safePage, pageSize]);

  function goTo(p: number) { setPage(Math.max(1, Math.min(p, totalPages))); }
  function onSizeChange(n: PageSize) { setPageSize(n); setPage(1); }

  return {
    paged,
    page: safePage,
    pageSize,
    totalPages,
    total: items.length,
    goTo,
    onSizeChange,
    hasPrev: safePage > 1,
    hasNext: safePage < totalPages,
  };
}
