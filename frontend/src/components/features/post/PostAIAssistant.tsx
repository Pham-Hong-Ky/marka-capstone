import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { ChevronDown, Sparkles } from 'lucide-react';
import type { JSONContent } from '@tiptap/react';
import Button from '@/components/ui/Button';
import TextArea from '@/components/ui/TextArea';
import TextField from '@/components/ui/TextField';
import SelectableAccountList from '@/components/shared/SelectableAccountList';
import { ChannelPlatformBadge } from '@/components/features/channel/ChannelPlatformBadge';
import { useStartAiPost } from '@/hooks/useAi';
import { useAiBatchWatcher, type AiBatchSummary } from '@/hooks/useAiBatchWatcher';
import { useChannels } from '@/hooks/useChannels';
import { getChannelPlatformMeta } from '@/services/channel';
import { isContentEmpty } from '@/services/post';
import {
  AI_IMAGE_COST,
  AI_MAX_IMAGES,
  AI_TEXT_COST,
  type AiTextResult,
  type StartPostPayload,
} from '@/services/ai';
import { queryKeys } from '@/lib/queryKeys';
import { cn } from '@/utils/cn';
import { getErrorMessage } from '@/utils/error';
import { clearDraft, draftKey } from '@/utils/postDraft';

interface PostAIAssistantProps {
  workspaceId: string;
  postId: string | null;
  title: string;
  content: JSONContent;
  disabled?: boolean;
  pendingImageCount?: number;
  initialGenerationIds?: string[];
  onBusyChange: (busy: boolean) => void;
  onApplyText: (result: AiTextResult) => void;
}

const IMAGE_COUNT_OPTIONS = Array.from({ length: AI_MAX_IMAGES }, (_, index) => index + 1);

const getSubmitLabel = (withText: boolean, withImages: boolean): string => {
  if (withText && withImages) return 'Tạo nội dung và ảnh';
  return withImages ? 'Tạo ảnh' : 'Tạo nội dung';
};

const getSuccessMessage = ({ textApplied, imageCount }: AiBatchSummary): string => {
  if (textApplied && imageCount > 0) return `Đã tạo nội dung và ${imageCount} ảnh bằng AI`;
  return textApplied ? 'Đã tạo nội dung bằng AI' : `Đã tạo ${imageCount} ảnh bằng AI`;
};

