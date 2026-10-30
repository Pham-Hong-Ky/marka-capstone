# Sơ đồ lớp (Class Diagram) — Marka

> **Nguồn sự thật:** `backend/src/` và `backend/prisma/schema.prisma`.
> Sơ đồ chỉ mô tả các lớp nghiệp vụ đang có trong code, entity Prisma tương ứng và các client bên thứ ba thực sự được dùng.

## 1. Quy ước

- Mỗi class nghiệp vụ tương ứng **1 file module**; tên class trùng tên object export mặc định (`authController`, `workspaceService`, `postRepository`...).
- `+` là hàm export, `-` là helper nội bộ. **Controller, Service, Repository, Client, Processor chỉ hiển thị hàm**; không hiển thị thuộc tính/dependency field để sơ đồ gọn.
- **Chỉ lớp entity** (ánh xạ model Prisma) mới có thuộc tính. Entity liệt kê **đầy đủ field scalar** kèm kiểu dữ liệu; không có method vì model Prisma chỉ mô tả dữ liệu. Quan hệ giữa entity vẽ ở sơ đồ tổng quan (ERD) bằng ký hiệu chân vịt, bội số lấy từ `schema.prisma`.
- Các module helper thuần hàm (`ai.prompt`, `ai.image-prompt`, `ai.generation`, `ai.config`, `analytics.aggregate`, `analytics.suggestion`, `schedule.content`) **không vẽ thành class riêng** để tránh rối; chức năng được ghi chú ở mục 4.
- Các **client bên thứ ba** được đặt tên theo vai trò:

| Class trên sơ đồ | File/công nghệ tương ứng |
| :--- | :--- |
| `GoogleOAuth2Client` | `modules/auth/google-oauth.client.ts` |
| `MailerClient` | `utils/mailer.client.ts` (Resend) |
| `CloudinaryClient` | `utils/cloudinary.client.ts` |
| `ProviderRegistry` | `modules/channel/providers/provider.registry.ts` (Facebook/Threads) |
| `PayOSClient` | `modules/billing/billing.payos.ts` (`@payos/node`) |
| `GeminiClient` | `modules/ai/ai.providers.ts` (Gemini API) |
| `CloudflareImageClient` | `modules/ai/ai.providers.ts` (Cloudflare Workers AI) |
| `BullMQ` | thư viện `bullmq` |

`oauthStore` không phải client mà là module Redis lưu state/session OAuth của Facebook/Threads (`modules/channel/channel.oauth-store.ts`).

- Không đưa vào sơ đồ: DTO, validation schema, mapper, middleware, utils JWT/password/cookie, config, enum.
- `auditService`/`auditRepository` (ghi `AuditLog`) là tác dụng phụ cross-cutting của nhiều service, **không vẽ**; `health` cũng không vẽ. `Notification` có sơ đồ riêng (12), nhưng `createNotification` được gọi từ module khác nên không vẽ mũi tên từ mọi service.
- Module không dùng client bên thứ ba (User, Brand Voice, Admin, Notification) chỉ có Controller → Service → Repository.

## 2. Danh sách sơ đồ

| # | Sơ đồ | Nguồn PlantUML | Ảnh |
| :-: | :--- | :--- | :--- |
| 0 | Tổng quan lớp & thực thể (16 bảng) | [`class-diagram.puml`](./class-diagram.puml) | [`class-diagram-overview.png`](./class-diagram-overview.png) |
| 1 | Auth & User | [`diagrams/01-auth-user.puml`](./diagrams/01-auth-user.puml) | [`diagrams/01-auth-user.png`](./diagrams/01-auth-user.png) |
| 2 | Workspace & Member | [`diagrams/02-workspace.puml`](./diagrams/02-workspace.puml) | [`diagrams/02-workspace.png`](./diagrams/02-workspace.png) |
| 3 | Brand Voice | [`diagrams/03-brandvoice.puml`](./diagrams/03-brandvoice.puml) | [`diagrams/03-brandvoice.png`](./diagrams/03-brandvoice.png) |
| 4 | Channel & Facebook OAuth | [`diagrams/04-channel.puml`](./diagrams/04-channel.puml) | [`diagrams/04-channel.png`](./diagrams/04-channel.png) |
| 5 | Post, Media & Approval | [`diagrams/05-post.puml`](./diagrams/05-post.puml) | [`diagrams/05-post.png`](./diagrams/05-post.png) |
| 6 | Queue & Worker (BullMQ) | [`diagrams/06-system.puml`](./diagrams/06-system.puml) | [`diagrams/06-system.png`](./diagrams/06-system.png) |
| 7 | Schedule & Publish | [`diagrams/07-schedule.puml`](./diagrams/07-schedule.puml) | [`diagrams/07-schedule.png`](./diagrams/07-schedule.png) |
| 8 | Billing, PayOS & Credit | [`diagrams/08-billing-credit.puml`](./diagrams/08-billing-credit.puml) | [`diagrams/08-billing-credit.png`](./diagrams/08-billing-credit.png) |
| 9 | AI Generation | [`diagrams/09-ai.puml`](./diagrams/09-ai.puml) | [`diagrams/09-ai.png`](./diagrams/09-ai.png) |
| 10 | Post Analytics | [`diagrams/10-analytics.puml`](./diagrams/10-analytics.puml) | [`diagrams/10-analytics.png`](./diagrams/10-analytics.png) |
| 11 | System Admin | [`diagrams/11-admin.puml`](./diagrams/11-admin.puml) | [`diagrams/11-admin.png`](./diagrams/11-admin.png) |
| 12 | Notification | [`diagrams/12-notification.puml`](./diagrams/12-notification.puml) | [`diagrams/12-notification.png`](./diagrams/12-notification.png) |

