# Đặc tả hệ thống Marka — Mục lục

> **Phạm vi:** mô tả **đúng code đang chạy** trong `backend/src` và `backend/prisma/schema.prisma`.
> Phần chưa có endpoint/service chỉ nằm trong mục **Roadmap**, không mô tả như tính năng đã hoạt động.
>
> Nguồn sự thật: `backend/src/routes/index.ts`, `backend/src/modules/**`, `backend/src/middlewares/**`, `backend/src/config/**`, `backend/src/workers/**`, `backend/prisma/schema.prisma`.
> Tài liệu liên quan: [API Documentation](../api_documentation.md), [Kiến trúc hệ thống](../architecture.md).

Base URL của toàn bộ API: `/api/v1`.

---

## 1. Tác nhân & vai trò

| Tác nhân | Cấp | Quyền thực tế trong code |
| :--- | :--- | :--- |
| **Guest** | Chưa đăng nhập | Đăng ký, đăng nhập (email/mật khẩu hoặc Google), mở link mời `GET /invites/:token`, xem `GET /health`, nhận email mời |
| **User** | Hệ thống (`User.systemRole = USER`) | Toàn bộ chức năng của thành viên trong các workspace mình thuộc về |
| **System Admin** | Hệ thống (`User.systemRole = SYSTEM_ADMIN`) | `requireWorkspaceRole` coi như `OWNER` ở mọi workspace; dùng `requireRoles('SYSTEM_ADMIN')` cho toàn bộ route `/admin/*` và thấy mục menu quản trị trên frontend |
| **Workspace Owner** | Workspace (`WorkspaceMember.role = OWNER`) | Sửa/xoá workspace, mời/xoá thành viên, đổi vai trò, cấu hình Brand Voice, kết nối/ngắt kênh, **duyệt/từ chối bài**, thao tác mọi bài viết, **nạp credit và huỷ đơn mình tạo** |
| **Content Creator** | Workspace (`WorkspaceMember.role = CONTENT_CREATOR`) | Xem thành viên/bài viết/Brand Voice/kênh; tạo bài; sửa/xoá/gửi duyệt **bài do mình tạo**; upload/xoá ảnh của bài đó; **nạp credit và huỷ đơn mình tạo** |

Quy tắc cố định, không có vai trò tuỳ chỉnh:

- Chỉ 2 vai trò workspace: `OWNER`, `CONTENT_CREATOR`.
- `WorkspaceMember.allowDirectPublish` **đã có trong schema** (Owner = `true`, Creator = `false` khi tạo) nhưng **chưa được dùng để cấp quyền** ở bất kỳ luồng nào và **không trả ra API**; cột này được giữ làm reserved cho tương lai.
- Không thể rời workspace, bị xoá, hoặc bị hạ vai trò nếu là **Owner cuối cùng**.
- Mỗi tài khoản mới (đăng ký local hoặc Google lần đầu) được tạo kèm **một workspace mặc định** với chính họ là `OWNER` (cùng transaction).

---

## 2. Quy ước chung

### 2.1. Định dạng response

Mọi response đi qua `ApiResponse` (`backend/src/utils/ApiResponse.ts`).

Thành công:

```json
{
  "status": "success",
  "message": "Lấy danh sách bài viết thành công",
  "data": { "posts": [] },
  "meta": { "page": 1, "limit": 10, "total": 0, "totalPages": 0 }
}
```

- `data` chỉ có mặt khi khác `null`/`undefined`; `meta` chỉ có ở API phân trang.
- Lỗi: `status = "fail"` với 4xx, `status = "error"` với 5xx.

```json
{ "status": "fail", "message": "Bạn không có quyền thực hiện hành động này trong Workspace" }
```

- Lỗi validation Zod trả `422` kèm mảng lỗi theo field:

```json
{
  "status": "fail",
  "message": "Dữ liệu không hợp lệ",
  "errors": [{ "field": "email", "message": "Email không hợp lệ" }]
}
```

- Lỗi Prisma `P2002` → `409` `"Dữ liệu đã tồn tại trong hệ thống"`; `P2025` → `404` `"Không tìm thấy dữ liệu"`.
- Lỗi không xác định → `500` `"Đã có lỗi hệ thống xảy ra"` (chỉ kèm `errors.debug` khi `NODE_ENV=development`).
- Route không tồn tại → `404` `"Đường dẫn <path> không tồn tại"`.