export const PostAIAssistant = ({
  workspaceId,
  postId,
  title,
  content,
  disabled = false,
  pendingImageCount = 0,
  initialGenerationIds = [],
  onBusyChange,
  onApplyText,
}: PostAIAssistantProps) => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const startPost = useStartAiPost();

  const [open, setOpen] = useState(initialGenerationIds.length > 0);
  const [withText, setWithText] = useState(true);
  const [withImages, setWithImages] = useState(false);
  const [imageCount, setImageCount] = useState(1);
  const [topic, setTopic] = useState('');
  const [instructions, setInstructions] = useState('');
  const [pickedChannelIds, setPickedChannelIds] = useState<string[] | null>(null);
  const [generationIds, setGenerationIds] = useState<string[]>(initialGenerationIds);
  const channelsQuery = useChannels(open ? workspaceId : null);

  const invalidatePosts = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: queryKeys.post.detailWorkspace(workspaceId) });
    void queryClient.invalidateQueries({ queryKey: queryKeys.post.workspace(workspaceId) });
  }, [queryClient, workspaceId]);

  const { error, setError, isBusy } = useAiBatchWatcher({
    workspaceId,
    generationIds,
    setGenerationIds,
    onText: onApplyText,
    onImage: invalidatePosts,
    onSettled: (summary) => {
      if (summary.failures.length === 0) {
        toast.success(getSuccessMessage(summary));
        setOpen(false);
        return;
      }

      if (summary.textApplied || summary.imageCount > 0) {
        toast.success(getSuccessMessage(summary));
      }
      setError([...new Set(summary.failures)].join(' '));
    },
  });

  const isWorking = isBusy || startPost.isPending;

  useEffect(() => {
    onBusyChange(isWorking);
  }, [isWorking, onBusyChange]);

  const channels = useMemo(
    () =>
      (channelsQuery.data?.channels ?? []).filter(
        (channel) =>
          getChannelPlatformMeta(channel.platform).capabilities.scheduling &&
          channel.status === 'ACTIVE'
      ),
    [channelsQuery.data]
  );

  // Chưa chọn lần nào thì mặc định chọn tất cả kênh đang hoạt động.
  const selectedIds = pickedChannelIds ?? channels.map((channel) => channel.id);

  const toggleChannel = (channelId: string) => {
    setPickedChannelIds(
      selectedIds.includes(channelId)
        ? selectedIds.filter((id) => id !== channelId)
        : [...selectedIds, channelId]
    );
  };

  const hasThreads = channels.some(
    (channel) => channel.platform === 'THREADS' && selectedIds.includes(channel.id)
  );
  const missingChannel = withText && channels.length > 0 && selectedIds.length === 0;
  const creditCost = (withText ? AI_TEXT_COST : 0) + (withImages ? AI_IMAGE_COST * imageCount : 0);
  const nothingSelected = !withText && !withImages;

  const validate = (): string | null => {
    if (withText && topic.trim().length < 5) return 'Chủ đề tối thiểu 5 ký tự.';
    if (missingChannel) return 'Chọn ít nhất một kênh để AI viết nội dung phù hợp.';
    if (withImages && !postId && pendingImageCount > 0) {
      return 'Vui lòng lưu bài để tải các ảnh đang chờ trước khi tạo ảnh AI.';
    }
    if (!withText && !postId && !title.trim()) {
      return 'Cần nhập tiêu đề trước khi tạo ảnh cho bài mới.';
    }
    if (!withText && !postId && isContentEmpty(content)) {
      return 'Cần có nội dung trước khi tạo ảnh cho bài mới.';
    }
    return null;
  };

  const buildPayload = (): StartPostPayload => ({
    withText,
    imageCount: withImages ? imageCount : 0,
    instructions: instructions.trim() || undefined,
    postId: postId ?? undefined,
    ...(withText
      ? {
          topic: topic.trim(),
          channelIds: channels.length > 0 ? selectedIds : undefined,
        }
      : postId
        ? {}
        : { title: title.trim(), content }),
  });

  const handleSubmit = async () => {
    const validationError = validate();
    if (validationError) {
      setError(validationError);
      return;
    }

    setError(null);

    try {
      const result = await startPost.mutateAsync({ workspaceId, payload: buildPayload() });
      const ids = result.generations.map((item) => item.generationId);

      if (result.createdDraft && result.postId) {
        await clearDraft(draftKey(workspaceId, null));
        navigate(`/posts/${result.postId}/edit`, {
          replace: true,
          state: { pendingAiGenerationIds: ids },
        });
        return;
      }

      setGenerationIds(ids);
    } catch (mutationError) {
      setError(getErrorMessage(mutationError));
    }
  };

  const inputsDisabled = disabled || isWorking;

  return (
    <section className="rounded-xl border border-border bg-surface">
      <button
        type="button"
        aria-expanded={open}
        aria-controls="post-ai-assistant-panel"
        disabled={isWorking}
        onClick={() => setOpen((current) => !current)}
        className="flex min-h-11 w-full items-center gap-3 rounded-xl px-4 py-2.5 text-left transition hover:bg-surface-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:cursor-not-allowed"
      >
        <Sparkles className="h-4 w-4 shrink-0 text-accent-text" aria-hidden="true" />
        <span className="whitespace-nowrap text-sm font-medium text-foreground">Viết bằng AI</span>
        <ChevronDown
          className={cn('ml-auto h-4 w-4 shrink-0 text-muted transition', open && 'rotate-180')}
          aria-hidden="true"
        />
      </button>

      {open ? (
        <div id="post-ai-assistant-panel" className="space-y-3 border-t border-border p-4">
          <fieldset disabled={inputsDisabled} className="space-y-2">
            <legend className="text-sm font-medium text-foreground">AI sẽ tạo</legend>
            <label className="flex min-h-11 cursor-pointer items-center gap-3 rounded-lg border border-border px-3 text-sm text-foreground transition hover:bg-surface-2">
              <input
                type="checkbox"
                className="h-4 w-4 accent-accent"
                checked={withText}
                onChange={(event) => setWithText(event.target.checked)}
              />
              Nội dung bài viết
            </label>
            <div className="flex flex-wrap items-center gap-3 rounded-lg border border-border px-3 py-1">
              <label className="flex min-h-11 flex-1 cursor-pointer items-center gap-3 text-sm text-foreground">
                <input
                  type="checkbox"
                  className="h-4 w-4 accent-accent"
                  checked={withImages}
                  onChange={(event) => setWithImages(event.target.checked)}
                />
                Ảnh minh hoạ
              </label>
              {withImages ? (
                <select
                  aria-label="Số lượng ảnh"
                  className="min-h-11 rounded-lg border border-border bg-surface px-3 text-sm text-foreground focus-visible:outline-2 focus-visible:outline-accent"
                  value={imageCount}
                  onChange={(event) => setImageCount(Number(event.target.value))}
                >
                  {IMAGE_COUNT_OPTIONS.map((count) => (
                    <option key={count} value={count}>
                      {count} ảnh
                    </option>
                  ))}
                </select>
              ) : null}
            </div>
          </fieldset>

          {withText ? (
            <TextArea
              label="Chủ đề bài viết"
              name="ai-topic"
              rows={3}
              maxLength={1000}
              placeholder="Ví dụ: Ra mắt bộ sưu tập áo thu đông cho nữ văn phòng"
              value={topic}
              disabled={inputsDisabled}
              onChange={(event) => setTopic(event.target.value)}
            />
          ) : null}
          <TextField
            label={withText ? 'Yêu cầu thêm (tuỳ chọn)' : 'Ghi chú cho ảnh (tuỳ chọn)'}
            name="ai-instructions"
            maxLength={500}
            placeholder={
              withText
                ? 'Ví dụ: nhấn mạnh chất liệu, giọng hài hước'
                : 'Ví dụ: tối giản, ánh sáng tự nhiên'
            }
            value={instructions}
            disabled={inputsDisabled}
            onChange={(event) => setInstructions(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') event.preventDefault();
            }}
          />

          {withText ? (
            <div>
              <p className="text-sm font-medium text-foreground">Kênh đăng bài</p>
              <p className="mt-0.5 text-xs text-muted">
                AI viết một bài đăng được trên tất cả kênh đã chọn.
              </p>
              {channelsQuery.isLoading ? (
                <p role="status" className="mt-2 text-xs text-muted">
                  Đang tải danh sách kênh...
                </p>
              ) : channelsQuery.isError ? (
                <p role="alert" className="mt-2 text-sm text-danger">
                  Không tải được danh sách kênh. Vui lòng thử lại.
                </p>
              ) : channels.length === 0 ? (
                <p className="mt-2 rounded-lg border border-border bg-surface-2 p-3 text-xs text-muted">
                  Chưa kết nối kênh nào.{' '}
                  <Link
                    to="/channels"
                    className="font-medium text-accent-text underline-offset-2 hover:underline"
                  >
                    Kết nối kênh
                  </Link>{' '}
                  để nội dung được tối ưu theo kênh.
                </p>
              ) : (
                <>
                  <SelectableAccountList
                    className="mt-2 space-y-2"
                    accounts={channels.map((channel) => ({
                      id: channel.id,
                      name: channel.label ?? channel.name,
                      avatar: channel.avatar,
                      meta: <ChannelPlatformBadge platform={channel.platform} />,
                    }))}
                    selectedIds={selectedIds}
                    onToggle={toggleChannel}
                  />
                  {missingChannel ? (
                    <p role="alert" className="mt-2 text-sm text-danger">
                      Chọn ít nhất một kênh.
                    </p>
                  ) : hasThreads ? (
                    <p className="mt-2 text-xs text-subtle">
                      Threads giới hạn 500 ký tự nên nội dung sẽ được viết ngắn gọn.
                    </p>
                  ) : null}
                </>
              )}
            </div>
          ) : null}

          <div className="flex items-center justify-between gap-3">
            <p className="text-xs text-subtle">
              {withText ? 'Thay tiêu đề và nội dung hiện tại. ' : ''}
              {withImages && !postId ? 'Bài mới sẽ được lưu nháp trước. ' : ''}
              {creditCost > 0 ? `Tổng ${creditCost} credit.` : 'Chọn nội dung hoặc ảnh.'}
            </p>
            <Button
              type="button"
              onClick={handleSubmit}
              isLoading={isWorking}
              disabled={
                inputsDisabled ||
                nothingSelected ||
                missingChannel ||
                (withText && channelsQuery.isLoading) ||
                (withText && topic.trim().length < 5)
              }
            >
              {getSubmitLabel(withText, withImages)}
            </Button>
          </div>
          {isWorking ? (
            <p role="status" className="text-xs text-muted">
              Đang tạo{withImages ? ' nội dung và ảnh' : ''}... Có thể mất vài chục giây.
            </p>
          ) : null}
          {error ? (
            <p role="alert" className="text-sm text-danger">
              {error}
            </p>
          ) : null}
        </div>
      ) : null}
    </section>
  );
};

export default PostAIAssistant;
