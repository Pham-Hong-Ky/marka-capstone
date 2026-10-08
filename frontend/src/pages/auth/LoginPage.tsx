import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import AuthLayout from '@/components/layout/AuthLayout';
import TextField from '@/components/ui/TextField';
import Button from '@/components/ui/Button';
import GoogleLoginButton from '@/components/auth/GoogleLoginButton';
import { useLogin, useGoogleLogin } from '@/hooks/useAuth';
import { loginSchema, type LoginFormValues } from '@/services/auth';
import { getSafeRedirect } from '@/utils/redirect';

export const LoginPage = () => {
  const login = useLogin();
  const googleLogin = useGoogleLogin();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const redirectTo = getSafeRedirect(searchParams.get('redirect'));
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: searchParams.get('email') ?? '', password: '' },
  });

  return (
    <AuthLayout title="Đăng nhập Marka" subtitle="Nền tảng AI Content đa kênh cho marketer Việt Nam">
      <form
        onSubmit={handleSubmit((values) =>
          login.mutate(values, { onSuccess: () => navigate(redirectTo) })
        )}
        className="space-y-4"
      >
        <TextField
          label="Email"
          type="email"
          autoComplete="email"
          placeholder="Nhập email"
          error={errors.email?.message}
          {...register('email')}
        />

        <TextField
          label="Mật khẩu"
          type="password"
          autoComplete="current-password"
          placeholder="••••••••"
          error={errors.password?.message}
          {...register('password')}
        />

        <Button type="submit" isLoading={login.isPending} className="w-full">
          Đăng nhập
        </Button>
      </form>

      <div className="my-4 flex items-center gap-3 text-xs text-muted">
        <span className="h-px flex-1 bg-border" />
        hoặc
        <span className="h-px flex-1 bg-border" />
      </div>

      <GoogleLoginButton
        onSuccess={(idToken) =>
          googleLogin.mutate({ idToken }, { onSuccess: () => navigate(redirectTo) })
        }
      />

      <p className="mt-4 text-center text-sm text-muted">
        Chưa có tài khoản?{' '}
        <Link to="/register" className="text-indigo-600 hover:text-indigo-500 dark:text-indigo-400 dark:hover:text-indigo-300">
          Đăng ký ngay
        </Link>
      </p>
    </AuthLayout>
  );
};

export default LoginPage;
