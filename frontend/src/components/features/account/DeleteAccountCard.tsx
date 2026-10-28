import { useCallback, useEffect, useRef, useState } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import Alert from '@/components/ui/Alert';
import Button from '@/components/ui/Button';
import Modal from '@/components/ui/Modal';
import TextField from '@/components/ui/TextField';
import { useDeleteAccount } from '@/hooks/useAccount';
import { deleteAccountFormSchema, type DeleteAccountFormValues } from '@/services/user';
import { getErrorMessage } from '@/utils/error';

const DELETE_CONFIRM_WORD = 'XOA';
const PASSWORD_HINT_ID = 'delete-account-password-hint';

type DeleteAccountFormInput = z.input<typeof deleteAccountFormSchema>;

export const DeleteAccountCard = () => {
  const [open, setOpen] = useState(false);
  const deleteAccount = useDeleteAccount();
  const { isPending: isDeleting, reset: resetMutation } = deleteAccount;
  const isPendingRef = useRef(false);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<DeleteAccountFormInput, unknown, DeleteAccountFormValues>({
    resolver: zodResolver(deleteAccountFormSchema),
    defaultValues: { password: '', confirm: '' },
  });

  useEffect(() => {
    isPendingRef.current = isDeleting;
  }, [isDeleting]);

  const resetAndClose = useCallback(() => {
    reset();
    resetMutation();
    setOpen(false);
  }, [reset, resetMutation]);

  const close = useCallback(() => {
    if (isPendingRef.current) return;

    resetAndClose();
  }, [resetAndClose]);

  const openModal = () => {
    resetMutation();
    setOpen(true);
  };

  const onSubmit = handleSubmit(({ password }) => {
    isPendingRef.current = true;

    deleteAccount.mutate(
      { confirm: DELETE_CONFIRM_WORD, password: password || undefined },
      { onSuccess: resetAndClose }
    );
  });

  return (
    <section className="rounded-2xl border border-danger/30 bg-surface p-6">
      <h2 className="text-sm font-semibold text-foreground">Xoá tài khoản</h2>
      <p className="mt-1 text-xs text-muted">
        Bạn sẽ mất quyền truy cập vào mọi workspace và không thể hoàn tác thao tác này.
      </p>

      <div className="mt-6 flex justify-end">
        <Button type="button" className="min-h-11 bg-danger hover:bg-danger/90" onClick={openModal}>
          Xoá tài khoản
        </Button>
      </div>

      <Modal
        open={open}
        onClose={close}
        title="Xoá tài khoản"
        footer={
          <>
            <Button
              type="button"
              variant="outline"
              className="min-h-11"
              onClick={close}
              disabled={deleteAccount.isPending}
            >
              Hủy
            </Button>
            <Button
              type="submit"
              form="delete-account-form"
              className="min-h-11 bg-danger hover:bg-danger/90"
              isLoading={deleteAccount.isPending}
            >
              Xoá tài khoản
            </Button>
          </>
        }
      >
        <Alert variant="danger">
          Hành động này không thể hoàn tác. Nhập XOA để xác nhận xoá tài khoản.
        </Alert>

        <form id="delete-account-form" onSubmit={onSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <TextField
              label="Mật khẩu"
              type="password"
              autoComplete="current-password"
              aria-describedby={PASSWORD_HINT_ID}
              {...register('password')}
            />
            <p id={PASSWORD_HINT_ID} className="text-xs text-subtle">
              Bắt buộc với tài khoản đăng nhập bằng email/mật khẩu; có thể để trống với tài khoản
              Google.
            </p>
          </div>

          <TextField
            label="Nhập XOA để xác nhận"
            autoComplete="off"
            placeholder="XOA"
            error={errors.confirm?.message}
            {...register('confirm')}
          />

          {deleteAccount.error ? (
            <Alert variant="danger">{getErrorMessage(deleteAccount.error)}</Alert>
          ) : null}
        </form>
      </Modal>
    </section>
  );
};

export default DeleteAccountCard;
