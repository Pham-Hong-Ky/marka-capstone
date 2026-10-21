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
| **System Admin** | Hệ thống (`User.systemRole = SYSTEM_ADMIN`) | `requireWorkspaceRole` coi như `OWNER` ở mọi workspace. **Chưa có module/endpoint quản trị nào** dùng `requireRoles`; giá trị này hiện chỉ có trong schema và middleware |
| **Workspace Owner** | Workspace (`WorkspaceMember.role = OWNER`) | Sửa/xoá workspace, mời/xoá thành viên, đổi vai trò, cấu hình Brand Voice, kết nối/ngắt kênh, **duyệt/từ chối bài**, thao tác mọi bài viết |
| **Content Creator** | Workspace (`WorkspaceMember.role = CONTENT_CREATOR`) | Xem thành viên/bài viết/Brand Voice/kênh; tạo bài; sửa/xoá/gửi duyệt **bài do mình tạo**; upload/xoá ảnh của bài đó |

Quy tắc cố định, không có vai trò tuỳ chỉnh:

- Chỉ 2 vai trò workspace: `OWNER`, `CONTENT_CREATOR`.
- `WorkspaceMember.allowDirectPublish` **đã có trong schema** (Owner = `true`, Creator = `false` khi tạo) nhưng **chưa được dùng để cấp quyền** ở bất kỳ luồng nào; hiện chỉ trả ra trong `GET /workspaces/:workspaceId/members`.
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
- **Workspace đã xoá mềm:** biến mất khỏi `GET /workspaces`; các API có kiểm tra workspace tồn tại (sửa/xoá workspace, danh sách thành viên, mời thành viên, Brand Voice) trả `404`.
  Tuy nhiên `requireWorkspaceRole` **không** kiểm tra `Workspace.deletedAt`, nên các route chỉ dựa vào membership (bài viết, kênh, rời workspace) vẫn thao tác được trên dữ liệu cũ của workspace đã xoá — đây là giới hạn hiện tại của code, chưa có cơ chế chặn tập trung.
- **Phân trang:** `page` (mặc định 1), `limit` (mặc định 10, tối đa 50); thông tin phân trang nằm trong `meta` với `{ page, limit, total, totalPages }`. Hiện chỉ `GET .../posts` dùng phân trang.

### 2.5. Rate limit, audit, tác vụ nền

- `apiLimiter`: 200 request/phút/IP cho toàn bộ `/api/`.
- `authLimiter`: 15 request/15 phút/IP cho `POST /auth/register` và `POST /auth/google`.
- `loginLimiter`: 5 lần **thất bại**/15 phút theo khoá `IP:email` cho `POST /auth/login` (đăng nhập đúng không bị tính).
- Hai limiter xác thực bị **bỏ qua khi `NODE_ENV=test`**. Vượt giới hạn → `429` với `{ "status": "fail", "message": "..." }`.
- **Audit log:** service gọi `auditService.recordAuditLog(...)`. Ghi audit lỗi **không làm hỏng request** (chỉ `console.warn`). Chưa có API đọc audit log.
- **Queue/worker:** BullMQ có 3 queue (`content-generation-queue`, `publishing-queue`, `email-queue`) và processor khung (chỉ log + `updateProgress(100)` + trả `{ success: true }`). **Chưa module nào enqueue job**; email hiện gửi đồng bộ trong request.
- **Health:** `GET /health` công khai, kiểm tra PostgreSQL (`SELECT 1`) và Redis (`PING`); trả `503` (status `error`, kèm `data`) nếu một trong hai lỗi.

---

## 3. Danh mục Use Case (UC01 – UC43)

Cột **Trạng thái**:

- **Đã triển khai** — có endpoint và xử lý đầy đủ trong code.
- **Một phần** — có endpoint nhưng thiếu phạm vi/trạng thái so với mô tả nghiệp vụ.
- **Chưa triển khai (Roadmap)** — không có route/service; chỉ có bảng trong schema hoặc hoàn toàn chưa có.

