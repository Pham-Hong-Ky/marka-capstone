# Sơ đồ lớp (Class Diagram) — Marka

> **Nguồn sự thật:** `backend/src/` và `backend/prisma/schema.prisma`.
> Sơ đồ chỉ mô tả các lớp nghiệp vụ đang có trong code, entity Prisma tương ứng và các client bên thứ ba thực sự được dùng.

## 1. Quy ước

- Mỗi class nghiệp vụ tương ứng **1 file module**; tên class trùng tên object export mặc định (`authController`, `workspaceService`, `postRepository`...).
- `+` là hàm export, `-` là helper nội bộ hoặc dependency được inject.
- **Lớp entity** (ánh xạ model Prisma) khai báo trực tiếp trong sơ đồ, tên class trùng tên model trong `schema.prisma` (`User`, `Workspace`...), chỉ gồm entity mà module/luồng trực tiếp dùng. Entity liệt kê **đầy đủ field scalar** kèm kiểu dữ liệu; không có method vì model Prisma chỉ mô tả dữ liệu. Quan hệ giữa entity (nếu có) vẽ bằng đường kết hợp, bội số ghi trong `docs/database_spec.md`.
- Các **client bên thứ ba** được đặt tên theo vai trò:

| Class trên sơ đồ | File/công nghệ tương ứng |
| :--- | :--- |
| `GoogleOAuth2Client` | `modules/auth/google-oauth.client.ts` |
| `MailerClient` | `utils/mailer.client.ts` (Resend) |
| `CloudinaryClient` | `utils/cloudinary.client.ts` |
| `FacebookClient` | `modules/channel/facebook.client.ts` (Graph API) |
| `BullMQ` | thư viện `bullmq` |

`oauthStore` không phải client mà là module Redis lưu state/session OAuth của Facebook (`modules/channel/channel.oauth-store.ts`).

- Không đưa vào sơ đồ: DTO, validation schema, mapper, middleware, utils JWT/password/cookie, config, enum.
- Phần dùng chung không vẽ: `auditService`/`auditRepository` (ghi `AuditLog`) và `Notification` — là tác dụng phụ cross-cutting của nhiều service, mô tả ở mục 4.
- Module không dùng client bên thứ ba (User, Brand Voice) chỉ có Controller → Service → Repository.

## 2. Danh sách sơ đồ

| # | Sơ đồ | Nguồn PlantUML | Ảnh |
| :-: | :--- | :--- | :--- |
| 0 | Tổng quan toàn hệ thống | [`class-diagram.puml`](./class-diagram.puml) | [`class-diagram-overview.png`](./class-diagram-overview.png) |
| 1 | Auth & User | [`diagrams/01-auth-user.puml`](./diagrams/01-auth-user.puml) | [`diagrams/01-auth-user.png`](./diagrams/01-auth-user.png) |
| 2 | Workspace & Member | [`diagrams/02-workspace.puml`](./diagrams/02-workspace.puml) | [`diagrams/02-workspace.png`](./diagrams/02-workspace.png) |
| 3 | Brand Voice | [`diagrams/03-brandvoice.puml`](./diagrams/03-brandvoice.puml) | [`diagrams/03-brandvoice.png`](./diagrams/03-brandvoice.png) |
| 4 | Channel & Facebook OAuth | [`diagrams/04-channel.puml`](./diagrams/04-channel.puml) | [`diagrams/04-channel.png`](./diagrams/04-channel.png) |
| 5 | Post, Media & Approval | [`diagrams/05-post.puml`](./diagrams/05-post.puml) | [`diagrams/05-post.png`](./diagrams/05-post.png) |
| 6 | Queue & Worker (BullMQ) | [`diagrams/06-system.puml`](./diagrams/06-system.puml) | [`diagrams/06-system.png`](./diagrams/06-system.png) |

Mỗi sơ đồ có kèm file `.svg` cùng tên.

Cả 6 sơ đồ module và sơ đồ tổng quan đều có lớp entity đầy đủ field scalar theo `schema.prisma`.

## 3. Module và client sử dụng

| Module | Controller | Service | Repository | Entity | Client bên thứ ba |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `auth` | `authController` | `authService` | dùng `userRepository` | `User`, `Workspace` (tạo mặc định) | `GoogleOAuth2Client` |
| `user` | `userController` | `userService` | `userRepository` | `User` | — |
| `workspace` | `workspaceController` | `workspaceService` | `workspaceRepository` | `Workspace`, `WorkspaceMember`, `WorkspaceInvite` | `MailerClient` |
| `brandvoice` | `brandVoiceController` | `brandVoiceService` | `brandVoiceRepository` | `Workspace` (cột `brandVoice`) | — |
| `channel` | `channelController` | `channelService` | `channelRepository` | `ChannelConnection` | `FacebookClient`, `oauthStore` |
| `post` | `postController` | `postService` | `postRepository` | `Post`, `MediaAsset` | `CloudinaryClient`, `MailerClient` (qua `PostNotification`) |
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

- OAuth dùng `state` và `session` lưu Redis 600 giây (`oauthStore`); Page token mã hoá AES-256-GCM.
- `FacebookClient` gọi Graph API v21.0 với các scope `pages_show_list`, `pages_read_engagement`, `pages_manage_posts`.
- `connectFacebookPages` upsert theo `(workspaceId, FACEBOOK, externalAccountId)`.
- `disconnectChannel` chuyển `ScheduledPost` đang `SCHEDULED` sang `CANCELLED` rồi xoá kênh.
- `verifyChannelToken` giải mã token, kiểm tra qua Graph API và cập nhật `ChannelConnection.status` (`ACTIVE`/`EXPIRED`).

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

### Queue & Worker

- 3 queue: `content-generation-queue`, `schedule-queue`, `email-queue`; `defaultJobOptions` có `attempts: 3`, backoff exponential 2s.
- Processor hiện chỉ log + `updateProgress(100)` + trả `{ success: true }`; **chưa module nào gọi `enqueue()`**.

## 5. Phần không có trong code

Không có lớp cho AI/OpenAI, Order/PayOS, Admin, analytics/n8n, Notification API hay UC42/UC43 — các phần này chỉ nằm trong Roadmap tại [`PROJECT_OVERVIEW.md`](./PROJECT_OVERVIEW.md). Lịch đăng/publish đã có module `schedule` + `scheduleWorker`.

## 6. Render lại sơ đồ

Cần Java + `plantuml.jar`:

```powershell
# Sơ đồ tổng quan rộng hơn 4096px nên cần nới giới hạn xuất ảnh của PlantUML
java -DPLANTUML_LIMIT_SIZE=16384 -jar plantuml.jar -tpng -charset UTF-8 docs/class-diagram.puml docs/diagrams
java -DPLANTUML_LIMIT_SIZE=16384 -jar plantuml.jar -tsvg -charset UTF-8 docs/class-diagram.puml docs/diagrams
```

Hoặc mở file `.puml` bằng extension PlantUML trong VS Code (`Alt + D`).
