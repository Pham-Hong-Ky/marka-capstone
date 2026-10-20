# Project Overview — Marka

> Nền tảng quản lý nội dung mạng xã hội cho marketer Việt Nam: soạn bài, duyệt bài theo workspace, quản lý Brand Voice và kết nối Facebook Page.
>
> **Tài liệu này phản ánh code hiện tại.** Trạng thái từng tính năng được ghi rõ: ✅ đã triển khai, 🟡 một phần, ⛔ chưa triển khai (Roadmap).

---

## 1. Mục tiêu sản phẩm

Marka giúp nhóm marketing:

- Quản lý nội dung theo **workspace** (mỗi workspace = một thương hiệu/doanh nghiệp).
- Soạn thảo bài viết rich-text, tải ảnh lên, lưu nháp.
- Gửi bài cho **Owner duyệt/từ chối**, có lý do từ chối và thông báo trong ứng dụng.
- Lưu **Brand Voice** (ngành hàng, khách hàng mục tiêu, phong cách viết, từ khoá nên dùng/tránh, bài mẫu).
- Kết nối **Facebook Page** thật qua OAuth để chuẩn bị cho việc đăng bài.
- Quản lý thành viên workspace với 2 vai trò `OWNER` và `CONTENT_CREATOR`.

---

## 2. Vai trò & phân quyền

### 2.1. Cấp hệ thống (`User.systemRole`)

| Vai trò | Trạng thái | Quyền trong code |
| :--- | :--- | :--- |
| `SYSTEM_ADMIN` | 🟡 có trong schema/middleware | Được `requireRoles` cho phép; trong `requireWorkspaceRole` được coi như `OWNER` của mọi workspace. **Chưa có API quản trị nào** (suspend user, xem audit toàn hệ thống...). |
| `USER` | ✅ | Người dùng thường. |

### 2.2. Cấp workspace (`WorkspaceMember.role`)

| Vai trò | Quyền |
| :--- | :--- |
| `OWNER` | Toàn quyền workspace: sửa/xoá workspace, mời/xoá/đổi vai trò thành viên, cấu hình Brand Voice, kết nối/ngắt kênh, duyệt/từ chối bài. |
| `CONTENT_CREATOR` | Xem thành viên, bài viết, Brand Voice, kênh; tạo bài; sửa/xoá bài **do mình tạo** khi bài ở `DRAFT`/`REJECTED`; upload/xoá ảnh của bài mình; gửi duyệt. |

Quy tắc:

- Vai trò gắn theo cặp `(user, workspace)`; một user có thể là Owner ở workspace A và Creator ở workspace B.
- Không thể rời/xoá/hạ vai trò **Owner cuối cùng** của workspace.
- `SYSTEM_ADMIN` không có quyền sửa nội dung qua UI admin vì chưa có admin API; nếu gọi API workspace hợp lệ thì được xử lý như Owner (theo middleware hiện tại).

---

## 3. Tính năng đã triển khai

### 3.1. Xác thực & tài khoản ✅

- Đăng ký email/password; mật khẩu bcrypt 10 rounds.
- Đăng nhập email/password.
- Đăng nhập Google qua `idToken` (chỉ nhận email đã xác minh).
- Đăng xuất, làm mới access token.
- Đổi mật khẩu; đăng xuất mọi thiết bị bằng `User.tokenVersion`.
- Xem/cập nhật hồ sơ (tên, avatar URL).
- Rate limit: 15 request/15 phút cho auth; 5 lần sai/15 phút cho login theo `IP:email`.
- Refresh token nằm trong cookie HttpOnly; không lưu DB.

**Chưa có:** xác thực email/OTP, quên mật khẩu, 2FA.

### 3.2. Workspace & thành viên ✅

- Tạo workspace (mặc định mỗi tài khoản đăng ký có 1 workspace).
- Xem danh sách workspace mình tham gia.
- Sửa tên workspace; workspace dùng icon mặc định (không còn upload logo).
- Xoá mềm workspace; chuyển các kênh sang `EXPIRED`.
- Xem thành viên + lời mời đang chờ.
- Mời thành viên qua email (Resend), token 7 ngày; mời lại thì cấp token mới.
- Chấp nhận lời mời (khách chưa đăng nhập được yêu cầu đăng ký trước).
- Rời workspace, xoá thành viên, đổi vai trò.
- Không cho thao tác lên Owner cuối cùng.

**Chưa có:** chuyển quyền sở hữu chủ động (chỉ đổi role), mời bằng link không qua email, phân trang thành viên.

### 3.3. Brand Voice ✅

