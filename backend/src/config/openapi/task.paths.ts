import type { OpenAPIRegistry } from '@asteasolutions/zod-to-openapi';
import { workspaceIdParamSchema } from '../../utils/validation/common.js';
import {
  assignTaskBodySchema,
  boardQuerySchema,
  createTaskBodySchema,
  linkTaskPostBodySchema,
  taskIdParamSchema,
  updateTaskBodySchema,
  updateTaskStatusBodySchema,
} from '../../modules/task/task.validation.js';

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

  registry.registerPath({
    method: 'patch',
    path: '/workspaces/{workspaceId}/tasks/{taskId}/assign',
    tags: ['Task'],
    summary: 'Giao hoặc bỏ giao công việc (Owner)',
    security: [{ bearerAuth: [] }],
    request: {
      params: taskIdParamSchema,
      body: { content: { 'application/json': { schema: assignTaskBodySchema } } },
    },
    responses: {
      200: { description: 'Giao việc / bỏ giao thành công' },
      400: { description: 'Người nhận không phải thành viên workspace' },
      403: { description: 'Chỉ Workspace Owner được giao việc' },
      404: { description: 'Công việc không tồn tại' },
    },
  });

  registry.registerPath({
    method: 'patch',
    path: '/workspaces/{workspaceId}/tasks/{taskId}/status',
    tags: ['Task'],
    summary: 'Đổi trạng thái công việc (Owner hoặc người nhận)',
    security: [{ bearerAuth: [] }],
    request: {
      params: taskIdParamSchema,
      body: { content: { 'application/json': { schema: updateTaskStatusBodySchema } } },
    },
    responses: {
      200: { description: 'Đổi trạng thái thành công' },
      403: { description: 'Không phải Owner hoặc người nhận việc' },
      404: { description: 'Công việc không tồn tại' },
      409: { description: 'Công việc chưa được giao' },
      422: { description: 'Trạng thái không hợp lệ' },
    },
  });

  registry.registerPath({
    method: 'patch',
    path: '/workspaces/{workspaceId}/tasks/{taskId}',
    tags: ['Task'],
    summary: 'Sửa công việc (Owner)',
    security: [{ bearerAuth: [] }],
    request: {
      params: taskIdParamSchema,
      body: { content: { 'application/json': { schema: updateTaskBodySchema } } },
    },
    responses: {
      200: { description: 'Cập nhật công việc thành công' },
      400: { description: 'Hạn chót không hợp lệ' },
      403: { description: 'Chỉ Workspace Owner được sửa việc' },
      404: { description: 'Công việc không tồn tại' },
      422: { description: 'Dữ liệu không hợp lệ' },
    },
  });

  registry.registerPath({
    method: 'patch',
    path: '/workspaces/{workspaceId}/tasks/{taskId}/post',
    tags: ['Task'],
    summary: 'Gắn hoặc bỏ gắn bài viết (Owner hoặc người nhận)',
    security: [{ bearerAuth: [] }],
    request: {
      params: taskIdParamSchema,
      body: { content: { 'application/json': { schema: linkTaskPostBodySchema } } },
    },
    responses: {
      200: { description: 'Gắn / bỏ gắn bài viết thành công' },
      400: { description: 'Bài viết đã lưu trữ' },
      403: { description: 'Không phải Owner hoặc người nhận việc' },
      404: { description: 'Công việc hoặc bài viết không tồn tại' },
      409: { description: 'Bài viết đã gắn với công việc khác' },
    },
  });

  registry.registerPath({
    method: 'delete',
    path: '/workspaces/{workspaceId}/tasks/{taskId}',
    tags: ['Task'],
    summary: 'Xoá mềm công việc (Owner)',
    security: [{ bearerAuth: [] }],
    request: { params: taskIdParamSchema },
    responses: {
      200: { description: 'Xoá công việc thành công' },
      403: { description: 'Chỉ Workspace Owner được xoá việc' },
      404: { description: 'Công việc không tồn tại' },
    },
  });
};

export default registerTaskPaths;