| Mã UC | Tên chức năng | Tác nhân chính | Trạng thái | Endpoint hiện có (nếu có) | Spec |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **UC01** | Register | Guest | Đã triển khai | `POST /auth/register` | [01](./01-auth-workspace.md) |
| **UC02** | Login | Guest | Đã triển khai | `POST /auth/login` (email/mật khẩu) | [01](./01-auth-workspace.md) |
| **UC03** | Login with Google | Guest | Đã triển khai | `POST /auth/google` | [01](./01-auth-workspace.md) |
| **UC04** | Logout | User | Đã triển khai | `POST /auth/logout` | [01](./01-auth-workspace.md) |
| **UC05** | Change Password | User | Đã triển khai | `PATCH /users/me/password` | [01](./01-auth-workspace.md) |
| **UC06** | Create Content | Creator, Owner | Đã triển khai | `POST /workspaces/:workspaceId/posts` | [02](./02-content-media.md) |
| **UC07** | Generate AI Content | Creator, Owner | Chưa triển khai (Roadmap) | — | [03](./03-ai-brandvoice.md) |
| **UC08** | Update Content | Creator, Owner | Đã triển khai | `PATCH /workspaces/:workspaceId/posts/:postId` | [02](./02-content-media.md) |
| **UC09** | View Content | Creator, Owner | Đã triển khai | `GET /workspaces/:workspaceId/posts/:postId` | [02](./02-content-media.md) |
| **UC10** | Search Content | Creator, Owner | Đã triển khai | `GET /workspaces/:workspaceId/posts` | [02](./02-content-media.md) |
| **UC11** | Delete Content | Creator, Owner | Một phần | `DELETE /workspaces/:workspaceId/posts/:postId` (chỉ `DRAFT`/`REJECTED`) | [02](./02-content-media.md) |
| **UC12** | Submit Content for Approval | Creator, Owner | Đã triển khai | `POST /workspaces/:workspaceId/posts/:postId/submit` | [02](./02-content-media.md) |
| **UC13** | Schedule Content | Owner | Chưa triển khai (Roadmap) | — | [04](./04-social-publishing.md) |
| **UC14** | View Content Schedule | Creator, Owner | Chưa triển khai (Roadmap) | — | [04](./04-social-publishing.md) |
| **UC15** | Review Content | Owner | Đã triển khai | `PATCH /workspaces/:workspaceId/posts/:postId/review` | [02](./02-content-media.md) |
| **UC16** | Post Content to Social Media | Owner | Chưa triển khai (Roadmap) | — | [04](./04-social-publishing.md) |
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
| **UC27** | View Brand Voice | Creator, Owner | Đã triển khai | `GET /workspaces/:workspaceId/brand-voice` | [03](./03-ai-brandvoice.md) |
| **UC28** | View Connected Channels | Creator, Owner | Đã triển khai | `GET /workspaces/:workspaceId/channels` | [04](./04-social-publishing.md) |
| **UC29** | Connect Social Channels | Owner | Một phần | `GET /channels/facebook/oauth/url`, `GET /channels/facebook/oauth/callback`, `GET /channels/facebook/oauth/session/:sessionId`, `POST /channels/facebook/oauth/session/:sessionId/connect` — **chỉ Facebook** | [04](./04-social-publishing.md) |
| **UC30** | Disconnect Social Channel | Owner | Đã triển khai | `DELETE /channels/:channelId` | [04](./04-social-publishing.md) |
| **UC31** | Purchase Credits | Owner | Chưa triển khai (Roadmap) | — | [06](./06-billing-payos.md) |
| **UC32** | View Dashboard & Audit Log | System Admin, Owner | Chưa triển khai (Roadmap) | — (audit log được **ghi** nhưng chưa có API đọc) | [07](./07-admin-analytics.md) |
| **UC33** | Update Profile | User | Đã triển khai | `GET /users/me`, `PATCH /users/me` | [01](./01-auth-workspace.md) |
| **UC34** | Refresh Token | User | Đã triển khai | `POST /auth/refresh-token` | [01](./01-auth-workspace.md) |
| **UC35** | List Workspaces | User | Đã triển khai | `GET /workspaces` | [01](./01-auth-workspace.md) |
| **UC36** | Change Member Role | Owner | Đã triển khai | `PATCH /workspaces/:workspaceId/members/:memberId` | [01](./01-auth-workspace.md) |
| **UC37** | Cancel Scheduled Post | Owner | Chưa triển khai (Roadmap) | — | [04](./04-social-publishing.md) |
| **UC38** | List Notifications | User | Chưa triển khai (Roadmap) | — (bảng `Notification` có ghi dữ liệu) | [05](./05-notifications-email.md) |
| **UC39** | View Workspace Performance Overview | Creator, Owner | Chưa triển khai (Roadmap) | — | [08](./08-post-analytics.md) |
| **UC40** | List Credit Packages | User | Chưa triển khai (Roadmap) | — | [06](./06-billing-payos.md) |
| **UC41** | View Credit Balance & History | Thành viên workspace | Một phần | Chỉ thấy `remainingCredit`/`monthlyQuota` trong `GET /workspaces` và response tạo/sửa workspace; không có API credit/lịch sử giao dịch | [06](./06-billing-payos.md) |
| **UC42** | Assign Content Task | Owner | Chưa triển khai (Roadmap) | — | [02](./02-content-media.md) |
| **UC43** | Update Task Status | Assignee, Owner | Chưa triển khai (Roadmap) | — | [02](./02-content-media.md) |

