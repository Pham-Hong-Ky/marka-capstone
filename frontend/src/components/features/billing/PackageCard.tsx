import Button from '@/components/ui/Button';
import { formatNumber } from '@/utils/format';
import type { CreditPackage } from '@/services/billing';

export const PackageCard = ({
  creditPackage,
  isPurchasing,
  isBusy,
  onBuy,
}: {
  creditPackage: CreditPackage;
  isPurchasing: boolean;
  isBusy: boolean;
  onBuy: (creditPackage: CreditPackage) => void;
}) => (
  <div className="flex flex-col rounded-xl border border-border bg-surface p-5">
    <h3 className="text-sm font-semibold text-foreground">{creditPackage.name}</h3>

    <p className="mt-3 text-2xl font-semibold tabular-nums tracking-tight text-foreground">
      {formatNumber(creditPackage.price)}đ
    </p>
    <p className="mt-1 text-[13px] text-muted">
      +{formatNumber(creditPackage.creditAmount)} credit
    </p>
    <p className="mt-1 text-[11px] text-subtle">
      {creditPackage.description ?? 'Credit dùng cho trợ lý AI và sinh ảnh.'}
    </p>

    <Button
      type="button"
      className="mt-4 w-full"
      disabled={isBusy}
      isLoading={isPurchasing}
      onClick={() => onBuy(creditPackage)}
    >
      Nạp credit
    </Button>
  </div>
);

export default PackageCard;
