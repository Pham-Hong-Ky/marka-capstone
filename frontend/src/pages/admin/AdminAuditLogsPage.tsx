import { useCallback, useEffect, useState } from 'react';
import AuditLogDetailModal from '@/components/features/admin/AuditLogDetailModal';
import AuditLogFilters from '@/components/features/admin/AuditLogFilters';
import Alert from '@/components/ui/Alert';
import Badge from '@/components/ui/Badge';
import Button from '@/components/ui/Button';
import DataTable, { type DataTableColumn } from '@/components/ui/DataTable';
import EmptyState from '@/components/ui/EmptyState';
import Pagination from '@/components/ui/Pagination';
import { useAdminAuditLogs } from '@/hooks/useAdmin';
import { useClampPage } from '@/hooks/useClampPage';
import { AUDIT_ACTION_LABELS, type AdminAuditLog } from '@/services/admin';
import { getErrorMessage } from '@/utils/error';
import { formatDateTime } from '@/utils/format';

const PAGE_SIZE = 20;

const parseVnDate = (value: string): Date | undefined => {
  const date = new Date(value);

  return Number.isNaN(date.getTime()) ? undefined : date;
};

const startOfVnDayIso = (date: string) => {
  const parsed = parseVnDate(`${date}T00:00:00+07:00`);

  return parsed?.toISOString();
};

const endOfVnDayIso = (date: string) => {
  const parsed = parseVnDate(`${date}T23:59:59.999+07:00`);

  return parsed?.toISOString();
};

const actionLabel = (action: string) => AUDIT_ACTION_LABELS[action] ?? action;

export const AdminAuditLogsPage = () => {
  const [page, setPage] = useState(1);
  const [action, setAction] = useState('');
  const [targetType, setTargetType] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [selectedLog, setSelectedLog] = useState<AdminAuditLog | null>(null);

  const dateRangeInvalid = Boolean(dateFrom && dateTo && dateFrom > dateTo);

  useEffect(() => {
    setPage(1);
  }, [action, targetType, dateFrom, dateTo]);

  const { data, isLoading, isError, isFetching, error, refetch } = useAdminAuditLogs(
    {
      page,
      limit: PAGE_SIZE,
      action: action || undefined,
      targetType: targetType || undefined,
      dateFrom: dateFrom ? startOfVnDayIso(dateFrom) : undefined,
      dateTo: dateTo ? endOfVnDayIso(dateTo) : undefined,
    },
    { enabled: !dateRangeInvalid }
  );

  const auditLogs = data?.auditLogs ?? [];
  const totalPages = data?.meta.totalPages;

  useClampPage(page, totalPages, setPage);

  const clearFilters = () => {
    setAction('');
    setTargetType('');
    setDateFrom('');
    setDateTo('');
    setPage(1);
  };

  const hasFilters = Boolean(action || targetType || dateFrom || dateTo);

  const closeDetail = useCallback(() => setSelectedLog(null), []);

  const renderActor = (log: AdminAuditLog) =>
    log.actor ? (
      <div className="min-w-0">
        <p className="truncate text-foreground">{log.actor.name}</p>
        <p className="truncate text-xs text-muted">{log.actor.email}</p>
      </div>
    ) : (
      <span className="text-muted">Hệ thống</span>
    );

  const renderTarget = (log: AdminAuditLog) => (
    <div className="flex flex-wrap items-center gap-2">
      <Badge variant="neutral">{log.targetType}</Badge>
      {log.targetId ? (
        <span className="font-mono text-xs text-muted" title={log.targetId}>
          {log.targetId.slice(0, 8)}
        </span>
      ) : null}
    </div>
  );

  const renderDetailButton = (log: AdminAuditLog) => (
    <Button
      type="button"
      variant="outline"
      className="min-h-11"
      aria-label={`Xem chi tiết audit log ${log.id}`}
      onClick={() => setSelectedLog(log)}
    >
      Xem
    </Button>
  );

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
      cell: renderActor,
    },
    {
      key: 'action',
      header: 'Hành động',
      cell: (log) => <span className="text-foreground">{actionLabel(log.action)}</span>,
    },
    {
      key: 'target',
      header: 'Đối tượng',
      cell: renderTarget,
    },
    {
      key: 'workspace',
      header: 'Workspace',
      cell: (log) => (
        <span className="block max-w-48 truncate text-foreground">
          {log.workspace?.name ?? '—'}
        </span>
      ),
    },
    {
      key: 'detail',
      header: 'Chi tiết',
      headerClassName: 'text-right',
      className: 'text-right',
      cell: renderDetailButton,
    },
  ];

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h2 className="text-lg font-semibold text-foreground">Audit log</h2>
        <p className="text-sm text-muted">
          Theo dõi lịch sử thao tác của người dùng và hệ thống trên toàn bộ workspace.
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
        <div className="space-y-4">
          <DataTable
            columns={columns}
            rows={auditLogs}
            getRowKey={(log) => log.id}
            isLoading={isLoading}
            error={
              isError ? (
                <Alert
                  variant="danger"
                  title="Không tải được audit log"
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
            empty={<EmptyState title="Không có audit log nào." />}
          />

          {!isLoading && !isError && data ? (
            <Pagination
              page={data.meta.page}
              limit={data.meta.limit}
              total={data.meta.total}
              totalPages={data.meta.totalPages}
              onPageChange={setPage}
              itemLabel="audit log"
            />
          ) : null}
        </div>
      )}

      <AuditLogDetailModal log={selectedLog} onClose={closeDetail} />
    </div>
  );
};

export default AdminAuditLogsPage;