### 3.1. UC con / biến thể

| Mã | Tên | Trạng thái | Ghi chú |
| :--- | :--- | :--- | :--- |
| UC29a | Connect Facebook Page (thật) | Đã triển khai | Qua OAuth, chọn nhiều Page, token mã hoá AES-256-GCM |
| UC29b | Connect simulated channels (Instagram/TikTok/Zalo) | Chưa triển khai (Roadmap) | Schema có `ChannelType.SIMULATED`, `SocialPlatform`; không có endpoint |
| UC31a | Create Order | Chưa triển khai (Roadmap) | Bảng `Order` có trong schema |
| UC31b | PayOS Webhook | Chưa triển khai (Roadmap) | Chưa có route webhook |
| UC31c | Poll Order Status | Chưa triển khai (Roadmap) | — |
| UC32a | Admin Dashboard | Chưa triển khai (Roadmap) | — |
| UC32b | View Audit Log | Chưa triển khai (Roadmap) | Audit log chỉ được ghi, không có API đọc |

**Thống kê:** 28 UC đã triển khai · 3 UC một phần (UC11, UC29, UC41) · 12 UC chưa triển khai.

---

## 4. Tổng hợp theo phân hệ

| Phân hệ | Tài liệu | Đã có trong code |
| :--- | :--- | :--- |
| 1. Xác thực & Workspace | [01-auth-workspace.md](./01-auth-workspace.md) | Đăng ký/đăng nhập/Google/logout/refresh, hồ sơ, đổi mật khẩu, workspace, thành viên, lời mời |
| 2. Nội dung & Media | [02-content-media.md](./02-content-media.md) | CRUD bài viết, upload/xoá ảnh theo bài, state machine duyệt bài, notification + audit |
| 3. Brand Voice & AI | [03-ai-brandvoice.md](./03-ai-brandvoice.md) | Chỉ Brand Voice; phần AI là Roadmap |
| 4. Kênh & Đăng bài | [04-social-publishing.md](./04-social-publishing.md) | Chỉ Facebook Page OAuth (kết nối/ngắt kết nối); lịch đăng/publish là Roadmap |
| 5. Email & Thông báo | [05-notifications-email.md](./05-notifications-email.md) | Email mời, email duyệt/từ chối (Resend); ghi notification in-app; chưa có API đọc |
| 6. Credit & PayOS | [06-billing-payos.md](./06-billing-payos.md) | Roadmap — schema đã có, chưa có service/endpoint |
| 7. Quản trị & Báo cáo | [07-admin-analytics.md](./07-admin-analytics.md) | Roadmap — audit log được ghi, chưa có dashboard/API quản trị |
| 8. Post Analytics | [08-post-analytics.md](./08-post-analytics.md) | Roadmap — schema `PostMetric` đã có, chưa có đồng bộ/endpoint |

---

## 5. Roadmap tổng hợp

Các mục sau **chưa có trong code** (chi tiết ở file tương ứng):

1. **AI (03):** sinh nội dung bằng LLM, sinh ảnh, Viral Score, trừ credit; bảng `AiGeneration` và queue `content-generation-queue` mới chỉ là khung.
2. **Đăng bài (04):** Instagram/TikTok/Zalo (kể cả giả lập), lên lịch (`ScheduledPost`), publish worker, calendar, huỷ lịch (UC37), làm mới token Facebook/hạ trạng thái `EXPIRED`.
3. **Thông báo (05):** API đọc thông báo (UC38), email nhắc hạn gói/hết credit/lịch đăng, đẩy email qua `email-queue`.
4. **Thanh toán (06):** CreditPackage, Order, PayOS, webhook, trừ/hoàn credit, reset credit theo chu kỳ (UC31, UC40–UC41).
5. **Quản trị (07):** admin panel, quản lý user/workspace, dashboard, API đọc audit log (UC32).
6. **Post Analytics (08):** đồng bộ `PostMetric` từ Facebook Graph API, dashboard hiệu quả, n8n (UC39).
7. **Giao việc (02):** UC42/UC43 — giao việc và trạng thái công việc trên bài viết.

---

## 6. Quan hệ với tài liệu khác

- **Endpoint & ví dụ request/response:** [`docs/api_documentation.md`](../api_documentation.md) — danh sách đầy đủ endpoint đang có.
- **Kiến trúc, middleware, transaction, xoá mềm:** [`docs/architecture.md`](../architecture.md).
- **Mô hình dữ liệu & quan hệ:** `backend/prisma/schema.prisma`.
- Khi code thay đổi, cập nhật **cả** spec này và `api_documentation.md` để tránh lệch nguồn sự thật.
