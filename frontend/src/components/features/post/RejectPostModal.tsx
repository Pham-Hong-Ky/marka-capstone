import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import Modal from '@/components/ui/Modal';
import Button from '@/components/ui/Button';
import TextArea from '@/components/ui/TextArea';
import { rejectPostSchema, type RejectPostValues } from '@/services/post';
import { useReviewPost } from '@/hooks/usePost';

export const RejectPostModal = ({
  open,
  onClose,
  workspaceId,
  postId,
}: {
  open: boolean;
  onClose: () => void;
  workspaceId: string;
  postId: string;
}) => {
  const reviewPost = useReviewPost();

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<RejectPostValues>({
    resolver: zodResolver(rejectPostSchema),
    defaultValues: { rejectReason: '' },
  });

  const close = () => {
    reset();
    onClose();
  };

  const onSubmit = handleSubmit((values) => {
    reviewPost.mutate(
      { workspaceId, postId, payload: { decision: 'REJECTED', rejectReason: values.rejectReason } },
      { onSuccess: close }
    );
  });

  return (
    <Modal open={open} onClose={close} title="Từ chối bài viết">
      <form id="reject-post-form" onSubmit={onSubmit}>
        <TextArea
          label="Lý do từ chối"
          rows={4}
          placeholder="Nêu rõ lý do để người viết chỉnh sửa..."
          error={errors.rejectReason?.message}
          {...register('rejectReason')}
        />
      </form>

      <div className="mt-6 flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={close}>
          Hủy
        </Button>
        <Button
          type="submit"
          form="reject-post-form"
          className="bg-danger hover:bg-danger/90"
          isLoading={reviewPost.isPending}
        >
          Từ chối
        </Button>
      </div>
    </Modal>
  );
};

export default RejectPostModal;
