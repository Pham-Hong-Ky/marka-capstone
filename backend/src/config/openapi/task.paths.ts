import type { OpenAPIRegistry } from '@asteasolutions/zod-to-openapi';
import { workspaceIdParamSchema } from '../../utils/validation/common.js';
import { boardQuerySchema, createTaskBodySchema } from '../../modules/task/task.validation.js';

export const registerTaskPaths = (registry: OpenAPIRegistry) => {
  registry.registerPath({
    method: 'get',
    path: '/workspaces/{workspaceId}/tasks/board',
    tags: ['Task'],
    summary: 'Bảng công việc Kanban',
    description:
      'Owner thấy toàn bộ workspace; thành viên chỉ thấy việc của mình và không có cột Chưa giao.',
    security: [{ bearerAuth: [] }],
    request: { params: workspaceIdParamSchema, query: boardQuerySchema },
    responses: {
      200: { description: 'Bảng công việc gồm 4 cột và số đếm' },
      403: { description: 'Không phải thành viên workspace' },
    },
  });

  registry.registerPath({
    method: 'post',
    path: '/workspaces/{workspaceId}/tasks',
    tags: ['Task'],
    summary: 'Tạo công việc (Owner)',
    security: [{ bearerAuth: [] }],
    request: {
      params: workspaceIdParamSchema,
      body: { content: { 'application/json': { schema: createTaskBodySchema } } },
    },
    responses: {
      201: { description: 'Tạo công việc thành công' },
      400: { description: 'Người nhận không phải thành viên hoặc hạn chót không hợp lệ' },
      403: { description: 'Chỉ Workspace Owner được tạo việc' },
      422: { description: 'Dữ liệu không hợp lệ' },
    },
  });
};

export default registerTaskPaths;
