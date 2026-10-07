import { Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import AuthLayout from '@/components/layout/AuthLayout';
import TextField from '@/components/ui/TextField';
import Button from '@/components/ui/Button';
import GoogleLoginButton from '@/components/auth/GoogleLoginButton';
import { useRegister, useGoogleLogin } from '@/hooks/useAuth';

const registerSchema = z
  .object({
    name: z.string().trim().min(2, 'Tên tối thiểu 2 ký tự'),
    email: z.email('Email không hợp lệ'),
    password: z
      .string()
      .min(8, 'Mật khẩu tối thiểu 8 ký tự')
      .regex(
        /^(?=.*[A-Za-z])(?=.*\d).+$/,
        'Mật khẩu phải chứa ít nhất một chữ cái và một chữ số'
      ),
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Mật khẩu xác nhận không khớp',
    path: ['confirmPassword'],
  });

type RegisterFormValues = z.infer<typeof registerSchema>;

export const RegisterPage = () => {
  const registerAccount = useRegister();
  const googleLogin = useGoogleLogin();
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<RegisterFormValues>({
    resolver: zodResolver(registerSchema),
    defaultValues: { name: '', email: '', password: '', confirmPassword: '' },
  });

  const onSubmit = handleSubmit(({ name, email, password }) => {
    registerAccount.mutate({ name, email, password });
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

      <GoogleLoginButton onSuccess={(idToken) => googleLogin.mutate({ idToken })} />

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
