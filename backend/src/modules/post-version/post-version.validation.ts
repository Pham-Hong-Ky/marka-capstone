import { z } from 'zod';
import { postIdParamSchema } from '../post/post.validation.js';

export const postVersionParamSchema = postIdParamSchema.extend({
  version: z.coerce.number().int().min(1, 'Số phiên bản không hợp lệ'),
});

export const listPostVersionsSchema = { params: postIdParamSchema };
export const postVersionSchema = { params: postVersionParamSchema };

export default {
  listPostVersionsSchema,
  postVersionSchema,
  postVersionParamSchema,
};