### 2.2. Xác thực

- Access token: JWT ký bằng `JWT_ACCESS_SECRET`, hạn mặc định **15 phút**, payload `{ id, email, systemRole, tokenVersion }`, gửi qua header `Authorization: Bearer <accessToken>`.
- Refresh token: JWT ký bằng `JWT_REFRESH_SECRET`, hạn mặc định **7 ngày**, payload `{ id, tokenVersion }`, lưu trong cookie `refreshToken` (`HttpOnly`; `SameSite=Lax` ở dev, `None` + `Secure` ở production; `maxAge` 7 ngày).
- **Không có bảng refresh token.** Thu hồi phiên bằng cách tăng `User.tokenVersion` (logout, đổi mật khẩu) — mọi access/refresh token cũ mất hiệu lực ở request kế tiếp vì `requireAuth` kiểm tra `tokenVersion` với DB.
- Tài khoản `isSuspended = true` bị chặn ở mọi request đã xác thực (`403`).
- `optionalAuth` dùng cho route công khai cần biết người gọi (`GET /invites/:token`): token sai/hết hạn bị bỏ qua, request tiếp tục như khách.

### 2.3. Phạm vi workspace (đa tenant)

Middleware `requireWorkspaceRole(...roles)` lấy `workspaceId` theo thứ tự:

1. header `x-workspace-id`
2. `req.params.workspaceId`
3. `req.query.workspaceId`
4. `req.body.workspaceId`

Sau đó:

- Nếu có **cả** header và param mà khác nhau → `403` `"Workspace ID không khớp giữa header và URL"`.
- Không tìm thấy `workspaceId` → `400` `"Vui lòng cung cấp Workspace ID (qua header x-workspace-id hoặc params)"`.
- `SYSTEM_ADMIN` được đặt `workspaceRole = 'OWNER'` và đi tiếp mà không cần là thành viên.
- Người dùng không phải thành viên → `403` `"Bạn không phải là thành viên của Workspace này"`.
- Có truyền danh sách role mà vai trò không khớp → `403` `"Bạn không có quyền thực hiện hành động này trong Workspace"`.

Mọi truy vấn dữ liệu nghiệp vụ đều lọc theo `workspaceId`; không có endpoint nào đọc chéo workspace.

### 2.4. Thời gian, xoá mềm, phân trang

- **Thời gian:** DB lưu `DateTime`; API trả **ISO-8601 UTC** (`2026-10-20T12:00:00.000Z`). Client tự quy đổi múi giờ.
- **Xoá mềm:** áp dụng cho `Workspace`, `Post`, `MediaAsset`, `CreditPackage` (trường `deletedAt`).
  Prisma client được mở rộng (`config/prismaExtensions.ts`) tự thêm `deletedAt: null` vào **truy vấn đọc trực tiếp** trên 4 model (`findFirst`, `findMany`, `findUnique`, `count`, `aggregate`, `groupBy`...).
  Điều kiện này **không tự áp dụng cho dữ liệu lồng** nạp qua `include`/`select` quan hệ; repository phải lọc thủ công nếu cần.
  Đọc bản ghi đã xoá phải dùng `basePrisma` (export từ `config/db.ts`); **chưa có endpoint khôi phục**.
- **Workspace đã xoá mềm:** biến mất khỏi `GET /workspaces`; mọi route đi qua `requireWorkspaceRole` trả `404 "Workspace không tồn tại hoặc đã bị xoá"` (kể cả `SYSTEM_ADMIN`).
- **Phân trang:** `page` (mặc định 1), `limit` (mặc định 10, tối đa 50); thông tin phân trang nằm trong `meta` với `{ page, limit, total, totalPages }`. Hiện `GET .../posts`, `GET .../billing/transactions`, `GET /users/me/notifications`, `GET .../admin/users`, `GET .../admin/workspaces`, `GET .../admin/audit-logs` và `GET .../schedules` dùng phân trang.

### 2.5. Rate limit, audit, tác vụ nền

