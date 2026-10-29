import Avatar from '@/components/ui/Avatar';
import Badge from '@/components/ui/Badge';
import type { TaskItem } from '@/services/task';
import { cn } from '@/utils/cn';
import { formatDateTime } from '@/utils/format';
import TaskPriorityBadge from './TaskPriorityBadge';

const cardClasses =
  'w-full rounded-xl border border-border bg-surface p-3 text-left transition hover:border-accent/40 hover:bg-surface-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent';

export const TaskCard = ({ task, onOpen }: { task: TaskItem; onOpen?: () => void }) => {
  const overdue = Boolean(task.dueAt && new Date(task.dueAt) < new Date() && task.status !== 'DONE');

  const content = (
    <>
      <span className="flex items-start justify-between gap-2">
        <span className="line-clamp-2 text-sm font-medium text-foreground">{task.title}</span>
        <TaskPriorityBadge priority={task.priority} />
      </span>

      <span className="mt-2 flex flex-wrap items-center gap-2">
        {task.post ? <Badge variant="neutral">Bài viết</Badge> : null}
        {overdue ? (
          <span className="text-xs font-medium text-danger">Quá hạn</span>
        ) : task.dueAt ? (
          <span className={cn('text-xs text-muted')}>Hạn: {formatDateTime(task.dueAt)}</span>
        ) : null}
      </span>

      <span className="mt-3 flex items-center gap-2">
        {task.assignee ? (
          <>
            <Avatar
              name={task.assignee.name}
              src={task.assignee.avatar}
              className="h-6 w-6 text-[10px]"
            />
            <span className="truncate text-xs text-muted">{task.assignee.name}</span>
          </>
        ) : (
          <span className="text-xs text-subtle">Chưa giao</span>
        )}
      </span>
    </>
  );

  if (!onOpen) {
    return <article className={cardClasses}>{content}</article>;
  }

  return (
    <button type="button" onClick={onOpen} className={cardClasses}>
      {content}
    </button>
  );
};

export default TaskCard;
