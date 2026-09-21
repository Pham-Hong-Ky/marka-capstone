# Thiết kế Cơ sở Dữ liệu — Hệ thống Marka

> **Database:** PostgreSQL &nbsp;|&nbsp; **ORM:** Prisma &nbsp;|&nbsp; **Tổng số bảng:** 17

---

## ERD Tổng quan

![ERD Hệ thống Marka](C:\Users\ADMIN88\.gemini\antigravity-ide\brain\517a698a-b390-438b-b2b2-97f9ed11860b\erd_marka_diagram_1787300110324.jpg)

---

## 1. Nhóm Auth & User

### Bảng `users`

| Tên cột | Kiểu dữ liệu | Ràng buộc | Mô tả |
|---------|-------------|-----------|-------|
| `id` | VARCHAR(36) | PK | Định danh duy nhất (UUID) |
| `email` | VARCHAR(255) | UNIQUE, NOT NULL | Địa chỉ email đăng nhập |
| `passwordHash` | VARCHAR(255) | NULL | Mật khẩu đã mã hoá (bcrypt) |
| `name` | VARCHAR(255) | NOT NULL | Tên hiển thị |
| `avatar` | VARCHAR(255) | NULL | URL ảnh đại diện |
| `authProvider` | ENUM | NOT NULL | Phương thức đăng nhập: `LOCAL`, `GOOGLE` |
| `googleId` | VARCHAR(255) | NULL | Google OAuth ID |
| `emailVerified` | BOOLEAN | DEFAULT false | Trạng thái xác thực email |
| `verificationToken` | VARCHAR(255) | NULL | Token xác thực email |
| `systemRole` | ENUM | DEFAULT USER | Vai trò hệ thống: `SYSTEM_ADMIN`, `USER` |
| `tokenVersion` | INT | DEFAULT 1 | Phiên bản token (dùng để vô hiệu hoá JWT) |
| `isSuspended` | BOOLEAN | DEFAULT false | Trạng thái bị khoá tài khoản |
| `createdAt` | DATETIME | NOT NULL | Thời điểm tạo |
| `updatedAt` | DATETIME | NOT NULL | Thời điểm cập nhật |

### Bảng `refresh_tokens`

| Tên cột | Kiểu dữ liệu | Ràng buộc | Mô tả |
|---------|-------------|-----------|-------|
| `id` | VARCHAR(36) | PK | Định danh duy nhất |
| `token` | VARCHAR(255) | UNIQUE, NOT NULL | Chuỗi refresh token |
| `userId` | VARCHAR(36) | FK → users | Người dùng sở hữu token |
| `revoked` | BOOLEAN | DEFAULT false | Token đã bị thu hồi |
| `expiresAt` | DATETIME | NOT NULL | Thời điểm hết hạn |
| `createdAt` | DATETIME | NOT NULL | Thời điểm tạo |
| `updatedAt` | DATETIME | NOT NULL | Thời điểm cập nhật |

---

## 2. Nhóm Workspace Management

### Bảng `workspaces`

| Tên cột | Kiểu dữ liệu | Ràng buộc | Mô tả |
|---------|-------------|-----------|-------|
| `id` | VARCHAR(36) | PK | Định danh duy nhất |
| `name` | VARCHAR(255) | NOT NULL | Tên workspace |
| `logo` | VARCHAR(255) | NULL | URL logo |
| `plan` | ENUM | DEFAULT FREE | Gói dịch vụ: `FREE`, `PRO`, `ENTERPRISE` |
| `remainingCredit` | INT | DEFAULT 100 | Số credit còn lại |
| `monthlyQuota` | INT | DEFAULT 100 | Hạn mức credit hàng tháng |
| `planExpiresAt` | DATETIME | NULL | Thời điểm hết hạn gói |
| `deletedAt` | DATETIME | NULL | Thời điểm xoá mềm |
| `createdAt` | DATETIME | NOT NULL | Thời điểm tạo |
| `updatedAt` | DATETIME | NOT NULL | Thời điểm cập nhật |

### Bảng `workspace_members`