- `apiLimiter`: 200 request/phút/IP cho toàn bộ `/api/`.
- `authLimiter`: 15 request/15 phút/IP cho `POST /auth/register` và `POST /auth/google`.
- `loginLimiter`: 5 lần **thất bại**/15 phút theo khoá `IP:email` cho `POST /auth/login` (đăng nhập đúng không bị tính).
- Hai limiter xác thực bị **bỏ qua khi `NODE_ENV=test`**. Vượt giới hạn → `429` với `{ "status": "fail", "message": "..." }`.
- **Audit log:** service gọi `auditService.recordAuditLog(...)`. Ghi audit lỗi **không làm hỏng request** (chỉ `console.warn`). Đọc audit log qua `/admin/audit-logs` (System Admin) và `/workspaces/:workspaceId/audit-logs` (Owner).
- **Queue/worker:** BullMQ có 5 queue (`content-generation-queue`, `schedule-queue`, `analytics-queue`, `channel-maintenance-queue`, `task-reminder-queue`). `scheduleWorker` xử lý đăng bài; `contentWorker` xử lý job `ai:text`/`ai:image` (Gemini/Cloudflare, hoàn credit khi thất bại); `analyticsWorker` đồng bộ `PostMetric` (job lặp mỗi 6 giờ + job kích hoạt từ `POST .../analytics/sync`); `channelWorker` gia hạn token Threads; `taskReminderWorker` gửi nhắc hạn công việc. Billing **không dùng queue**. Email hiện gửi đồng bộ trong request. Khi `NODE_ENV=test`, BullMQ dùng prefix `marka-test` (production dùng `bull`).
- **Health:** `GET /health` công khai, kiểm tra PostgreSQL (`SELECT 1`) và Redis (`PING`); trả `503` (status `error`, kèm `data`) nếu một trong hai lỗi.
- **Thông báo in-app (UC37):** API hộp thư của chính người dùng (`GET /users/me/notifications`, `GET .../unread-count`, `PATCH .../:id/read`, `PATCH .../read-all`); lọc theo `workspaceId` yêu cầu là thành viên workspace.

---

## 3. Danh mục Use Case (UC01 – UC42)

Cột **Trạng thái**:

- **Đã triển khai** — có endpoint và xử lý đầy đủ trong code.
- **Một phần** — có endpoint nhưng thiếu phạm vi/trạng thái so với mô tả nghiệp vụ.
- **Chưa triển khai (Roadmap)** — không có route/service; chỉ có bảng trong schema hoặc hoàn toàn chưa có.

