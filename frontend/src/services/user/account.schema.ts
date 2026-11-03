import { z } from 'zod';
import { passwordSchema } from '@/services/auth/auth.schema';

const isHttpUrl = (value: string): boolean => {
  try {
    const { protocol } = new URL(value);
    return protocol === 'http:' || protocol === 'https:';
  } catch {
    return false;
  }
};

const optionalUrlSchema = (label: string) =>
  z
    .string()
    .trim()
    .max(2048, `Link ${label} tối đa 2048 ký tự`)
    .refine(
      (value) => value === '' || z.string().url().safeParse(value).success,
      `Link ${label} không hợp lệ`
    )
    .refine(
      (value) => value === '' || isHttpUrl(value),
      `Link ${label} chỉ hỗ trợ http hoặc https`
    );

export const profileFormSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, 'Tên tối thiểu 2 ký tự')
    .max(100, 'Tên tối đa 100 ký tự'),
  facebookUrl: optionalUrlSchema('Facebook'),
  threadsUrl: optionalUrlSchema('Threads'),
});

export type ProfileFormValues = z.infer<typeof profileFormSchema>;

export const passwordFormSchema = z
  .object({
    oldPassword: z.string().min(1, 'Mật khẩu hiện tại không được để trống'),
    newPassword: passwordSchema,
    confirmPassword: z.string(),
  })
  .refine((values) => values.newPassword === values.confirmPassword, {
    path: ['confirmPassword'],
    message: 'Mật khẩu xác nhận không khớp',
  });

export type PasswordFormValues = z.infer<typeof passwordFormSchema>;

export const deleteAccountFormSchema = z.object({
  password: z.string().optional(),
  confirm: z
    .string()
    .refine((value) => value === 'XOA', 'Nhập XOA để xác nhận xoá tài khoản'),
});

export type DeleteAccountFormValues = z.infer<typeof deleteAccountFormSchema>;
