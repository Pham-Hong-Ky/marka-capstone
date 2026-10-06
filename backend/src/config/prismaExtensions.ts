import { Prisma } from '@prisma/client';

// Các model áp dụng xóa mềm (D18) — mọi truy vấn đọc mặc định bỏ qua bản ghi đã xóa.
const SOFT_DELETE_MODELS = new Set(['Workspace', 'Post', 'CreditPackage', 'MediaAsset']);

const READ_OPERATIONS = new Set([
  'findFirst',
  'findFirstOrThrow',
  'findMany',
  'findUnique',
  'findUniqueOrThrow',
  'count',
  'aggregate',
  'groupBy',
]);

// Mọi truy vấn đọc thêm điều kiện deletedAt: null. Lấy bản ghi đã xóa phải dùng
// repository chuyên biệt gọi thẳng prisma gốc (không qua client mở rộng này).
export const softDeleteExtension = Prisma.defineExtension({
  name: 'softDelete',
  query: {
    $allModels: {
      async $allOperations({ model, operation, args, query }) {
        if (!model || !SOFT_DELETE_MODELS.has(model) || !READ_OPERATIONS.has(operation)) {
          return query(args);
        }

        const nextArgs = args as Record<string, unknown>;
        const where = (nextArgs.where ?? {}) as Record<string, unknown>;
        nextArgs.where = { ...where, deletedAt: null };

        return query(nextArgs as typeof args);
      },
    },
  },
});

export default softDeleteExtension;
