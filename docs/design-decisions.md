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
| **D3 — Trạng thái lịch đăng** | `PublishStatus = { SCHEDULED, PROCESSING, PUBLISHED, FAILED, CANCELLED }`. | ✅ | Có luồng tạo/đăng/huỷ lịch; `PROCESSING` dùng để claim và recovery worker. |
| **D4 — Đơn hàng** | `OrderStatus = { PENDING, PAID, CANCELLED }`; `payosTransId` unique. | ✅ | Module billing + PayOS đã có; `Order` thêm `paymentLinkId`, `checkoutUrl`, `expiresAt`; dùng `packageId`. |
| **D5 — Analytics** | Có `PostMetric` (1-1 `ScheduledPost`). | ⛔ | Chưa có service/endpoint/n8n. |
| **D6 — Quota & chu kỳ** | `Workspace` có `remainingCredit`, `monthlyQuota`, `billingCycleStart`, `nextResetAt`. | 🟡 (legacy) | Mô hình nạp credit không reset/hết hạn; các cột `monthlyQuota`, `billingCycleStart`, `nextResetAt` giữ trong schema nhưng không dùng. |
| **D7 — Cờ email** | `planExpiryWarningSentAt`, `creditWarningSentAt`, `reminderSentAt`. | ⛔ | Chưa có luồng gửi email cảnh báo/nhắc lịch. |
| **D8 — Index** | Index cho post, media, audit, scheduled post. | ✅ | Có trong `schema.prisma`. |
| **D9 — Không có `SimulatedPost`** | Kênh giả lập dùng `ScheduledPost`. | ✅ | Không có model `SimulatedPost`; chưa có luồng giả lập đăng bài. |

## B. Luồng nghiệp vụ

| ID | Quyết định | Trạng thái | Ghi chú theo code |
| :--- | :--- | :--- | :--- |
| **D10 — Bất đồng bộ** | Publish/AI đẩy job BullMQ; API trả kết quả enqueue, worker xử lý nền. | ✅ | Đăng bài dùng `schedule-queue` + `scheduleWorker`; AI dùng `content-generation-queue` + `processContentJob`, frontend poll `AiGeneration`. |
| **D11 — Ủy quyền đăng** | Mọi thành viên workspace được đăng/lên lịch bài `APPROVED`. | ✅ (thay đổi) | Không dùng `allowDirectPublish` trong đợt này; route dùng `requireWorkspaceRole()` không giới hạn role. |
| **D12 — Idempotency PayOS** | Verify chữ ký + `updateMany` theo `orderCode` trong transaction. | ✅ | Webhook + polling dùng chung `finalizePaidOrder`; `updateMany` theo `status: PENDING`. |
| **D13 — Kết nối Facebook** | OAuth redirect, đổi code lấy long-lived token, chọn Page, mã hoá token AES-256-GCM; cấu hình qua env. | ✅ | `channel.service.ts`, `facebook.client.ts`, `channel.oauth-store.ts`, `utils/encryption.ts`. State/session lưu Redis 600 giây. |
| **D14 — Từ vựng Credit** | Enum `CreditActionType`, `AiGenType` theo schema. | ✅ | AI dùng `AiGeneration`, `CreditTransaction` (`GEN_TEXT` 10, `GEN_IMAGE` 20, `REFUND`); billing dùng `TOP_UP`. `RESET` chỉ còn dữ liệu cũ. |
| **D15 — Máy trạng thái Post** | `DRAFT → PENDING → APPROVED/REJECTED`; `REJECTED → PENDING`; `APPROVED → SCHEDULED`; worker cập nhật `SCHEDULED → PUBLISHED/FAILED`. | ✅ | `ALLOWED_TRANSITIONS` có thêm `APPROVED → SCHEDULED`; worker tính trạng thái tổng từ các `ScheduledPost`. |
| **D16 — Xoá bài** | Chỉ `DRAFT`/`REJECTED` được sửa/xoá; `OWNER` hoặc người tạo. | ✅ | `assertEditable` + `assertCanModify`. Chưa có thu hồi về `DRAFT`, huỷ job hay archive. |
| **D17 — Ranh giới transaction** | Service sở hữu transaction nhiều bước; repository được tự mở transaction cho thao tác atomic. | ✅ | Ví dụ: `createUserWithDefaultWorkspace`, `createWorkspaceWithOwner`, `acceptInviteAsMember`, `deleteChannelAndCancelSchedules`, `startTextGeneration`/`startImageGeneration` (credit + post + generation), `failGeneration` (FAILED + refund). |
| **D18 — Xoá mềm** | `Workspace`, `Post`, `CreditPackage`, `MediaAsset`; Prisma extension tự lọc `deletedAt: null`. | ✅ | `config/prismaExtensions.ts`; đọc bản ghi đã xoá cần `basePrisma`. |
| **D19 — Timezone** | UTC toàn hệ thống; API ISO-8601 UTC. | ✅ (quy ước) | Code dùng `Date`/ISO; không có xử lý timezone riêng ở service. |
| **D20 — Realtime** | MVP dùng notification in-app + polling; WebSocket/SSE để sau. | 🟡 | Chỉ ghi bảng `Notification`; **UC38 (API đọc) đã bỏ khỏi phạm vi**; chưa có polling/WebSocket. `socket.io` có trong dependencies nhưng không được dùng. |
| **D21 — n8n** | Không dùng n8n cho đăng bài; publish chạy bằng BullMQ worker. n8n (nếu có) chỉ dành cho analytics. | ✅ (đăng bài) | `schedule-queue` + `schedule.processor.ts`; không có code n8n. |
| **D22 — Trạng thái job AI** | `AiGeneration` là nguồn trạng thái (`PENDING/PROCESSING/SUCCESS/FAILED`); frontend poll 2 giây; credit trừ khi enqueue, hoàn khi thất bại hẳn trong cùng transaction. | ✅ | `ai.service.ts`, `ai.processor.ts`, `workers/index.ts`; `GET /ai/generations/:id` không dùng `aiLimiter`. |