| Tên cột | Kiểu dữ liệu | Ràng buộc | Mô tả |
|---------|-------------|-----------|-------|
| `id` | VARCHAR(36) | PK | Định danh duy nhất |
| `workspaceId` | VARCHAR(36) | FK → workspaces | Workspace |
| `userId` | VARCHAR(36) | FK → users | Thành viên |
| `role` | ENUM | DEFAULT CONTENT_CREATOR | Vai trò: `OWNER`, `CONTENT_CREATOR` |
| `allowDirectPublish` | BOOLEAN | DEFAULT false | Quyền đăng bài trực tiếp |
| `createdAt` | DATETIME | NOT NULL | Thời điểm tham gia |
| `updatedAt` | DATETIME | NOT NULL | Thời điểm cập nhật |

> **Ràng buộc:** UNIQUE(`userId`, `workspaceId`) — mỗi user chỉ là thành viên một lần.

### Bảng `workspace_invites`

| Tên cột | Kiểu dữ liệu | Ràng buộc | Mô tả |
|---------|-------------|-----------|-------|
| `id` | VARCHAR(36) | PK | Định danh duy nhất |
| `email` | VARCHAR(255) | NOT NULL | Email được mời |
| `workspaceId` | VARCHAR(36) | FK → workspaces | Workspace mời |
| `role` | ENUM | DEFAULT CONTENT_CREATOR | Vai trò được cấp khi chấp nhận |
| `token` | VARCHAR(255) | UNIQUE | Token xác thực lời mời |
| `isUsed` | BOOLEAN | DEFAULT false | Đã sử dụng chưa |
| `expiresAt` | DATETIME | NOT NULL | Thời điểm hết hạn |
| `invitedById` | VARCHAR(36) | FK → users, NULL | Người gửi lời mời |
| `createdAt` | DATETIME | NOT NULL | Thời điểm tạo |

### Bảng `brand_voices`

| Tên cột | Kiểu dữ liệu | Ràng buộc | Mô tả |
|---------|-------------|-----------|-------|
| `id` | VARCHAR(36) | PK | Định danh duy nhất |
| `workspaceId` | VARCHAR(36) | FK → workspaces, UNIQUE | Workspace sở hữu (1:1) |
| `industry` | VARCHAR(255) | NOT NULL | Lĩnh vực kinh doanh |
| `targetAudience` | VARCHAR(255) | NOT NULL | Đối tượng khách hàng mục tiêu |
| `keywordsShouldUse` | TEXT | NULL | Từ khoá nên dùng |
| `keywordsAvoid` | TEXT | NULL | Từ khoá cần tránh |
| `fewShotExamples` | JSON | NULL | Ví dụ nội dung mẫu |
| `createdAt` | DATETIME | NOT NULL | Thời điểm tạo |
| `updatedAt` | DATETIME | NOT NULL | Thời điểm cập nhật |

---

## 3. Nhóm Nội dung & Media

### Bảng `posts`

| Tên cột | Kiểu dữ liệu | Ràng buộc | Mô tả |
|---------|-------------|-----------|-------|
| `id` | VARCHAR(36) | PK | Định danh duy nhất |
| `workspaceId` | VARCHAR(36) | FK → workspaces | Workspace chứa bài viết |
| `title` | VARCHAR(255) | NOT NULL | Tiêu đề bài viết |
| `content` | JSON | NOT NULL | Nội dung bài viết (rich text) |
| `status` | ENUM | DEFAULT DRAFT | Trạng thái: `DRAFT`, `PENDING`, `APPROVED`, `REJECTED`, `SCHEDULED`, `PUBLISHED`, `FAILED`, `ARCHIVED` |
| `campaignTag` | VARCHAR(255) | NULL | Tag chiến dịch |
| `rejectReason` | VARCHAR(255) | NULL | Lý do từ chối |
| `submittedById` | VARCHAR(36) | FK → users, NULL | Người nộp bài duyệt |
| `submittedAt` | DATETIME | NULL | Thời điểm nộp duyệt |
| `reviewedById` | VARCHAR(36) | FK → users, NULL | Người duyệt bài |
| `reviewedAt` | DATETIME | NULL | Thời điểm duyệt |
| `deletedAt` | DATETIME | NULL | Thời điểm xoá mềm |
| `createdAt` | DATETIME | NOT NULL | Thời điểm tạo |
| `updatedAt` | DATETIME | NOT NULL | Thời điểm cập nhật |

