import { z } from 'zod';

export const workspaceIdField = z.string().uuid('Workspace ID không hợp lệ');

export const workspaceIdParamSchema = z.object({
  workspaceId: workspaceIdField,
});

export const personNameSchema = z
  .string()
  .trim()
  .min(2, 'Tên tối thiểu 2 ký tự')
  .max(100, 'Tên tối đa 100 ký tự');

export const strongPasswordSchema = (label = 'Mật khẩu') =>
  z
    .string()
    .min(8, `${label} tối thiểu 8 ký tự`)
    .max(100, `${label} tối đa 100 ký tự`)
    .regex(
      /^(?=.*[A-Za-z])(?=.*\d).+$/,
      `${label} phải chứa ít nhất một chữ cái và một chữ số`
    );

export default { workspaceIdParamSchema, personNameSchema, strongPasswordSchema };
