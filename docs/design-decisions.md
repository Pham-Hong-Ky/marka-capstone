# Quyết định thiết kế (Design Decisions) — Marka

> **Mục đích**: Chốt các điểm trước đây bị mâu thuẫn giữa `database_spec`, `api_documentation`, `function_layer_mapping`, `specs/*` và `schema.prisma`.
> Từ nay **`backend/prisma/schema.prisma` là nguồn sự thật (single source of truth)** về dữ liệu; mọi tài liệu khác phải khớp file này.
>
> Ngày chốt: 2026-10-05. Mọi tài liệu (API, sequence, specs, class diagram, DBML) đã được đồng bộ theo các quyết định dưới đây.

---

## A. Dữ liệu (schema)

| ID | Quyết định | Lý do / thay đổi |
| :--- | :--- | :--- |
| **D1 — Media** | Media là **thư viện cấp Workspace**, gắn bài viết là tùy chọn. `MediaAsset` thêm `workspaceId` (bắt buộc, Cascade), đổi `postId` thành **nullable** (FK `SetNull`), thêm `deletedAt` (xóa mềm). | Khớp `PROJECT_OVERVIEW` (thư viện độc lập) và endpoint `POST /workspaces/:id/media`. Không còn lỗi NOT NULL khi upload trước khi có bài. |
| **D2 — Người tạo bài** | `Post` thêm **`createdById`** (FK `users`, `SetNull`). Tên chuẩn trong DB/API là `createdById`; tham số truyền vào service vẫn gọi là `creatorId` (lấy từ JWT) và map thẳng vào `createdById`. | Phục vụ lọc UC09, phân quyền xoá UC10, và `createNotification(creatorId, …)`. |
| **D3 — Trạng thái lịch đăng** | Thêm **`CANCELLED`** vào `enum PublishStatus`. Huỷ lịch / ngắt kênh → `CANCELLED`; đăng thất bại → `FAILED`. | API/mapping/test đã dùng `CANCELLED`; spec04 trước đó ghi `FAILED` nay đổi thành `CANCELLED`. |
| **D4 — Trạng thái đơn hàng** | Giữ `OrderStatus = { PENDING, PAID, CANCELLED }` (không thêm `FAILED`). API polling trả `PENDING | PAID | CANCELLED`. Thêm **`payosTransId @unique`**. | Đơn hỏng = `CANCELLED`; unique `payosTransId` hỗ trợ idempotency webhook. |
| **D5 — Analytics** | Thêm model **`PostMetric`** (1-1 `ScheduledPost`, `@@unique([scheduledPostId])`) theo đúng đặc tả Phân hệ 8. `post_metric_snapshots` (đồ thị xu hướng) để **Could-have**, không thêm ở MVP. | Analytics là điểm khác biệt; spec08 nói "bắt buộc". |
| **D6 — Quota & chu kỳ** | Hạn mức mặc định: **FREE = 100, PRO = 1000, ENTERPRISE = 5000** credit/tháng. `Workspace` thêm **`billingCycleStart`**, **`nextResetAt`** (mốc neo cron reset/hạ gói). | Trước đây không có số quota và không có mốc chu kỳ → cron bất khả thi. |
| **D7 — Idempotency email** | `Workspace` thêm **`planExpiryWarningSentAt`**, **`creditWarningSentAt`**; `ScheduledPost` thêm **`reminderSentAt`**. | Thay cho "cờ đã gửi" trước đây không có chỗ lưu. |
| **D8 — Index bổ sung** | `scheduled_posts.channelId`, `scheduled_posts.postId`, `audit_logs(workspaceId,createdAt)`, `audit_logs(actorId,createdAt)`, `media_assets.workspaceId`, `posts.createdById`. | Các truy vấn đã mô tả (huỷ theo kênh, audit log, media workspace) trước đây seq scan. |
| **D9 — `SimulatedPost`** | **Không có bảng `SimulatedPost`.** Kênh giả lập dùng `ScheduledPost` (`ChannelType.SIMULATED`, `status = PUBLISHED`, `externalPostId` sinh giả). | Trước đây overview/spec04 nhắc bảng không tồn tại. |

---

## B. Luồng nghiệp vụ

