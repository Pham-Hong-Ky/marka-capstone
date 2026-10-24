import { ExternalLink } from 'lucide-react';
import Button from '@/components/ui/Button';
import Modal from '@/components/ui/Modal';
import { cn } from '@/utils/cn';
import { formatDateTime, formatNumber } from '@/utils/format';
import type { BillingOrder, BillingOrderStatus } from '@/services/billing';

const STATUS_LABELS: Record<BillingOrderStatus, string> = {
  PENDING: 'Chờ thanh toán',
  PAID: 'Đã thanh toán',
  CANCELLED: 'Đã huỷ',
};

const statusClasses: Record<BillingOrderStatus, string> = {
  PENDING: 'bg-warning/10 text-warning',
  PAID: 'bg-success/10 text-success',
  CANCELLED: 'bg-surface-2 text-muted',
};

export const PaymentModal = ({
  open,
  order,
  isLoading,
  isCancelling,
  error,
  onClose,
  onCancel,
}: {
  open: boolean;
  order: BillingOrder | null;
  isLoading: boolean;
  isCancelling: boolean;
  error: string | null;
  onClose: () => void;
  onCancel: () => void;
}) => {
  const title = order?.creditAmount
    ? `Nạp ${formatNumber(order.creditAmount)} credit`
    : 'Thanh toán nạp credit';
  const canOpenCheckout = Boolean(order?.checkoutUrl);
  const canCancel = order?.status === 'PENDING';

  const openCheckout = () => {
    if (!order?.checkoutUrl) return;
    window.open(order.checkoutUrl, '_blank', 'noopener,noreferrer');
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      footer={
        canCancel ? (
          <>
            <Button
              type="button"
              variant="outline"
              className="text-danger"
              isLoading={isCancelling}
              onClick={onCancel}
            >
              Huỷ đơn
            </Button>
            <Button type="button" onClick={openCheckout} disabled={!canOpenCheckout}>
              <ExternalLink className="h-4 w-4" />
              Mở trang thanh toán
            </Button>
          </>
        ) : (
          <Button type="button" onClick={onClose}>
            Đóng
          </Button>
        )
      }
    >
      {isLoading && !order ? (
        <p className="text-sm text-muted">Đang tải trạng thái đơn hàng...</p>
      ) : null}

      {error ? <p className="text-sm text-danger">{error}</p> : null}

      {order ? (
        <div className="space-y-3 text-sm">
          <div className="flex items-center justify-between gap-4">
            <span className="text-muted">Trạng thái</span>
            <span
              className={cn(
                'rounded-full px-2.5 py-1 text-xs font-medium',
                statusClasses[order.status]
              )}
            >
              {STATUS_LABELS[order.status]}
            </span>
          </div>

          <div className="flex items-center justify-between gap-4">
            <span className="text-muted">Số tiền</span>
            <span className="font-semibold text-foreground">
              {formatNumber(order.amount)}đ
            </span>
          </div>

          {order.creditAmount ? (
            <div className="flex items-center justify-between gap-4">
              <span className="text-muted">Credit nhận được</span>
              <span className="font-semibold text-success">
                +{formatNumber(order.creditAmount)}
              </span>
            </div>
          ) : null}

          <div className="flex items-center justify-between gap-4">
            <span className="text-muted">Mã đơn</span>
            <span className="font-mono text-xs text-foreground">{order.orderCode}</span>
          </div>

          {order.expiresAt ? (
            <div className="flex items-center justify-between gap-4">
              <span className="text-muted">Hết hạn link</span>
              <span className="text-foreground">{formatDateTime(order.expiresAt)}</span>
            </div>
          ) : null}

          {order.status === 'PENDING' ? (
            <p className="rounded-lg bg-surface-2 p-3 text-muted">
              Sau khi thanh toán trên PayOS, trạng thái sẽ tự cập nhật. Bạn có thể đóng cửa sổ này
              và quay lại sau.
            </p>
          ) : null}

          {order.status === 'PAID' ? (
            <p className="rounded-lg bg-success/10 p-3 text-success">
              Thanh toán thành công. Credit đã được cộng vào workspace.
            </p>
          ) : null}

          {order.status === 'CANCELLED' ? (
            <p className="rounded-lg bg-surface-2 p-3 text-muted">
              Đơn hàng đã bị huỷ. Bạn có thể tạo đơn nạp mới nếu vẫn muốn mua credit.
            </p>
          ) : null}
        </div>
      ) : null}
    </Modal>
  );
};

export default PaymentModal;