- Xem/cập nhật Brand Voice theo workspace, lưu trong `Workspace.brandVoice` (Json).
- Gồm: `industry`, `targetAudience`, `writingStyle`, `keywordsShouldUse[]`, `keywordsAvoid[]`, `fewShotExamples[]` (tối đa 3).
- Khử trùng lặp từ khoá; ghi audit.
- Chỉ `OWNER` được cập nhật; mọi thành viên được xem.

**Chưa có:** dùng Brand Voice để sinh nội dung AI (chưa có module AI).

### 3.4. Kênh & Facebook OAuth ✅

- Xem danh sách kênh đã kết nối (không trả token).
- Kết nối Facebook Page thật qua OAuth redirect:
  - lấy URL đăng nhập Facebook;
  - callback đổi code → long-lived token → danh sách Page;
  - mã hoá Page token bằng AES-256-GCM;
  - chọn Page để lưu vào `ChannelConnection`.
- Ngắt kết nối kênh; huỷ các `ScheduledPost` đang `SCHEDULED` của kênh.
- Chỉ `OWNER` được kết nối/ngắt kênh.

**Chưa có:** Instagram/TikTok/Zalo (kể cả giả lập), đăng bài, lịch đăng, làm mới token tự động.

### 3.5. Bài viết, media & duyệt bài ✅

- Tạo bài nháp (`DRAFT`), nội dung JSON rich-text.
- Danh sách bài viết có phân trang, tìm theo tiêu đề, lọc trạng thái/người tạo/khoảng ngày.
- Xem chi tiết bài kèm media.
- Sửa/xoá bài khi `DRAFT` hoặc `REJECTED`; `OWNER` hoặc người tạo bài.
- Upload ảnh JPG/PNG/WEBP ≤ 10MB qua Cloudinary; xoá mềm ảnh.
- Gửi duyệt: `DRAFT`/`REJECTED` → `PENDING`.
- Owner duyệt/từ chối: `PENDING` → `APPROVED`/`REJECTED`, bắt buộc lý do khi từ chối.
- Ghi notification in-app cho Owner (khi gửi duyệt) và tác giả (khi duyệt/từ chối).
- Ghi audit log cho submit/approve/reject.

**Chưa có:** lưu nháp tự động, template, campaign tag (cột có trong schema nhưng API chưa nhận), lịch sử phiên bản, bình luận, giao việc, lịch đăng, đăng bài, archive.

### 3.6. Email ✅

- Gửi email mời workspace qua Resend, template HTML.
- Email thông báo bài viết: khi gửi duyệt, hệ thống gửi email cho các Owner; khi duyệt/từ chối, gửi email cho tác giả (`postReviewEmail.ts`, gọi từ `post.notification.ts`).
- Nếu thiếu `RESEND_API_KEY`: bỏ qua gửi và trả `false` (trừ môi trường test luôn trả `true`).

**Chưa có:** email xác thực tài khoản, nhắc lịch đăng, cảnh báo hết credit/gói, email marketing.

### 3.7. Thông báo in-app 🟡

- Bảng `Notification` được ghi khi:
  - thành viên mới tham gia workspace (`MEMBER_JOINED`, gửi các Owner còn lại);
  - bài được gửi duyệt / được duyệt / bị từ chối.
- **Chưa có API** đọc danh sách, đánh dấu đã đọc hay đếm số chưa đọc; frontend chưa hiển thị chuông thông báo.

### 3.8. Audit, health & hạ tầng ✅

- Audit log cho các hành động auth, workspace, member, Brand Voice, kênh, duyệt bài.
- `GET /health` kiểm tra PostgreSQL + Redis.
- BullMQ có 3 queue (`content-generation-queue`, `publishing-queue`, `email-queue`) và worker khung; **processor chỉ log + trả success**, chưa module nào enqueue.
- Soft delete bằng Prisma Client Extension cho `Workspace`, `Post`, `CreditPackage`, `MediaAsset`.
- Log Winston + requestId, morgan; helmet, CORS theo `CLIENT_URL`, rate limit, HTTPS ở production.

---

## 4. Chưa triển khai (Roadmap)

Các phần dưới đây **không có** trong `backend/src/modules` hay `frontend/src/pages` (ngoài trang placeholder):

