import { formatNumber } from '@/utils/format';
import { cn } from '@/utils/cn';

export const CreditUsageCard = ({
  remainingCredit,
  className,
}: {
  remainingCredit: number;
  className?: string;
}) => (
  <div className={cn('rounded-lg border border-sidebar-border bg-sidebar-hover p-3', className)}>
    <div className="flex items-baseline justify-between gap-2 text-[11px]">
      <span className="text-sidebar-muted">Credit còn lại</span>
      <span className="font-semibold tabular-nums text-sidebar-foreground">
        {formatNumber(remainingCredit)}
      </span>
    </div>
    <p className="mt-2 text-[11px] text-sidebar-subtle">Nạp thêm khi cần dùng AI.</p>
  </div>
);

export default CreditUsageCard;
