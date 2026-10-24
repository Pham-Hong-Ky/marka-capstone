import { ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/utils/cn';

type PageItem = number | 'start-ellipsis' | 'end-ellipsis';

const buildPageItems = (page: number, totalPages: number): PageItem[] => {
  if (totalPages <= 7) {
    return Array.from({ length: totalPages }, (_, index) => index + 1);
  }

  const windowStart = Math.max(2, Math.min(page - 2, totalPages - 4));
  const windowEnd = Math.min(totalPages - 1, Math.max(page + 2, 5));
  const items: PageItem[] = [1];

  if (windowStart > 2) items.push('start-ellipsis');
  for (let current = windowStart; current <= windowEnd; current += 1) {
    items.push(current);
  }
  if (windowEnd < totalPages - 1) items.push('end-ellipsis');
  items.push(totalPages);

  return items;
};

const pageButtonClasses =
  'inline-flex h-11 min-w-11 items-center justify-center rounded-lg px-2 text-sm font-medium transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:cursor-not-allowed disabled:opacity-40';

export const Pagination = ({
  page,
  limit,
  total,
  totalPages,
  onPageChange,
  itemLabel = 'mục',
}: {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  itemLabel?: string;
}) => {
  if (total === 0 || totalPages === 0) {
    return null;
  }

  const from = (page - 1) * limit + 1;
  const to = Math.min(page * limit, total);
  const items = buildPageItems(page, totalPages);

  return (
    <div className="flex flex-col gap-3 text-sm text-muted sm:flex-row sm:items-center sm:justify-between">
      <span>
        Hiển thị {from}–{to} / {total} {itemLabel}
      </span>

      <nav aria-label="Phân trang" className="flex flex-wrap items-center gap-1">
        <button
          type="button"
          aria-label="Trang trước"
          className={cn(pageButtonClasses, 'text-foreground hover:bg-surface-2')}
          disabled={page <= 1}
          onClick={() => onPageChange(page - 1)}
        >
          <ChevronLeft className="h-4 w-4" />
        </button>

        {items.map((item) =>
          typeof item === 'number' ? (
            <button
              key={item}
              type="button"
              aria-label={`Trang ${item}`}
              aria-current={item === page ? 'page' : undefined}
              className={cn(
                pageButtonClasses,
                item === page
                  ? 'bg-accent text-white'
                  : 'text-foreground hover:bg-surface-2'
              )}
              onClick={() => onPageChange(item)}
            >
              {item}
            </button>
          ) : (
            <span key={item} aria-hidden="true" className="inline-flex h-11 min-w-6 items-center justify-center">
              …
            </span>
          )
        )}

        <button
          type="button"
          aria-label="Trang sau"
          className={cn(pageButtonClasses, 'text-foreground hover:bg-surface-2')}
          disabled={page >= totalPages}
          onClick={() => onPageChange(page + 1)}
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </nav>
    </div>
  );
};

export default Pagination;
