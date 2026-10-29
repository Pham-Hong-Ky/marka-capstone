import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import {
  taskService,
  type CreateTaskPayload,
  type TaskBoard,
  type TaskBoardParams,
  type TaskColumn,
  type TaskItem,
  type TaskStatus,
  type UpdateTaskPayload,
} from '@/services/task';
import { queryKeys } from '@/lib/queryKeys';
import { getErrorMessage } from '@/utils/error';

const COLUMNS: TaskColumn[] = ['unassigned', 'todo', 'inProgress', 'done'];

const findColumn = (board: TaskBoard, taskId: string): TaskColumn | null =>
  COLUMNS.find((column) => board[column].some((task) => task.id === taskId)) ?? null;

const compareTasks = (a: TaskItem, b: TaskItem): number => {
  if (a.priority !== b.priority) return a.priority - b.priority;
  if (a.dueAt && b.dueAt) return new Date(a.dueAt).getTime() - new Date(b.dueAt).getTime();
  if (a.dueAt) return -1;
  if (b.dueAt) return 1;
  return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
};

const applyStatus = (board: TaskBoard, taskId: string, status: TaskStatus): TaskBoard => {
  const source = findColumn(board, taskId);
  if (!source) return board;

  const task = board[source].find((item) => item.id === taskId);
  if (!task) return board;

  const next: TaskBoard = {
    ...board,
    [source]: board[source].filter((item) => item.id !== taskId),
    counts: { ...board.counts, [source]: Math.max(0, board.counts[source] - 1) },
  };

  if (status === 'CANCELLED') {
    return next;
  }

  const target: TaskColumn =
    status === 'TODO'
      ? task.assignee
        ? 'todo'
        : 'unassigned'
      : status === 'IN_PROGRESS'
        ? 'inProgress'
        : 'done';
  next[target] = [
    ...next[target],
    { ...task, status, updatedAt: new Date().toISOString() },
  ].sort(compareTasks);
  next.counts[target] += 1;
  return next;
};

export const useTaskBoard = (workspaceId: string | null, params: TaskBoardParams) =>
  useQuery({
    queryKey: queryKeys.task.board(workspaceId ?? '', params),
    queryFn: () => taskService.listBoard(workspaceId as string, params),
    enabled: Boolean(workspaceId),
  });

export const useCreateTask = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      workspaceId,
      payload,
    }: {
      workspaceId: string;
      payload: CreateTaskPayload;
    }) => taskService.createTask(workspaceId, payload),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.task.boardRoot(variables.workspaceId) });
      toast.success('Tạo công việc thành công');
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  });
};

export const useUpdateTask = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      workspaceId,
      taskId,
      payload,
    }: {
      workspaceId: string;
      taskId: string;
      payload: UpdateTaskPayload;
    }) => taskService.updateTask(workspaceId, taskId, payload),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.task.boardRoot(variables.workspaceId) });
      toast.success('Cập nhật công việc thành công');
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  });
};

export const useAssignTask = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      workspaceId,
      taskId,
      assigneeId,
    }: {
      workspaceId: string;
      taskId: string;
      assigneeId: string | null;
    }) => taskService.assignTask(workspaceId, taskId, { assigneeId }),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.task.boardRoot(variables.workspaceId) });
      toast.success(variables.assigneeId ? 'Giao việc thành công' : 'Đã bỏ giao việc');
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  });
};

export const useUpdateTaskStatus = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      workspaceId,
      taskId,
      status,
    }: {
      workspaceId: string;
      taskId: string;
      status: TaskStatus;
    }) => taskService.updateTaskStatus(workspaceId, taskId, status),
    onMutate: async ({ workspaceId, taskId, status }) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.task.boardRoot(workspaceId) });
      const previous = queryClient.getQueriesData<TaskBoard>({
        queryKey: queryKeys.task.boardRoot(workspaceId),
      });

      queryClient.setQueriesData<TaskBoard>(
        { queryKey: queryKeys.task.boardRoot(workspaceId) },
        (board) => (board ? applyStatus(board, taskId, status) : board)
      );

      return { previous };
    },
    onError: (error, _variables, context) => {
      context?.previous.forEach(([key, data]) => queryClient.setQueryData(key, data));
      toast.error(getErrorMessage(error));
    },
    onSuccess: () => toast.success('Cập nhật trạng thái công việc thành công'),
    onSettled: (_data, _error, variables) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.task.boardRoot(variables.workspaceId) });
      queryClient.invalidateQueries({
        queryKey: queryKeys.post.detailWorkspace(variables.workspaceId),
      });
    },
  });
};

export const useLinkTaskPost = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      workspaceId,
      taskId,
      postId,
    }: {
      workspaceId: string;
      taskId: string;
      postId: string | null;
    }) => taskService.linkPost(workspaceId, taskId, { postId }),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.task.boardRoot(variables.workspaceId) });
      queryClient.invalidateQueries({
        queryKey: queryKeys.post.detailWorkspace(variables.workspaceId),
      });
      toast.success(variables.postId ? 'Gắn bài viết thành công' : 'Đã bỏ gắn bài viết');
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  });
};

export const useDeleteTask = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ workspaceId, taskId }: { workspaceId: string; taskId: string }) =>
      taskService.deleteTask(workspaceId, taskId),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.task.boardRoot(variables.workspaceId) });
      queryClient.invalidateQueries({
        queryKey: queryKeys.post.detailWorkspace(variables.workspaceId),
      });
      toast.success('Xoá công việc thành công');
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  });
};