Mỗi sơ đồ có kèm file `.svg` cùng tên.

Sơ đồ 0 gộp **lớp nghiệp vụ + 16 bảng entity** trong cùng một ảnh: các lớp controller/service/repository/client/processor ở một khối, entity và quan hệ chân vịt ở khối còn lại. Sơ đồ tổng quan chỉ liệt kê các hàm chính; chi tiết đầy đủ nằm ở sơ đồ module 1–12.

## 3. Module và client sử dụng

| Module | Controller | Service | Repository | Entity | Client bên thứ ba |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `auth` | `authController` | `authService` | dùng `userRepository` | `User`, `Workspace` (tạo mặc định) | `GoogleOAuth2Client` |
| `user` | `userController` | `userService` | `userRepository` | `User` | — |
| `workspace` | `workspaceController` | `workspaceService` | `workspaceRepository` | `Workspace`, `WorkspaceMember`, `WorkspaceInvite` | `MailerClient` |
| `brandvoice` | `brandVoiceController` | `brandVoiceService` | `brandVoiceRepository` | `Workspace` (cột `brandVoice`) | — |
| `channel` | `channelController` | `channelService` | `channelRepository` | `ChannelConnection` | `ProviderRegistry` (Facebook/Threads), `oauthStore` |
| `post` | `postController` | `postService` | `postRepository` | `Post`, `MediaAsset` | `CloudinaryClient`, `MailerClient` (qua `PostNotification`) |
| `schedule` | `scheduleController` | `scheduleService` | `scheduleRepository` | `ScheduledPost`, `Post`, `ChannelConnection` | `ProviderRegistry` (Facebook/Threads) |
| `billing` | `billingController` | `billingService` | `billingRepository` | `Order`, `CreditPackage`, `CreditTransaction`, `Workspace` | `PayOSClient` |
| `credit` | — (service dùng chung) | `creditService` | `creditRepository` | `CreditTransaction`, `Workspace` | — |
| `ai` | `aiController` | `aiService` | `aiRepository` | `AiGeneration`, `Post`, `MediaAsset` | `GeminiClient`, `CloudflareImageClient`, `CloudinaryClient` |
| `analytics` | `analyticsController` | `analyticsService` | `analyticsRepository` | `ScheduledPost`, `PostMetric`, `Post`, `ChannelConnection` | `ProviderRegistry` (Facebook/Threads) |
| `admin` | `adminController` | `adminService` | `adminRepository` | `User`, `Workspace`, `Post`, `ChannelConnection`, `Order` | — |
| `notification` | `notificationController` | `notificationService` | `notificationRepository` | `Notification`, `WorkspaceMember` | — |
| `health` | `healthController` | `healthService` | — | — | — |
| `audit` | `auditController` | `auditService` | `auditRepository` | `AuditLog` | — |
| `workers` | — | — | — | — | `BullMQ` |

## 4. Ghi chú hành vi (không vẽ trong sơ đồ)

### Auth & User

- `authService.registerUser` tạo User + Workspace mặc định + WorkspaceMember(OWNER) trong cùng transaction.
- Refresh token là JWT stateless trong cookie HttpOnly; không có bảng refresh token. Logout/đổi mật khẩu tăng `User.tokenVersion` để thu hồi token cũ.
- `GoogleOAuth2Client` chỉ dùng để verify `idToken`; email Google phải đã xác minh.

