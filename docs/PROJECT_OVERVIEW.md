# Project Overview — Marka

> Nền tảng quản lý nội dung mạng xã hội cho marketer Việt Nam: soạn bài, duyệt bài theo workspace, quản lý Brand Voice và kết nối Facebook Page/Threads.
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
| `SYSTEM_ADMIN` | ✅ | Dashboard hệ thống, danh sách/khoá-mở khoá user, danh sách workspace, đọc audit log toàn hệ thống (`/admin/*`); trong `requireWorkspaceRole` được coi như `OWNER` của mọi workspace. |
| `USER` | ✅ | Người dùng thường. |

### 2.2. Cấp workspace (`WorkspaceMember.role`)

| Vai trò | Quyền |
| :--- | :--- |
| `OWNER` | Toàn quyền workspace: sửa/xoá workspace, mời/xoá/đổi vai trò thành viên, cấu hình Brand Voice, kết nối/ngắt kênh, duyệt/từ chối bài, nạp credit, huỷ đơn mình tạo. |
| `CONTENT_CREATOR` | Xem thành viên, bài viết, Brand Voice, kênh; tạo bài; sửa/xoá bài **do mình tạo** khi bài ở `DRAFT`/`REJECTED`; upload/xoá ảnh của bài mình; gửi duyệt; nạp credit, huỷ đơn mình tạo. |

Quy tắc:

- Vai trò gắn theo cặp `(user, workspace)`; một user có thể là Owner ở workspace A và Creator ở workspace B.
- Không thể rời/xoá/hạ vai trò **Owner cuối cùng** của workspace.
- `SYSTEM_ADMIN` dùng UI `/admin` để quản trị user/workspace/audit; UI này không sửa nội dung. Nếu gọi API workspace hợp lệ thì được xử lý như Owner (theo middleware hiện tại).

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

**Chưa có:** quên mật khẩu, 2FA.

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

**Chưa có:** lịch sử phiên bản Brand Voice, gợi ý Brand Voice tự động.

### 3.3.1. Trợ lý AI cho bài viết ✅

- Panel “Trợ lý AI” trong editor bài viết; mọi thành viên workspace dùng được.
- Sinh tiêu đề + nội dung từ chủ đề, tự động dùng Brand Voice; kết quả điền thẳng vào editor (khoá editor trong lúc chờ).
- Sinh 1 ảnh minh hoạ từ tiêu đề/nội dung/ghi chú; ảnh lưu Cloudinary và gắn vào bài với `source = AI_GENERATED`.
- Bài mới chưa lưu: tự tạo nháp trong cùng transaction với trừ credit + tạo job.
- Chạy nền qua `content-generation-queue`; frontend poll trạng thái 2 giây/lần.
- Trừ **10 credit** cho nội dung, **20 credit** cho ảnh; hoàn credit nếu job thất bại hẳn.
- Provider: Gemini (text), Cloudflare Workers AI Flux Schnell (ảnh).

**Chưa có:** Viral Score, sinh lại theo góp ý, nhiều ảnh/lần, chọn tỉ lệ/style, lịch sử AI có UI.

### 3.4. Kênh, Facebook & Threads ✅

- Xem danh sách kênh đã kết nối (không trả token).
- Kết nối Facebook Page thật qua OAuth redirect:
  - lấy URL đăng nhập Facebook;
  - callback đổi code → long-lived token → danh sách Page;
  - mã hoá Page token bằng AES-256-GCM;
  - chọn Page để lưu vào `ChannelConnection`.
- Kết nối Threads qua OAuth (single-account): đổi code → long-lived token → lưu tài khoản ngay, không có màn chọn Page.
- Mã hoá token kênh bằng AES-256-GCM; Threads tự gia hạn token qua `channel-maintenance-queue`, Facebook chưa tự gia hạn.
- Ngắt kết nối kênh; huỷ các `ScheduledPost` đang `SCHEDULED` của kênh.
- Chỉ `OWNER` được kết nối/ngắt kênh.
- Đăng ngay hoặc lên lịch bài `APPROVED` lên nhiều kênh: Facebook tối đa 10 ảnh, Threads tối đa 20 ảnh/500 ký tự.
- Worker `schedule-queue` tự đăng đúng giờ: upload ảnh, gọi provider tương ứng, lưu `externalPostId`, retry khi lỗi tạm thời.
- Chỉnh sửa trạng thái từng kênh, huỷ lịch đang chờ, xem danh sách ở trang `/schedule`.
- Mọi thành viên workspace được đăng/lên lịch bài đã duyệt.

**Chưa có:** Instagram/TikTok/Zalo (kể cả giả lập), calendar kéo-thả, sửa giờ sau khi tạo, video, làm mới token Facebook tự động.

### 3.5. Bài viết, media & duyệt bài ✅

