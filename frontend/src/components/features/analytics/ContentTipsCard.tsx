import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import Badge, { type BadgeVariant } from '@/components/ui/Badge';
import EmptyState from '@/components/ui/EmptyState';
import type { AnalyticsSuggestions, TipSeverity } from '@/services/analytics';

const SEVERITY_ORDER: TipSeverity[] = ['high', 'medium', 'low'];

const SEVERITY_META: Record<TipSeverity, { label: string; variant: BadgeVariant }> = {
  high: { label: 'Cao', variant: 'danger' },
  medium: { label: 'Trung bình', variant: 'warning' },
  low: { label: 'Thấp', variant: 'neutral' },
};

export const ContentTipsCard = ({ suggestions }: { suggestions: AnalyticsSuggestions }) => {
  const tips = useMemo(
    () =>
      [...suggestions.contentTips].sort(
        (a, b) => SEVERITY_ORDER.indexOf(a.severity) - SEVERITY_ORDER.indexOf(b.severity)
      ),
    [suggestions.contentTips]
  );

  return (
    <section className="rounded-2xl border border-border bg-surface p-5">
      <h2 className="text-base font-semibold text-foreground">Gợi ý nội dung</h2>

      {tips.length === 0 ? (
        <EmptyState title="Chưa có gợi ý cho các bài nháp." className="mt-4 px-4 py-8" />
      ) : (
        <ul className="mt-4 divide-y divide-border">
          {tips.map((tip) => {
            const meta = SEVERITY_META[tip.severity];

            return (
              <li key={`${tip.postId}-${tip.rule}`} className="py-3 first:pt-0 last:pb-0">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant={meta.variant}>{meta.label}</Badge>
                  <p className="text-sm font-medium text-foreground">{tip.postTitle}</p>
                </div>
                <p className="mt-1 text-sm text-muted">{tip.message}</p>
                <Link
                  to={`/posts/${tip.postId}/edit`}
                  className="inline-flex min-h-11 items-center text-sm font-medium text-accent-text hover:underline"
                >
                  Sửa bài
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
};

export default ContentTipsCard;
