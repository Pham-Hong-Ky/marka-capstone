import type { TaskBoard as TaskBoardData, TaskItem } from '@/services/task';
import TaskColumn from './TaskColumn';

export const TaskBoard = ({
  board,
  showUnassigned,
  onCreate,
  onOpenTask,
}: {
  board: TaskBoardData;
  showUnassigned: boolean;
  onCreate?: (column: 'unassigned' | 'todo') => void;
  onOpenTask?: (task: TaskItem) => void;
}) => (
  <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-4">
    {showUnassigned ? (
      <TaskColumn
        title="Chưa giao"
        tasks={board.unassigned}
        onCreate={onCreate ? () => onCreate('unassigned') : undefined}
        onOpenTask={onOpenTask}
      />
    ) : null}
    <TaskColumn
      title="Cần làm"
      tasks={board.todo}
      onCreate={onCreate ? () => onCreate('todo') : undefined}
      onOpenTask={onOpenTask}
    />
    <TaskColumn
      title="Đang làm"
      tasks={board.inProgress}
      onCreate={onCreate ? () => onCreate('todo') : undefined}
      onOpenTask={onOpenTask}
    />
    <TaskColumn
      title="Hoàn thành"
      tasks={board.done}
      onCreate={onCreate ? () => onCreate('todo') : undefined}
      onOpenTask={onOpenTask}
    />
  </div>
);

export default TaskBoard;