- Tạo bài nháp (`DRAFT`), nội dung JSON rich-text.
- Danh sách bài viết có phân trang, tìm theo tiêu đề, lọc trạng thái/người tạo/khoảng ngày, lọc `taskStatus` và người nhận việc (`assigneeId=me`).
- Xem chi tiết bài kèm media.
- Giao việc (UC42/UC43) + bảng công việc `/tasks`: Owner giao/đổi người nhận, hạn chót, ưu tiên; người nhận hoặc Owner cập nhật `taskStatus` (`TODO`/`IN_PROGRESS`/`DONE`/`CANCELLED`); notification + audit khi giao/đổi trạng thái.
- Job nhắc hạn gửi `TASK_DUE_SOON` và `TASK_OVERDUE`, không gửi trùng khi chạy lại.
- Sửa/xoá bài: `OWNER` sửa/xoá mọi bài; người tạo sửa/xoá bài của mình khi `DRAFT`/`REJECTED`. Xoá bài tự huỷ các `ScheduledPost` đang `SCHEDULED` và ghi audit `POST_DELETED`.
- Upload ảnh JPG/PNG/WEBP ≤ 10MB qua Cloudinary; xoá mềm ảnh.
- Ảnh AI tạo bởi trợ lý cũng là `MediaAsset` (`source = AI_GENERATED`) và hiển thị chung mục ảnh đính kèm.
- Gửi duyệt: `DRAFT`/`REJECTED` → `PENDING`.
- Owner duyệt/từ chối: `PENDING` → `APPROVED`/`REJECTED`, bắt buộc lý do khi từ chối.
- Ghi notification in-app cho Owner (khi gửi duyệt) và tác giả (khi duyệt/từ chối).
- Ghi audit log cho submit/approve/reject.

**Chưa có:** lưu nháp tự động lên server (frontend chỉ lưu tạm localStorage), template, campaign tag (cột có trong schema nhưng API chưa nhận), lịch sử phiên bản, bình luận, archive.

### 3.6. Email ✅

- Gửi email mời workspace qua Resend, template HTML.
- Email thông báo bài viết: khi gửi duyệt, hệ thống gửi email cho các Owner; khi duyệt/từ chối, gửi email cho tác giả (`postReviewEmail.ts`, gọi từ `post.notification.ts`).
- Nếu thiếu `RESEND_API_KEY`: bỏ qua gửi và trả `false` (trừ môi trường test luôn trả `true`).

**Chưa có:** nhắc lịch đăng, cảnh báo hết credit/gói, email marketing.

### 3.7. Thông báo in-app ✅

- Bảng `Notification` được ghi khi:
  - thành viên mới tham gia workspace (`MEMBER_JOINED`, gửi các Owner còn lại);
  - bài được gửi duyệt / được duyệt / bị từ chối;
  - công việc được giao, đổi trạng thái, sắp đến hạn hoặc quá hạn (`TASK_ASSIGNED`, `TASK_STATUS_CHANGED`, `TASK_DUE_SOON`, `TASK_OVERDUE`).
- API hộp thư của chính người dùng: `GET /users/me/notifications` (phân trang, lọc `isRead`, `workspaceId`), `GET .../unread-count`, `PATCH .../:id/read`, `PATCH .../read-all`.
- Chuông trên header hiển thị số chưa đọc, poll 30 giây, bấm thông báo mở đúng bài viết.

### 3.8. Audit, health & hạ tầng ✅

- Audit log cho các hành động auth, workspace, member, Brand Voice, kênh, duyệt/giao việc bài, billing, quản trị user.
- API đọc audit log: `GET /admin/audit-logs` (System Admin) và `GET /workspaces/:workspaceId/audit-logs` (Owner), có lọc actor/action/target/thời gian + phân trang.
- `GET /health` kiểm tra PostgreSQL + Redis.
- BullMQ có 5 queue: `content-generation-queue`, `schedule-queue`, `analytics-queue`, `channel-maintenance-queue`, `task-reminder-queue`. Các worker tương ứng xử lý AI, đăng bài, đồng bộ metrics, gia hạn token kênh và nhắc hạn công việc. Billing không dùng queue.
- Soft delete bằng Prisma Client Extension cho `Workspace`, `Post`, `CreditPackage`, `MediaAsset`, `User`, `ChannelConnection`, `Task`.
- Log Winston + requestId, morgan; helmet, CORS theo `CLIENT_URL`, rate limit, HTTPS ở production.

### 3.9. Nạp credit & PayOS ✅

- 4 gói nạp mặc định: 500 credit/25.000đ, 1.500/69.000đ, 5.000/199.000đ, 10.000/349.000đ.
- Credit **không hết hạn, không reset**; mua gói = cộng thẳng vào `remainingCredit`.
- Mọi thành viên workspace được nạp; chỉ người tạo đơn được huỷ đơn của mình.
- Tạo order `PENDING` + link PayOS; lưu `paymentLinkId`, `checkoutUrl`, `expiresAt`.
- Webhook PayOS verify chữ ký, chống cộng trùng bằng `updateMany` theo `status: PENDING`; polling đối soát khi webhook chưa tới.
- Không có cron/queue billing; order quá hạn được PayOS xử lý, backend chỉ cập nhật khi polling.
- Trang `/billing`: số dư, 4 gói nạp, modal thanh toán poll 3 giây, lịch sử credit phân trang.

