import { useState, type FormEvent } from 'react';
import { Plus, Search } from 'lucide-react';
import Button from '@/components/ui/Button';
import { POST_STATUS_TABS, type PostStatus } from '@/services/post';
import { cn } from '@/utils/cn';

export const PostToolbar = ({
  status,
  onStatusChange,
  onSearch,
  onCreate,
}: {
  status: PostStatus | null;
  onStatusChange: (status: PostStatus | null) => void;
  onSearch: (term: string) => void;
  onCreate: () => void;
}) => {
  const [term, setTerm] = useState('');

  const submitSearch = (event: FormEvent) => {
    event.preventDefault();
    onSearch(term.trim());
  };

  return (
    <div className="rounded-xl border border-border bg-surface p-3">
      <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
        <div className="min-w-0 overflow-x-auto">
          <div
            role="group"
            aria-label="Lọc theo trạng thái"
            className="flex w-max gap-1 rounded-lg bg-surface-2 p-1"
          >
            {POST_STATUS_TABS.map((tab) => (
              <button
                key={tab.label}
                type="button"
                aria-pressed={status === tab.value}
                onClick={() => onStatusChange(tab.value)}
                className={cn(
                  'min-h-11 shrink-0 rounded-md px-3 text-[12px] font-medium transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent',
                  status === tab.value
                    ? 'bg-surface text-foreground shadow-sm'
                    : 'text-muted hover:text-foreground'
                )}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        <form onSubmit={submitSearch} className="flex w-full items-center gap-2 xl:w-auto">
          <div className="relative min-w-0 flex-1 xl:w-64">
            <label htmlFor="post-search" className="sr-only">
              Tìm bài viết theo tiêu đề
            </label>
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-subtle" />
            <input
              id="post-search"
              value={term}
              onChange={(event) => setTerm(event.target.value)}
              placeholder="Tìm theo tiêu đề..."
              className="min-h-11 w-full rounded-lg border border-border bg-surface pl-9 pr-3 text-sm text-foreground outline-none transition placeholder:text-subtle focus:border-accent focus:ring-2 focus:ring-accent/20"
            />
          </div>
          <Button type="submit" variant="outline">
            Tìm
          </Button>
          <Button type="button" onClick={onCreate} className="shrink-0">
            <Plus className="h-4 w-4" />
            Tạo bài viết
          </Button>
        </form>
      </div>
    </div>
  );
};

export default PostToolbar;
