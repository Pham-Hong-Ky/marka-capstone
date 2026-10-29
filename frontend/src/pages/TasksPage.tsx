import { useMemo, useState } from 'react';
import Alert from '@/components/ui/Alert';
import Button from '@/components/ui/Button';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import EmptyState from '@/components/ui/EmptyState';
import PageHeader from '@/components/ui/PageHeader';
import { SkeletonBlock } from '@/components/ui/Skeleton';
import TaskBoard from '@/components/features/task/TaskBoard';
import TaskCreateModal from '@/components/features/task/TaskCreateModal';
import TaskDetailModal from '@/components/features/task/TaskDetailModal';
import TaskFilterBar from '@/components/features/task/TaskFilterBar';
import { useDeleteTask, useTaskBoard } from '@/hooks/useTasks';
import type { TaskItem } from '@/services/task';
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
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<TaskItem | null>(null);
  const [taskToDelete, setTaskToDelete] = useState<TaskItem | null>(null);
  const debouncedSearch = useDebouncedValue(search, 300);

  const { data, isLoading, isError, error, refetch } = useTaskBoard(workspaceId, {
    search: debouncedSearch.trim() || undefined,
    priority: priority ?? undefined,
    mine: mine || undefined,
  });
  const deleteTask = useDeleteTask();

  const selectedTask = useMemo(() => {
    if (!data || !selectedTaskId) return null;
    return (
      [...data.unassigned, ...data.todo, ...data.inProgress, ...data.done].find(
        (task) => task.id === selectedTaskId
      ) ?? null
    );
  }, [data, selectedTaskId]);

  const openCreate = () => {
    setEditingTask(null);
    setFormOpen(true);
  };

  const openEdit = (task: TaskItem) => {
    setSelectedTaskId(null);
    setEditingTask(task);
    setFormOpen(true);
  };

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
        actions={
          canManage ? (
            <Button type="button" onClick={openCreate}>
              Tạo việc
            </Button>
          ) : undefined
        }
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
        <TaskBoard
          board={data}
          showUnassigned={showUnassigned}
          onCreate={canManage ? openCreate : undefined}
          onOpenTask={(task) => setSelectedTaskId(task.id)}
        />
      ) : null}

      <TaskCreateModal
        open={formOpen}
        onClose={() => setFormOpen(false)}
        workspaceId={workspaceId}
        task={editingTask}
      />

      <TaskDetailModal
        open={Boolean(selectedTask)}
        task={selectedTask}
        canManage={canManage}
        onClose={() => setSelectedTaskId(null)}
        onEdit={openEdit}
        onDelete={(task) => setTaskToDelete(task)}
      />

      <ConfirmDialog
        open={Boolean(taskToDelete)}
        onClose={() => setTaskToDelete(null)}
        title="Xoá công việc?"
        description={`Xoá "${taskToDelete?.title ?? ''}"? Bài viết đã gắn (nếu có) sẽ không bị xoá.`}
        confirmLabel="Xoá việc"
        tone="danger"
        isLoading={deleteTask.isPending}
        onConfirm={() => {
          if (!taskToDelete) return;
          deleteTask.mutate(
            { workspaceId, taskId: taskToDelete.id },
            {
              onSuccess: () => {
                setTaskToDelete(null);
                setSelectedTaskId(null);
              },
            }
          );
        }}
      />
    </div>
  );
};

export default TasksPage;
