import { z } from 'zod';

export const postEditorSchema = z.object({
  title: z
    .string()
    .trim()
    .min(1, 'Tiêu đề không được để trống')
    .max(255, 'Tiêu đề tối đa 255 ký tự'),
});

export type PostEditorValues = z.infer<typeof postEditorSchema>;

export const rejectPostSchema = z.object({
  rejectReason: z
    .string()
    .trim()
    .min(3, 'Lý do từ chối tối thiểu 3 ký tự')
    .max(255, 'Lý do từ chối tối đa 255 ký tự'),
});

export type RejectPostValues = z.infer<typeof rejectPostSchema>;
