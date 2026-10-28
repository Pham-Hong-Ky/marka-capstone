import { z } from 'zod';
import { passwordSchema } from '@/services/auth/auth.schema';

export const profileFormSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, 'Tên tối thiểu 2 ký tự')
    .max(100, 'Tên tối đa 100 ký tự'),
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
