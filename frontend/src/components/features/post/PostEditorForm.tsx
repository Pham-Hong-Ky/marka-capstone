import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Trash2 } from 'lucide-react';
import type { JSONContent } from '@tiptap/react';
import Button from '@/components/ui/Button';
import TextField from '@/components/ui/TextField';
import RichTextEditor from '@/components/ui/RichTextEditor';
import ImageUploadField from '@/components/ui/ImageUploadField';
import { EMPTY_DOC, isContentEmpty, postEditorSchema, type PostDetail, type PostEditorValues } from '@/services/post';
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
}: {
  workspaceId: string;
  post: PostDetail | null;
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
  const [pending, setPending] = useState<PendingImage[]>([]);
  const [restored, setRestored] = useState(Boolean(initialDraft));

  const pendingRef = useRef(pending);
  pendingRef.current = pending;

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

  useEffect(() => {
    if (initialDraft) {
      void loadPendingFiles(key).then((files) => {
        if (files.length > 0) {
          setPending(files.map((file) => ({ file, url: URL.createObjectURL(file) })));
        }
      });
      return;
    }

    const stale = loadDraft(key);
    if (stale && post && stale.savedAt <= new Date(post.updatedAt).getTime()) {
      void clearDraft(key);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (!title.trim() && isContentEmpty(content) && pending.length === 0) {
        void clearDraft(key);
        return;
      }

      saveDraft(key, { title, content, savedAt: Date.now() });
      void savePendingFiles(
        key,
        pending.map((item) => item.file)
      );
    }, DRAFT_DEBOUNCE_MS);

    return () => clearTimeout(timer);
  }, [key, title, content, pending]);

  const addImage = (file: File) =>
    setPending((list) => [...list, { file, url: URL.createObjectURL(file) }]);

  const removeImage = (url: string) => {
    URL.revokeObjectURL(url);
    setPending((list) => list.filter((item) => item.url !== url));
  };

  const discardDraft = () => {
    void clearDraft(key);
    pending.forEach((item) => URL.revokeObjectURL(item.url));
    setPending([]);
    reset({ title: post?.title ?? '' });
    setContent((post?.content as JSONContent) ?? EMPTY_DOC);
    setRestored(false);
  };

  const cancel = () => {
    void clearDraft(key);
    navigate('/posts');
  };

  const onSubmit = handleSubmit(async (values) => {
    if (isContentEmpty(content)) {
      setContentError('Nội dung không được để trống');
      return;
    }

    setContentError(null);
    const payload = { title: values.title, content };

    let saved: PostDetail;
    try {
      saved = post
        ? await updatePost.mutateAsync({ workspaceId, postId: post.id, payload })
        : await createPost.mutateAsync({ workspaceId, payload });
    } catch {
      return;
    }

    for (const item of pending) {
      try {
        await uploadMedia.mutateAsync({ workspaceId, postId: saved.id, file: item.file });
      } catch {
        break;
      }
    }

    void clearDraft(key);
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
            className="shrink-0 font-medium text-indigo-600 underline transition hover:text-indigo-500 dark:text-indigo-400"
          >
            Bỏ thay đổi
          </button>
        </div>
      ) : null}

      <TextField
        label="Tiêu đề"
        placeholder="Ví dụ: Khuyến mãi mùa thu"
        error={errors.title?.message}
        {...register('title')}
      />

      <div className="space-y-1.5">
        <span className="block text-sm font-medium text-foreground">Nội dung</span>
        <RichTextEditor
          value={content}
          onChange={(json) => {
            setContent(json);
            setContentError(null);
          }}
          error={contentError ?? undefined}
        />
      </div>

      <div className="space-y-3">
        <span className="block text-sm font-medium text-foreground">Ảnh đính kèm</span>

        {existingMedia.length + pending.length > 0 ? (
          <div className="grid grid-cols-3 gap-3 sm:grid-cols-4">
            {existingMedia.map((media) => (
              <div
                key={media.id}
                className="relative overflow-hidden rounded-lg border border-border"
              >
                <img src={media.url} alt="" className="h-24 w-full object-cover" />
                <button
                  type="button"
                  aria-label="Gỡ ảnh"
                  disabled={deleteMedia.isPending}
                  onClick={() =>
                    post && deleteMedia.mutate({ workspaceId, postId: post.id, mediaId: media.id })
                  }
                  className="absolute right-2 top-2 grid h-11 w-11 place-items-center rounded-lg bg-black/50 text-white transition hover:bg-black/70 disabled:opacity-60"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}

            {pending.map((item) => (
              <div key={item.url} className="relative overflow-hidden rounded-lg border border-border">
                <img src={item.url} alt="" className="h-24 w-full object-cover" />
                <button
                  type="button"
                  aria-label="Bỏ ảnh"
                  onClick={() => removeImage(item.url)}
                  className="absolute right-2 top-2 grid h-11 w-11 place-items-center rounded-lg bg-black/50 text-white transition hover:bg-black/70"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-xs text-subtle">Chưa có ảnh nào.</p>
        )}

        <ImageUploadField
          id="post-editor-media"
          label="Thêm ảnh"
          hint="JPG, PNG hoặc WEBP, tối đa 10MB. Ảnh sẽ được tải lên khi lưu bài."
          maxSize={10 * 1024 * 1024}
          disabled={isSaving}
          onSelect={addImage}
        />
      </div>

      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={cancel}>
          Hủy
        </Button>
        <Button type="submit" isLoading={isSaving}>
          {post ? 'Lưu' : 'Tạo bài viết'}
        </Button>
      </div>
    </form>
  );
};

export default PostEditorForm;
