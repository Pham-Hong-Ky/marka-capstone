import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import toast from 'react-hot-toast';
import type { JSONContent } from '@tiptap/react';
import Button from '@/components/ui/Button';
import TextField from '@/components/ui/TextField';
import RichTextEditor from '@/components/ui/RichTextEditor';
import ImageUploadField from '@/components/ui/ImageUploadField';
import PostAIAssistant from './PostAIAssistant';
import PostAIImageGenerator from './PostAIImageGenerator';
import PostMediaGrid from './PostMediaGrid';
import { EMPTY_DOC, isContentEmpty, postEditorSchema, type PostDetail, type PostEditorValues } from '@/services/post';
import type { AiTextResult } from '@/services/ai';
import { useCreatePost, useDeletePostMedia, useUpdatePost, useUploadPostMedia } from '@/hooks/usePost';
import {
  clearDraft,
  draftKey,
  loadDraft,
  loadPendingFiles,
  saveDraft,
  savePendingFiles,
  type PostDraft,
} from '@/utils/postDraft';

interface PendingImage {
  file: File;
  url: string;
}

const DRAFT_DEBOUNCE_MS = 1000;

export const PostEditorForm = ({
  workspaceId,
  post,
  initialAiGenerationId = null,
}: {
  workspaceId: string;
  post: PostDetail | null;
  initialAiGenerationId?: string | null;
}) => {
  const navigate = useNavigate();
  const createPost = useCreatePost();
  const updatePost = useUpdatePost();
  const uploadMedia = useUploadPostMedia();
  const deleteMedia = useDeletePostMedia();

  const key = draftKey(workspaceId, post?.id ?? null);

  // localStorage là đồng bộ → đọc draft ngay khi khởi tạo để editor mount với đúng nội dung.
  const [initialDraft] = useState<PostDraft | null>(() => {
    const draft = loadDraft(key);
    if (!draft) return null;
    if (post && draft.savedAt <= new Date(post.updatedAt).getTime()) return null;
    return draft;
  });

  const [content, setContent] = useState<JSONContent>(
    (initialDraft?.content as JSONContent) ?? (post?.content as JSONContent) ?? EMPTY_DOC
  );
  const [contentError, setContentError] = useState<string | null>(null);
  const [mediaError, setMediaError] = useState<string | null>(null);
  const [pending, setPending] = useState<PendingImage[]>([]);
  const [pendingHydrated, setPendingHydrated] = useState(!initialDraft);
  const [restored, setRestored] = useState(Boolean(initialDraft));
  const [aiBusy, setAiBusy] = useState(false);
  const [editorKey, setEditorKey] = useState(0);

  const pendingRef = useRef(pending);
  pendingRef.current = pending;
  const postRef = useRef(post);
  postRef.current = post;
  const initialDraftRef = useRef(initialDraft);
  initialDraftRef.current = initialDraft;

  useEffect(
    () => () => pendingRef.current.forEach((item) => URL.revokeObjectURL(item.url)),
    []
  );

  const {
    register,
    handleSubmit,
    reset,
    watch,
    formState: { errors },
  } = useForm<PostEditorValues>({
    resolver: zodResolver(postEditorSchema),
    defaultValues: { title: initialDraft?.title ?? post?.title ?? '' },
  });

  const title = watch('title');

  const handleApplyText = useCallback(
    (result: AiTextResult) => {
      reset({ title: result.title });
      setContent(result.content as JSONContent);
      setContentError(null);
      setEditorKey((current) => current + 1);
    },
    [reset]
  );

  useEffect(() => {
    if (!aiBusy) return;

    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = '';
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [aiBusy]);

  useEffect(() => {
    if (initialDraftRef.current) {
      void loadPendingFiles(key)
        .then((files) => {
          if (files.length > 0) {
            setPending(files.map((file) => ({ file, url: URL.createObjectURL(file) })));
          }
        })
        .finally(() => setPendingHydrated(true));
      return;
    }

    const stale = loadDraft(key);
    const currentPost = postRef.current;
    if (stale && currentPost && stale.savedAt <= new Date(currentPost.updatedAt).getTime()) {
      void clearDraft(key);
    }
    // Chỉ kiểm tra một lần khi mount/đổi bài; post refetch sau đó không được xoá draft mới.
  }, [key]);

  useEffect(() => {
    if (!pendingHydrated) return;

    const timer = setTimeout(() => {
      if (!title.trim() && isContentEmpty(content) && pending.length === 0) {
        void clearDraft(key);
        return;
      }

      saveDraft(key, { title, content, savedAt: Date.now() });
    }, DRAFT_DEBOUNCE_MS);

    return () => clearTimeout(timer);
  }, [key, title, content, pending.length, pendingHydrated]);

  useEffect(() => {
    if (!pendingHydrated) return;

    const timer = setTimeout(() => {
      void savePendingFiles(
        key,
        pending.map((item) => item.file)
      );
    }, DRAFT_DEBOUNCE_MS);

    return () => clearTimeout(timer);
  }, [key, pending, pendingHydrated]);

  const addImage = (file: File) => {
    setMediaError(null);
    setPending((list) => [...list, { file, url: URL.createObjectURL(file) }]);
  };

  const removeImage = (url: string) => {
    setMediaError(null);
    URL.revokeObjectURL(url);
    setPending((list) => list.filter((item) => item.url !== url));
  };

  const discardDraft = () => {
    void clearDraft(key);
    pending.forEach((item) => URL.revokeObjectURL(item.url));
    setPending([]);
    reset({ title: post?.title ?? '' });
    setContent((post?.content as JSONContent) ?? EMPTY_DOC);
    setEditorKey((current) => current + 1);
    setRestored(false);
  };

  const cancel = () => {
    void clearDraft(key);
    navigate('/posts');
  };

  const onSubmit = handleSubmit(async (values) => {
    if (aiBusy) return;

    if (isContentEmpty(content)) {
      setContentError('Nội dung không được để trống');
      return;
    }

    setContentError(null);
    setMediaError(null);
    const payload = { title: values.title, content };

    let saved: PostDetail;
    try {
      saved = post
        ? await updatePost.mutateAsync({ workspaceId, postId: post.id, payload })
        : await createPost.mutateAsync({ workspaceId, payload });
    } catch {
      return;
    }

    const failedImages: PendingImage[] = [];
    for (const item of pending) {
      try {
        await uploadMedia.mutateAsync({ workspaceId, postId: saved.id, file: item.file });
      } catch {
        failedImages.push(item);
      }
    }

    if (failedImages.length > 0) {
      const message = `Không tải lên được ${failedImages.length} ảnh: ${failedImages
        .map((item) => item.file.name)
        .join(', ')}.`;

      if (post) {
        setMediaError(message);
        return;
      }

      // Bài mới đã được tạo: giữ ảnh lỗi dưới draft của bài đó rồi chuyển sang trang sửa
      // để tránh tạo trùng bài khi người dùng bấm lưu lại.
      const editKey = draftKey(workspaceId, saved.id);
      saveDraft(editKey, { title: values.title, content, savedAt: Date.now() });
      await savePendingFiles(
        editKey,
        failedImages.map((item) => item.file)
      );
      await clearDraft(key);
      toast.error(`${message} Bài đã được lưu nháp, vui lòng thử tải lại ảnh.`);
      navigate(`/posts/${saved.id}/edit`, { replace: true });
      return;
    }

    await clearDraft(key);
    navigate('/posts');
  });

  const existingMedia = post?.mediaAssets ?? [];
  const isSaving = createPost.isPending || updatePost.isPending || uploadMedia.isPending;

  return (
    <form id="post-editor-form" onSubmit={onSubmit} className="space-y-5">
      {restored ? (
        <div className="flex items-center justify-between gap-3 rounded-lg border border-border bg-surface-2 px-3 py-2 text-xs text-muted">
          <span>Đã khôi phục bản đang soạn chưa lưu trước đó.</span>
          <button
            type="button"
            onClick={discardDraft}
            className="shrink-0 font-medium text-accent-text underline transition hover:opacity-80"
          >
            Bỏ thay đổi
          </button>
        </div>
      ) : null}

      <PostAIAssistant
        workspaceId={workspaceId}
        postId={post?.id ?? null}
        disabled={isSaving}
        onBusyChange={setAiBusy}
        onApplyText={handleApplyText}
      />

      <TextField
        label="Tiêu đề"
        placeholder="Ví dụ: Khuyến mãi mùa thu"
        error={errors.title?.message}
        disabled={aiBusy || isSaving}
        {...register('title')}
      />

      <div className="space-y-1.5">
        <span className="block text-sm font-medium text-foreground">Nội dung</span>
        <RichTextEditor
          key={editorKey}
          value={content}
          editable={!aiBusy}
          onChange={(json) => {
            setContent(json);
            setContentError(null);
          }}
          error={contentError ?? undefined}
        />
      </div>

      <div className="space-y-3">
        <span className="block text-sm font-medium text-foreground">Ảnh đính kèm</span>

        <PostMediaGrid
          existingMedia={existingMedia}
          pendingMedia={pending}
          isDeleting={deleteMedia.isPending}
          onDeleteExisting={(mediaId) => {
            if (post) deleteMedia.mutate({ workspaceId, postId: post.id, mediaId });
          }}
          onRemovePending={removeImage}
        />

        {mediaError ? (
          <p role="alert" className="text-sm text-danger">
            {mediaError}
          </p>
        ) : null}

        <ImageUploadField
          id="post-editor-media"
          label="Thêm ảnh"
          hint="JPG, PNG hoặc WEBP, tối đa 10MB. Ảnh sẽ được tải lên khi lưu bài."
          maxSize={10 * 1024 * 1024}
          disabled={isSaving || aiBusy}
          onSelect={addImage}
        />

        <PostAIImageGenerator
          workspaceId={workspaceId}
          postId={post?.id ?? null}
          title={title}
          content={content}
          disabled={isSaving || aiBusy}
          pendingImageCount={pending.length}
          initialImageGenerationId={initialAiGenerationId}
        />
      </div>

      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={cancel} disabled={aiBusy}>
          Hủy
        </Button>
        <Button type="submit" isLoading={isSaving} disabled={aiBusy}>
          {post ? 'Lưu' : 'Tạo bài viết'}
        </Button>
      </div>
    </form>
  );
};

export default PostEditorForm;