| Mã UC | Tên chức năng | Tác nhân chính | Trạng thái | Endpoint hiện có (nếu có) | Spec |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **UC01** | Register | Guest | Đã triển khai | `POST /auth/register` | [01](./01-auth-workspace.md) |
| **UC02** | Login | Guest | Đã triển khai | `POST /auth/login` (email/mật khẩu) | [01](./01-auth-workspace.md) |
| **UC03** | Login with Google | Guest | Đã triển khai | `POST /auth/google` | [01](./01-auth-workspace.md) |
| **UC04** | Logout | User | Đã triển khai | `POST /auth/logout`, `POST /users/me/logout-all` | [01](./01-auth-workspace.md) |
| **UC05** | Change Password | User | Đã triển khai | `PATCH /users/me/password` | [01](./01-auth-workspace.md) |
| **UC06** | Create Content | Creator, Owner | Đã triển khai | `POST /workspaces/:workspaceId/posts` | [02](./02-content-media.md) |
| **UC07** | Generate AI Content | Creator, Owner | Đã triển khai (text + ảnh) | `POST /workspaces/:workspaceId/ai/text`, `POST /workspaces/:workspaceId/ai/images` | [03](./03-ai-brandvoice.md) |
| **UC08** | Update Content | Creator, Owner | Đã triển khai | `PATCH /workspaces/:workspaceId/posts/:postId` | [02](./02-content-media.md) |
| **UC09** | View Content | Creator, Owner | Đã triển khai | `GET /workspaces/:workspaceId/posts/:postId` | [02](./02-content-media.md) |
| **UC10** | Search Content | Creator, Owner | Đã triển khai | `GET /workspaces/:workspaceId/posts` | [02](./02-content-media.md) |
| **UC11** | Delete Content | Creator, Owner | Một phần | `DELETE /workspaces/:workspaceId/posts/:postId` — Creator chỉ `DRAFT`/`REJECTED`; Owner mọi trạng thái trừ bài đang đăng | [02](./02-content-media.md) |
| **UC12** | Submit Content for Approval | Creator, Owner | Đã triển khai | `POST /workspaces/:workspaceId/posts/:postId/submit` | [02](./02-content-media.md) |
| **UC13** | Schedule Content | Creator (bài của mình), Owner | Đã triển khai | `POST /workspaces/:workspaceId/posts/:postId/schedules`, `PATCH /workspaces/:workspaceId/schedules/:scheduleId` | [04](./04-social-publishing.md) |
| **UC14** | View Content Schedule | Mọi thành viên | Đã triển khai | `GET /workspaces/:workspaceId/schedules`, trang `/schedule`, kéo-thả đổi ngày + modal đổi giờ | [04](./04-social-publishing.md) |
| **UC15** | Review Content | Owner | Đã triển khai | `PATCH /workspaces/:workspaceId/posts/:postId/review` | [02](./02-content-media.md) |
| **UC16** | Post Content to Social Media | Creator (bài của mình), Owner | Đã triển khai (Facebook Page + Threads) | Worker `schedule-queue` gọi Graph API/Threads API | [04](./04-social-publishing.md) |
| **UC17** | Create Workspace | User | Đã triển khai | `POST /workspaces` | [01](./01-auth-workspace.md) |
| **UC18** | Update Workspace | Owner | Đã triển khai | `PATCH /workspaces/:workspaceId` | [01](./01-auth-workspace.md) |
| **UC19** | Delete Workspace | Owner | Đã triển khai | `DELETE /workspaces/:workspaceId` | [01](./01-auth-workspace.md) |
| **UC20** | View Members in Workspace | Creator, Owner | Đã triển khai | `GET /workspaces/:workspaceId/members` | [01](./01-auth-workspace.md) |
| **UC21** | Invite Member | Owner | Đã triển khai | `POST /workspaces/:workspaceId/invites` | [01](./01-auth-workspace.md) |
| **UC22** | Accept Invitation | Guest, User | Đã triển khai | `GET /invites/:token` | [01](./01-auth-workspace.md) |
| **UC23** | Leave Workspace | Creator, Owner | Đã triển khai | `DELETE /workspaces/:workspaceId/members/me` | [01](./01-auth-workspace.md) |
| **UC24** | Remove Member | Owner | Đã triển khai | `DELETE /workspaces/:workspaceId/members/:memberId` | [01](./01-auth-workspace.md) |
| **UC25** | Create Brand Voice | Owner | Đã triển khai | `PUT /workspaces/:workspaceId/brand-voice` (upsert) | [03](./03-ai-brandvoice.md) |
| **UC26** | Update Brand Voice | Owner | Đã triển khai | `PUT /workspaces/:workspaceId/brand-voice` (ghi đè toàn bộ) | [03](./03-ai-brandvoice.md) |
| **UC27** | View Brand Voice | Creator, Owner | Đã triển khai | `GET /workspaces/:workspaceId/brand-voice`, `GET .../brand-voice/insights` | [03](./03-ai-brandvoice.md) |
| **UC28** | View Connected Channels | Creator, Owner | Đã triển khai | `GET /workspaces/:workspaceId/channels`, `GET/PATCH .../channels/:channelId`, `POST .../channels/:channelId/refresh` | [04](./04-social-publishing.md) |
| **UC29** | Connect Social Channels | Owner | Một phần | `GET /channels/:platform/oauth/url`, `GET /channels/:platform/oauth/callback`, `GET /channels/:platform/oauth/session/:sessionId`, `POST /channels/:platform/oauth/session/:sessionId/connect` — **Facebook + Threads** | [04](./04-social-publishing.md) |
| **UC30** | Disconnect Social Channel | Owner | Đã triển khai | `DELETE /channels/:channelId` | [04](./04-social-publishing.md) |
| **UC31** | Top Up Credits | Mọi thành viên | Đã triển khai | `POST /workspaces/:workspaceId/billing/orders`, `GET .../billing/orders/:orderId`, `POST .../billing/orders/:orderId/cancel` | [06](./06-billing-payos.md) |
| **UC32** | View Dashboard & Audit Log | System Admin, Owner | Đã triển khai | `/admin/stats`, `/admin/users`, `/admin/users/:userId/suspend`, `/admin/users/:userId/tester-invite`, `/admin/workspaces`, `/admin/audit-logs`, `/workspaces/:workspaceId/audit-logs` | [07](./07-admin-analytics.md) |
| **UC33** | Update Profile | User | Đã triển khai | `GET /users/me`, `PATCH /users/me`, `POST /users/me/avatar`, `DELETE /users/me` | [01](./01-auth-workspace.md) |
| **UC34** | List Workspaces | User | Đã triển khai | `GET /workspaces` | [01](./01-auth-workspace.md) |
| **UC35** | Change Member Role | Owner | Đã triển khai | `PATCH /workspaces/:workspaceId/members/:memberId` | [01](./01-auth-workspace.md) |
| **UC36** | Cancel Scheduled Post | Creator (bài của mình), Owner | Đã triển khai | `DELETE /workspaces/:workspaceId/schedules/:scheduleId` | [04](./04-social-publishing.md) |
| **UC37** | View Notifications | User | Đã triển khai (hộp thư in-app; chưa realtime) | `GET /users/me/notifications`, `GET .../notifications/unread-count`, `PATCH .../notifications/:notificationId/read`, `PATCH .../notifications/read-all` | [05](./05-notifications-email.md) |
| **UC38** | View Workspace Performance Overview | Creator, Owner | Đã triển khai | `GET /workspaces/:workspaceId/analytics/overview`, `GET .../analytics/suggestions`, `POST .../analytics/sync`, hiển thị trong Dashboard `/` | [08](./08-post-analytics.md) |
| **UC39** | List Credit Packages | Mọi thành viên | Đã triển khai | `GET /workspaces/:workspaceId/billing` | [06](./06-billing-payos.md) |
| **UC40** | View Credit Balance & History | Thành viên workspace | Đã triển khai | `GET /workspaces/:workspaceId/billing`, `GET .../billing/transactions` | [06](./06-billing-payos.md) |
| **UC41** | Assign & Manage Content Tasks | Owner | Đã triển khai | `PATCH .../posts/:postId/assign`, `GET .../tasks/board`, `POST .../tasks`, `PATCH/DELETE .../tasks/:taskId`, `PATCH .../tasks/:taskId/post` | [02](./02-content-media.md) |
| **UC42** | Update Task Status | Assignee, Owner | Đã triển khai | `PATCH .../posts/:postId/task-status`, `PATCH .../tasks/:taskId/status` | [02](./02-content-media.md) |

