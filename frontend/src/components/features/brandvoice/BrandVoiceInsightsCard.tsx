import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import Alert from '@/components/ui/Alert';
import Badge, { type BadgeVariant } from '@/components/ui/Badge';
import Button from '@/components/ui/Button';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import EmptyState from '@/components/ui/EmptyState';
import SelectField from '@/components/ui/SelectField';
import { SkeletonBlock } from '@/components/ui/Skeleton';
import { useBrandVoiceInsights, useUpdateBrandVoice } from '@/hooks/useBrandVoice';
import { useChannels } from '@/hooks/useChannels';
import type {
  BrandVoice,
  BrandVoiceInsightSeverity,
  BrandVoiceInsights,
} from '@/services/brandvoice';
import { getErrorMessage } from '@/utils/error';
import { formatDate, formatNumber } from '@/utils/format';

const SEVERITY_META: Record<
  BrandVoiceInsightSeverity,
  { label: string; variant: BadgeVariant }
> = {
  high: { label: 'Nên ưu tiên', variant: 'danger' },
  medium: { label: 'Nên thử', variant: 'warning' },
  low: { label: 'Tham khảo', variant: 'neutral' },
};

const mergeKeywords = (current: string[], suggested: string[]): string[] => {
  const seen = new Set(current.map((keyword) => keyword.toLowerCase()));
  return [...current, ...suggested.filter((keyword) => !seen.has(keyword.toLowerCase()))].slice(
    0,
    30
  );
};

const buildNextBrandVoice = (
  current: BrandVoice | null,
  insights: BrandVoiceInsights
): BrandVoice | null => {
  if (!current) return null;

  const suggested = insights.suggestedBrandVoice;

  return {
    industry: current.industry,
    targetAudience: current.targetAudience,
    writingStyle: suggested.writingStyle || current.writingStyle,
    keywordsShouldUse: mergeKeywords(
      current.keywordsShouldUse,
      suggested.keywordsShouldUse
    ),
    keywordsAvoid: mergeKeywords(current.keywordsAvoid, suggested.keywordsAvoid),
    fewShotExamples:
      suggested.fewShotExamples.length > 0
        ? suggested.fewShotExamples
        : current.fewShotExamples,
  };
};

