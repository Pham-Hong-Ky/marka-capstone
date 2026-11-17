import TextField from '@/components/ui/TextField';
import { cn } from '@/utils/cn';

export const TaskFilterBar = ({
  search,
  mine,
  canManage,
  onSearchChange,
  onMineChange,
}: {
  search: string;
  mine: boolean;
  canManage: boolean;
  onSearchChange: (value: string) => void;
  onMineChange: (value: boolean) => void;
}) => (
  <div className="rounded-xl border border-border bg-surface p-3">
    <div className="flex flex-col gap-3 lg:flex-row lg:items-end">
      <div className="min-w-0 flex-1">
        <TextField
          label="Tìm việc"
          type="search"
          name="task-search"
          placeholder="Tìm theo tiêu đề"
          value={search}
          onChange={(event) => onSearchChange(event.target.value)}
        />
      </div>

      {canManage ? (
        <button
          type="button"
          aria-pressed={mine}
          onClick={() => onMineChange(!mine)}
          className={cn(
            'min-h-11 rounded-lg border px-4 text-[13px] font-medium transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent',
            mine
              ? 'border-accent bg-accent/10 text-accent-text'
              : 'border-border text-muted hover:bg-surface-2 hover:text-foreground'
          )}
        >
          Của tôi
        </button>
      ) : null}
    </div>
  </div>
);

export default TaskFilterBar;
