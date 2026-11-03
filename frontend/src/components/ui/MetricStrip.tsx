import type { ReactNode } from 'react';
import { cn } from '@/utils/cn';
import { Delta } from './StatCard';

export interface MetricItem {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  delta?: number | null;
}

const columnsFor = (count: number): string => {
  if (count >= 5) return 'sm:grid-cols-5';
  if (count === 4) return 'sm:grid-cols-2 lg:grid-cols-4';
  return 'sm:grid-cols-3';
};

export const MetricStrip = ({
  items,
  className,
}: {
  items: MetricItem[];
  className?: string;
}) => (
  <section
    className={cn(
      'grid gap-px overflow-hidden rounded-xl border border-border bg-border',
      columnsFor(items.length),
      className
    )}
  >
    {items.map((item) => (
      <div
        key={item.label}
        className={cn(
          'bg-surface p-4',
          items.length % 2 === 1 && 'last:col-span-2 sm:last:col-span-1'
        )}
      >
        <p className="text-[11px] font-medium uppercase tracking-wide text-muted">{item.label}</p>
        <div className="mt-1 flex flex-wrap items-baseline gap-2">
          <p className="text-2xl font-semibold tabular-nums tracking-tight text-foreground">
            {item.value}
          </p>
          {typeof item.delta === 'number' ? (
            <Delta value={item.delta} />
          ) : item.delta === null ? (
            <span className="text-[11px] text-muted">—</span>
          ) : null}
        </div>
        {item.hint ? <div className="mt-1 text-[11px] text-subtle">{item.hint}</div> : null}
      </div>
    ))}
  </section>
);

export default MetricStrip;