### 3.1. UC con / biến thể

| Mã | Tên | Trạng thái | Ghi chú |
| :--- | :--- | :--- | :--- |
| UC29a | Connect Facebook Page (thật) | Đã triển khai | Qua OAuth, chọn nhiều Page, token mã hoá AES-256-GCM |
| UC29c | Connect Threads (thật) | Đã triển khai | OAuth single-account, token mã hoá, tự gia hạn qua channel-maintenance queue |
| UC29b | Connect simulated channels (Instagram/TikTok/Zalo) | Chưa triển khai (Roadmap) | Schema có `ChannelType.SIMULATED`, `SocialPlatform`; không có endpoint |
| UC31a | Create Order | Đã triển khai | Tạo `Order(PENDING)` + link PayOS |
| UC31b | PayOS Webhook | Đã triển khai | `POST /webhooks/payos`, verify chữ ký, idempotent |
| UC31c | Poll Order Status | Đã triển khai | `GET /billing/orders/:orderId` đối soát PayOS |
| UC32a | Admin Dashboard | Đã triển khai | `GET /admin/stats` — user/workspace/bài/kênh/doanh thu 30 ngày |
| UC32b | View Audit Log | Đã triển khai | `/admin/audit-logs` (toàn hệ thống), `/workspaces/:workspaceId/audit-logs` (Owner) |

**Thống kê:** 42 UC — 40 đã triển khai · 2 một phần (UC11, UC29) · 0 chưa triển khai. UC37 là hộp thư thông báo in-app; realtime (WebSocket/SSE) vẫn ngoài phạm vi.

