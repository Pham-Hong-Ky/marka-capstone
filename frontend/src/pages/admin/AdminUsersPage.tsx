import { useEffect, useState } from 'react';
import UserSuspendDialog from '@/components/features/admin/UserSuspendDialog';
import Alert from '@/components/ui/Alert';
import Avatar from '@/components/ui/Avatar';
import Badge from '@/components/ui/Badge';
import Button from '@/components/ui/Button';
import DataTable, { type DataTableColumn } from '@/components/ui/DataTable';
import EmptyState from '@/components/ui/EmptyState';
import Pagination from '@/components/ui/Pagination';
import SelectField from '@/components/ui/SelectField';
import TextField from '@/components/ui/TextField';
import { useAdminUsers } from '@/hooks/useAdmin';
import { useClampPage } from '@/hooks/useClampPage';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import type { AdminUser } from '@/services/admin';
import { useAuthStore } from '@/stores/auth.store';
import { getErrorMessage } from '@/utils/error';
import { formatDate, formatNumber } from '@/utils/format';

type RoleFilter = '' | 'SYSTEM_ADMIN' | 'USER';
type StatusFilter = '' | 'active' | 'suspended';

const PAGE_SIZE = 10;

const ROLE_LABELS: Record<AdminUser['systemRole'], string> = {
  SYSTEM_ADMIN: 'Quản trị',
  USER: 'Người dùng',
};

export const AdminUsersPage = () => {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [systemRole, setSystemRole] = useState<RoleFilter>('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('');
  const [selectedUser, setSelectedUser] = useState<AdminUser | null>(null);

  const currentUserId = useAuthStore((state) => state.user?.id ?? null);
  const debouncedSearch = useDebouncedValue(search, 300);
  const searchTerm = debouncedSearch.trim();

  useEffect(() => {
    setPage(1);
  }, [searchTerm, systemRole, statusFilter]);

  const isSuspended = statusFilter === '' ? undefined : statusFilter === 'suspended';

  const { data, isLoading, isError, isFetching, error, refetch } = useAdminUsers({
    page,
    limit: PAGE_SIZE,
    search: searchTerm || undefined,
    systemRole: systemRole || undefined,
    isSuspended,
  });

  const totalPages = data?.meta.totalPages;

  useClampPage(page, totalPages, setPage);

  const users = data?.users ?? [];

  const renderAction = (user: AdminUser) => {
    const isSelf = user.id === currentUserId;
    const actionLabel = user.isSuspended ? 'Mở khoá' : 'Khoá';

    return (
      <Button
        type="button"
        variant="outline"
        className="min-h-11"
        disabled={isSelf}
        title={isSelf ? 'Không thể tự khoá tài khoản' : undefined}
        aria-label={`${actionLabel} tài khoản ${user.name}`}
        onClick={() => setSelectedUser(user)}
      >
        {actionLabel}
      </Button>
    );
  };

  const columns: DataTableColumn<AdminUser>[] = [
    {
      key: 'user',
      header: 'Người dùng',
      cell: (user) => (
        <div className="flex items-center gap-3">
          <Avatar name={user.name} src={user.avatar} className="h-9 w-9" />
          <div className="min-w-0">
            <p className="truncate font-medium text-foreground">{user.name}</p>
            <p className="truncate text-xs text-muted">{user.email}</p>
          </div>
        </div>
      ),
    },
    {
      key: 'role',
      header: 'Vai trò',
      cell: (user) => (
        <Badge variant={user.systemRole === 'SYSTEM_ADMIN' ? 'accent' : 'neutral'}>
          {ROLE_LABELS[user.systemRole]}
        </Badge>
      ),
    },
    {
      key: 'status',
      header: 'Trạng thái',
      cell: (user) => (
        <Badge variant={user.isSuspended ? 'danger' : 'success'}>
          {user.isSuspended ? 'Bị khoá' : 'Hoạt động'}
        </Badge>
      ),
    },
    {
      key: 'workspaceCount',
      header: 'Workspace',
      cell: (user) => (
        <span className="tabular-nums text-foreground">{formatNumber(user.workspaceCount)}</span>
      ),
    },
    {
      key: 'createdAt',
      header: 'Ngày tạo',
      cell: (user) => (
        <span className="whitespace-nowrap text-muted">{formatDate(user.createdAt)}</span>
      ),
    },
    {
      key: 'actions',
      header: 'Hành động',
      headerClassName: 'text-right',
      className: 'text-right',
      cell: renderAction,
    },
  ];

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h2 className="text-lg font-semibold text-foreground">Người dùng</h2>
        <p className="text-sm text-muted">
          Tìm kiếm và quản lý trạng thái tài khoản người dùng trong hệ thống.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <TextField
          label="Tìm người dùng"
          name="search"
          placeholder="Tên hoặc email"
          className="min-h-11"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
        <SelectField
          label="Vai trò"
          name="systemRole"
          className="min-h-11"
          value={systemRole}
          onChange={(event) => setSystemRole(event.target.value as RoleFilter)}
        >
          <option value="">Tất cả</option>
          <option value="SYSTEM_ADMIN">Quản trị</option>
          <option value="USER">Người dùng</option>
        </SelectField>
        <SelectField
          label="Trạng thái"
          name="statusFilter"
          className="min-h-11"
          value={statusFilter}
          onChange={(event) => setStatusFilter(event.target.value as StatusFilter)}
        >
          <option value="">Tất cả</option>
          <option value="active">Hoạt động</option>
          <option value="suspended">Bị khoá</option>
        </SelectField>
      </div>

      <div className="space-y-4">
        <DataTable
          columns={columns}
          rows={users}
          getRowKey={(user) => user.id}
          isLoading={isLoading}
          error={
            isError ? (
              <Alert
                variant="danger"
                title="Không tải được danh sách người dùng"
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
          empty={<EmptyState title="Không tìm thấy người dùng." />}
        />

        {!isLoading && !isError && data ? (
          <Pagination
            page={data.meta.page}
            limit={data.meta.limit}
            total={data.meta.total}
            totalPages={data.meta.totalPages}
            onPageChange={setPage}
            itemLabel="người dùng"
          />
        ) : null}
      </div>

      {selectedUser ? (
        <UserSuspendDialog
          key={selectedUser.id}
          user={selectedUser}
          onClose={() => setSelectedUser(null)}
        />
      ) : null}
    </div>
  );
};

export default AdminUsersPage;
