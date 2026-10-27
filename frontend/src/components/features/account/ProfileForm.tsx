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
    defaultValues: { name: user?.name ?? '' },
  });

  if (!user) return null;

  const onSubmit = handleSubmit(({ name }) => updateProfile.mutate({ name }));

  return (
    <section className="rounded-2xl border border-border bg-surface p-6">
      <h2 className="text-sm font-semibold text-foreground">Hồ sơ cá nhân</h2>
      <p className="mt-1 text-xs text-muted">
        Cập nhật tên hiển thị và ảnh đại diện dùng trong toàn bộ workspace.
      </p>

      <div className="mt-6">
        <AvatarField
          name={user.name}
          avatar={user.avatar}
          isUploading={upload.isPending}
          onSelect={(file) => upload.mutate(file)}
        />
      </div>

      <form onSubmit={onSubmit} className="mt-6 space-y-4">
        <TextField
          id="profile-email"
          label="Email"
          value={user.email}
          readOnly
          className="bg-surface-2 text-muted"
        />
        <TextField label="Tên hiển thị" error={errors.name?.message} {...register('name')} />

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
