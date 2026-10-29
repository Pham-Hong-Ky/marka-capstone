import { useState } from 'react';
import { Plus } from 'lucide-react';
import type { TaskColumn as TaskColumnName, TaskItem } from '@/services/task';
import { cn } from '@/utils/cn';
import TaskCard from './TaskCard';

export const TaskColumn = ({
  column,
  title,
  tasks,
  onCreate,
  onOpenTask,
  onStatusChange,
  onDropTask,
}: {
  column: TaskColumnName;
  title: string;
  tasks: TaskItem[];
  onCreate?: () => void;
  onOpenTask?: (task: TaskItem) => void;
  onStatusChange?: (task: TaskItem, status: TaskItem['status']) => void;
  onDropTask?: (taskId: string, column: TaskColumnName) => void;
}) => {
  const [isOver, setIsOver] = useState(false);

  return (
    <section
      onDragOver={(event) => {
        if (!onDropTask) return;
        event.preventDefault();
        event.dataTransfer.dropEffect = 'move';
      }}
      onDragEnter={(event) => {
        if (!onDropTask) return;
        setIsOver(true);
        event.preventDefault();
      }}
      onDragLeave={(event) => {
        if (!onDropTask) return;
        if (event.currentTarget.contains(event.relatedTarget as Node)) return;
        setIsOver(false);
      }}
      onDrop={(event) => {
        if (!onDropTask) return;
        event.preventDefault();
        setIsOver(false);
        const taskId = event.dataTransfer.getData('text/plain');
        if (taskId) {
          onDropTask(taskId, column);
        }
      }}
      className={cn(
        'flex min-h-64 flex-col rounded-2xl border border-border bg-surface-2/40 p-3 transition',
        isOver && 'border-accent bg-accent/5'
      )}
    >
      <header className="mb-3 flex items-center justify-between gap-2 px-1">
        <h2 className="text-sm font-semibold text-foreground">{title}</h2>
        <div className="flex items-center gap-1">
          <span className="text-xs text-muted">{tasks.length}</span>
          {onCreate ? (
            <button
              type="button"
              aria-label={`Tạo việc trong cột ${title}`}
              onClick={onCreate}
              className="grid h-11 w-11 place-items-center rounded-lg text-muted transition hover:bg-surface hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
            >
              <Plus className="h-4 w-4" />
            </button>
          ) : null}
        </div>
      </header>

      <div className="flex flex-1 flex-col gap-2">
        {tasks.length === 0 ? (
          <p className="rounded-xl border border-dashed border-border px-3 py-6 text-center text-xs text-muted">
            Chưa có việc
          </p>
        ) : (
          tasks.map((task) => (
            <TaskCard
              key={task.id}
              task={task}
              onOpen={onOpenTask ? () => onOpenTask(task) : undefined}
              onStatusChange={
                onStatusChange ? (status) => onStatusChange(task, status) : undefined
              }
              draggable={Boolean(onDropTask)}
            />
          ))
        )}
      </div>
    </section>
  );
};

export default TaskColumn;