### Bảng `post_media` *(Junction Table)*

| Tên cột | Kiểu dữ liệu | Ràng buộc | Mô tả |
|---------|-------------|-----------|-------|
| `postId` | VARCHAR(36) | PK, FK → posts | Bài viết |
| `mediaAssetId` | VARCHAR(36) | PK, FK → media_assets | File media |

> **Quan hệ N:M** giữa `posts` và `media_assets`.

### Bảng `media_assets`

| Tên cột | Kiểu dữ liệu | Ràng buộc | Mô tả |
|---------|-------------|-----------|-------|
| `id` | VARCHAR(36) | PK | Định danh duy nhất |
| `workspaceId` | VARCHAR(36) | FK → workspaces | Workspace sở hữu |
| `url` | VARCHAR(255) | NOT NULL | URL file media |
| `type` | ENUM | NOT NULL | Loại: `IMAGE`, `VIDEO` |
| `mimeType` | VARCHAR(100) | NULL | MIME type (vd: `image/jpeg`) |
| `thumbnailUrl` | VARCHAR(255) | NULL | URL ảnh thumbnail |
| `size` | INT | NOT NULL | Kích thước file (bytes) |
| `tags` | VARCHAR(255) | NULL | Thẻ phân loại |
| `source` | ENUM | DEFAULT UPLOADED | Nguồn gốc: `UPLOADED`, `AI_GENERATED` |
| `createdById` | VARCHAR(36) | FK → users, NULL | Người tải lên |
| `createdAt` | DATETIME | NOT NULL | Thời điểm tạo |

---

## 4. Nhóm Duyệt bài

### Bảng `approval_histories`

| Tên cột | Kiểu dữ liệu | Ràng buộc | Mô tả |
|---------|-------------|-----------|-------|
| `id` | VARCHAR(36) | PK | Định danh duy nhất |
| `postId` | VARCHAR(36) | FK → posts | Bài viết liên quan |
| `actorId` | VARCHAR(36) | FK → users, NULL | Người thực hiện hành động |
| `action` | ENUM | NOT NULL | Hành động: `SUBMIT`, `APPROVE`, `REJECT` |
| `reason` | VARCHAR(255) | NULL | Lý do (khi REJECT) |
| `createdAt` | DATETIME | NOT NULL | Thời điểm thực hiện |

---

## 5. Nhóm Kênh & Đăng bài

### Bảng `channel_connections`

| Tên cột | Kiểu dữ liệu | Ràng buộc | Mô tả |
|---------|-------------|-----------|-------|
| `id` | VARCHAR(36) | PK | Định danh duy nhất |
| `workspaceId` | VARCHAR(36) | FK → workspaces | Workspace sở hữu kênh |
| `platform` | ENUM | NOT NULL | Nền tảng: `FACEBOOK`, `INSTAGRAM`, `TIKTOK`, `ZALO` |
| `type` | ENUM | DEFAULT SIMULATED | Loại: `REAL`, `SIMULATED` |
| `name` | VARCHAR(255) | NOT NULL | Tên kênh / fanpage |
| `avatar` | VARCHAR(255) | NULL | Ảnh đại diện kênh |
| `externalAccountId` | VARCHAR(255) | NOT NULL | ID tài khoản trên nền tảng |
| `accessToken` | TEXT | NULL | Access token (đã mã hoá) |
| `status` | ENUM | DEFAULT ACTIVE | Trạng thái: `ACTIVE`, `EXPIRED` |
| `createdAt` | DATETIME | NOT NULL | Thời điểm kết nối |
| `updatedAt` | DATETIME | NOT NULL | Thời điểm cập nhật |

> **Ràng buộc:** UNIQUE(`workspaceId`, `platform`, `externalAccountId`)

### Bảng `scheduled_posts`

