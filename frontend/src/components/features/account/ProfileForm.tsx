import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import Alert from '@/components/ui/Alert';
import Button from '@/components/ui/Button';
import TextField from '@/components/ui/TextField';
import AvatarField from './AvatarField';
import { useUpdateProfile, useUploadAvatar } from '@/hooks/useAccount';
import { profileFormSchema, type ProfileFormValues } from '@/services/user';
import { useAuthStore } from '@/stores/auth.store';
import { getErrorMessage } from '@/utils/error';

export const ProfileForm = () => {
  const user = useAuthStore((state) => state.user);
  const updateProfile = useUpdateProfile();
  const upload = useUploadAvatar();

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ProfileFormValues>({
    resolver: zodResolver(profileFormSchema),
    defaultValues: {
      name: user?.name ?? '',
      facebookUrl: user?.facebookUrl ?? '',
      threadsUrl: user?.threadsUrl ?? '',
    },
  });

  if (!user) return null;

  const onSubmit = handleSubmit(({ name, facebookUrl, threadsUrl }) =>
    updateProfile.mutate({
      name,
      facebookUrl: facebookUrl || null,
      threadsUrl: threadsUrl || null,
    })
  );

  return (
    <section className="rounded-xl border border-border bg-surface p-5">
      <h2 className="text-sm font-semibold text-foreground">Hồ sơ cá nhân</h2>
      <p className="mt-1 text-[11px] text-muted">
        Cập nhật tên hiển thị và ảnh đại diện dùng trong toàn bộ workspace.
      </p>

      <div className="mt-5">
        <AvatarField
          name={user.name}
          avatar={user.avatar}
          isUploading={upload.isPending}
          onSelect={(file) => upload.mutate(file)}
        />
      </div>

      <form onSubmit={onSubmit} className="mt-5 space-y-4">
        <TextField
          id="profile-email"
          label="Email"
          value={user.email}
          readOnly
          className="bg-surface-2 text-muted"
        />
        <TextField label="Tên hiển thị" error={errors.name?.message} {...register('name')} />

        <div className="space-y-4 border-t border-border pt-6">
          <div className="space-y-1">
            <h3 className="text-sm font-semibold text-foreground">Liên kết mạng xã hội</h3>
            <p className="text-[11px] text-muted">
              Admin dùng thông tin này để liên hệ mời bạn tham gia thử nghiệm sản phẩm.
            </p>
          </div>

          <TextField
            label="Facebook"
            type="text"
            inputMode="url"
            placeholder="https://facebook.com/ten-ban"
            error={errors.facebookUrl?.message}
            {...register('facebookUrl')}
          />
          <TextField
            label="Threads"
            type="text"
            inputMode="url"
            placeholder="https://www.threads.net/@ten-ban"
            error={errors.threadsUrl?.message}
            {...register('threadsUrl')}
          />
        </div>

        {updateProfile.error ? (
          <Alert variant="danger">{getErrorMessage(updateProfile.error)}</Alert>
        ) : null}

        <div className="flex justify-end">
          <Button type="submit" isLoading={updateProfile.isPending}>
            Lưu thay đổi
          </Button>
        </div>
      </form>
    </section>
  );
};

export default ProfileForm;
