import { extendZodWithOpenApi } from '@asteasolutions/zod-to-openapi';
import { z } from 'zod';
import { workspaceIdParamSchema } from '../workspace/workspace.validation.js';

extendZodWithOpenApi(z);

export const orderIdParamSchema = z.object({
  workspaceId: z.string().uuid('Workspace ID không hợp lệ'),
  orderId: z.string().uuid('Order ID không hợp lệ'),
});

export const createOrderBodySchema = z
  .object({
    packageId: z.string().uuid('Gói nạp không hợp lệ').openapi({
      example: '10000000-0000-4000-8000-000000000001',
    }),
  })
  .strict();

export const listTransactionsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).max(100000).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(10),
});

export const billingSchema = { params: workspaceIdParamSchema };
export const listTransactionsSchema = {
  params: workspaceIdParamSchema,
  query: listTransactionsQuerySchema,
};
export const createOrderSchema = {
  params: workspaceIdParamSchema,
  body: createOrderBodySchema,
};
export const orderIdSchema = { params: orderIdParamSchema };

export type CreateOrderBody = z.infer<typeof createOrderBodySchema>;
export type ListTransactionsQuery = z.infer<typeof listTransactionsQuerySchema>;

export default {
  billingSchema,
  listTransactionsSchema,
  createOrderSchema,
  orderIdSchema,
};