| Tên cột | Kiểu dữ liệu | Ràng buộc | Mô tả |
|---------|-------------|-----------|-------|
| `id` | VARCHAR(36) | PK | Định danh duy nhất |
| `postId` | VARCHAR(36) | FK → posts | Bài viết |
| `channelId` | VARCHAR(36) | FK → channel_connections | Kênh đăng |
| `customContent` | JSON | NULL | Nội dung tuỳ chỉnh theo kênh |
| `scheduledAt` | DATETIME | NULL | Thời điểm dự kiến đăng |
| `status` | ENUM | DEFAULT SCHEDULED | Trạng thái: `SCHEDULED`, `PUBLISHED`, `FAILED` |
| `externalPostId` | VARCHAR(255) | NULL | ID bài đăng trên nền tảng |
| `errorMessage` | TEXT | NULL | Thông báo lỗi khi thất bại |
| `retryCount` | INT | DEFAULT 0 | Số lần thử lại |
| `createdAt` | DATETIME | NOT NULL | Thời điểm tạo |
| `updatedAt` | DATETIME | NOT NULL | Thời điểm cập nhật |

---

## 6. Nhóm AI & Credit

### Bảng `ai_generations`

| Tên cột | Kiểu dữ liệu | Ràng buộc | Mô tả |
|---------|-------------|-----------|-------|
| `id` | VARCHAR(36) | PK | Định danh duy nhất |
| `workspaceId` | VARCHAR(36) | FK → workspaces | Workspace yêu cầu |
| `userId` | VARCHAR(36) | FK → users, NULL | Người dùng yêu cầu |
| `postId` | VARCHAR(36) | FK → posts, NULL | Bài viết liên kết |
| `type` | ENUM | NOT NULL | Loại: `TEXT`, `IMAGE`, `VIRAL_SCORE`, `REGENERATE` |
| `provider` | VARCHAR(100) | NOT NULL | Nhà cung cấp AI (vd: `openai`) |
| `model` | VARCHAR(100) | NOT NULL | Mô hình AI (vd: `gpt-4o`) |
| `status` | ENUM | DEFAULT SUCCESS | Trạng thái: `SUCCESS`, `FAILED` |
| `prompt` | TEXT | NOT NULL | Prompt gửi lên AI |
| `response` | TEXT | NOT NULL | Kết quả trả về từ AI |
| `creditCost` | INT | NOT NULL | Số credit tiêu thụ |
| `createdAt` | DATETIME | NOT NULL | Thời điểm tạo |

### Bảng `credit_transactions`

| Tên cột | Kiểu dữ liệu | Ràng buộc | Mô tả |
|---------|-------------|-----------|-------|
| `id` | VARCHAR(36) | PK | Định danh duy nhất |
| `workspaceId` | VARCHAR(36) | FK → workspaces | Workspace liên quan |
| `type` | ENUM | NOT NULL | Luồng: `INFLOW` (nạp), `OUTFLOW` (dùng) |
| `action` | ENUM | NOT NULL | Loại hành động: `GEN_TEXT`, `GEN_IMAGE`, `TOP_UP`, `REFUND`,... |
| `amount` | INT | NOT NULL | Số credit thay đổi |
| `balanceBefore` | INT | NOT NULL | Số dư trước giao dịch |
| `balanceAfter` | INT | NOT NULL | Số dư sau giao dịch |
| `reason` | VARCHAR(255) | NULL | Ghi chú |
| `createdById` | VARCHAR(36) | FK → users, NULL | Người thực hiện |
| `createdAt` | DATETIME | NOT NULL | Thời điểm giao dịch |

### Bảng `orders`