### Workspace

- `inviteMember` gửi email trước, chỉ lưu/cập nhật `WorkspaceInvite` khi gửi thành công.
- `acceptInvite` dùng transaction để đánh dấu lời mời đã dùng và tạo thành viên.
- Không thể rời/xoá/hạ vai trò Owner cuối cùng.
- `deleteWorkspace` xoá mềm Workspace và chuyển các kênh chưa `EXPIRED` sang `EXPIRED`.

### Brand Voice

- Lưu trong `Workspace.brandVoice` (Json), không có bảng riêng.
- `updateBrandVoice` khử trùng lặp hai mảng từ khoá trước khi ghi.

### Channel

- OAuth dùng `state` và `session` lưu Redis 600 giây (`oauthStore`); token kênh mã hoá AES-256-GCM.
- `ProviderRegistry` chọn `FacebookProvider` hoặc `ThreadsProvider`; Facebook gọi Graph API v21.0, Threads gọi `graph.threads.com/v1.0`.
- Facebook dùng multi-account + session chọn Page; Threads single-account, upsert ngay sau callback.
- `connectAccounts` upsert theo `(workspaceId, platform, externalAccountId)`.
- `disconnectChannel` chuyển `ScheduledPost` đang `SCHEDULED` sang `CANCELLED`, rồi xoá mềm kênh (`deletedAt`, `accessToken = null`, `status = EXPIRED`) để giữ lịch sử bài đã đăng và `PostMetric`.
- `markChannelExpired` chỉ cập nhật `ChannelConnection.status` sang `EXPIRED` khi token hết hạn lúc đăng/đồng bộ.

### Post

- `ALLOWED_TRANSITIONS`:

| Từ | Đến |
| :--- | :--- |
| `DRAFT` | `PENDING` |
| `PENDING` | `APPROVED`, `REJECTED` |
| `REJECTED` | `PENDING` |
| `APPROVED`, `SCHEDULED`, `PUBLISHED`, `FAILED`, `ARCHIVED` | không có |

- Chỉ `DRAFT`/`REJECTED` được sửa, xoá, upload/xoá ảnh.
- `OWNER` thao tác mọi bài; `CONTENT_CREATOR` chỉ thao tác bài do mình tạo.
- `submitPost` và `reviewPost` ghi notification + gửi email qua `PostNotification` → `MailerClient`.
- Ảnh upload qua `CloudinaryClient`, lưu `MediaAsset` với `type=IMAGE`, `source=UPLOADED`.

### Schedule

- Chỉ bài `APPROVED`, `PUBLISHED` hoặc `FAILED` được đăng/lên lịch; kênh phải là `FACEBOOK`, `REAL`, `ACTIVE`.
- Giới hạn: tối đa 10 kênh, 10 ảnh, nội dung 63.206 ký tự; hẹn đăng từ 1 phút đến 1 năm. Không có `scheduledAt` → đăng ngay qua `schedule-queue`.
- `createSchedulesForPost` chạy transaction: chuyển `Post` sang `SCHEDULED`, upsert `ScheduledPost` theo `(postId, channelId)`.
- `claimSchedule` nguyên tử `SCHEDULED → PROCESSING` để tránh đăng trùng; lỗi tạm thời được thử lại sau 30 giây / 2 phút / 10 phút (tối đa 3 lần).
- Token hết hạn → `ChannelConnection` chuyển `EXPIRED`; lịch `PROCESSING` quá 10 phút bị coi là stale và chuyển `FAILED`.
- Sau mỗi thay đổi, `recomputePostStatus` suy ra trạng thái `Post` từ toàn bộ lịch của bài.
- Scheduler `schedule-due` chạy mỗi 60 giây để nhặt các lịch đến hạn.
- Các phụ thuộc không vẽ để gọn sơ đồ: `channelRepository.updateChannelStatus`, `auditService`, `renderContentToPlainText`.

### Billing & Credit

- `createOrder` tạo `Order` PENDING rồi gọi PayOS tạo link thanh toán; tạo link lỗi thì đơn chuyển `CANCELLED`.
- Webhook PayOS được xác thực chữ ký; `claimPaidOrder` đổi `PENDING → PAID` theo kiểu idempotent, sau đó cộng credit và ghi `CreditTransaction` (`TOP_UP`) trong cùng transaction.
- `cancelOrder` chỉ cho người tạo đơn và chỉ khi đơn còn `PENDING`.
- `getOrder` đối soát lại trạng thái với PayOS khi đơn còn chờ.
- `creditService.reserve` trừ credit nguyên tử (chỉ khi đủ) và ghi `OUTFLOW`; `refund` cộng lại và ghi `REFUND`. AI và các luồng tiêu credit dùng service này.
- Billing không dùng queue.

