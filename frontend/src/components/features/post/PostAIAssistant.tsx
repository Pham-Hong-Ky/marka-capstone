import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { ChevronDown, Sparkles } from 'lucide-react';
import type { JSONContent } from '@tiptap/react';
import Button from '@/components/ui/Button';
import TextArea from '@/components/ui/TextArea';
import TextField from '@/components/ui/TextField';
import AiChannelPicker from './AiChannelPicker';
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

const MODES = [
  { label: 'Chỉ nội dung', withText: true, withImages: false },
  { label: 'Nội dung + ảnh', withText: true, withImages: true },
  { label: 'Chỉ ảnh', withText: false, withImages: true },
] as const;

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

  const [open, setOpen] = useState(true);
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

  const missingChannel = withText && channels.length > 0 && selectedIds.length === 0;
  const creditCost = (withText ? AI_TEXT_COST : 0) + (withImages ? AI_IMAGE_COST * imageCount : 0);

  const isNewPost = !postId;
  const validate = (): string | null => {
    const rules: Array<[failed: boolean, message: string]> = [
      [withText && topic.trim().length < 5, 'Chủ đề tối thiểu 5 ký tự.'],
      [missingChannel, 'Chọn ít nhất một kênh để AI viết nội dung phù hợp.'],
      [
        withImages && isNewPost && pendingImageCount > 0,
        'Vui lòng lưu bài để tải các ảnh đang chờ trước khi tạo ảnh AI.',
      ],
      [
        !withText && isNewPost && !title.trim(),
        'Cần nhập tiêu đề trước khi tạo ảnh cho bài mới.',
      ],
      [
        !withText && isNewPost && isContentEmpty(content),
        'Cần có nội dung trước khi tạo ảnh cho bài mới.',
      ],
    ];

    return rules.find(([failed]) => failed)?.[1] ?? null;
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
        className="flex min-h-14 w-full items-center gap-3 rounded-xl px-4 py-3 text-left transition hover:bg-surface-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:cursor-not-allowed"
      >
        <Sparkles className="h-5 w-5 shrink-0 text-accent-text" aria-hidden="true" />
        <span className="min-w-0">
          <span className="block text-sm font-semibold text-foreground">Viết bằng AI</span>
          <span className="block truncate text-xs text-muted">
            Nhập chủ đề, AI viết bài và tạo ảnh minh hoạ
          </span>
        </span>
        <ChevronDown
          className={cn('ml-auto h-4 w-4 shrink-0 text-muted transition', open && 'rotate-180')}
          aria-hidden="true"
        />
      </button>

      {open ? (
        <div id="post-ai-assistant-panel" className="space-y-4 border-t border-border p-4">
          {withText ? (
            <TextArea
              label="Chủ đề bài viết"
              name="ai-topic"
              rows={4}
              maxLength={1000}
              placeholder="Ví dụ: Ra mắt bộ sưu tập áo thu đông cho nữ văn phòng"
              value={topic}
              disabled={inputsDisabled}
              onChange={(event) => setTopic(event.target.value)}
            />
          ) : null}

          <fieldset disabled={inputsDisabled} className="space-y-2">
            <legend className="text-sm font-medium text-foreground">AI sẽ tạo</legend>
            <div
              role="radiogroup"
              aria-label="AI sẽ tạo"
              className="grid grid-cols-3 gap-1 rounded-lg bg-surface-2 p-1"
            >
              {MODES.map((item) => {
                const selected = item.withText === withText && item.withImages === withImages;

                return (
                  <button
                    key={item.label}
                    type="button"
                    role="radio"
                    aria-checked={selected}
                    onClick={() => {
                      setWithText(item.withText);
                      setWithImages(item.withImages);
                    }}
                    className={cn(
                      'min-h-11 rounded-md px-2 text-xs font-medium transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:cursor-not-allowed',
                      selected
                        ? 'bg-surface text-foreground shadow-sm'
                        : 'text-muted hover:text-foreground'
                    )}
                  >
                    {item.label}
                  </button>
                );
              })}
            </div>

            {withImages ? (
              <div
                role="radiogroup"
                aria-label="Số lượng ảnh"
                className="flex flex-wrap items-center gap-2 pt-1"
              >
                <span className="text-sm text-muted">Số ảnh</span>
                {IMAGE_COUNT_OPTIONS.map((count) => (
                  <button
                    key={count}
                    type="button"
                    role="radio"
                    aria-checked={imageCount === count}
                    onClick={() => setImageCount(count)}
                    className={cn(
                      'min-h-11 min-w-11 rounded-lg border px-3 text-sm font-medium transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent',
                      imageCount === count
                        ? 'border-accent bg-accent text-white'
                        : 'border-border text-foreground hover:bg-surface-2'
                    )}
                  >
                    {count}
                  </button>
                ))}
              </div>
            ) : null}
          </fieldset>

          {withText ? (
            <AiChannelPicker
              channels={channels}
              selectedIds={selectedIds}
              isLoading={channelsQuery.isLoading}
              isError={channelsQuery.isError}
              disabled={inputsDisabled}
              onToggle={toggleChannel}
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

          <div className="sticky bottom-0 flex flex-wrap items-center justify-between gap-3 rounded-lg bg-surface-2 p-3">
            <div className="min-w-0">
              <p className="text-sm font-medium text-foreground">Tổng {creditCost} credit</p>
              <p className="text-xs text-muted">
                {withText ? 'Thay tiêu đề và nội dung hiện tại. ' : ''}
                {withImages && !postId ? 'Bài mới sẽ được lưu nháp trước.' : ''}
              </p>
            </div>
            <Button
              type="button"
              onClick={handleSubmit}
              isLoading={isWorking}
              disabled={
                inputsDisabled ||
                missingChannel ||
                (withText && channelsQuery.isLoading) ||
                (withText && topic.trim().length < 5)
              }
            >
              {getSubmitLabel(withText, withImages)}
            </Button>
          </div>
        </div>
      ) : null}
    </section>
  );
};

export default PostAIAssistant;
