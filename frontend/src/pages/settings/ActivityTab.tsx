import { useCallback, useEffect, useState } from 'react';
import AuditLogDetailModal from '@/components/features/admin/AuditLogDetailModal';
import AuditLogFilters from '@/components/features/admin/AuditLogFilters';
import Alert from '@/components/ui/Alert';
import Badge from '@/components/ui/Badge';
import Button from '@/components/ui/Button';
import DataTable, { type DataTableColumn } from '@/components/ui/DataTable';
import EmptyState from '@/components/ui/EmptyState';
import Pagination from '@/components/ui/Pagination';
import { useClampPage } from '@/hooks/useClampPage';
import { useActiveWorkspace, useWorkspaceAuditLogs } from '@/hooks/useWorkspace';
import { AUDIT_ACTION_LABELS, type AdminAuditLog } from '@/services/admin';
import { getErrorMessage } from '@/utils/error';
import { formatDateTime } from '@/utils/format';
import { endOfVnDayIso, startOfVnDayIso } from '@/utils/vnDate';

const PAGE_SIZE = 20;

export const ActivityTab = () => {
  const activeWorkspace = useActiveWorkspace();
  const workspaceId = activeWorkspace?.id ?? null;
  const isOwner = activeWorkspace?.role === 'OWNER';

  const [page, setPage] = useState(1);
  const [action, setAction] = useState('');
  const [targetType, setTargetType] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [selectedLog, setSelectedLog] = useState<AdminAuditLog | null>(null);

  const dateRangeInvalid = Boolean(dateFrom && dateTo && dateFrom > dateTo);

  useEffect(() => {
    setPage(1);
  }, [action, targetType, dateFrom, dateTo, workspaceId]);

  const { data, isLoading, isError, isFetching, error, refetch } = useWorkspaceAuditLogs(
    workspaceId,
    {
      page,
      limit: PAGE_SIZE,
      action: action || undefined,
      targetType: targetType || undefined,
      dateFrom: dateFrom ? startOfVnDayIso(dateFrom) : undefined,
      dateTo: dateTo ? endOfVnDayIso(dateTo) : undefined,
    },
    { enabled: isOwner && !dateRangeInvalid }
  );

  useClampPage(page, data?.meta.totalPages, setPage);

  const closeDetail = useCallback(() => setSelectedLog(null), []);

  if (!workspaceId) {
    return <EmptyState title="Bạn chưa có workspace nào." />;
  }

  if (!isOwner) {
    return <EmptyState title="Chỉ chủ workspace mới xem được lịch sử hoạt động." />;
  }

  const hasFilters = Boolean(action || targetType || dateFrom || dateTo);

  const clearFilters = () => {
    setAction('');
    setTargetType('');
    setDateFrom('');
    setDateTo('');
  };

  const columns: DataTableColumn<AdminAuditLog>[] = [
    {
      key: 'createdAt',
      header: 'Thời gian',
      cell: (log) => (
        <span className="whitespace-nowrap text-muted">{formatDateTime(log.createdAt)}</span>
      ),
    },
    {
      key: 'actor',
      header: 'Người thực hiện',
      cell: (log) =>
        log.actor ? (
          <div className="min-w-0">
            <p className="truncate text-foreground">{log.actor.name}</p>
            <p className="truncate text-xs text-muted">{log.actor.email}</p>
          </div>
        ) : (
          <span className="text-muted">Hệ thống</span>
        ),
    },
    {
      key: 'action',
      header: 'Hành động',
      cell: (log) => (
        <span className="text-foreground">{AUDIT_ACTION_LABELS[log.action] ?? log.action}</span>
      ),
    },
    {
      key: 'target',
      header: 'Đối tượng',
      cell: (log) => <Badge variant="neutral">{log.targetType}</Badge>,
    },
    {
      key: 'detail',
      header: 'Chi tiết',
      headerClassName: 'text-right',
      className: 'text-right',
      cell: (log) => (
        <Button
          type="button"
          variant="outline"
          className="min-h-11"
          aria-label={`Xem chi tiết hoạt động ${log.id}`}
          onClick={() => setSelectedLog(log)}
        >
          Xem
        </Button>
      ),
    },
  ];

  return (
    <div className="space-y-4">
      <div className="space-y-1">
        <h2 className="text-sm font-semibold text-foreground">Lịch sử hoạt động</h2>
        <p className="text-[13px] text-muted">
          Theo dõi ai đã làm gì trong workspace: sửa bài, duyệt bài, đổi lịch đăng, quản lý thành
          viên.
        </p>
      </div>

      <AuditLogFilters
        action={action}
        targetType={targetType}
        dateFrom={dateFrom}
        dateTo={dateTo}
        hasFilters={hasFilters}
        onActionChange={setAction}
        onTargetTypeChange={setTargetType}
        onDateFromChange={setDateFrom}
        onDateToChange={setDateTo}
        onClear={clearFilters}
      />

      {dateRangeInvalid ? (
        <Alert variant="danger" title="Khoảng ngày không hợp lệ.">
          Ngày bắt đầu phải trước hoặc bằng ngày kết thúc.
        </Alert>
      ) : (
        <div className="space-y-3">
          <DataTable
            columns={columns}
            rows={data?.auditLogs ?? []}
            getRowKey={(log) => log.id}
            isLoading={isLoading}
            error={
              isError ? (
                <Alert
                  variant="danger"
                  title="Không tải được lịch sử hoạt động"
                  action={
                    <Button
                      type="button"
                      variant="outline"
                      className="min-h-11"
                      isLoading={isFetching}
                      onClick={() => void refetch()}
                    >
                      Thử lại
                    </Button>
                  }
                >
                  {getErrorMessage(error)}
                </Alert>
              ) : undefined
            }
            empty={<EmptyState title="Chưa có hoạt động nào." />}
          />

          {!isLoading && !isError && data ? (
            <Pagination
              page={data.meta.page}
              limit={data.meta.limit}
              total={data.meta.total}
              totalPages={data.meta.totalPages}
              onPageChange={setPage}
              itemLabel="hoạt động"
            />
          ) : null}
        </div>
      )}

      <AuditLogDetailModal log={selectedLog} onClose={closeDetail} />
    </div>
  );
};

export default ActivityTab;
