import SelectField from '@/components/ui/SelectField';
import TextField from '@/components/ui/TextField';
import { cn } from '@/utils/cn';

const PRIORITY_OPTIONS = [1, 2, 3, 4, 5];

export const TaskFilterBar = ({
  search,
  priority,
  mine,
  canManage,
  onSearchChange,
  onPriorityChange,
  onMineChange,
}: {
  search: string;
  priority: number | null;
  mine: boolean;
  canManage: boolean;
  onSearchChange: (value: string) => void;
  onPriorityChange: (value: number | null) => void;
  onMineChange: (value: boolean) => void;
}) => (
  <div className="flex flex-wrap items-end gap-3">
    <div className="min-w-56 flex-1">
      <TextField
        label="Tìm việc"
        type="search"
        name="task-search"
        placeholder="Tìm theo tiêu đề"
        value={search}
        onChange={(event) => onSearchChange(event.target.value)}
      />
    </div>

    <div className="w-40">
      <SelectField
        label="Ưu tiên"
        name="task-priority"
        value={priority ?? ''}
        onChange={(event) =>
          onPriorityChange(event.target.value ? Number(event.target.value) : null)
        }
      >
        <option value="">Tất cả</option>
        {PRIORITY_OPTIONS.map((value) => (
          <option key={value} value={value}>
            P{value}
          </option>
        ))}
      </SelectField>
    </div>

    {canManage ? (
      <button
        type="button"
        aria-pressed={mine}
        onClick={() => onMineChange(!mine)}
        className={cn(
          'min-h-11 rounded-lg border px-4 text-sm font-medium transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent',
          mine
            ? 'border-accent bg-accent/10 text-accent-text'
            : 'border-border text-muted hover:bg-surface-2 hover:text-foreground'
        )}
      >
        Của tôi
      </button>
    ) : null}
  </div>
);

export default TaskFilterBar;
