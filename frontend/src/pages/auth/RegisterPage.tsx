import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import AuthLayout from '@/components/layout/AuthLayout';
import TextField from '@/components/ui/TextField';
import Button from '@/components/ui/Button';
import GoogleLoginButton from '@/components/auth/GoogleLoginButton';
import { useRegister, useGoogleLogin } from '@/hooks/useAuth';
import { registerSchema, type RegisterFormValues } from '@/services/auth';
import { getSafeRedirect } from '@/utils/redirect';

export const RegisterPage = () => {
  const registerAccount = useRegister();
  const googleLogin = useGoogleLogin();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const redirectTo = getSafeRedirect(searchParams.get('redirect'));
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<RegisterFormValues>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      name: '',
      email: searchParams.get('email') ?? '',
      password: '',
      confirmPassword: '',
    },
  });

  const onSubmit = handleSubmit(({ name, email, password }) => {
    registerAccount.mutate({ name, email, password }, { onSuccess: () => navigate(redirectTo) });
  });

  return (
    <AuthLayout
      title="Tạo tài khoản Marka"
      subtitle="Bắt đầu với một workspace miễn phí 100 credit"
    >
      <form onSubmit={onSubmit} className="space-y-4">
        <TextField
          label="Họ và tên"
          autoComplete="name"
          placeholder="Nhập họ tên"
          error={errors.name?.message}
          {...register('name')}
        />

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
          autoComplete="new-password"
          placeholder="Tối thiểu 8 ký tự, gồm chữ và số"
          error={errors.password?.message}
          {...register('password')}
        />

        <TextField
          label="Xác nhận mật khẩu"
          type="password"
          autoComplete="new-password"
          placeholder="Nhập lại mật khẩu"
          error={errors.confirmPassword?.message}
          {...register('confirmPassword')}
        />

        <Button type="submit" isLoading={registerAccount.isPending} className="w-full">
          Đăng ký
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
        Đã có tài khoản?{' '}
        <Link to="/login" className="text-indigo-600 hover:text-indigo-500 dark:text-indigo-400 dark:hover:text-indigo-300">
          Đăng nhập
        </Link>
      </p>
    </AuthLayout>
  );
};

export default RegisterPage;
