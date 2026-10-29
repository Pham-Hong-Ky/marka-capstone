import EmptyState from '@/components/ui/EmptyState';
import Pagination from '@/components/ui/Pagination';
import { SkeletonList } from '@/components/ui/Skeleton';
import { Table, TBody, TD, TH, THead, TR } from '@/components/ui/Table';
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
      <Table className="min-w-[720px]">
        <THead className="uppercase tracking-wide">
          <TR>
            <TH scope="col">Thời gian</TH>
            <TH scope="col">Loại</TH>
            <TH scope="col">Số credit</TH>
            <TH scope="col">Số dư sau</TH>
            <TH scope="col">Ghi chú</TH>
          </TR>
        </THead>
        <TBody>
          {transactions.map((transaction) => (
            <TR key={transaction.id} className="align-top">
              <TD className="whitespace-nowrap text-muted">
                {formatDateTime(transaction.createdAt)}
              </TD>
              <TD>
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
              </TD>
              <TD
                className={cn(
                  'whitespace-nowrap font-semibold tabular-nums',
                  transaction.type === 'INFLOW' ? 'text-success' : 'text-foreground'
                )}
              >
                {transaction.type === 'INFLOW' ? '+' : '-'}
                {formatNumber(transaction.amount)}
              </TD>
              <TD className="whitespace-nowrap tabular-nums text-foreground">
                {formatNumber(transaction.balanceAfter)}
              </TD>
              <TD className="text-muted">
                <p>{transaction.reason ?? '—'}</p>
                {transaction.createdBy ? (
                  <p className="mt-1 text-xs text-subtle">{transaction.createdBy.name}</p>
                ) : null}
              </TD>
            </TR>
          ))}
        </TBody>
      </Table>

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
