import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import {
  accountService,
  type ChangePasswordPayload,
  type DeleteAccountPayload,
  type UpdateProfilePayload,
} from '@/services/user';
import { syncSessionUser } from '@/hooks/useWorkspace';
import { useAuthStore } from '@/stores/auth.store';
import { getErrorMessage } from '@/utils/error';

// Đổi mật khẩu, đăng xuất mọi thiết bị và xoá tài khoản đều làm token hiện tại
// mất hiệu lực, nên phải xoá phiên cục bộ rồi đưa người dùng về trang đăng nhập.
const useResetAuthSession = () => {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const clearSession = useAuthStore((state) => state.clearSession);

  return (message: string) => {
    clearSession();
    queryClient.clear();
    navigate('/login', { replace: true });
    toast.success(message);
  };
};

export const useUpdateProfile = () =>
  useMutation({
    mutationFn: (payload: UpdateProfilePayload) => accountService.updateProfile(payload),
    onSuccess: async () => {
      await syncSessionUser();
      toast.success('Cập nhật hồ sơ thành công');
    },
  });

export const useUploadAvatar = () =>
  useMutation({
    mutationFn: (file: File) => accountService.uploadAvatar(file),
    onSuccess: async () => {
      await syncSessionUser();
      toast.success('Cập nhật ảnh đại diện thành công');
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  });

export const useChangePassword = () => {
  const resetAuthSession = useResetAuthSession();

  return useMutation({
    mutationFn: (payload: ChangePasswordPayload) => accountService.changePassword(payload),
    onSuccess: () => resetAuthSession('Đã đổi mật khẩu. Vui lòng đăng nhập lại.'),
  });
};

export const useLogoutAll = () => {
  const resetAuthSession = useResetAuthSession();

  return useMutation({
    mutationFn: accountService.logoutAll,
    onSuccess: () => resetAuthSession('Đã đăng xuất khỏi mọi thiết bị.'),
  });
};

export const useDeleteAccount = () => {
  const resetAuthSession = useResetAuthSession();

  return useMutation({
    mutationFn: (payload: DeleteAccountPayload) => accountService.deleteAccount(payload),
    onSuccess: () => resetAuthSession('Tài khoản đã được xoá.'),
  });
};