> Refresh token là cơ chế duy trì phiên, không phải use case; chi tiết ở [01 §1.5](./01-auth-workspace.md#15-refresh-token).

---

## 4. Tổng hợp theo phân hệ

| Phân hệ | Tài liệu | Đã có trong code |
| :--- | :--- | :--- |
| 1. Xác thực & Workspace | [01-auth-workspace.md](./01-auth-workspace.md) | Đăng ký/đăng nhập/Google/logout/logout-all/refresh, hồ sơ (avatar, xoá tài khoản), đổi mật khẩu, workspace, thành viên, lời mời |
| 2. Nội dung & Media | [02-content-media.md](./02-content-media.md) | CRUD bài viết, upload/xoá ảnh theo bài, state machine duyệt bài, notification + audit |
| 3. Brand Voice & AI | [03-ai-brandvoice.md](./03-ai-brandvoice.md) | Brand Voice; trợ lý AI sinh text/ảnh, trừ/hoàn credit, queue + polling |
| 4. Kênh & Đăng bài | [04-social-publishing.md](./04-social-publishing.md) | Facebook Page + Threads OAuth; đăng ngay/lên lịch/đổi giờ nhiều kênh, worker BullMQ, trang `/schedule`; kéo-thả theo khung giờ là Roadmap |
| 5. Email & Thông báo | [05-notifications-email.md](./05-notifications-email.md) | Email mời, email duyệt/từ chối (Resend); ghi notification in-app + API hộp thư/chuông thông báo (UC37 — hộp thư in-app, chưa realtime) |
| 6. Credit & PayOS | [06-billing-payos.md](./06-billing-payos.md) | Module billing, gói nạp credit, PayOS, webhook, trang `/billing` |
| 7. Quản trị & Báo cáo | [07-admin-analytics.md](./07-admin-analytics.md) | Module admin: dashboard hệ thống, danh sách/khoá user, danh sách workspace, API đọc audit log (admin + Owner); frontend `/admin` (tổng quan, người dùng, workspace, audit log hệ thống) |
| 8. Post Analytics | [08-post-analytics.md](./08-post-analytics.md) | Module analytics: đồng bộ `PostMetric` từ Facebook/Threads qua queue, endpoint overview/suggestions/sync; hiển thị trong Dashboard `/` (KPI, biểu đồ, độ phủ, gợi ý) |

---

## 5. Roadmap tổng hợp

Các mục sau **chưa có trong code** (chi tiết ở file tương ứng):

1. **AI (03):** Viral Score, sinh lại/viết tiếp, nhiều ảnh/lần, chọn tỉ lệ/style, lịch sử AI UI.
2. **Đăng bài (04):** Instagram/TikTok/Zalo (kể cả giả lập), kéo-thả theo khung giờ, video, làm mới token Facebook tự động.
3. **Thông báo (05):** email nhắc hạn gói/hết credit/lịch đăng, đẩy email qua `email-queue`; realtime (WebSocket/SSE) vẫn ngoài phạm vi (UC37 hộp thư in-app đã có).
4. **Post Analytics nâng cao (08):** snapshot chỉ số theo thời gian, làm mới từng bài, chi tiết bài, xử lý rate limit; top bài đã có trong Brand Voice Insights; n8n vẫn ngoài phạm vi (UC38 cơ bản đã có).
5. **Nâng cấp giao việc:** nhắc hạn qua email (board Kanban, độ ưu tiên và nhắc hạn in-app đã có).
6. **Quản trị nâng cao (07):** đổi `systemRole`, xoá/khôi phục workspace, xuất audit log, chính sách lưu trữ log.

---

## 6. Quan hệ với tài liệu khác

- **Endpoint & ví dụ request/response:** [`docs/api_documentation.md`](../api_documentation.md) — danh sách đầy đủ endpoint đang có.
- **Kiến trúc, middleware, transaction, xoá mềm:** [`docs/architecture.md`](../architecture.md).
- **Mô hình dữ liệu & quan hệ:** `backend/prisma/schema.prisma`.
- Khi code thay đổi, cập nhật **cả** spec này và `api_documentation.md` để tránh lệch nguồn sự thật.
