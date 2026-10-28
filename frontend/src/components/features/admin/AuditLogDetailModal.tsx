import type { ReactNode } from 'react';
import Button from '@/components/ui/Button';
import Modal from '@/components/ui/Modal';
import { AUDIT_ACTION_LABELS, type AdminAuditLog } from '@/services/admin';
import { formatDateTime } from '@/utils/format';

const DetailItem = ({ label, children }: { label: string; children: ReactNode }) => (
  <div className="grid gap-1 sm:grid-cols-[8rem_1fr]">
    <dt className="text-muted">{label}</dt>
    <dd className="min-w-0 break-words text-foreground">{children}</dd>
  </div>
);

export const AuditLogDetailModal = ({
  log,
  onClose,
}: {
  log: AdminAuditLog | null;
  onClose: () => void;
}) => {
  if (!log) {
    return null;
  }

  const actionLabel = AUDIT_ACTION_LABELS[log.action];
  const metadata =
    log.metadata === null || log.metadata === undefined
      ? null
      : JSON.stringify(log.metadata, null, 2);

  return (
    <Modal
      open
      onClose={onClose}
      title="Chi tiết audit log"
      className="max-h-[90vh] max-w-2xl overflow-y-auto"
      footer={
        <Button type="button" variant="outline" className="min-h-11" onClick={onClose}>
          Đóng
        </Button>
      }
    >
      <dl className="space-y-3 text-sm">
        <DetailItem label="Hành động">
          <div className="flex flex-wrap items-center gap-2">
            <span>{actionLabel ?? log.action}</span>
            {actionLabel ? (
              <span className="rounded bg-surface-2 px-1.5 py-0.5 font-mono text-xs text-muted">
                {log.action}
              </span>
            ) : null}
          </div>
        </DetailItem>

        <DetailItem label="Loại đối tượng">{log.targetType}</DetailItem>
        <DetailItem label="ID đối tượng">
          {log.targetId ? <span className="font-mono text-xs">{log.targetId}</span> : '—'}
        </DetailItem>
        <DetailItem label="Workspace">{log.workspace?.name ?? '—'}</DetailItem>
        <DetailItem label="Lý do">{log.reason ?? '—'}</DetailItem>
        <DetailItem label="Thời gian">{formatDateTime(log.createdAt)}</DetailItem>
      </dl>

      <div className="space-y-2">
        <p className="text-sm font-medium text-foreground">Metadata</p>
        {metadata ? (
          <pre
            tabIndex={0}
            aria-label="Metadata"
            className="max-h-64 overflow-auto rounded-lg bg-surface-2 p-3 text-xs"
          >
            {metadata}
          </pre>
        ) : (
          <p className="text-sm text-muted">Không có metadata.</p>
        )}
      </div>
    </Modal>
  );
};

export default AuditLogDetailModal;
