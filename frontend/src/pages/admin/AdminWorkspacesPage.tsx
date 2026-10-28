import { useEffect, useState } from 'react';
import Alert from '@/components/ui/Alert';
import Badge from '@/components/ui/Badge';
import Button from '@/components/ui/Button';
import DataTable, { type DataTableColumn } from '@/components/ui/DataTable';
import EmptyState from '@/components/ui/EmptyState';
import Pagination from '@/components/ui/Pagination';
import SelectField from '@/components/ui/SelectField';
import TextField from '@/components/ui/TextField';
import { useAdminWorkspaces } from '@/hooks/useAdmin';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import type { AdminWorkspace } from '@/services/admin';
import type { WorkspacePlan } from '@/services/auth';
import { getErrorMessage } from '@/utils/error';
import { formatDate, formatNumber } from '@/utils/format';

type PlanFilter = '' | WorkspacePlan;

const PAGE_SIZE = 10;

export const AdminWorkspacesPage = () => {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [plan, setPlan] = useState<PlanFilter>('');
  const [includeDeleted, setIncludeDeleted] = useState(false);

  const debouncedSearch = useDebouncedValue(search, 300);
  const searchTerm = debouncedSearch.trim();

  useEffect(() => {
    setPage(1);
  }, [searchTerm, plan, includeDeleted]);

  const { data, isLoading, isError, isFetching, error, refetch } = useAdminWorkspaces({
    page,
    limit: PAGE_SIZE,
    search: searchTerm || undefined,
    plan: plan || undefined,
    includeDeleted,
  });

  const totalPages = data?.meta.totalPages;

  useEffect(() => {
    if (totalPages !== undefined && page > totalPages) {
      setPage(Math.max(1, totalPages));
    }
  }, [page, totalPages]);

  const workspaces = data?.workspaces ?? [];

  const renderName = (workspace: AdminWorkspace) => (
    <div className="flex flex-wrap items-center gap-2">
      <span className="min-w-0 truncate font-medium text-foreground" title={workspace.name}>
        {workspace.name}
      </span>
      {workspace.deletedAt ? <Badge variant="danger">Đã xoá</Badge> : null}
    </div>
  );

  const columns: DataTableColumn<AdminWorkspace>[] = [
    {
      key: 'name',
      header: 'Tên',
      cell: renderName,
    },
    {
      key: 'plan',
      header: 'Gói',
      cell: (workspace) => <Badge variant="accent">{workspace.plan}</Badge>,
    },
    {
      key: 'memberCount',
      header: 'Thành viên',
      cell: (workspace) => (
        <span className="tabular-nums text-foreground">
          {formatNumber(workspace.memberCount)}
        </span>
      ),
    },
    {
      key: 'postCount',
      header: 'Bài viết',
      cell: (workspace) => (
        <span className="tabular-nums text-foreground">{formatNumber(workspace.postCount)}</span>
      ),
    },
    {
      key: 'remainingCredit',
      header: 'Credit còn lại',
      cell: (workspace) => (
        <span className="tabular-nums text-foreground">
          {formatNumber(workspace.remainingCredit)}
        </span>
      ),
    },
    {
      key: 'createdAt',
      header: 'Ngày tạo',
      cell: (workspace) => (
        <span className="whitespace-nowrap text-muted">{formatDate(workspace.createdAt)}</span>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h2 className="text-lg font-semibold text-foreground">Workspace</h2>
        <p className="text-sm text-muted">
          Theo dõi danh sách workspace, gói dịch vụ và mức sử dụng credit trong hệ thống.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <TextField
          label="Tìm workspace"
          name="search"
          placeholder="Tên workspace"
          className="min-h-11"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
        <SelectField
          label="Gói"
          name="plan"
          className="min-h-11"
          value={plan}
          onChange={(event) => setPlan(event.target.value as PlanFilter)}
        >
          <option value="">Tất cả</option>
          <option value="FREE">FREE</option>
          <option value="PRO">PRO</option>
          <option value="ENTERPRISE">ENTERPRISE</option>
        </SelectField>
        <label className="flex min-h-11 cursor-pointer items-center gap-3 self-end text-sm text-foreground">
          <input
            type="checkbox"
            className="h-4 w-4 accent-accent"
            checked={includeDeleted}
            onChange={(event) => setIncludeDeleted(event.target.checked)}
          />
          Bao gồm workspace đã xoá
        </label>
      </div>

      <div className="space-y-4">
        <DataTable
          columns={columns}
          rows={workspaces}
          getRowKey={(workspace) => workspace.id}
          isLoading={isLoading}
          error={
            isError ? (
              <Alert
                variant="danger"
                title="Không tải được danh sách workspace"
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
          empty={<EmptyState title="Không tìm thấy workspace." />}
        />

        {!isLoading && !isError && data ? (
          <Pagination
            page={data.meta.page}
            limit={data.meta.limit}
            total={data.meta.total}
            totalPages={data.meta.totalPages}
            onPageChange={setPage}
            itemLabel="workspace"
          />
        ) : null}
      </div>
    </div>
  );
};

export default AdminWorkspacesPage;
