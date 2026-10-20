import { useMemo, useState } from 'react';
import { Search } from 'lucide-react';
import { EMOJI_GROUPS } from '@/utils/emoji';
import { cn } from '@/utils/cn';

const normalize = (value: string): string =>
  value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');

export const EmojiPicker = ({
  onSelect,
  className,
}: {
  onSelect: (emoji: string) => void;
  className?: string;
}) => {
  const [query, setQuery] = useState('');
  const [groupIndex, setGroupIndex] = useState(0);

  const keyword = normalize(query.trim());
  const visibleGroups = useMemo(() => {
    if (!keyword) return [EMOJI_GROUPS[groupIndex]];
    return EMOJI_GROUPS.filter(
      (group) =>
        normalize(group.name).includes(keyword) ||
        group.keywords.some((word) => normalize(word).includes(keyword))
    );
  }, [keyword, groupIndex]);

  return (
    <div
      className={cn(
        'flex w-80 flex-col overflow-hidden rounded-xl border border-border bg-surface shadow-xl',
        className
      )}
    >
      <div className="border-b border-border p-2">
        <div className="relative">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-subtle" />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Tìm kiếm biểu tượng cảm xúc"
            aria-label="Tìm kiếm biểu tượng cảm xúc"
            className="w-full rounded-lg border border-border bg-surface py-2 pl-8 pr-2 text-sm text-foreground outline-none transition placeholder:text-subtle focus:border-accent"
          />
        </div>
      </div>

      <div className="max-h-56 space-y-2 overflow-y-auto p-2">
        {visibleGroups.length === 0 ? (
          <p className="p-3 text-center text-xs text-subtle">Không tìm thấy biểu tượng phù hợp.</p>
        ) : (
          visibleGroups.map((group) => (
            <div key={group.name} className="space-y-1">
              <p className="text-xs font-medium text-muted">{group.name}</p>
              <div className="grid grid-cols-8 gap-0.5">
                {group.emojis.map((emoji) => (
                  <button
                    key={`${group.name}-${emoji}`}
                    type="button"
                    aria-label={`Chèn ${emoji}`}
                    onClick={() => onSelect(emoji)}
                    className="grid h-8 w-8 place-items-center rounded-md text-lg transition hover:bg-surface-2"
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            </div>
          ))
        )}
      </div>

      <div className="flex items-center gap-0.5 overflow-x-auto border-t border-border p-1.5">
        {EMOJI_GROUPS.map((group, index) => {
          const active = !keyword && groupIndex === index;
          return (
            <button
              key={group.name}
              type="button"
              aria-label={group.name}
              title={group.name}
              aria-pressed={active}
              onClick={() => {
                setQuery('');
                setGroupIndex(index);
              }}
              className={cn(
                'grid h-8 w-8 shrink-0 place-items-center rounded-md text-lg transition hover:bg-surface-2',
                active && 'bg-accent/10'
              )}
            >
              {group.emojis[0]}
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default EmojiPicker;