## C. Đánh số Use Case

Xem bảng đầy đủ và trạng thái từng UC tại [`specs/README.md`](./specs/README.md). Các nhóm chính:

| Dải | Nội dung | Trạng thái |
| :--- | :--- | :--- |
| UC01, UC02, UC03 | Register, Login, Google OAuth | ✅ |
| UC04, UC05, UC33, UC34 | Logout, Đổi mật khẩu, Cập nhật hồ sơ, Refresh token | ✅ |
| UC06, UC08–UC12, UC15 | Bài viết, media, gửi duyệt, duyệt/từ chối | ✅ (Owner xoá mọi trạng thái; Creator chỉ `DRAFT`/`REJECTED`) |
| UC07, UC13, UC14, UC16 | AI, lên lịch/đăng bài Facebook | ✅ (AI còn thiếu Viral Score/regenerate; đăng bài chỉ Facebook) |
| UC17–UC24, UC35, UC36 | Workspace & thành viên | ✅ |
| UC25–UC30 | Brand Voice, kênh (chỉ Facebook) | 🟡 (Instagram/TikTok/Zalo chưa có) |
| UC31, UC40, UC41 | Nạp credit, PayOS, lịch sử credit | ✅ |
| UC32a/b | Admin | ✅ backend: dashboard, user, workspace, audit log (frontend `/admin` chưa có) |
| UC39 | Post Analytics (hiệu quả workspace) | ⛔ |
| UC42–UC43 | Giao việc | ✅ (`assigneeId`, `dueAt`, `taskStatus`, `assignedById/At`; chưa có `priority`) |

## D. Việc còn lại

- Analytics/n8n, calendar nâng cao, đăng bài đa kênh.
- Frontend `/admin`; đổi `systemRole`, xoá/khôi phục workspace, xuất audit log.
- Email cảnh báo hết credit và nhắc lịch đăng (D7).
- WebSocket/SSE, 2FA.
- Nâng cấp giao việc: Kanban, độ ưu tiên, nhắc hạn.
