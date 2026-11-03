import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { ChevronDown, Sparkles } from 'lucide-react';
import Button from '@/components/ui/Button';
import TextArea from '@/components/ui/TextArea';
import TextField from '@/components/ui/TextField';
import SelectableAccountList from '@/components/shared/SelectableAccountList';
import { ChannelPlatformBadge } from '@/components/features/channel/ChannelPlatformBadge';
import { useStartAiText } from '@/hooks/useAi';
import { useAiGenerationWatcher } from '@/hooks/useAiGenerationWatcher';
import { useChannels } from '@/hooks/useChannels';
import { getChannelPlatformMeta } from '@/services/channel';
import type { AiTextResult } from '@/services/ai';
import { cn } from '@/utils/cn';
import { getErrorMessage } from '@/utils/error';

interface PostAIAssistantProps {
  workspaceId: string;
  postId: string | null;
  disabled?: boolean;
  onBusyChange: (busy: boolean) => void;
  onApplyText: (result: AiTextResult) => void;
}

const isTextResult = (result: unknown): result is AiTextResult =>
  Boolean(
    result &&
      typeof result === 'object' &&
      'title' in result &&
      typeof (result as AiTextResult).title === 'string' &&
      'content' in result
  );

export const PostAIAssistant = ({
  workspaceId,
  postId,
  disabled = false,
  onBusyChange,
  onApplyText,
}: PostAIAssistantProps) => {
  const startText = useStartAiText();

  const [open, setOpen] = useState(false);
  const [topic, setTopic] = useState('');
  const [instructions, setInstructions] = useState('');
  const [pickedChannelIds, setPickedChannelIds] = useState<string[] | null>(null);
  const [textGenerationId, setTextGenerationId] = useState<string | null>(null);
  const channelsQuery = useChannels(open ? workspaceId : null);

  const { error, setError, isBusy } = useAiGenerationWatcher({
    workspaceId,
    generationId: textGenerationId,
    setGenerationId: setTextGenerationId,
    isResult: isTextResult,
    resultLabel: 'nội dung bài viết',
    onSuccess: (result) => {
      onApplyText(result);
      toast.success('Đã tạo nội dung bằng AI');
      setOpen(false);
    },
  });

  const isTextBusy = isBusy || startText.isPending;

  useEffect(() => {
    onBusyChange(isTextBusy);
  }, [isTextBusy, onBusyChange]);

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
  const missingChannel = channels.length > 0 && selectedIds.length === 0;

  const handleText = async () => {
    if (topic.trim().length < 5) {
      setError('Chủ đề tối thiểu 5 ký tự.');
      return;
    }

    if (missingChannel) {
      setError('Chọn ít nhất một kênh để AI viết nội dung phù hợp.');
      return;
    }

    setError(null);

    try {
      const result = await startText.mutateAsync({
        workspaceId,
        payload: {
          topic: topic.trim(),
          instructions: instructions.trim() || undefined,
          postId: postId ?? undefined,
          channelIds: channels.length > 0 ? selectedIds : undefined,
        },
      });
      setTextGenerationId(result.generationId);
    } catch (mutationError) {
      setError(getErrorMessage(mutationError));
    }
  };

  const inputsDisabled = disabled || isTextBusy;

  return (
    <section className="rounded-xl border border-border bg-surface">
      <button
        type="button"
        aria-expanded={open}
        aria-controls="post-ai-assistant-panel"
        disabled={isTextBusy}
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
          <TextField
            label="Yêu cầu thêm (tuỳ chọn)"
            name="ai-instructions"
            maxLength={500}
            placeholder="Ví dụ: nhấn mạnh chất liệu, giọng hài hước"
            value={instructions}
            disabled={inputsDisabled}
            onChange={(event) => setInstructions(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') event.preventDefault();
            }}
          />
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
                <Link to="/channels" className="font-medium text-accent-text underline-offset-2 hover:underline">
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
          <div className="flex items-center justify-between gap-3">
            <p className="text-xs text-subtle">
              Thay tiêu đề và nội dung hiện tại. 10 credit mỗi lần.
            </p>
            <Button
              type="button"
              onClick={handleText}
              isLoading={isTextBusy}
              disabled={
                inputsDisabled || missingChannel || channelsQuery.isLoading || topic.trim().length < 5
              }
            >
              Tạo nội dung
            </Button>
          </div>
          {isTextBusy ? (
            <p role="status" className="text-xs text-muted">
              Đang tạo nội dung... Có thể mất vài giây.
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
