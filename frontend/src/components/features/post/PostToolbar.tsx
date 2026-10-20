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
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-1 rounded-lg border border-border bg-surface p-1">
          {POST_STATUS_TABS.map((tab) => (
            <button
              key={tab.label}
              type="button"
              onClick={() => onStatusChange(tab.value)}
              className={cn(
                'rounded-md px-3 py-1.5 text-sm font-medium transition',
                status === tab.value
                  ? 'bg-accent/10 text-accent-text'
                  : 'text-muted hover:bg-surface-2 hover:text-foreground'
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <Button type="button" onClick={onCreate}>
          <Plus className="h-4 w-4" />
          Tạo bài viết
        </Button>
      </div>

      <form onSubmit={submitSearch} className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-subtle" />
          <input
            value={term}
            onChange={(event) => setTerm(event.target.value)}
            placeholder="Tìm theo tiêu đề..."
            aria-label="Tìm bài viết theo tiêu đề"
            className="w-full rounded-lg border border-border bg-surface py-2.5 pl-9 pr-3.5 text-sm text-foreground outline-none transition placeholder:text-subtle focus:border-accent"
          />
        </div>
        <Button type="submit" variant="outline">
          Tìm
        </Button>
      </form>
    </div>
  );
};

export default PostToolbar;