const InsightsBody = ({
  insights,
  canApply,
  onApply,
}: {
  insights: BrandVoiceInsights;
  canApply: boolean;
  onApply: () => void;
}) => {
  const { suggestedBrandVoice } = insights;
  const hasSuggestions =
    Boolean(suggestedBrandVoice.writingStyle) ||
    suggestedBrandVoice.keywordsShouldUse.length > 0 ||
    suggestedBrandVoice.keywordsAvoid.length > 0;

  return (
    <>
      {insights.meta.usedFallback ? (
        <Alert variant="info" className="mt-4">
          Cần ít nhất {insights.meta.minPostsForInsights} bài đã đồng bộ số liệu trong{' '}
          {insights.meta.windowDays} ngày để rút ra bài học. Hiện có{' '}
          {formatNumber(insights.meta.sampleSize)} bài.
        </Alert>
      ) : (
        <p className="mt-3 text-[11px] text-muted">
          Dựa trên {formatNumber(insights.meta.sampleSize)} bài trong{' '}
          {insights.meta.windowDays} ngày.
        </p>
      )}

      {insights.topPosts.length === 0 ? (
        <EmptyState
          title="Chưa có bài viết nào đủ dữ liệu."
          description="Đồng bộ số liệu cho các bài đã đăng để hệ thống xếp hạng và rút ra bài học."
          action={
            <Link
              to="/"
              className="inline-flex min-h-11 items-center text-[13px] font-medium text-accent-text hover:underline"
            >
              Tới Dashboard để đồng bộ số liệu
            </Link>
          }
          className="mt-4"
        />
      ) : (
        <div className="mt-5">
          <h3 className="text-[13px] font-semibold text-foreground">Top bài hiệu quả</h3>
          <ol className="mt-2 divide-y divide-border">
            {insights.topPosts.map((post) => (
              <li key={post.id} className="py-4 first:pt-0 last:pb-0">
                <div className="flex items-start gap-3">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-surface-2 text-[11px] font-semibold text-muted">
                    {post.rank}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-[13px] font-medium text-foreground">{post.title}</p>
                      {post.rank <= 3 ? <Badge variant="accent">Bài mẫu</Badge> : null}
                    </div>
                    <p className="mt-1 text-[11px] text-muted">
                      {formatNumber(post.totalInteractions)} tương tác ·{' '}
                      {formatNumber(post.metrics.reactions)} thích ·{' '}
                      {formatNumber(post.metrics.comments)} bình luận ·{' '}
                      {formatNumber(post.metrics.shares)} chia sẻ
                    </p>
                    <p className="mt-0.5 text-[11px] text-muted">
                      {post.channelName} · {formatDate(post.publishedAt)}
                    </p>
                    {post.signals.length > 0 ? (
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {post.signals.map((signal) => (
                          <Badge key={signal} variant="neutral">
                            {signal}
                          </Badge>
                        ))}
                      </div>
                    ) : null}
                  </div>
                </div>
              </li>
            ))}
          </ol>
        </div>
      )}

      {insights.insights.length > 0 ? (
        <div className="mt-5">
          <h3 className="text-[13px] font-semibold text-foreground">Nên học gì từ các bài này</h3>
          <ul className="mt-2 space-y-2">
            {insights.insights.map((insight) => {
              const meta = SEVERITY_META[insight.severity];

              return (
                <li key={insight.id} className="rounded-lg bg-surface-2 p-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant={meta.variant}>{meta.label}</Badge>
                    <p className="text-[13px] font-medium text-foreground">{insight.label}</p>
                  </div>
                  <p className="mt-1 text-[13px] text-muted">{insight.explanation}</p>
                  <p className="mt-2 text-[13px] text-foreground">{insight.action}</p>
                </li>
              );
            })}
          </ul>
        </div>
      ) : insights.meta.usedFallback ? null : (
        <p className="mt-4 text-[13px] text-muted">
          Chưa thấy khác biệt đủ rõ giữa nhóm bài top và nhóm bài kém. Các bài trên vẫn là
          mẫu tham khảo tốt để giữ giọng điệu.
        </p>
      )}

      {hasSuggestions ? (
        <div className="mt-5 rounded-lg bg-surface-2 p-4">
          <p className="text-[13px] font-medium text-foreground">Gợi ý cập nhật Brand Voice</p>

          {suggestedBrandVoice.writingStyle ? (
            <p className="mt-2 text-[13px] text-muted">
              <span className="font-medium text-foreground">Phong cách viết: </span>
              {suggestedBrandVoice.writingStyle}
            </p>
          ) : null}

          {suggestedBrandVoice.keywordsShouldUse.length > 0 ? (
            <div className="mt-3">
              <p className="text-[11px] font-medium text-muted">Hashtag nên dùng</p>
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {suggestedBrandVoice.keywordsShouldUse.map((keyword) => (
                  <Badge key={keyword} variant="success">
                    {keyword}
                  </Badge>
                ))}
              </div>
            </div>
          ) : null}

          {suggestedBrandVoice.keywordsAvoid.length > 0 ? (
            <div className="mt-3">
              <p className="text-[11px] font-medium text-muted">Hashtag nên tránh</p>
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {suggestedBrandVoice.keywordsAvoid.map((keyword) => (
                  <Badge key={keyword} variant="danger">
                    {keyword}
                  </Badge>
                ))}
              </div>
            </div>
          ) : null}

          <p className="mt-3 text-[13px] text-muted">
            {suggestedBrandVoice.fewShotExamples.length} bài top sẽ được đưa vào bài viết mẫu.
            Hashtag gợi ý được thêm vào danh sách từ khoá hiện có.
          </p>
        </div>
      ) : null}

      <div className="mt-5 border-t border-border pt-5">
        <Button type="button" onClick={onApply} disabled={!canApply}>
          Áp dụng gợi ý
        </Button>
        <p className="mt-2 text-[11px] text-muted">
          Thay phong cách viết và bài mẫu; thêm hashtag gợi ý vào từ khoá hiện có.
        </p>
      </div>
    </>
  );
};

