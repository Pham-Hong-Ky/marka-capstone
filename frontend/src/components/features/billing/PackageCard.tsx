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
  <div className="flex flex-col rounded-2xl border border-border bg-surface p-6">
    <h3 className="text-base font-semibold text-foreground">{creditPackage.name}</h3>

    <p className="mt-4 text-2xl font-semibold text-foreground">
      {formatNumber(creditPackage.price)}đ
    </p>
    <p className="mt-2 text-sm text-muted">
      +{formatNumber(creditPackage.creditAmount)} credit
    </p>
    <p className="mt-1 text-xs text-subtle">
      {creditPackage.description ?? 'Credit dùng cho trợ lý AI và sinh ảnh.'}
    </p>

    <Button
      type="button"
      className="mt-6 w-full"
      disabled={isBusy}
      isLoading={isPurchasing}
      onClick={() => onBuy(creditPackage)}
    >
      Nạp credit
    </Button>
  </div>
);

export default PackageCard;