| Tên cột | Kiểu dữ liệu | Ràng buộc | Mô tả |
|---------|-------------|-----------|-------|
| `id` | VARCHAR(36) | PK | Định danh duy nhất |
| `orderCode` | VARCHAR(100) | UNIQUE | Mã đơn hàng (PayOS) |
| `workspaceId` | VARCHAR(36) | FK → workspaces | Workspace đặt mua |
| `amount` | INT | NOT NULL | Số tiền (VND) |
| `creditAmount` | INT | NULL | Số credit mua |
| `targetPlan` | ENUM | NULL | Gói nâng cấp: `FREE`, `PRO`, `ENTERPRISE` |
| `payosTransId` | VARCHAR(255) | NULL | ID giao dịch PayOS |
| `paidAt` | DATETIME | NULL | Thời điểm thanh toán thành công |
| `status` | ENUM | DEFAULT PENDING | Trạng thái: `PENDING`, `PAID`, `CANCELLED` |
| `createdById` | VARCHAR(36) | FK → users, NULL | Người tạo đơn |
| `createdAt` | DATETIME | NOT NULL | Thời điểm tạo |
| `updatedAt` | DATETIME | NOT NULL | Thời điểm cập nhật |

---

## 7. Nhóm Hệ thống

### Bảng `notifications`

| Tên cột | Kiểu dữ liệu | Ràng buộc | Mô tả |
|---------|-------------|-----------|-------|
| `id` | VARCHAR(36) | PK | Định danh duy nhất |
| `userId` | VARCHAR(36) | FK → users | Người nhận thông báo |
| `workspaceId` | VARCHAR(36) | FK → workspaces, NULL | Workspace liên quan |
| `type` | VARCHAR(100) | NOT NULL | Loại thông báo (vd: `POST_APPROVED`) |
| `payload` | JSON | NOT NULL | Dữ liệu chi tiết thông báo |
| `isRead` | BOOLEAN | DEFAULT false | Đã đọc chưa |
| `createdAt` | DATETIME | NOT NULL | Thời điểm tạo |

### Bảng `audit_logs`

| Tên cột | Kiểu dữ liệu | Ràng buộc | Mô tả |
|---------|-------------|-----------|-------|
| `id` | VARCHAR(36) | PK | Định danh duy nhất |
| `workspaceId` | VARCHAR(36) | FK → workspaces, NULL | Workspace liên quan |
| `actorId` | VARCHAR(36) | FK → users, NULL | Người thực hiện hành động |
| `action` | VARCHAR(100) | NOT NULL | Hành động (vd: `MEMBER_REMOVED`) |
| `targetType` | VARCHAR(100) | NOT NULL | Loại đối tượng tác động (vd: `Post`) |
| `targetId` | VARCHAR(255) | NULL | ID đối tượng tác động |
| `metadata` | JSON | NULL | Dữ liệu bổ sung |
| `createdAt` | DATETIME | NOT NULL | Thời điểm ghi log |

---

## Tổng hợp các mối quan hệ

| STT | Bảng A | Kiểu | Bảng B | On Delete |
|-----|--------|------|--------|-----------|
| 1 | `users` | N:M | `workspaces` | Cascade (qua `workspace_members`) |
| 2 | `users` | 1:N | `workspace_invites` | SetNull |
| 3 | `workspaces` | 1:1 | `brand_voices` | Cascade |
| 4 | `workspaces` | 1:N | `posts` | Cascade |
| 5 | `posts` | N:M | `media_assets` | Cascade (qua `post_media`) |
| 6 | `workspaces` | 1:N | `media_assets` | Cascade |
| 7 | `workspaces` | 1:N | `channel_connections` | Cascade |
| 8 | `posts` | 1:N | `scheduled_posts` | Cascade |
| 9 | `channel_connections` | 1:N | `scheduled_posts` | Cascade |
| 10 | `posts` | 1:N | `approval_histories` | Cascade |
| 11 | `users` | 1:N | `approval_histories` | SetNull |
| 12 | `workspaces` | 1:N | `ai_generations` | Cascade |
| 13 | `workspaces` | 1:N | `credit_transactions` | Cascade |
| 14 | `workspaces` | 1:N | `orders` | Cascade |
| 15 | `users` | 1:N | `notifications` | Cascade |
| 16 | `users` | 1:N | `refresh_tokens` | Cascade |
| 17 | `users` | 1:N | `audit_logs` | SetNull |
| 18 | `workspaces` | 1:N | `audit_logs` | SetNull |

---

*Tài liệu thiết kế CSDL — Hệ thống Marka — 2026-08-21*
