import { Minus, TrendingDown, TrendingUp } from 'lucide-react';
import type { ReactNode } from 'react';
import { cn } from '@/utils/cn';

export const Delta = ({ value, className }: { value: number; className?: string }) => {
  const Icon = value > 0 ? TrendingUp : value < 0 ? TrendingDown : Minus;
  const tone = value > 0 ? 'text-success' : value < 0 ? 'text-danger' : 'text-muted';

  return (
    <span
      className={cn(
        'inline-flex items-center gap-0.5 text-[11px] font-medium tabular-nums',
        tone,
        className
      )}
    >
      <Icon aria-hidden="true" className="h-3.5 w-3.5" />
      {value > 0 ? '+' : ''}
      {value}%
    </span>
  );
};

export const StatCard = ({
  label,
  value,
  hint,
  delta,
  className,
}: {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  delta?: number | null;
  className?: string;
}) => (
  <div className={cn('rounded-xl border border-border bg-surface p-4', className)}>
    <p className="text-[11px] font-medium uppercase tracking-wide text-muted">{label}</p>
    <div className="mt-1 flex flex-wrap items-baseline gap-2">
      <p className="text-2xl font-semibold tabular-nums tracking-tight text-foreground">{value}</p>
      {typeof delta === 'number' ? (
        <Delta value={delta} />
      ) : delta === null ? (
        <span className="text-[11px] font-medium text-muted">
          <span aria-hidden="true">—</span>
          <span className="sr-only">không có dữ liệu</span>
        </span>
      ) : null}
    </div>
    {hint ? <div className="mt-1 text-[11px] text-subtle">{hint}</div> : null}
  </div>
);

export default StatCard;
