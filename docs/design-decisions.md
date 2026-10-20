# Quyết định thiết kế (Design Decisions) — Marka

> Mục đích: chốt các điểm dễ mâu thuẫn giữa tài liệu và code.
> **Nguồn sự thật:** `backend/prisma/schema.prisma` (dữ liệu) và `backend/src` (hành vi).
>
> Trạng thái: ✅ đã có trong code · 🟡 có một phần · ⛔ chỉ là kế hoạch.

## A. Dữ liệu (schema)

| ID | Quyết định | Trạng thái | Ghi chú theo code |
| :--- | :--- | :--- | :--- |
| **D1 — Media** | `MediaAsset` thuộc workspace; `postId` nullable; có `deletedAt`. | ✅ | API hiện chỉ tạo media gắn trực tiếp vào bài (`POST /workspaces/:id/posts/:postId/media`). Chưa có API thư viện media độc lập. |
| **D2 — Người tạo bài** | Dùng `Post.createdById`; service nhận `userId` từ JWT. | ✅ | `postService.createPost(workspaceId, userId, data)` ghi thẳng `createdById`. |
| **D3 — Trạng thái lịch đăng** | `PublishStatus` có `CANCELLED`. | ✅ (schema) | Code dùng `CANCELLED` khi ngắt kênh (`deleteChannelAndCancelSchedules`). Chưa có luồng tạo/đăng lịch. |
| **D4 — Đơn hàng** | `OrderStatus = { PENDING, PAID, CANCELLED }`; `payosTransId` unique. | ⛔ | Chưa có module order/PayOS. |
| **D5 — Analytics** | Có `PostMetric` (1-1 `ScheduledPost`). | ⛔ | Chưa có service/endpoint/n8n. |
| **D6 — Quota & chu kỳ** | `Workspace` có `remainingCredit`, `monthlyQuota`, `billingCycleStart`, `nextResetAt`. | 🟡 | Cột đã có; chưa có cron reset credit hay hạ gói. |
| **D7 — Cờ email** | `planExpiryWarningSentAt`, `creditWarningSentAt`, `reminderSentAt`. | ⛔ | Chưa có luồng gửi email cảnh báo/nhắc lịch. |
| **D8 — Index** | Index cho post, media, audit, scheduled post. | ✅ | Có trong `schema.prisma`. |
| **D9 — Không có `SimulatedPost`** | Kênh giả lập dùng `ScheduledPost`. | ✅ | Không có model `SimulatedPost`; chưa có luồng giả lập đăng bài. |

## B. Luồng nghiệp vụ

| ID | Quyết định | Trạng thái | Ghi chú theo code |
| :--- | :--- | :--- | :--- |
| **D10 — Bất đồng bộ** | AI/publish đẩy job BullMQ, trả `202 + jobId`. | ⛔ | Queue + worker khung đã có; processor chỉ log + success; chưa module nào `enqueue`. |
| **D11 — Ủy quyền đăng** | Creator chỉ đăng/lên lịch khi `allowDirectPublish=true`. | ⛔ | Cột đã có, chưa có endpoint publish/schedule để kiểm tra. |
| **D12 — Idempotency PayOS** | Verify chữ ký + `updateMany` theo `orderCode` trong transaction. | ⛔ | Chưa triển khai. |
| **D13 — Kết nối Facebook** | OAuth redirect, đổi code lấy long-lived token, chọn Page, mã hoá token AES-256-GCM; cấu hình qua env. | ✅ | `channel.service.ts`, `facebook.client.ts`, `channel.oauth-store.ts`, `utils/encryption.ts`. State/session lưu Redis 600 giây. |
| **D14 — Từ vựng Credit** | Enum `CreditActionType`, `AiGenType` theo schema. | ⛔ | Chỉ có enum; chưa có module credit/AI. |
| **D15 — Máy trạng thái Post** | `DRAFT → PENDING → APPROVED/REJECTED`; `REJECTED → PENDING`. | ✅ | `ALLOWED_TRANSITIONS` trong `post.service.ts` chỉ có 3 nhóm chuyển trên. `APPROVED/SCHEDULED/PUBLISHED/FAILED/ARCHIVED` không có transition. Các giá trị enum còn lại chưa dùng. |
| **D16 — Xoá bài** | Chỉ `DRAFT`/`REJECTED` được sửa/xoá; `OWNER` hoặc người tạo. | ✅ | `assertEditable` + `assertCanModify`. Chưa có thu hồi về `DRAFT`, huỷ job hay archive. |
| **D17 — Ranh giới transaction** | Service sở hữu transaction nhiều bước; repository được tự mở transaction cho thao tác atomic. | ✅ | Ví dụ: `createUserWithDefaultWorkspace`, `createWorkspaceWithOwner`, `acceptInviteAsMember`, `deleteChannelAndCancelSchedules`. |
| **D18 — Xoá mềm** | `Workspace`, `Post`, `CreditPackage`, `MediaAsset`; Prisma extension tự lọc `deletedAt: null`. | ✅ | `config/prismaExtensions.ts`; đọc bản ghi đã xoá cần `basePrisma`. |
| **D19 — Timezone** | UTC toàn hệ thống; API ISO-8601 UTC. | ✅ (quy ước) | Code dùng `Date`/ISO; không có xử lý timezone riêng ở service. |
| **D20 — Realtime** | MVP dùng notification in-app + polling; WebSocket/SSE để sau. | 🟡 | Chỉ ghi bảng `Notification`; chưa có API đọc, chưa có polling/WebSocket. `socket.io` có trong dependencies nhưng không được dùng. |
| **D21 — n8n** | n8n chỉ dùng cho analytics. | ⛔ | Không có code n8n. |

## C. Đánh số Use Case

Xem bảng đầy đủ và trạng thái từng UC tại [`specs/README.md`](./specs/README.md). Các nhóm chính:

| Dải | Nội dung | Trạng thái |
| :--- | :--- | :--- |
| UC01, UC02, UC02b | Register, Login, Google OAuth | ✅ |
| UC03, UC33, UC04, UC32 | Logout, Refresh token, Đổi mật khẩu, Cập nhật hồ sơ | ✅ |
| UC05–UC11, UC14, UC37 | Bài viết, media, gửi duyệt, duyệt/từ chối | ✅ (trừ UC06 AI, UC12/13/15 lịch đăng/đăng bài) |
| UC16–UC23, UC35, UC36 | Workspace & thành viên | ✅ |
| UC24–UC29 | Brand Voice, kênh (chỉ Facebook) | 🟡 (Instagram/TikTok/Zalo chưa có) |
| UC30a/b/c | PayOS/Credit | ⛔ |
| UC31a/b | Admin | ⛔ |
| UC39–UC41 | Notification API | ⛔ (chỉ ghi DB) |
| UC42–UC43 | Post Analytics | ⛔ |
| UC44–UC48 | Credit package/balance | ⛔ |
| UC34 | Email xác thực tài khoản | ⛔ |
| UC49–UC50 | Giao việc | ⛔ (không có cột trong schema) |

## D. Việc còn lại

- AI generation, credit, PayOS, admin, lịch đăng/publish, analytics/n8n, Notification API.
- Cron reset credit/hạ gói và email cảnh báo (D6, D7).
- WebSocket/SSE, 2FA, email xác thực.
- Giao việc UC49/UC50 (cần bổ sung cột vào schema trước).