export const BrandVoiceInsightsCard = ({
  workspaceId,
  brandVoice,
  canEdit,
}: {
  workspaceId: string;
  brandVoice: BrandVoice | null;
  canEdit: boolean;
}) => {
  const [channelId, setChannelId] = useState('');
  const [confirmOpen, setConfirmOpen] = useState(false);
  const insightsQuery = useBrandVoiceInsights(workspaceId, {
    limit: 5,
    windowDays: 90,
    ...(channelId ? { channelId } : {}),
  });
  const channelsQuery = useChannels(workspaceId);
  const updateBrandVoice = useUpdateBrandVoice();

  const nextBrandVoice = useMemo(
    () => (insightsQuery.data ? buildNextBrandVoice(brandVoice, insightsQuery.data) : null),
    [brandVoice, insightsQuery.data]
  );
  const canApply = Boolean(
    canEdit &&
      nextBrandVoice &&
      insightsQuery.data &&
      (insightsQuery.data.insights.length > 0 ||
        insightsQuery.data.suggestedBrandVoice.fewShotExamples.length > 0)
  );

  const applySuggestions = () => {
    if (!nextBrandVoice) return;

    updateBrandVoice.mutate(
      { workspaceId, payload: nextBrandVoice },
      { onSuccess: () => setConfirmOpen(false) }
    );
  };

  return (
    <section className="rounded-xl border border-border bg-surface p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-[13px] font-semibold text-foreground">
            Tối ưu từ bài viết hiệu quả
          </h2>
          <p className="mt-1 text-[13px] text-muted">
            Hệ thống tự xếp hạng bài theo tổng tương tác và rút ra bài học cho Brand Voice.
          </p>
        </div>

        {channelsQuery.data && channelsQuery.data.channels.length > 0 ? (
          <SelectField
            id="brand-voice-insights-channel"
            name="channelId"
            label="Kênh phân tích"
            className="min-h-11 w-full sm:w-56"
            value={channelId}
            onChange={(event) => setChannelId(event.target.value)}
          >
            <option value="">Tất cả kênh</option>
            {channelsQuery.data.channels.map((channel) => (
              <option key={channel.id} value={channel.id}>
                {channel.label ?? channel.name}
              </option>
            ))}
          </SelectField>
        ) : null}
      </div>

      {insightsQuery.isLoading ? <SkeletonBlock className="mt-5" /> : null}

      {insightsQuery.isError ? (
        <Alert variant="danger" className="mt-4">
          {getErrorMessage(insightsQuery.error)}
        </Alert>
      ) : null}

      {insightsQuery.data ? (
        <InsightsBody
          insights={insightsQuery.data}
          canApply={canApply}
          onApply={() => setConfirmOpen(true)}
        />
      ) : null}

      {!canEdit ? (
        <p className="mt-4 text-[11px] text-muted">
          Chỉ Workspace Owner được áp dụng gợi ý vào Brand Voice.
        </p>
      ) : null}

      {canEdit && !brandVoice ? (
        <p className="mt-4 text-[11px] text-muted">
          Điền Ngành hàng và Đối tượng mục tiêu ở form bên dưới trước khi áp dụng gợi ý.
        </p>
      ) : null}

      <ConfirmDialog
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        title="Áp dụng gợi ý vào Brand Voice?"
        description="Phong cách viết và bài mẫu hiện tại sẽ được thay bằng gợi ý từ các bài viết hiệu quả; hashtag gợi ý được thêm vào từ khoá hiện có. Bạn có thể chỉnh lại sau khi áp dụng."
        confirmLabel="Áp dụng"
        isLoading={updateBrandVoice.isPending}
        onConfirm={applySuggestions}
      />
    </section>
  );
};

export default BrandVoiceInsightsCard;
