import type {
  TaskBoard as TaskBoardData,
  TaskColumn as TaskColumnName,
  TaskItem,
  TaskStatus,
} from '@/services/task';
import TaskColumn from './TaskColumn';

export const TaskBoard = ({
  board,
  showUnassigned,
  canManage,
  onCreate,
  onOpenTask,
  onStatusChange,
  onDropTask,
}: {
  board: TaskBoardData;
  showUnassigned: boolean;
  canManage: boolean;
  onCreate?: (column: 'unassigned' | 'todo') => void;
  onOpenTask?: (task: TaskItem) => void;
  onStatusChange?: (task: TaskItem, status: TaskStatus) => void;
  onDropTask?: (taskId: string, column: TaskColumnName) => void;
}) => (
  <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-4">
    {showUnassigned ? (
      <TaskColumn
        column="unassigned"
        title="Chưa giao"
        tasks={board.unassigned}
        count={board.counts.unassigned}
        onCreate={onCreate ? () => onCreate('unassigned') : undefined}
        onOpenTask={onOpenTask}
        onDropTask={onDropTask}
      />
    ) : null}
    <TaskColumn
      column="todo"
      title="Cần làm"
      tasks={board.todo}
      count={board.counts.todo}
      onCreate={canManage && onCreate ? () => onCreate('todo') : undefined}
      onOpenTask={onOpenTask}
      onStatusChange={onStatusChange}
      onDropTask={onDropTask}
    />
    <TaskColumn
      column="inProgress"
      title="Đang làm"
      tasks={board.inProgress}
      count={board.counts.inProgress}
      onOpenTask={onOpenTask}
      onStatusChange={onStatusChange}
      onDropTask={onDropTask}
    />
    <TaskColumn
      column="done"
      title="Hoàn thành"
      tasks={board.done}
      count={board.counts.done}
      onOpenTask={onOpenTask}
      onStatusChange={onStatusChange}
      onDropTask={onDropTask}
    />
  </div>
);

export default TaskBoard;
