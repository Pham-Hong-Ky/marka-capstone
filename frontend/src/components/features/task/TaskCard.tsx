import { useEffect, useRef, useState } from 'react';
import { Check, MoreHorizontal } from 'lucide-react';
import Avatar from '@/components/ui/Avatar';
import Badge from '@/components/ui/Badge';
import { useDismissable } from '@/hooks/useDismissable';
import { useMenuKeyboard } from '@/hooks/useMenuKeyboard';
import type { TaskItem, TaskStatus } from '@/services/task';
import { cn } from '@/utils/cn';
import { formatDateTime } from '@/utils/format';
import TaskPriorityBadge from './TaskPriorityBadge';

const cardClasses =
  'w-full rounded-xl border border-border bg-surface p-3 text-left transition hover:border-accent/40 hover:bg-surface-2';

const STATUS_OPTIONS: Array<{ status: TaskStatus; label: string }> = [
  { status: 'TODO', label: 'Cần làm' },
  { status: 'IN_PROGRESS', label: 'Đang làm' },
  { status: 'DONE', label: 'Hoàn thành' },
  { status: 'CANCELLED', label: 'Huỷ việc' },
];

const TaskStatusMenu = ({
  task,
  onChange,
}: {
  task: TaskItem;
  onChange: (status: TaskStatus) => void;
}) => {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useDismissable(containerRef, () => setOpen(false), { enabled: open });
  const onKeyDown = useMenuKeyboard(menuRef, () => setOpen(false));

  useEffect(() => {
    if (!open) return;
    menuRef.current?.querySelector<HTMLElement>('[role="menuitem"]')?.focus();
  }, [open]);

  if (!task.assignee) return null;

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        aria-label={`Đổi trạng thái công việc ${task.title}`}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
        className="grid h-11 w-11 place-items-center rounded-lg text-muted transition hover:bg-surface-2 hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
      >
        <MoreHorizontal className="h-4 w-4" />
      </button>

      {open ? (
        <div
          ref={menuRef}
          role="menu"
          aria-label={`Đổi trạng thái công việc ${task.title}`}
          onKeyDown={onKeyDown}
          className="absolute right-0 top-full z-20 mt-1 w-44 overflow-hidden rounded-xl border border-border bg-surface p-1 shadow-xl"
        >
          {STATUS_OPTIONS.map((option) => (
            <button
              key={option.status}
              type="button"
              role="menuitem"
              disabled={option.status === task.status}
              onClick={() => {
                setOpen(false);
                onChange(option.status);
              }}
              className={cn(
                'flex min-h-11 w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-sm transition hover:bg-surface-2 focus:bg-surface-2 focus:outline-none',
                option.status === task.status ? 'text-muted' : 'text-foreground',
                option.status === 'CANCELLED' && option.status !== task.status ? 'text-danger' : ''
              )}
            >
              {option.status === task.status ? <Check className="h-4 w-4" /> : null}
              {option.label}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
};

export const TaskCard = ({
  task,
  onOpen,
  onStatusChange,
  draggable = false,
}: {
  task: TaskItem;
  onOpen?: () => void;
  onStatusChange?: (status: TaskStatus) => void;
  draggable?: boolean;
}) => {
  const overdue = Boolean(task.dueAt && new Date(task.dueAt) < new Date() && task.status !== 'DONE');

  const summary = (
    <>
      <span className="flex items-start justify-between gap-2">
        <span className="line-clamp-2 text-sm font-medium text-foreground">{task.title}</span>
        <TaskPriorityBadge priority={task.priority} />
      </span>

      <span className="mt-2 flex flex-wrap items-center gap-2">
        {task.post ? <Badge variant="neutral">Bài viết</Badge> : null}
        {overdue ? <span className="text-xs font-medium text-danger">Quá hạn</span> : null}
        {task.dueAt ? (
          <span className="text-xs text-muted">Hạn: {formatDateTime(task.dueAt)}</span>
        ) : null}
      </span>
    </>
  );

  return (
    <article
      aria-label={`${task.title}, ưu tiên P${task.priority}`}
      aria-roledescription={draggable ? 'thẻ công việc có thể kéo' : 'thẻ công việc'}
      className={cardClasses}
      draggable={draggable}
      onDragStart={(event) => {
        event.dataTransfer.setData('text/plain', task.id);
        event.dataTransfer.effectAllowed = 'move';
      }}
    >
      {onOpen ? (
        <button
          type="button"
          onClick={onOpen}
          className="block w-full text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        >
          {summary}
        </button>
      ) : (
        <div>{summary}</div>
      )}

      <div className="mt-3 flex items-center gap-2">
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

        {onStatusChange ? (
          <div className="ml-auto">
            <TaskStatusMenu task={task} onChange={onStatusChange} />
          </div>
        ) : null}
      </div>
    </article>
  );
};

export default TaskCard;
