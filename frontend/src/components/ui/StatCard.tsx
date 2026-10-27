import { Minus, TrendingDown, TrendingUp } from 'lucide-react';
import type { ReactNode } from 'react';
import { cn } from '@/utils/cn';

const Delta = ({ value }: { value: number }) => {
  const Icon = value > 0 ? TrendingUp : value < 0 ? TrendingDown : Minus;
  const tone = value > 0 ? 'text-success' : value < 0 ? 'text-danger' : 'text-muted';

  return (
    <span className={cn('inline-flex items-center gap-0.5 text-xs font-medium', tone)}>
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
  <div className={cn('rounded-2xl border border-border bg-surface p-5', className)}>
    <p className="text-sm text-muted">{label}</p>
    <div className="mt-1 flex flex-wrap items-baseline gap-2">
      <p className="text-2xl font-semibold tabular-nums text-foreground">{value}</p>
      {typeof delta === 'number' ? <Delta value={delta} /> : null}
    </div>
    {hint ? <div className="mt-1 text-xs text-subtle">{hint}</div> : null}
  </div>
);

export default StatCard;
