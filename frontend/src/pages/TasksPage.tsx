import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import Alert from '@/components/ui/Alert';
import Button from '@/components/ui/Button';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import EmptyState from '@/components/ui/EmptyState';
import PageHeader from '@/components/ui/PageHeader';
import { SkeletonBlock } from '@/components/ui/Skeleton';
import TaskAssignModal from '@/components/features/task/TaskAssignModal';
import TaskBoard from '@/components/features/task/TaskBoard';
import TaskCreateModal from '@/components/features/task/TaskCreateModal';
import TaskDetailModal from '@/components/features/task/TaskDetailModal';
import TaskFilterBar from '@/components/features/task/TaskFilterBar';
import TaskLinkPostModal from '@/components/features/task/TaskLinkPostModal';
import { useAssignTask, useDeleteTask, useTaskBoard, useUpdateTaskStatus } from '@/hooks/useTasks';
import type { TaskColumn, TaskItem, TaskStatus } from '@/services/task';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import { useActiveWorkspace } from '@/hooks/useWorkspace';
import { getErrorMessage } from '@/utils/error';

const COLUMN_STATUS: Record<Exclude<TaskColumn, 'unassigned'>, TaskStatus> = {
  todo: 'TODO',
  inProgress: 'IN_PROGRESS',
  done: 'DONE',
};

export const TasksPage = () => {
  const [searchParams, setSearchParams] = useSearchParams();
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
  const [assignTarget, setAssignTarget] = useState<{
    task: TaskItem;
    targetStatus: TaskStatus | null;
  } | null>(null);
  const [linkTarget, setLinkTarget] = useState<TaskItem | null>(null);
  const [pendingUnassign, setPendingUnassign] = useState<TaskItem | null>(null);
  const [taskToCancel, setTaskToCancel] = useState<TaskItem | null>(null);
  const debouncedSearch = useDebouncedValue(search, 300);
  const taskIdFromQuery = searchParams.get('taskId');

  const { data, isLoading, isError, error, refetch } = useTaskBoard(workspaceId, {
    search: debouncedSearch.trim() || undefined,
    priority: priority ?? undefined,
    mine: mine || undefined,
  });
  const deleteTask = useDeleteTask();
  const updateStatus = useUpdateTaskStatus();
  const assignMutation = useAssignTask();

  useEffect(() => {
    if (taskIdFromQuery) {
      setSelectedTaskId(taskIdFromQuery);
    }
  }, [taskIdFromQuery]);

  const selectedTask = useMemo(() => {
    if (!data || !selectedTaskId) return null;
    return (
      [...data.unassigned, ...data.todo, ...data.inProgress, ...data.done].find(
        (task) => task.id === selectedTaskId
      ) ?? null
    );
  }, [data, selectedTaskId]);

  const closeDetail = () => {
    setSelectedTaskId(null);
    if (taskIdFromQuery) {
      const next = new URLSearchParams(searchParams);
      next.delete('taskId');
      setSearchParams(next, { replace: true });
    }
  };

  const openCreate = () => {
    setEditingTask(null);
    setFormOpen(true);
  };

  const openEdit = (task: TaskItem) => {
    closeDetail();
    setEditingTask(task);
    setFormOpen(true);
  };

  const openAssign = (task: TaskItem) => {
    closeDetail();
    setAssignTarget({ task, targetStatus: null });
  };

  const openLinkPost = (task: TaskItem) => {
    closeDetail();
    setLinkTarget(task);
  };

  const handleDropTask = (taskId: string, column: TaskColumn) => {
    if (!workspaceId || !data) return;
    const task = [...data.unassigned, ...data.todo, ...data.inProgress, ...data.done].find(
      (item) => item.id === taskId
    );
    if (!task) return;

    if (column === 'unassigned') {
      if (task.assignee) {
        setPendingUnassign(task);
      }
      return;
    }

    if (!task.assignee) {
      setAssignTarget({
        task,
        targetStatus: column === 'todo' ? null : COLUMN_STATUS[column],
      });
      return;
    }

    const status = COLUMN_STATUS[column];
    if (task.status !== status) {
      updateStatus.mutate({ workspaceId, taskId: task.id, status });
    }
  };

  const handleStatusChange = (task: TaskItem, status: TaskStatus) => {
    if (!workspaceId) return;

    if (status === 'CANCELLED') {
      setTaskToCancel(task);
      return;
    }

    updateStatus.mutate({ workspaceId, taskId: task.id, status });
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
          canManage={canManage}
          onCreate={canManage ? openCreate : undefined}
          onOpenTask={(task) => setSelectedTaskId(task.id)}
          onStatusChange={handleStatusChange}
          onDropTask={handleDropTask}
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
        onClose={closeDetail}
        onEdit={openEdit}
        onDelete={(task) => setTaskToDelete(task)}
        onAssign={openAssign}
        onLinkPost={openLinkPost}
      />

      {assignTarget ? (
        <TaskAssignModal
          open
          onClose={() => setAssignTarget(null)}
          workspaceId={workspaceId}
          task={assignTarget.task}
          onAssigned={(assigned) => {
            if (assignTarget.targetStatus) {
              updateStatus.mutate({
                workspaceId,
                taskId: assigned.id,
                status: assignTarget.targetStatus,
              });
            }
          }}
        />
      ) : null}

      {linkTarget ? (
        <TaskLinkPostModal
          open
          onClose={() => setLinkTarget(null)}
          workspaceId={workspaceId}
          task={linkTarget}
          canManage={canManage}
        />
      ) : null}

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
                closeDetail();
              },
            }
          );
        }}
      />

      <ConfirmDialog
        open={Boolean(taskToCancel)}
        onClose={() => setTaskToCancel(null)}
        title="Huỷ công việc?"
        description={`Huỷ "${taskToCancel?.title ?? ''}"? Việc sẽ bị ẩn khỏi bảng và bỏ gắn bài viết (nếu có).`}
        confirmLabel="Huỷ việc"
        tone="danger"
        isLoading={updateStatus.isPending}
        onConfirm={() => {
          if (!taskToCancel) return;
          updateStatus.mutate(
            { workspaceId, taskId: taskToCancel.id, status: 'CANCELLED' },
            { onSuccess: () => setTaskToCancel(null) }
          );
        }}
      />

      <ConfirmDialog
        open={Boolean(pendingUnassign)}
        onClose={() => setPendingUnassign(null)}
        title="Bỏ giao việc?"
        description={`Bỏ giao "${pendingUnassign?.title ?? ''}"? Việc sẽ về cột Chưa giao và hạn chót bị xoá.`}
        confirmLabel="Bỏ giao"
        tone="danger"
        isLoading={assignMutation.isPending}
        onConfirm={() => {
          if (!pendingUnassign) return;
          assignMutation.mutate(
            { workspaceId, taskId: pendingUnassign.id, assigneeId: null },
            { onSuccess: () => setPendingUnassign(null) }
          );
        }}
      />
    </div>
  );
};

export default TasksPage;
