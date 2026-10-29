import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import Alert from '@/components/ui/Alert';
import Button from '@/components/ui/Button';
import TextField from '@/components/ui/TextField';
import { useChangePassword } from '@/hooks/useAccount';
import { passwordFormSchema, type PasswordFormValues } from '@/services/user';
import { getErrorMessage } from '@/utils/error';

export const ChangePasswordForm = () => {
  const changePassword = useChangePassword();

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<PasswordFormValues>({
    resolver: zodResolver(passwordFormSchema),
    defaultValues: { oldPassword: '', newPassword: '', confirmPassword: '' },
  });

  const onSubmit = handleSubmit(({ oldPassword, newPassword }) =>
    changePassword.mutate({ oldPassword, newPassword })
  );

  return (
    <section className="rounded-2xl border border-border bg-surface p-6">
      <h2 className="text-sm font-semibold text-foreground">Đổi mật khẩu</h2>

      <form onSubmit={onSubmit} className="mt-6 space-y-4">
        <TextField
          label="Mật khẩu hiện tại"
          type="password"
          autoComplete="current-password"
          error={errors.oldPassword?.message}
          {...register('oldPassword')}
        />
        <TextField
          label="Mật khẩu mới"
          type="password"
          autoComplete="new-password"
          error={errors.newPassword?.message}
          {...register('newPassword')}
        />
        <TextField
          label="Xác nhận mật khẩu mới"
          type="password"
          autoComplete="new-password"
          error={errors.confirmPassword?.message}
          {...register('confirmPassword')}
        />

        {changePassword.error ? (
          <Alert variant="danger">{getErrorMessage(changePassword.error)}</Alert>
        ) : null}

        <div className="flex justify-end">
          <Button type="submit" className="min-h-11" isLoading={changePassword.isPending}>
            Đổi mật khẩu
          </Button>
        </div>
      </form>
    </section>
  );
};

export default ChangePasswordForm;
