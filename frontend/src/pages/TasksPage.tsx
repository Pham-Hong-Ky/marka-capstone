import { useState } from 'react';
import Alert from '@/components/ui/Alert';
import Button from '@/components/ui/Button';
import EmptyState from '@/components/ui/EmptyState';
import PageHeader from '@/components/ui/PageHeader';
import { SkeletonBlock } from '@/components/ui/Skeleton';
import TaskBoard from '@/components/features/task/TaskBoard';
import TaskFilterBar from '@/components/features/task/TaskFilterBar';
import { useTaskBoard } from '@/hooks/useTasks';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import { useActiveWorkspace } from '@/hooks/useWorkspace';
import { getErrorMessage } from '@/utils/error';

export const TasksPage = () => {
  const activeWorkspace = useActiveWorkspace();
  const workspaceId = activeWorkspace?.id ?? null;
  const canManage = activeWorkspace?.role === 'OWNER';

  const [search, setSearch] = useState('');
  const [priority, setPriority] = useState<number | null>(null);
  const [mine, setMine] = useState(false);
  const debouncedSearch = useDebouncedValue(search, 300);

  const { data, isLoading, isError, error, refetch } = useTaskBoard(workspaceId, {
    search: debouncedSearch.trim() || undefined,
    priority: priority ?? undefined,
    mine: mine || undefined,
  });

  if (!workspaceId) {
    return (
      <EmptyState
        title="Bạn chưa có workspace nào."
        description="Tạo workspace để bắt đầu giao việc cho nhóm."
      />
    );
  }

  const showUnassigned = canManage && !mine;

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <PageHeader
        title="Công việc"
        description="Theo dõi việc của nhóm theo 4 cột. P1 là ưu tiên cao nhất, P5 là thấp nhất."
      />

      <TaskFilterBar
        search={search}
        priority={priority}
        mine={mine}
        canManage={canManage}
        onSearchChange={setSearch}
        onPriorityChange={setPriority}
        onMineChange={setMine}
      />

      {isError ? (
        <Alert
          variant="danger"
          title="Không tải được bảng công việc"
          action={
            <Button type="button" variant="outline" onClick={() => refetch()}>
              Thử lại
            </Button>
          }
        >
          {getErrorMessage(error)}
        </Alert>
      ) : null}

      {isLoading ? (
        <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: showUnassigned ? 4 : 3 }, (_, index) => (
            <SkeletonBlock key={index} className="h-64" />
          ))}
        </div>
      ) : null}

      {!isLoading && !isError && data ? (
        <TaskBoard board={data} showUnassigned={showUnassigned} />
      ) : null}
    </div>
  );
};

export default TasksPage;
