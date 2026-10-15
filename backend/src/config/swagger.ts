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
import {
  createPostBodySchema,
  updatePostBodySchema,
  listPostsQuerySchema,
  postIdParamSchema,
  postMediaParamSchema,
  reviewPostBodySchema,
} from '../modules/post/post.validation.js';

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
  method: 'post',
  path: '/workspaces/{workspaceId}/logo',
  tags: ['Workspace'],
  summary: 'Cập nhật logo workspace (UC17)',
  security: [{ [bearerAuth.name]: [] }],
  request: {
    params: workspaceIdParamSchema,
    body: {
      content: {
        'multipart/form-data': {
          schema: z.object({
            logo: z
              .any()
              .openapi({ type: 'string', format: 'binary', description: 'Ảnh JPG/PNG/WEBP, tối đa 2MB' }),
          }),
        },
      },
    },
  },
  responses: {
    200: { description: 'Cập nhật logo thành công' },
    400: { description: 'Chưa chọn ảnh, sai định dạng hoặc quá 2MB' },
    403: { description: 'Không đủ quyền' },
    404: { description: 'Workspace không tồn tại' },
  },
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

// 6. Posts (UC05, UC07, UC08, UC09, UC10, UC37)
const postMediaUploadBodySchema = z.object({
  file: z.any().openapi({ type: 'string', format: 'binary', description: 'Ảnh JPG/PNG/WEBP, tối đa 10MB' }),
});

registry.registerPath({
  method: 'post',
  path: '/workspaces/{workspaceId}/posts',
  tags: ['Post'],
  summary: 'Tạo bản nháp bài viết (UC05)',
  security: [{ [bearerAuth.name]: [] }],
  request: {
    params: workspaceIdParamSchema,
    body: { content: { 'application/json': { schema: createPostBodySchema } } },
  },
  responses: {
    201: { description: 'Tạo bản nháp thành công' },
    403: { description: 'Không phải thành viên workspace' },
    422: { description: 'Dữ liệu không hợp lệ' },
  },
});

registry.registerPath({
  method: 'get',
  path: '/workspaces/{workspaceId}/posts',
  tags: ['Post'],
  summary: 'Danh sách bài viết: phân trang, tìm kiếm, lọc (UC09)',
  security: [{ [bearerAuth.name]: [] }],
  request: {
    params: workspaceIdParamSchema,
    query: listPostsQuerySchema,
  },
  responses: {
    200: { description: 'Thành công (posts + meta phân trang)' },
    403: { description: 'Không phải thành viên workspace' },
  },
});

registry.registerPath({
  method: 'get',
  path: '/workspaces/{workspaceId}/posts/{postId}',
  tags: ['Post'],
  summary: 'Chi tiết bài viết kèm ảnh (UC08)',
  security: [{ [bearerAuth.name]: [] }],
  request: { params: postIdParamSchema },
  responses: {
    200: { description: 'Thành công' },
    404: { description: 'Bài viết không tồn tại' },
  },
});

registry.registerPath({
  method: 'patch',
  path: '/workspaces/{workspaceId}/posts/{postId}',
  tags: ['Post'],
  summary: 'Cập nhật nội dung bài viết (UC07)',
  security: [{ [bearerAuth.name]: [] }],
  request: {
    params: postIdParamSchema,
    body: { content: { 'application/json': { schema: updatePostBodySchema } } },
  },
  responses: {
    200: { description: 'Cập nhật thành công' },
    403: { description: 'Không có quyền thay đổi bài viết' },
    404: { description: 'Bài viết không tồn tại' },
    409: { description: 'Chỉ sửa được bài ở trạng thái bản nháp hoặc bị từ chối' },
  },
});

registry.registerPath({
  method: 'delete',
  path: '/workspaces/{workspaceId}/posts/{postId}',
  tags: ['Post'],
  summary: 'Xóa mềm bài viết (UC10)',
  security: [{ [bearerAuth.name]: [] }],
  request: { params: postIdParamSchema },
  responses: {
    200: { description: 'Xóa thành công' },
    403: { description: 'Không có quyền xóa bài viết' },
    404: { description: 'Bài viết không tồn tại' },
    409: { description: 'Chỉ sửa được bài ở trạng thái bản nháp hoặc bị từ chối' },
  },
});

registry.registerPath({
  method: 'post',
  path: '/workspaces/{workspaceId}/posts/{postId}/media',
  tags: ['Post'],
  summary: 'Tải ảnh lên cho bài viết (UC37)',
  security: [{ [bearerAuth.name]: [] }],
  request: {
    params: postIdParamSchema,
    body: { content: { 'multipart/form-data': { schema: postMediaUploadBodySchema } } },
  },
  responses: {
    201: { description: 'Tải ảnh lên thành công' },
    400: { description: 'Chưa chọn ảnh, sai định dạng hoặc quá 10MB' },
    403: { description: 'Không có quyền thay đổi bài viết' },
    404: { description: 'Bài viết không tồn tại' },
    409: { description: 'Chỉ sửa được bài ở trạng thái bản nháp hoặc bị từ chối' },
  },
});

registry.registerPath({
  method: 'delete',
  path: '/workspaces/{workspaceId}/posts/{postId}/media/{mediaId}',
  tags: ['Post'],
  summary: 'Xóa ảnh của bài viết',
  security: [{ [bearerAuth.name]: [] }],
  request: { params: postMediaParamSchema },
  responses: {
    200: { description: 'Xóa thành công' },
    403: { description: 'Không có quyền thay đổi bài viết' },
    404: { description: 'Bài viết hoặc ảnh không tồn tại' },
    409: { description: 'Chỉ sửa được bài ở trạng thái bản nháp hoặc bị từ chối' },
  },
});

// 7. Approval flow (UC11, UC14)
registry.registerPath({
  method: 'post',
  path: '/workspaces/{workspaceId}/posts/{postId}/submit',
  tags: ['Post'],
  summary: 'Gửi duyệt bài viết (UC11)',
  security: [{ [bearerAuth.name]: [] }],
  request: { params: postIdParamSchema },
  responses: {
    200: { description: 'Chuyển bài viết sang trạng thái chờ duyệt (PENDING)' },
    403: { description: 'Không có quyền gửi duyệt bài viết' },
    404: { description: 'Bài viết không tồn tại' },
    409: { description: 'Không thể chuyển trạng thái bài viết này' },
  },
});

registry.registerPath({
  method: 'patch',
  path: '/workspaces/{workspaceId}/posts/{postId}/review',
  tags: ['Post'],
  summary: 'Duyệt hoặc từ chối bài viết (UC14)',
  security: [{ [bearerAuth.name]: [] }],
  request: {
    params: postIdParamSchema,
    body: { content: { 'application/json': { schema: reviewPostBodySchema } } },
  },
  responses: {
    200: { description: 'Duyệt / từ chối thành công' },
    403: { description: 'Chỉ Workspace Owner được duyệt bài' },
    404: { description: 'Bài viết không tồn tại' },
    409: { description: 'Bài viết không ở trạng thái chờ duyệt' },
    422: { description: 'Thiếu lý do khi từ chối bài viết' },
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
