import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { Sparkles } from 'lucide-react';
import type { JSONContent } from '@tiptap/react';
import Button from '@/components/ui/Button';
import TextField from '@/components/ui/TextField';
import { useStartAiImage } from '@/hooks/useAi';
import { useAiGenerationWatcher } from '@/hooks/useAiGenerationWatcher';
import { isContentEmpty } from '@/services/post';
import { queryKeys } from '@/lib/queryKeys';
import type { AiImageResult } from '@/services/ai';
import { getErrorMessage } from '@/utils/error';
import { clearDraft, draftKey } from '@/utils/postDraft';

interface PostAIImageGeneratorProps {
  workspaceId: string;
  postId: string | null;
  title: string;
  content: JSONContent;
  disabled?: boolean;
  pendingImageCount?: number;
  initialImageGenerationId?: string | null;
}

const isImageResult = (result: unknown): result is AiImageResult =>
  Boolean(result && typeof result === 'object' && 'media' in result);

export const PostAIImageGenerator = ({
  workspaceId,
  postId,
  title,
  content,
  disabled = false,
  pendingImageCount = 0,
  initialImageGenerationId = null,
}: PostAIImageGeneratorProps) => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const startImage = useStartAiImage();

  const [imagePrompt, setImagePrompt] = useState('');
  const [imageGenerationId, setImageGenerationId] = useState<string | null>(
    initialImageGenerationId
  );

  const { error, setError, isBusy } = useAiGenerationWatcher({
    workspaceId,
    generationId: imageGenerationId,
    setGenerationId: setImageGenerationId,
    isResult: isImageResult,
    resultLabel: 'ảnh',
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: queryKeys.post.detailWorkspace(workspaceId),
      });
      void queryClient.invalidateQueries({
        queryKey: queryKeys.post.workspace(workspaceId),
      });
      toast.success('Đã tạo ảnh bằng AI');
    },
  });

  const isImageBusy = isBusy || startImage.isPending;
  const hasPendingImages = !postId && pendingImageCount > 0;

  const handleImage = async () => {
    if (hasPendingImages) {
      setError('Vui lòng lưu bài để tải các ảnh đang chờ trước khi tạo ảnh AI.');
      return;
    }

    if (!postId && !title.trim()) {
      setError('Cần nhập tiêu đề trước khi tạo ảnh cho bài mới.');
      return;
    }

    if (!postId && isContentEmpty(content)) {
      setError('Cần có nội dung trước khi tạo ảnh cho bài mới.');
      return;
    }

    setError(null);

    try {
      const result = await startImage.mutateAsync({
        workspaceId,
        payload: postId
          ? { postId, prompt: imagePrompt.trim() || undefined }
          : { title: title.trim(), content, prompt: imagePrompt.trim() || undefined },
      });

      if (!postId && result.postId) {
        await clearDraft(draftKey(workspaceId, null));
        navigate(`/posts/${result.postId}/edit`, {
          replace: true,
          state: { pendingAiGenerationId: result.generationId },
        });
        return;
      }

      setImageGenerationId(result.generationId);
    } catch (mutationError) {
      setError(getErrorMessage(mutationError));
    }
  };

  const inputsDisabled = disabled || isImageBusy;

  return (
    <div className="space-y-2 border-t border-border pt-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
        <div className="sm:flex-1">
          <TextField
            label="Tạo ảnh bằng AI"
            name="ai-image-prompt"
            maxLength={500}
            placeholder="Ghi chú tuỳ chọn, ví dụ: tối giản, ánh sáng tự nhiên"
            value={imagePrompt}
            disabled={inputsDisabled}
            onChange={(event) => setImagePrompt(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') event.preventDefault();
            }}
          />
        </div>
        <Button
          type="button"
          variant="outline"
          onClick={handleImage}
          isLoading={isImageBusy}
          disabled={inputsDisabled || hasPendingImages}
        >
          <Sparkles className="h-4 w-4 text-accent-text" aria-hidden="true" />
          Tạo ảnh
        </Button>
      </div>
      <p className="text-xs text-subtle">
        {hasPendingImages
          ? 'Có ảnh đang chờ tải lên. Hãy lưu bài trước khi tạo ảnh AI.'
          : 'Dựa trên tiêu đề và nội dung đã lưu; bài mới sẽ được lưu nháp trước. 20 credit mỗi lần.'}
      </p>
      {isImageBusy ? (
        <p role="status" className="text-xs text-muted">
          Đang tạo ảnh... Có thể mất vài giây.
        </p>
      ) : null}
      {error ? (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      ) : null}
    </div>
  );
};

export default PostAIImageGenerator;
