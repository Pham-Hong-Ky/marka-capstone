import { extendZodWithOpenApi, OpenAPIRegistry, OpenApiGeneratorV3 } from '@asteasolutions/zod-to-openapi';
import { z } from 'zod';
import env from './env.js';
import { registerBodySchema, loginBodySchema, refreshTokenBodySchema } from '../modules/auth/auth.validation.js';
import { updateProfileBodySchema, changePasswordBodySchema } from '../modules/user/user.validation.js';
import {
  createWorkspaceBodySchema,
  updateWorkspaceBodySchema,
  workspaceIdParamSchema,
  memberIdParamSchema,
  inviteMemberBodySchema,
  changeMemberRoleBodySchema,
  inviteTokenParamSchema,
} from '../modules/workspace/workspace.validation.js';

extendZodWithOpenApi(z);

const registry = new OpenAPIRegistry();

// 1. Security Scheme
const bearerAuth = registry.registerComponent('securitySchemes', 'bearerAuth', {
  type: 'http',
  scheme: 'bearer',
  bearerFormat: 'JWT',
  description: 'Nhập Access Token vào đây',
});

// 2. Health
registry.registerPath({
  method: 'get',
  path: '/health',
  tags: ['Health'],
  summary: 'Kiểm tra tình trạng kết nối Database & Redis',
  responses: {
    200: { description: 'Hệ thống hoạt động bình thường' },
    503: { description: 'Có sự cố kết nối Database hoặc Redis' },
  },
});

// 3. Auth
registry.registerPath({
  method: 'post',
  path: '/auth/register',
  tags: ['Auth'],
  summary: 'Đăng ký tài khoản người dùng mới (UC01)',
  request: {
    body: {
      content: {
        'application/json': { schema: registerBodySchema },
      },
    },
  },
  responses: {
    201: { description: 'Đăng ký thành công' },
    409: { description: 'Email đã tồn tại' },
    422: { description: 'Dữ liệu không hợp lệ' },
  },
});

registry.registerPath({
  method: 'post',
  path: '/auth/login',
  tags: ['Auth'],
  summary: 'Đăng nhập hệ thống (UC02)',
  request: {
    body: {
      content: {
        'application/json': { schema: loginBodySchema },
      },
    },
  },
  responses: {
    200: { description: 'Đăng nhập thành công' },
    401: { description: 'Sai email hoặc mật khẩu' },
    403: { description: 'Tài khoản bị tạm khóa' },
  },
});

registry.registerPath({
  method: 'post',
  path: '/auth/google',
  tags: ['Auth'],
  summary: 'Đăng nhập bằng tài khoản Google (Google OAuth)',
  request: {
    body: {
      content: {
        'application/json': {
          schema: z.object({
            idToken: z.string().openapi({ example: 'eyJhbGciOiJSUzI1NiIs...' }),
          }),
        },
      },
    },
  },
  responses: {
    200: { description: 'Đăng nhập Google thành công' },
    401: { description: 'Token Google không hợp lệ' },
  },
});

registry.registerPath({
  method: 'post',
  path: '/auth/logout',
  tags: ['Auth'],
  summary: 'Đăng xuất hệ thống (UC03)',
  security: [{ [bearerAuth.name]: [] }],
  responses: {
    200: { description: 'Đăng xuất thành công' },
  },
});

registry.registerPath({
  method: 'post',
  path: '/auth/refresh-token',
  tags: ['Auth'],
  summary: 'Làm mới Access Token (UC33)',
  request: {
    body: {
      content: {
        'application/json': { schema: refreshTokenBodySchema },
      },
    },
  },
  responses: {
    200: { description: 'Làm mới token thành công' },
    401: { description: 'Token không hợp lệ hoặc hết hạn' },
  },
});

// 4. User
registry.registerPath({
  method: 'get',
  path: '/users/me',
  tags: ['User'],
  summary: 'Lấy thông tin tài khoản hiện tại & workspaces',
  security: [{ [bearerAuth.name]: [] }],
  responses: {
    200: { description: 'Thông tin hồ sơ' },
    401: { description: 'Chưa xác thực' },
  },
});

registry.registerPath({
  method: 'patch',
  path: '/users/me',
  tags: ['User'],
  summary: 'Cập nhật hồ sơ cá nhân (UC32)',
  security: [{ [bearerAuth.name]: [] }],
  request: {
    body: {
      content: {
        'application/json': { schema: updateProfileBodySchema },
      },
    },
  },
  responses: {
    200: { description: 'Cập nhật thành công' },
    401: { description: 'Chưa xác thực' },
  },
});

registry.registerPath({
  method: 'patch',
  path: '/users/me/password',
  tags: ['User'],
  summary: 'Đổi mật khẩu người dùng (UC04)',
  security: [{ [bearerAuth.name]: [] }],
  request: {
    body: {
      content: {
        'application/json': { schema: changePasswordBodySchema },
      },
    },
  },
  responses: {
    200: { description: 'Đổi mật khẩu thành công' },
    401: { description: 'Mật khẩu cũ không chính xác' },
  },
});