| ID | Quyết định | Lý do |
| :--- | :--- | :--- |
| **D10 — Bất đồng bộ** | UC06 (sinh AI) và UC15 (đăng ngay) **đẩy job vào BullMQ** và trả `202` + `jobId`; worker mới gọi OpenAI / Facebook. | Tránh timeout; hỗ trợ retry; khớp `specs/README.md` và `content-generation-queue`/`publishing-queue`. |
| **D11 — Ủy quyền đăng** | Creator chỉ được lên lịch/đăng khi `WorkspaceMember.allowDirectPublish = true`; Owner luôn được. Áp dụng ở UC12 và UC15. | Trước đây cờ này không được kiểm tra ở luồng nào. |
| **D12 — Idempotency PayOS** | Webhook: verify chữ ký ở **Service**, rồi `updateMany({ where: { orderCode, status: 'PENDING' } })` trong transaction; chỉ cộng credit khi update thành công. Khóa là **`orderCode`**. | Chống cộng credit trùng khi PayOS retry. |
| **D13 — Kết nối Facebook** | MVP dùng **nhập `pageId` + `pageAccessToken` thủ công** (không OAuth redirect). `appId/appSecret` để ở **biến môi trường**, KHÔNG lưu DB. Chỉ `accessToken` (Page Token) được mã hoá AES-256 lưu DB. | Khớp api/mapping/test; tránh lưu secret không có cột. OAuth là hạng mục Phase sau. |
| **D14 — Từ vựng Credit** | Chuẩn theo enum schema: `CreditActionType = { GEN_TEXT, GEN_IMAGE, REGEN, SCORE, TOP_UP, RESET, REFUND }`; `AiGenType = { TEXT, IMAGE, VIRAL_SCORE, REGENERATE }`. Bảng giá trong `config/credit-cost` dùng khóa `GEN_TEXT/GEN_IMAGE/REGEN/SCORE`. | Trước đây dùng `GENERATE_TEXT/REGENERATE` lệch enum. |
| **D15 — Máy trạng thái Post** | Bổ sung đầy đủ, gồm **`ARCHIVED`** và các transition: `REJECTED→PENDING`; `PENDING/APPROVED→DRAFT` (thu hồi); `PUBLISHED` **không xoá** (chỉ archive). Danh sách trung tâm nằm ở `specs/README.md §8`. | Trước đây state machine thiếu ARCHIVED, sơ đồ vẽ reject→Draft. |
| **D16 — Xoá bài** | `DRAFT/REJECTED/FAILED`: creator của bài hoặc Owner xoá mềm. `PENDING/APPROVED`: thu hồi về `DRAFT` hoặc Owner xoá. `SCHEDULED`: huỷ job rồi xoá. `PUBLISHED`: **403** (chỉ archive). | Khớp spec02. Trước đây flow UC10 không chặn PUBLISHED. |
| **D17 — Ranh giới transaction** | Service sở hữu `$transaction` cho luồng nhiều bước/tài chính và truyền `tx` xuống Repository. Repository **được phép** tự mở transaction cho thao tác atomic tự chứa (ví dụ `createUser` tạo user + workspace + member). | Hợp thức hóa cả 2 pattern đang tồn tại. |
| **D18 — Xoá mềm** | Áp dụng cho `Workspace`, `Post`, `CreditPackage`, `MediaAsset`. Cơ chế cưỡng chế: **Prisma Client Extension** thêm điều kiện `deletedAt: null` mặc định; muốn lấy bản ghi đã xoá phải dùng API `includeDeleted`. | Rule trước đây chỉ là văn xuôi, dễ bỏ sót. |
| **D19 — Timezone** | Toàn hệ thống dùng **UTC** (DB `DateTime`, API ISO-8601 UTC). Đặt `TZ=UTC` cho server/worker; FE tự chuyển sang giờ local. | Trước đây không quy định múi giờ. |
| **D20 — Realtime** | MVP dùng **in-app notification + polling**. WebSocket/SSE là **Phase sau (tùy chọn)**; không khẳng định là đã có. | `socket.io` chưa được khởi tạo; tránh hứa tính năng không có. |
| **D21 — n8n** | n8n **chỉ** dùng cho **đồng bộ metrics Facebook** (Phân hệ 8). **Đăng bài dùng BullMQ**, n8n không tham gia. | Khớp `specs/04:70` và `PROJECT_OVERVIEW:169`. |

---

## C. Đánh số Use Case (chuẩn hóa)

| Dải | Nội dung |
| :--- | :--- |
| UC01, UC02, **UC02b** | Register, Login, **Google OAuth Login** (đặt mã UC02b) |
| UC03, UC33, UC04, UC32 | Logout, Refresh token, Đổi mật khẩu, Cập nhật hồ sơ |
| UC05–UC15, UC37, UC38 | Nội dung, media, duyệt bài, lịch đăng, đăng bài |
| UC16–UC23, UC35, UC36 | Workspace & thành viên |
| UC24–UC29, UC28a/b | Brand voice & kênh |
| UC30a/b/c | Thanh toán PayOS |
| UC31a/b | Admin dashboard & audit log |
| UC39–UC41 | Notifications |
| **UC42, UC42b, UC43** | **Post Analytics** |
| **UC47–UC51** | **Credit Package (List/Create/Update/Delete) + Credit Balance** *(đổi từ UC42–UC46 để hết trùng)* |
| UC34 | Gửi email xác thực tài khoản — **dời Phase 5**, chưa triển khai |

---

## D. Việc còn lại (không chặn code)

- `post_metric_snapshots` (đồ thị xu hướng) — Could-have.
- Facebook OAuth redirect — Phase sau.
- WebSocket/SSE realtime — Phase sau.
- 2FA, staging, multi-provider LLM — Should/Could-have theo `PROJECT_OVERVIEW`.