| Nhóm | Nội dung | Dấu vết hiện có |
| :--- | :--- | :--- |
| AI | Sinh text/ảnh, Viral Score, 1-Click Fix | deps `openai`, env `OPENAI_API_KEY`, bảng `ai_generations`; chưa có service/endpoint |
| Credit & thanh toán | Ví credit, gói credit, Order, PayOS, webhook | deps `@payos/node`, env `PAYOS_*`, bảng `credit_*`, `orders`; chưa có service/endpoint |
| Lịch đăng & publish | Calendar, đặt lịch, đăng ngay, retry | bảng `scheduled_posts`, queue `publishing-queue`; chưa có service/endpoint |
| Analytics | Đồng bộ metrics Facebook, biểu đồ | bảng `post_metrics`; chưa có service, không có n8n |
| Admin | Quản lý user/workspace, dashboard hệ thống | `SYSTEM_ADMIN` trong schema/middleware; chưa có module admin |
| Notification API | Đọc/đánh dấu thông báo, realtime | bảng `notifications`; chỉ ghi, chưa có API |
| Giao việc | UC49/UC50 | chưa có cột trong `schema.prisma` |
| Email xác thực | OTP/xác minh tài khoản | `emailVerified` có trong schema; chưa có luồng |

Frontend hiện có các trang placeholder: `/schedule`, `/ai`, `/publishing`, `/billing`.

---

## 5. Kiến trúc & công nghệ

| Lớp | Công nghệ |
| :--- | :--- |
| Frontend | React 19, Vite, TypeScript, Tailwind CSS v4, React Router, React Query, Zustand, react-hook-form + Zod |
| Backend | Node.js, TypeScript ESM, Express 4, Zod |
| Database | PostgreSQL + Prisma 5 |
| Cache/Queue | Redis + BullMQ (worker khung) |
| Email | Resend |
| Ảnh | Cloudinary |
| Facebook | Graph API v21.0, OAuth redirect |
| Test | Vitest + Supertest (DB thật) |

Luồng chuẩn: `route → middleware (auth/validate) → controller → service → repository → Prisma`.

Chi tiết: [`architecture.md`](./architecture.md), [`class-diagram.md`](./class-diagram.md), [`api_documentation.md`](./api_documentation.md).

---

## 6. Bảo mật

- JWT access token ngắn hạn (mặc định 15 phút); refresh token 7 ngày trong cookie HttpOnly, `SameSite=None; Secure` ở production.
- Thu hồi phiên bằng `tokenVersion` (logout, đổi mật khẩu, token cũ bị dùng lại).
- Mật khẩu bcrypt; không trả `passwordHash` ra API.
- Page token Facebook mã hoá AES-256-GCM.
- `requireWorkspaceRole` chặn truy cập chéo workspace và chặn lệch `x-workspace-id` với URL.
- Rate limit toàn API + auth + login.
- Helmet, CORS theo `CLIENT_URL`, HTTPS redirect ở production.
- Upload giới hạn MIME và dung lượng.

---

## 7. Quy ước dữ liệu & vận hành

- **UTC** toàn hệ thống; API trả ISO-8601.
- **Soft delete** cho `Workspace`, `Post`, `CreditPackage`, `MediaAsset`, tự lọc `deletedAt: null` ở tầng Prisma.
- **Response envelope**: `{ status, message, data?, meta? }`; lỗi 4xx = `fail`, 5xx = `error`.
- **Phân trang**: dữ liệu trong `data`, thông tin trang trong `meta` (`page`, `limit`, `total`, `totalPages`).
- **Worker**: `ENABLE_WORKERS=true` chạy cùng API; production có thể đặt `false` và chạy `npm run worker`.

---

## 8. Cấu trúc tài liệu

| File | Nội dung |
| :--- | :--- |
| [`architecture.md`](./architecture.md) | Kiến trúc, middleware, auth, transaction, tích hợp ngoài |
| [`api_documentation.md`](./api_documentation.md) | Toàn bộ endpoint thật, request/response/lỗi |
| [`class-diagram.md`](./class-diagram.md) | Sơ đồ lớp theo module + hướng dẫn render |
| [`database_design.md`](./database_design.md) | Thiết kế 15 bảng |
| [`database_spec.md`](./database_spec.md) | Đặc tả chi tiết cột/ràng buộc |
| [`schema.dbml`](./schema.dbml) | DBML để render ERD |
| [`function_layer_mapping.md`](./function_layer_mapping.md) | Sequence diagram theo UC đã code |
| [`test_cases.md`](./test_cases.md) | Test case thật trong backend |
| [`specs/README.md`](./specs/README.md) | Danh mục UC và trạng thái |
| [`design-decisions.md`](./design-decisions.md) | Quyết định thiết kế còn hiệu lực |
| [`cicd.md`](./cicd.md) | CI/CD và môi trường |