### AI

- `POST /ai/text` và `POST /ai/image` trả `202`: reserve credit + tạo `AiGeneration` PENDING trong transaction rồi enqueue vào `content-generation-queue`.
- Worker text gọi Gemini (JSON schema), worker ảnh gọi Cloudflare FLUX; ảnh sau đó upload Cloudinary và lưu `MediaAsset` (`AI_GENERATED`).
- Generation lỗi hẳn thì hoàn credit; lỗi tạm thời để BullMQ retry, lỗi không phục hồi bọc `UnrecoverableError`.
- Tạo ảnh cho bài mới sẽ tạo luôn `Post` nháp; chỉ bài `DRAFT`/`REJECTED` được nhận ảnh AI.
- `AiGeneration.prompt` và `response` lưu chuỗi JSON; API đọc ra parse lại khi trả kết quả.
- Các phụ thuộc không vẽ: `creditService` (reserve/refund), `brandVoiceService`, `postRepository`, `queueManager` và các helper `ai.generation`/`ai.prompt`/`ai.image-prompt`/`ai.config`.

### Analytics

- `getOverview` tính summary, delta so với kỳ trước, series theo ngày Việt Nam và độ phủ dữ liệu (bài đã đăng / đã đồng bộ).
- `getSuggestions` dùng dữ liệu 90 ngày để gợi ý khung giờ đăng tốt và các lỗi nội dung; nếu thiếu mẫu thì dùng khung giờ benchmark.
- `syncMetrics` lấy bài `PUBLISHED` trong 30 ngày, upsert `PostMetric`; lỗi lưu `syncError`, token hết hạn chuyển kênh sang `EXPIRED`.
- Scheduler `analytics-sync` chạy mỗi 6 giờ; `triggerSync` đưa yêu cầu vào `analytics-queue`.
- Các helper `analytics.aggregate`/`analytics.suggestion` và `schedule.content` không vẽ thành class riêng.

### Admin

- `getStats` đếm user/workspace/post/channel và doanh thu 30 ngày.
- `setUserSuspension` không cho tự khoá chính mình; mỗi lần khoá/mở đều tăng `User.tokenVersion` để thu hồi phiên cũ.
- `listWorkspaces` có `includeDeleted`, dùng `basePrisma` để bỏ qua soft-delete filter.
- Mọi thao tác khoá/mở tài khoản ghi `AuditLog` (không vẽ trong sơ đồ).

### Notification

- `listNotifications`, `getUnreadCount`, `markNotificationRead`, `markAllNotificationsRead` đều scope theo `userId`.
- Khi lọc theo workspace, service kiểm tra membership qua `workspaceRepository.findMember`.
- `createNotification` được gọi từ post/workspace (cross-cutting), không vẽ mũi tên từ các service đó.

### Queue & Worker

- 5 queue: `content-generation-queue`, `schedule-queue`, `analytics-queue`, `channel-maintenance-queue`, `task-reminder-queue`; `defaultJobOptions` có `attempts: 3`, backoff exponential 2s. Billing không dùng queue.
- Cả 5 worker content/schedule/analytics/channel/task-reminder đã nối processor thật; Redis producer tách riêng kết nối để không treo request khi Redis mất kết nối.

## 5. Phạm vi loại trừ

- `health` **không vẽ** vì quá nhỏ. `auditService`/`auditRepository` không vẽ vì là cross-cutting; riêng bảng `AuditLog` vẫn có trong sơ đồ tổng quan.
- `analytics/n8n` chưa có trong code (chỉ có analytics nội bộ).
- UC38 (thông báo realtime) chưa có; API đọc hộp thư đã có ở sơ đồ 12.
- Toàn bộ module nghiệp vụ còn lại của backend đều đã có sơ đồ lớp.

## 6. Render lại sơ đồ

Cần Java + `plantuml.jar`:

```powershell
# Giữ giới hạn lớn để render đủ sơ đồ tổng quan và các sơ đồ module
java -DPLANTUML_LIMIT_SIZE=16384 -jar plantuml.jar -tpng -charset UTF-8 docs/class-diagram.puml docs/diagrams
java -DPLANTUML_LIMIT_SIZE=16384 -jar plantuml.jar -tsvg -charset UTF-8 docs/class-diagram.puml docs/diagrams
```

Hoặc mở file `.puml` bằng extension PlantUML trong VS Code (`Alt + D`).