**Chưa có:** gói tháng/reset credit, hoá đơn VAT, hoàn tiền/chargeback, tự động trừ tiền định kỳ, email cảnh báo hết credit.

---

### 3.10. Quản trị hệ thống ✅

- `GET /admin/stats`: user (tổng/hoạt động/bị khoá/admin), workspace, bài theo trạng thái, kênh, đơn PAID + doanh thu 30 ngày.
- `GET /admin/users`: tìm theo email/tên, lọc `systemRole`/`isSuspended`, phân trang; không trả `passwordHash`.
- `PATCH /admin/users/:userId/suspend`: khoá/mở khoá, tăng `tokenVersion` để đá phiên, chặn tự khoá, ghi audit.
- `GET /admin/workspaces`: tìm/lọc `plan`, `includeDeleted`, kèm số thành viên/bài.
- `GET /admin/audit-logs` cho System Admin và `GET /workspaces/:workspaceId/audit-logs` cho Owner.

- Frontend `/admin`: tổng quan, người dùng, workspace, audit log; menu chỉ hiện với `SYSTEM_ADMIN`.

**Chưa có:** đổi `systemRole`, xoá/khôi phục workspace, xuất báo cáo.

---

## 4. Chưa triển khai (Roadmap)

Các phần dưới đây **không có** trong code hiện tại:

| Nhóm | Nội dung | Dấu vết hiện có |
| :--- | :--- | :--- |
| Calendar nâng cao | Kéo-thả đổi giờ, sửa lịch sau khi tạo | Đăng ngay/lên lịch/huỷ lịch cơ bản đã có |
| Kênh mở rộng | Instagram/TikTok/Zalo, đăng video | Adapter Facebook/Threads đã có |
| AI nâng cao | Viral Score, sinh lại theo góp ý, nhiều ảnh/lần | Trợ lý AI text + 1 ảnh đã có |
| Vận hành | Email queue, retention Notification/AuditLog/Order | Email đang gửi đồng bộ trong request |

Frontend không còn trang placeholder; `/ai` chuyển về editor, `/publishing` chuyển về `/schedule`.

---

## 5. Kiến trúc & công nghệ

| Lớp | Công nghệ |
| :--- | :--- |
| Frontend | React 19, Vite, TypeScript, Tailwind CSS v4, React Router, React Query, Zustand, react-hook-form + Zod |
| Backend | Node.js, TypeScript ESM, Express 4, Zod |
| Database | PostgreSQL + Prisma 5 |
| Cache/Queue | Redis + BullMQ (5 queue: content, schedule, analytics, channel-maintenance, task-reminder) |
| Email | Resend |
| Ảnh | Cloudinary |
| Kênh | Facebook Graph API v21.0 + Threads API, OAuth redirect, provider registry |
| Test | Vitest + Supertest (DB thật) |

Luồng chuẩn: `route → middleware (auth/validate) → controller → service → repository → Prisma`.

Chi tiết: [`architecture.md`](./architecture.md), [`class-diagram.md`](./class-diagram.md), [`api_documentation.md`](./api_documentation.md).

---

## 6. Bảo mật

- JWT access token ngắn hạn (mặc định 15 phút); refresh token 7 ngày trong cookie HttpOnly, `SameSite=None; Secure` ở production.
- Thu hồi phiên bằng `tokenVersion` (logout, đổi mật khẩu, token cũ bị dùng lại).
- Mật khẩu bcrypt; không trả `passwordHash` ra API.
- Token Facebook/Threads mã hoá AES-256-GCM.
- `requireWorkspaceRole` chặn truy cập chéo workspace và chặn lệch `x-workspace-id` với URL.
- Rate limit toàn API + auth + login.
- Helmet, CORS theo `CLIENT_URL`, HTTPS redirect ở production.
- Upload giới hạn MIME và dung lượng.

---

## 7. Quy ước dữ liệu & vận hành

- **UTC** toàn hệ thống; API trả ISO-8601.
- **Soft delete** cho `Workspace`, `Post`, `CreditPackage`, `MediaAsset`, `User`, `ChannelConnection`, `Task`; tự lọc `deletedAt: null` ở tầng Prisma.
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
| [`database_design.md`](./database_design.md) | Thiết kế 16 bảng |
| [`database_spec.md`](./database_spec.md) | Đặc tả chi tiết cột/ràng buộc |
| [`schema.dbml`](./schema.dbml) | DBML để render ERD |
| [`function_layer_mapping.md`](./function_layer_mapping.md) | Sequence diagram theo UC đã code |
| [`test_cases.md`](./test_cases.md) | Test case thật trong backend |
| [`specs/README.md`](./specs/README.md) | Danh mục UC và trạng thái |
| [`design-decisions.md`](./design-decisions.md) | Quyết định thiết kế còn hiệu lực |
| [`cicd.md`](./cicd.md) | CI/CD và môi trường |