// 5. Workspace
registry.registerPath({
  method: 'post',
  path: '/workspaces',
  tags: ['Workspace'],
  summary: 'Tạo workspace mới (UC16)',
  security: [{ [bearerAuth.name]: [] }],
  request: {
    body: { content: { 'application/json': { schema: createWorkspaceBodySchema } } },
  },
  responses: {
    201: { description: 'Tạo thành công' },
    409: { description: 'Trùng tên workspace' },
  },
});

registry.registerPath({
  method: 'get',
  path: '/workspaces',
  tags: ['Workspace'],
  summary: 'Danh sách workspace của người dùng (UC35)',
  security: [{ [bearerAuth.name]: [] }],
  responses: { 200: { description: 'Thành công' } },
});

registry.registerPath({
  method: 'patch',
  path: '/workspaces/{workspaceId}',
  tags: ['Workspace'],
  summary: 'Cập nhật workspace (UC17)',
  security: [{ [bearerAuth.name]: [] }],
  request: {
    params: workspaceIdParamSchema,
    body: { content: { 'application/json': { schema: updateWorkspaceBodySchema } } },
  },
  responses: {
    200: { description: 'Cập nhật thành công' },
    403: { description: 'Không đủ quyền' },
  },
});

registry.registerPath({
  method: 'delete',
  path: '/workspaces/{workspaceId}',
  tags: ['Workspace'],
  summary: 'Xóa mềm workspace (UC18)',
  security: [{ [bearerAuth.name]: [] }],
  request: { params: workspaceIdParamSchema },
  responses: { 200: { description: 'Xóa thành công' } },
});

registry.registerPath({
  method: 'get',
  path: '/workspaces/{workspaceId}/members',
  tags: ['Workspace'],
  summary: 'Danh sách thành viên & lời mời chờ (UC19)',
  security: [{ [bearerAuth.name]: [] }],
  request: { params: workspaceIdParamSchema },
  responses: { 200: { description: 'Thành công' } },
});

registry.registerPath({
  method: 'post',
  path: '/workspaces/{workspaceId}/invites',
  tags: ['Workspace'],
  summary: 'Mời thành viên qua email (UC20)',
  security: [{ [bearerAuth.name]: [] }],
  request: {
    params: workspaceIdParamSchema,
    body: { content: { 'application/json': { schema: inviteMemberBodySchema } } },
  },
  responses: {
    201: { description: 'Đã gửi lời mời' },
    409: { description: 'Email đã là thành viên' },
  },
});

registry.registerPath({
  method: 'get',
  path: '/invites/{token}',
  tags: ['Workspace'],
  summary: 'Xem / chấp nhận lời mời (UC21)',
  request: { params: inviteTokenParamSchema },
  responses: {
    200: { description: 'Tham gia thành công hoặc cần đăng ký' },
    409: { description: 'Lời mời đã dùng hoặc hết hạn' },
  },
});

registry.registerPath({
  method: 'delete',
  path: '/workspaces/{workspaceId}/members/me',
  tags: ['Workspace'],
  summary: 'Rời workspace (UC22)',
  security: [{ [bearerAuth.name]: [] }],
  request: { params: workspaceIdParamSchema },
  responses: {
    200: { description: 'Rời thành công' },
    409: { description: 'Owner duy nhất' },
  },
});

registry.registerPath({
  method: 'patch',
  path: '/workspaces/{workspaceId}/members/{memberId}',
  tags: ['Workspace'],
  summary: 'Đổi vai trò thành viên (UC36)',
  security: [{ [bearerAuth.name]: [] }],
  request: {
    params: memberIdParamSchema,
    body: { content: { 'application/json': { schema: changeMemberRoleBodySchema } } },
  },
  responses: {
    200: { description: 'Cập nhật thành công' },
    409: { description: 'Hạ Owner duy nhất' },
  },
});

registry.registerPath({
  method: 'delete',
  path: '/workspaces/{workspaceId}/members/{memberId}',
  tags: ['Workspace'],
  summary: 'Xóa thành viên (UC23)',
  security: [{ [bearerAuth.name]: [] }],
  request: { params: memberIdParamSchema },
  responses: {
    200: { description: 'Xóa thành công' },
    409: { description: 'Owner duy nhất' },
  },
});

const generator = new OpenApiGeneratorV3(registry.definitions);

export const swaggerSpec = generator.generateDocument({
  openapi: '3.0.0',
  info: {
    title: 'Tài liệu API Nền tảng Marka AI',
    version: '1.0.0',
    description: 'Tài liệu API tự động từ Zod Schema cho Marka Platform',
  },
  servers: [{ url: `http://localhost:${env.PORT}/api/v1` }],
});

export default swaggerSpec;
