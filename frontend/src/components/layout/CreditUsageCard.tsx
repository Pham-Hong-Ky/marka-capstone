import { formatNumber } from '@/utils/format';
import { cn } from '@/utils/cn';

export const CreditUsageCard = ({
  remainingCredit,
  className,
}: {
  remainingCredit: number;
  className?: string;
}) => (
  <div className={cn('rounded-xl border border-border bg-surface-2 p-3', className)}>
    <div className="flex items-baseline justify-between gap-2 text-xs">
      <span className="text-muted">Credit còn lại</span>
      <span className="font-semibold tabular-nums text-foreground">
        {formatNumber(remainingCredit)}
      </span>
    </div>
  </div>
);

export default CreditUsageCard;
