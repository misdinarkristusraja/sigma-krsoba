import React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { PAGE_SIZE_OPTIONS, PageSize } from '@/hooks/usePagination';

interface PaginationProps {
  page: number;
  totalPages: number;
  total: number;
  pageSize: PageSize;
  onPage: (p: number) => void;
  onSizeChange: (n: PageSize) => void;
  hasPrev: boolean;
  hasNext: boolean;
  label?: string;
}

export function Pagination({ page, totalPages, total, pageSize, onPage, onSizeChange, hasPrev, hasNext, label = 'data' }: PaginationProps) {
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const to   = Math.min(page * pageSize, total);

  return (
    <div className="flex items-center justify-between flex-wrap gap-3 mt-3 pt-3 border-t border-gray-100">
      <div className="flex items-center gap-2 text-xs text-gray-500">
        <span>Tampilkan</span>
        <select
          className="border border-gray-200 rounded-lg px-2 py-1 text-xs bg-white focus:outline-none focus:ring-1 focus:ring-brand-400"
          value={pageSize}
          onChange={e => onSizeChange(Number(e.target.value) as PageSize)}
        >
          {PAGE_SIZE_OPTIONS.map(n => <option key={n} value={n}>{n}</option>)}
        </select>
        <span>{label} per halaman · {total === 0 ? '0' : `${from}–${to} dari ${total}`}</span>
      </div>

      <div className="flex items-center gap-1">
        <button
          onClick={() => onPage(page - 1)}
          disabled={!hasPrev}
          className="p-1.5 rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
        >
          <ChevronLeft size={14} />
        </button>

        {pageWindows(page, totalPages).map((p, i) =>
          p === null
            ? <span key={`sep-${i}`} className="px-1 text-gray-300 text-xs">…</span>
            : <button
                key={p}
                onClick={() => onPage(p)}
                className={`min-w-[28px] h-7 text-xs rounded-lg border transition-colors ${
                  p === page
                    ? 'bg-brand-800 text-white border-brand-800 font-semibold'
                    : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                }`}
              >{p}</button>
        )}

        <button
          onClick={() => onPage(page + 1)}
          disabled={!hasNext}
          className="p-1.5 rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
        >
          <ChevronRight size={14} />
        </button>
      </div>
    </div>
  );
}

function pageWindows(current: number, total: number): (number | null)[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const pages: (number | null)[] = [];
  pages.push(1);
  if (current > 3) pages.push(null);
  for (let p = Math.max(2, current - 1); p <= Math.min(total - 1, current + 1); p++) pages.push(p);
  if (current < total - 2) pages.push(null);
  pages.push(total);
  return pages;
}
