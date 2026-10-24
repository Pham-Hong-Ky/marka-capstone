import { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import Button from '@/components/ui/Button';
import EmptyState from '@/components/ui/EmptyState';
import PageHeader from '@/components/ui/PageHeader';
import { SkeletonBlock } from '@/components/ui/Skeleton';
import CreditHistoryTable from '@/components/features/billing/CreditHistoryTable';
import PackageCard from '@/components/features/billing/PackageCard';
import PaymentModal from '@/components/features/billing/PaymentModal';
import { useActiveWorkspace, syncSessionUser } from '@/hooks/useWorkspace';
import {
  billingKeys,
  useBilling,
  useBillingOrder,
  useCancelBillingOrder,
  useCreateBillingOrder,
  useCreditTransactions,
} from '@/hooks/useBilling';
import type {
  BillingOrder,
  BillingPaginationMeta,
  CreditPackage,
} from '@/services/billing';
import { getErrorMessage } from '@/utils/error';
import { formatNumber } from '@/utils/format';

const EMPTY_META: BillingPaginationMeta = { page: 1, limit: 10, total: 0, totalPages: 0 };

export const BillingPage = () => {
  const activeWorkspace = useActiveWorkspace();
  const workspaceId = activeWorkspace?.id ?? null;
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();

  const [page, setPage] = useState(1);
  const [orderId, setOrderId] = useState<string | null>(() => searchParams.get('orderId'));
  const [createdOrder, setCreatedOrder] = useState<BillingOrder | null>(null);
  const [purchasingPackageId, setPurchasingPackageId] = useState<string | null>(null);
  const notifiedOrderRef = useRef<string | null>(null);

  const billing = useBilling(workspaceId);
  const transactions = useCreditTransactions(workspaceId, page);
  const createOrder = useCreateBillingOrder();
  const cancelOrder = useCancelBillingOrder();
  const orderQuery = useBillingOrder(workspaceId, orderId);

  const activeOrder = orderQuery.data ?? createdOrder;

  useEffect(() => {
    const queryOrderId = searchParams.get('orderId');
    if (queryOrderId && queryOrderId !== orderId) {
      setOrderId(queryOrderId);
      setCreatedOrder(null);
    }
  }, [orderId, searchParams]);

  useEffect(() => {
    if (!activeOrder || activeOrder.status !== 'PAID' || notifiedOrderRef.current === activeOrder.id) {
      return;
    }

    notifiedOrderRef.current = activeOrder.id;
    void syncSessionUser();

    if (workspaceId) {
      queryClient.invalidateQueries({ queryKey: billingKeys.overview(workspaceId) });
      queryClient.invalidateQueries({ queryKey: ['billing', workspaceId, 'transactions'] });
    }

    toast.success('Nạp credit thành công');
    setOrderId(null);
    setCreatedOrder(null);
    setSearchParams({}, { replace: true });
  }, [activeOrder, queryClient, setSearchParams, workspaceId]);

  if (!workspaceId) {
    return <EmptyState title="Bạn chưa có workspace nào." />;
  }

  if (billing.isLoading) {
    return (
      <div className="mx-auto max-w-5xl space-y-6">
        <PageHeader title="Credit & Nạp" description="Nạp credit để dùng trợ lý AI và sinh ảnh." />
        <SkeletonBlock />
      </div>
    );
  }

  if (billing.isError || !billing.data) {
    return (
      <div className="mx-auto max-w-5xl space-y-6">
        <PageHeader title="Credit & Nạp" description="Nạp credit để dùng trợ lý AI và sinh ảnh." />
        <div className="rounded-2xl border border-border bg-surface p-6">
          <p className="text-sm text-danger">{getErrorMessage(billing.error)}</p>
          <Button type="button" variant="outline" className="mt-4" onClick={() => billing.refetch()}>
            Thử lại
          </Button>
        </div>
      </div>
    );
  }

  const { remainingCredit, packages } = billing.data;

  const handleBuy = (creditPackage: CreditPackage) => {
    setPurchasingPackageId(creditPackage.id);
    createOrder.mutate(
      { workspaceId, payload: { packageId: creditPackage.id } },
      {
        onSuccess: (order) => {
          setCreatedOrder(order);
          setOrderId(order.id);
          setSearchParams({ orderCode: order.orderCode, orderId: order.id }, { replace: true });

          if (order.checkoutUrl) {
            window.open(order.checkoutUrl, '_blank', 'noopener,noreferrer');
          }
        },
        onSettled: () => setPurchasingPackageId(null),
      }
    );
  };

  const handleClosePayment = () => {
    setOrderId(null);
    setCreatedOrder(null);
    setSearchParams({}, { replace: true });
  };

  const handleCancelOrder = () => {
    if (!activeOrder) return;
    cancelOrder.mutate({ workspaceId, orderId: activeOrder.id });
  };

  return (
    <div className="mx-auto max-w-5xl space-y-8">
      <PageHeader
        title="Credit & Nạp"
        description="Nạp credit để dùng trợ lý AI và sinh ảnh. Credit không hết hạn, dùng đến khi hết."
      />

      <section className="rounded-2xl border border-border bg-surface p-6">
        <p className="text-sm text-muted">Credit còn lại</p>
        <p className="mt-1 text-3xl font-semibold tabular-nums text-foreground">
          {formatNumber(remainingCredit)}
        </p>
        <p className="mt-2 text-sm text-muted">
          Credit được cộng ngay sau khi thanh toán PayOS thành công.
        </p>
      </section>

      <section className="space-y-4">
        <div>
          <h2 className="text-base font-semibold text-foreground">Gói nạp</h2>
          <p className="mt-1 text-sm text-muted">
            Mọi thành viên đều có thể nạp credit cho workspace.
          </p>
        </div>

        {packages.length === 0 ? (
          <EmptyState
            title="Chưa có gói nạp nào."
            description="Quản trị viên cần cấu hình gói nạp trước khi bán credit."
          />
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {packages.map((creditPackage) => (
              <PackageCard
                key={creditPackage.id}
                creditPackage={creditPackage}
                isPurchasing={purchasingPackageId === creditPackage.id}
                isBusy={purchasingPackageId !== null}
                onBuy={handleBuy}
              />
            ))}
          </div>
        )}
      </section>

      <section className="space-y-4">
        <div>
          <h2 className="text-base font-semibold text-foreground">Lịch sử credit</h2>
          <p className="mt-1 text-sm text-muted">
            Các lần nạp credit và sử dụng trợ lý AI.
          </p>
        </div>

        <CreditHistoryTable
          transactions={transactions.data?.transactions ?? []}
          meta={transactions.data?.meta ?? EMPTY_META}
          isLoading={transactions.isLoading}
          isError={transactions.isError}
          errorMessage={getErrorMessage(transactions.error)}
          onPageChange={setPage}
        />
      </section>

      <PaymentModal
        open={Boolean(activeOrder || orderId)}
        order={activeOrder}
        isLoading={orderQuery.isLoading}
        isCancelling={cancelOrder.isPending}
        error={orderQuery.isError ? getErrorMessage(orderQuery.error) : null}
        onClose={handleClosePayment}
        onCancel={handleCancelOrder}
      />
    </div>
  );
};

export default BillingPage;
