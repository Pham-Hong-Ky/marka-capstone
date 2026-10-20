import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { authService } from '@/services/auth';
import { useAuthStore } from '@/stores/auth.store';
import { getErrorMessage } from '@/utils/error';

export const useLogin = () => {
  const setSession = useAuthStore((state) => state.setSession);

  return useMutation({
    mutationFn: authService.login,
    onSuccess: (session) => {
      setSession(session);
      toast.success('Đăng nhập thành công');
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  });
};

export const useRegister = () => {
  const setSession = useAuthStore((state) => state.setSession);

  return useMutation({
    mutationFn: authService.register,
    onSuccess: (session) => {
      setSession(session);
      toast.success('Đăng ký thành công');
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  });
};

export const useGoogleLogin = () => {
  const setSession = useAuthStore((state) => state.setSession);

  return useMutation({
    mutationFn: authService.googleLogin,
    onSuccess: (session) => {
      setSession(session);
      toast.success('Đăng nhập Google thành công');
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  });
};

export const useLogout = () => {
  const queryClient = useQueryClient();
  const clearSession = useAuthStore((state) => state.clearSession);

  return useMutation({
    mutationFn: authService.logout,
    onSettled: () => {
      clearSession();
      queryClient.clear();
      toast.success('Đã đăng xuất');
    },
  });
};

export const useCurrentUser = () => {
  const isAuthenticated = useAuthStore((state) => Boolean(state.user));

  return useQuery({
    queryKey: ['auth', 'me'],
    queryFn: authService.getMe,
    enabled: isAuthenticated,
  });
};
