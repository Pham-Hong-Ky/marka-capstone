import { z } from 'zod';

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
    newPassword: z
      .string()
      .min(8, 'Mật khẩu tối thiểu 8 ký tự')
      .max(100, 'Mật khẩu tối đa 100 ký tự')
      .regex(
        /^(?=.*[A-Za-z])(?=.*\d).+$/,
        'Mật khẩu phải chứa ít nhất một chữ cái và một chữ số'
      ),
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
