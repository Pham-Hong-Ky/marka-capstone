import EmptyState from '@/components/ui/EmptyState';
import Pagination from '@/components/ui/Pagination';
import { SkeletonList } from '@/components/ui/Skeleton';
import { cn } from '@/utils/cn';
import { formatDateTime, formatNumber } from '@/utils/format';
import type {
  BillingPaginationMeta,
  CreditActionType,
  CreditTransaction,
} from '@/services/billing';

const ACTION_LABELS: Record<CreditActionType, string> = {
  GEN_TEXT: 'Sinh nội dung AI',
  GEN_IMAGE: 'Sinh ảnh AI',
  REGEN: 'Sinh lại nội dung',
  SCORE: 'Chấm điểm nội dung',
  TOP_UP: 'Nạp credit',
  RESET: 'Reset credit (cũ)',
  REFUND: 'Hoàn credit',
};

export const CreditHistoryTable = ({
  transactions,
  meta,
  isLoading,
  isError,
  errorMessage,
  onPageChange,
}: {
  transactions: CreditTransaction[];
  meta: BillingPaginationMeta;
  isLoading: boolean;
  isError: boolean;
  errorMessage: string;
  onPageChange: (page: number) => void;
}) => {
  if (isLoading) {
    return <SkeletonList rows={5} />;
  }

  if (isError) {
    return (
      <p className="rounded-2xl border border-border bg-surface p-5 text-sm text-danger">
        {errorMessage}
      </p>
    );
  }

  if (transactions.length === 0) {
    return (
      <EmptyState
        title="Chưa có giao dịch credit."
        description="Lịch sử nạp credit và sử dụng AI sẽ hiển thị tại đây."
      />
    );
  }

  return (
    <div className="space-y-4">
      <div className="overflow-x-auto rounded-2xl border border-border bg-surface">
        <table className="w-full min-w-[720px] text-left text-sm">
          <thead>
            <tr className="text-xs uppercase tracking-wide text-muted">
              <th className="px-5 py-3 font-medium">Thời gian</th>
              <th className="px-5 py-3 font-medium">Loại</th>
              <th className="px-5 py-3 font-medium">Số credit</th>
              <th className="px-5 py-3 font-medium">Số dư sau</th>
              <th className="px-5 py-3 font-medium">Ghi chú</th>
            </tr>
          </thead>
          <tbody>
            {transactions.map((transaction) => (
              <tr key={transaction.id} className="border-t border-border align-top">
                <td className="whitespace-nowrap px-5 py-4 text-muted">
                  {formatDateTime(transaction.createdAt)}
                </td>
                <td className="px-5 py-4">
                  <span
                    className={cn(
                      'rounded-full px-2.5 py-1 text-xs font-medium',
                      transaction.type === 'INFLOW'
                        ? 'bg-success/10 text-success'
                        : 'bg-surface-2 text-muted'
                    )}
                  >
                    {ACTION_LABELS[transaction.action]}
                  </span>
                </td>
                <td
                  className={cn(
                    'whitespace-nowrap px-5 py-4 font-semibold tabular-nums',
                    transaction.type === 'INFLOW' ? 'text-success' : 'text-foreground'
                  )}
                >
                  {transaction.type === 'INFLOW' ? '+' : '-'}
                  {formatNumber(transaction.amount)}
                </td>
                <td className="whitespace-nowrap px-5 py-4 tabular-nums text-foreground">
                  {formatNumber(transaction.balanceAfter)}
                </td>
                <td className="px-5 py-4 text-muted">
                  <p>{transaction.reason ?? '—'}</p>
                  {transaction.createdBy ? (
                    <p className="mt-1 text-xs text-subtle">{transaction.createdBy.name}</p>
                  ) : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Pagination
        page={meta.page}
        limit={meta.limit}
        total={meta.total}
        totalPages={meta.totalPages}
        onPageChange={onPageChange}
        itemLabel="giao dịch"
      />
    </div>
  );
};

export default CreditHistoryTable;
