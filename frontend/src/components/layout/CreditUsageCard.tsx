import { formatNumber } from '@/utils/format';

export const CreditUsageCard = ({
  remainingCredit,
  monthlyQuota,
}: {
  remainingCredit: number;
  monthlyQuota: number;
}) => {
  const used = Math.max(monthlyQuota - remainingCredit, 0);
  const usedPercent = monthlyQuota > 0 ? Math.min(Math.round((used / monthlyQuota) * 100), 100) : 0;

  return (
    <div className="rounded-xl border border-border bg-surface-2 p-3">
      <div className="flex items-baseline justify-between gap-2 text-xs">
        <span className="text-muted">Credit sử dụng</span>
        <span className="font-semibold text-foreground">
          {monthlyQuota > 0
            ? `${formatNumber(used)} / ${formatNumber(monthlyQuota)}`
            : `Còn ${formatNumber(remainingCredit)}`}
        </span>
      </div>

      {monthlyQuota > 0 ? (
        <div
          role="progressbar"
          aria-label="Credit đã sử dụng"
          aria-valuenow={usedPercent}
          aria-valuemin={0}
          aria-valuemax={100}
          className="mt-2 h-1.5 overflow-hidden rounded-full bg-border"
        >
          <div className="h-full rounded-full bg-accent" style={{ width: `${usedPercent}%` }} />
        </div>
      ) : null}
    </div>
  );
};

export default CreditUsageCard;
