# Tài liệu Đặc tả Cơ sở dữ liệu — Marka

Tài liệu này đặc tả chi tiết thiết kế cơ sở dữ liệu vật lý của hệ thống Marka, bao gồm danh sách các bảng, kiểu dữ liệu, các ràng buộc và mối quan hệ giữa các bảng. Hệ thống sử dụng cơ sở dữ liệu quan hệ **PostgreSQL** và được quản lý thông qua **Prisma ORM**.

---

## 1. Biểu đồ Quan hệ Thực thể (ERD Overview)

Hệ thống bao gồm các nhóm thực thể chính:
1. **Xác thực & Không gian làm việc**: `users`, `workspaces`, `workspace_members`, `workspace_invites`.
2. **Quản lý nội dung & Media**: `posts`, `media_assets`, `scheduled_posts`, `post_metrics`.
3. **Kênh liên kết**: `channel_connections`.
4. **Credit, Giao dịch & Quản trị**: `orders`, `credit_packages`, `credit_transactions`, `ai_generations`, `notifications`, `audit_logs`.

Chi tiết mối liên kết thực thể tham chiếu tại file thiết kế [schema.dbml](file:///f:/DATN/marka-capstone/docs/schema.dbml).

---

## 2. Đặc tả Chi tiết các Bảng Dữ Liệu

### 2.1. Bảng `users` (Thông tin người dùng hệ thống)
Lưu trữ thông tin tài khoản người dùng, vai trò hệ thống và trạng thái hoạt động.

| Tên cột | Kiểu dữ liệu | Ràng buộc | Mô tả |
| :--- | :--- | :--- | :--- |
| `id` | VARCHAR(36) | PK, Default: UUID | ID duy nhất của người dùng |
| `email` | VARCHAR(255) | Unique, NOT NULL | Email dùng làm tài khoản đăng nhập |
| `passwordHash` | VARCHAR(255) | Nullable | Hash mật khẩu (bcrypt), null nếu dùng Google OAuth |
| `name` | VARCHAR(255) | NOT NULL | Tên hiển thị của người dùng |
| `avatar` | VARCHAR(255) | Nullable | URL hình ảnh đại diện |
| `authProvider` | ENUM | Default: 'LOCAL', NOT NULL | Phương thức xác thực (`LOCAL` hoặc `GOOGLE`) |
| `googleId` | VARCHAR(255) | Nullable | ID của tài khoản Google nếu login OAuth |
| `emailVerified` | BOOLEAN | Default: FALSE, NOT NULL | Trạng thái xác thực email |
| `systemRole` | ENUM | Default: 'USER', NOT NULL | Vai trò hệ thống (`SYSTEM_ADMIN`, `USER`) |
| `tokenVersion` | INTEGER | Default: 1, NOT NULL | Version token dùng để hủy session hàng loạt khi đổi pass |
| `isSuspended` | BOOLEAN | Default: FALSE, NOT NULL | Trạng thái khóa tài khoản bởi Admin |
| `createdAt` | TIMESTAMP | Default: NOW(), NOT NULL | Thời điểm đăng ký tài khoản |
| `updatedAt` | TIMESTAMP | NOT NULL | Thời điểm cập nhật thông tin tài khoản lần cuối |

### 2.2. Bảng `workspaces` (Không gian làm việc)
Mỗi Workspace đại diện cho một thương hiệu hoặc doanh nghiệp riêng biệt.

| Tên cột | Kiểu dữ liệu | Ràng buộc | Mô tả |
| :--- | :--- | :--- | :--- |
| `id` | VARCHAR(36) | PK, Default: UUID | ID duy nhất của Workspace |
| `name` | VARCHAR(255) | NOT NULL | Tên của Workspace |
| `logo` | VARCHAR(255) | Nullable | URL ảnh logo của Workspace |
| `plan` | ENUM | Default: 'FREE', NOT NULL | Gói cước hiện tại (`FREE`, `PRO`, `ENTERPRISE`) |
| `remainingCredit` | INTEGER | Default: 100, NOT NULL | Số credit khả dụng dùng để gọi AI |
| `monthlyQuota` | INTEGER | Default: 100, NOT NULL | Hạn mức credit mặc định được cấp mỗi tháng |
| `planExpiresAt` | TIMESTAMP | Nullable | Thời điểm hết hạn của gói cước trả phí |
| `billingCycleStart` | TIMESTAMP | Nullable | Mốc bắt đầu chu kỳ billing hiện tại (dùng cho cron reset credit hằng tháng — D6) |
| `nextResetAt` | TIMESTAMP | Nullable | Mốc cron reset credit kế tiếp / neo hạ gói khi hết hạn (D6) |
| `planExpiryWarningSentAt` | TIMESTAMP | Nullable | Cờ chống gửi trùng email cảnh báo sắp hết hạn gói (D7) |
| `creditWarningSentAt` | TIMESTAMP | Nullable | Cờ chống gửi trùng email cảnh báo sắp hết credit (D7) |
| `brandVoice` | JSON | Nullable | Cấu hình tông giọng thương hiệu dạng JSON (`{ industry, targetAudience, keywordsShouldUse, keywordsAvoid, fewShotExamples }`) |
| `deletedAt` | TIMESTAMP | Nullable | Thời điểm xóa mềm Workspace (null nếu đang hoạt động) |
| `createdAt` | TIMESTAMP | Default: NOW(), NOT NULL | Thời điểm khởi tạo Workspace |
| `updatedAt` | TIMESTAMP | NOT NULL | Thời điểm cập nhật thông tin Workspace |

* **Hạn mức theo gói**: `monthlyQuota` (credit/tháng) tương ứng `FREE = 100`, `PRO = 1000`, `ENTERPRISE = 5000`. Credit reset theo chu kỳ là **đặt lại về hạn mức, không cộng dồn** phần dư. Khi gói hết hạn (`planExpiresAt`/`nextResetAt`), Workspace tự động **hạ về `FREE`** (D6).

### 2.3. Bảng `workspace_members` (Thành viên của Workspace)
Lưu trữ quan hệ phân quyền 2 cấp Workspace (RBAC).

| Tên cột | Kiểu dữ liệu | Ràng buộc | Mô tả |
| :--- | :--- | :--- | :--- |
| `id` | VARCHAR(36) | PK, Default: UUID | ID duy nhất của bản ghi thành viên |
| `workspaceId` | VARCHAR(36) | FK -> `workspaces.id`, Cascade | Liên kết tới Workspace |
| `userId` | VARCHAR(36) | FK -> `users.id`, Cascade | Liên kết tới Người dùng |
| `role` | ENUM | Default: 'CONTENT_CREATOR' | Vai trò thành viên (`OWNER`, `CONTENT_CREATOR`) |
| `allowDirectPublish` | BOOLEAN | Default: FALSE, NOT NULL | Toggle ủy quyền cho Creator tự đăng bài đã được duyệt |
| `createdAt` | TIMESTAMP | Default: NOW(), NOT NULL | Thời điểm tham gia Workspace |
| `updatedAt` | TIMESTAMP | NOT NULL | Thời điểm cập nhật quyền của thành viên |

* **Index**: Unique Constraint trên tổ hợp khóa `(userId, workspaceId)`.

### 2.4. Bảng `workspace_invites` (Lời mời tham gia Workspace)
Lưu trữ thông tin lời mời thành viên chưa kích hoạt.

| Tên cột | Kiểu dữ liệu | Ràng buộc | Mô tả |
| :--- | :--- | :--- | :--- |
| `id` | VARCHAR(36) | PK, Default: UUID | ID duy nhất của bản ghi mời |
| `email` | VARCHAR(255) | NOT NULL | Email nhận lời mời |
| `workspaceId` | VARCHAR(36) | FK -> `workspaces.id`, Cascade | Workspace mời tham gia |
| `role` | ENUM | Default: 'CONTENT_CREATOR' | Vai trò sẽ được gán sau khi chấp nhận lời mời |
| `token` | VARCHAR(255) | Unique, NOT NULL | Token bí mật gửi qua email xác thực |
| `isUsed` | BOOLEAN | Default: FALSE, NOT NULL | Trạng thái đã sử dụng token |
| `expiresAt` | TIMESTAMP | NOT NULL | Thời hạn hết hiệu lực lời mời (7 ngày) |
| `invitedById` | VARCHAR(36) | FK -> `users.id`, SetNull | ID người gửi lời mời (Workspace Owner) |
| `createdAt` | TIMESTAMP | Default: NOW(), NOT NULL | Thời điểm gửi lời mời |

### 2.5. Bảng `posts` (Bài viết nội dung)
Lưu trữ nội dung bài viết chính và vòng đời trạng thái của nó.

| Tên cột | Kiểu dữ liệu | Ràng buộc | Mô tả |
| :--- | :--- | :--- | :--- |
| `id` | VARCHAR(36) | PK, Default: UUID | ID bài viết |
| `workspaceId` | VARCHAR(36) | FK -> `workspaces.id`, Cascade | Workspace chứa bài viết |
| `title` | VARCHAR(255) | NOT NULL | Tiêu đề của bài viết phục vụ tìm kiếm quản lý |
| `content` | JSON | NOT NULL | Nội dung soạn thảo rich-text dưới dạng JSON |
| `status` | ENUM | Default: 'DRAFT', NOT NULL | Trạng thái duyệt/xuất bản (`DRAFT`, `PENDING`, `APPROVED`, `REJECTED`, `SCHEDULED`, `PUBLISHED`, `FAILED`, `ARCHIVED`) |
| `campaignTag` | VARCHAR(255) | Nullable | Thẻ gắn nhãn chiến dịch |
| `rejectReason` | VARCHAR(255) | Nullable | Lý do từ chối phê duyệt từ Owner |
| `createdById` | VARCHAR(36) | FK -> `users.id`, SetNull | Người tạo bài viết (API truyền tham số `creatorId`, map thẳng vào `createdById` — D2) |
| `submittedById` | VARCHAR(36) | FK -> `users.id`, SetNull | Người gửi duyệt bài viết |
| `submittedAt` | TIMESTAMP | Nullable | Thời điểm gửi duyệt bài viết |
| `reviewedById` | VARCHAR(36) | FK -> `users.id`, SetNull | Owner thực hiện phê duyệt/từ chối bài |
| `reviewedAt` | TIMESTAMP | Nullable | Thời điểm đưa ra quyết định phê duyệt |
| `deletedAt` | TIMESTAMP | Nullable | Thời điểm xóa mềm bài viết |
| `createdAt` | TIMESTAMP | Default: NOW(), NOT NULL | Thời điểm tạo bài viết |
| `updatedAt` | TIMESTAMP | NOT NULL | Thời điểm cập nhật bài viết lần cuối |

* **Index**: Index trên cột `createdById` (phục vụ lọc UC09 / phân quyền xóa UC10).

### 2.6. Bảng `media_assets` (Thư viện hình ảnh và video)
Thư viện tệp tin đa phương tiện **cấp Workspace**; việc gắn vào bài viết là **tùy chọn** (D1).

| Tên cột | Kiểu dữ liệu | Ràng buộc | Mô tả |
| :--- | :--- | :--- | :--- |
| `id` | VARCHAR(36) | PK, Default: UUID | ID duy nhất của tệp |
| `workspaceId` | VARCHAR(36) | FK -> `workspaces.id`, Cascade, NOT NULL | Workspace sở hữu tệp (thư viện cấp Workspace) |
| `postId` | VARCHAR(36) | FK -> `posts.id`, SetNull, Nullable | Bài viết mà tệp được đính kèm (tùy chọn, null nếu chỉ nằm trong thư viện) |
| `url` | VARCHAR(255) | NOT NULL | URL đường dẫn tệp trên Cloudinary hoặc AWS S3 |
| `type` | ENUM | NOT NULL | Loại định dạng (`IMAGE` hoặc `VIDEO`) |
| `mimeType` | VARCHAR(100) | Nullable | Định dạng file chi tiết (ví dụ: `image/png`, `video/mp4`) |
| `thumbnailUrl` | VARCHAR(255) | Nullable | URL ảnh xem trước đối với video |
| `size` | INTEGER | NOT NULL | Dung lượng tệp tin (tính bằng bytes) |
| `tags` | VARCHAR(255) | Nullable | Thẻ gắn nhãn để lọc thư viện |
| `source` | ENUM | Default: 'UPLOADED', NOT NULL | Nguồn gốc tệp (`UPLOADED` tải lên, `AI_GENERATED` AI sinh) |
| `createdById` | VARCHAR(36) | FK -> `users.id`, SetNull | Người thực hiện tải lên hoặc yêu cầu AI tạo |
| `deletedAt` | TIMESTAMP | Nullable | Thời điểm xóa mềm tệp (D1) |
| `createdAt` | TIMESTAMP | Default: NOW(), NOT NULL | Thời điểm đưa vào thư viện |

* **Index**: Index trên `workspaceId` (truy vấn thư viện theo Workspace) và trên `postId`.

### 2.7. Bảng `channel_connections` (Kênh mạng xã hội liên kết)
Lưu trữ thông tin xác thực/mã hóa các kênh phân phối bài viết.

| Tên cột | Kiểu dữ liệu | Ràng buộc | Mô tả |
| :--- | :--- | :--- | :--- |
| `id` | VARCHAR(36) | PK, Default: UUID | ID duy nhất của kết nối |
| `workspaceId` | VARCHAR(36) | FK -> `workspaces.id`, Cascade | Workspace sở hữu liên kết kênh |
| `platform` | ENUM | NOT NULL | Mạng xã hội (`FACEBOOK`, `INSTAGRAM`, `TIKTOK`, `ZALO`) |
| `type` | ENUM | Default: 'SIMULATED', NOT NULL | Bản chất kết nối (`REAL` API thật, `SIMULATED` giả lập) |
| `name` | VARCHAR(255) | NOT NULL | Tên hiển thị của kênh (ví dụ: Tên Facebook Page) |
| `avatar` | VARCHAR(255) | Nullable | URL ảnh đại diện của kênh |
| `externalAccountId` | VARCHAR(255) | NOT NULL | ID kênh từ phía MXH bên thứ 3 cung cấp |
| `accessToken` | TEXT | Nullable | Access Token hoặc Page Token đã được **mã hóa AES-256** |
| `status` | ENUM | Default: 'ACTIVE', NOT NULL | Trạng thái hiệu lực token (`ACTIVE` hoặc `EXPIRED`) |
| `createdAt` | TIMESTAMP | Default: NOW(), NOT NULL | Thời điểm liên kết kênh |
| `updatedAt` | TIMESTAMP | NOT NULL | Thời điểm cập nhật/làm mới kết nối |

* **Index**: Unique Constraint trên bộ ba `(workspaceId, platform, externalAccountId)`.

### 2.8. Bảng `scheduled_posts` (Lịch trình xuất bản cụ thể)
Đại diện cho một job đăng bài cụ thể lên 1 kênh liên kết riêng lẻ.

| Tên cột | Kiểu dữ liệu | Ràng buộc | Mô tả |
| :--- | :--- | :--- | :--- |
| `id` | VARCHAR(36) | PK, Default: UUID | ID duy nhất của lịch đăng bài |
| `postId` | VARCHAR(36) | FK -> `posts.id`, Cascade | Liên kết tới nội dung bài viết gốc |
| `channelId` | VARCHAR(36) | FK -> `channel_connections.id`, Cascade | Kênh liên kết sẽ được xuất bản |
| `customContent` | JSON | Nullable | Nội dung đã được tối ưu riêng biệt cho kênh này |
| `scheduledAt` | TIMESTAMP | Nullable | Thời gian hẹn giờ đăng bài (null nếu đăng ngay) |
| `status` | ENUM | Default: 'SCHEDULED', NOT NULL | Trạng thái đăng bài (`SCHEDULED`, `PUBLISHED`, `FAILED`, `CANCELLED`) |
| `externalPostId` | VARCHAR(255) | Nullable | ID bài viết thực tế sau khi đăng thành công (MXH cung cấp) |
| `errorMessage` | TEXT | Nullable | Nhật ký lỗi phản hồi từ API khi đăng bài thất bại |
| `retryCount` | INTEGER | Default: 0, NOT NULL | Số lần tự động thử lại của Worker khi gặp lỗi |
| `reminderSentAt` | TIMESTAMP | Nullable | Cờ chống gửi trùng email/thông báo nhắc lịch đăng (D7) |
| `createdAt` | TIMESTAMP | Default: NOW(), NOT NULL | Thời điểm khởi tạo lịch trình |
| `updatedAt` | TIMESTAMP | NOT NULL | Thời điểm cập nhật lịch trình |

* **Index**: Composite Index trên `(status, scheduledAt)` phục vụ tra cứu/đối soát lịch đăng; index trên `channelId` (huỷ theo kênh) và `postId`. Cơ chế đăng chính là **BullMQ delayed job** (đẩy job với `delay` tới hạn đăng), **không dựa vào cron quét mỗi phút**; cron chỉ chạy **đối soát phụ** (job mồ côi / quá hạn).

### 2.9. Bảng `ai_generations` (Lịch sử sử dụng AI)
Lưu nhật ký prompts và logs để kiểm tra chi phí/dashboard của System Admin.

| Tên cột | Kiểu dữ liệu | Ràng buộc | Mô tả |
| :--- | :--- | :--- | :--- |
| `id` | VARCHAR(36) | PK, Default: UUID | ID duy nhất của log |
| `workspaceId` | VARCHAR(36) | FK -> `workspaces.id`, Cascade | Workspace thực hiện yêu cầu AI |
| `userId` | VARCHAR(36) | FK -> `users.id`, SetNull | Người yêu cầu sinh AI |
| `postId` | VARCHAR(36) | FK -> `posts.id`, SetNull, Nullable | ID bài viết đích nhận nội dung AI (nếu có) |
| `type` | ENUM | NOT NULL | Loại tác vụ (`TEXT`, `IMAGE`, `VIRAL_SCORE`, `REGENERATE`) |
| `provider` | VARCHAR(100) | NOT NULL | Nhà cung cấp AI (ví dụ: `OpenAI`) |
| `model` | VARCHAR(100) | NOT NULL | Phiên bản model sử dụng (ví dụ: `gpt-4o`, `dall-e-3`) |
| `status` | ENUM | Default: 'SUCCESS', NOT NULL | Kết quả gọi API (`SUCCESS` hoặc `FAILED`) |
| `prompt` | TEXT | NOT NULL | Prompt đầy đủ gửi lên AI |
| `response` | TEXT | NOT NULL | Kết quả văn bản hoặc URL ảnh trả về từ AI |
| `creditCost` | INTEGER | NOT NULL | Số credit đã trừ của Workspace cho giao dịch này |
| `createdAt` | TIMESTAMP | Default: NOW(), NOT NULL | Thời điểm gọi AI |

### 2.10. Bảng `credit_transactions` (Nhật ký giao dịch Credit)
Lịch sử thay đổi tài chính trong Workspace. Phục vụ truy vết số dư.

| Tên cột | Kiểu dữ liệu | Ràng buộc | Mô tả |
| :--- | :--- | :--- | :--- |
| `id` | VARCHAR(36) | PK, Default: UUID | ID giao dịch |
| `workspaceId` | VARCHAR(36) | FK -> `workspaces.id`, Cascade | Workspace thực hiện giao dịch |
| `type` | ENUM | NOT NULL | Hướng dòng credit (`INFLOW` cộng vào, `OUTFLOW` trừ đi) |
| `action` | ENUM | NOT NULL | Nguyên nhân giao dịch (`GEN_TEXT`, `GEN_IMAGE`, `REGEN`, `SCORE`, `TOP_UP`, `RESET`, `REFUND`) |
| `amount` | INTEGER | NOT NULL | Số credit biến động |
| `balanceBefore` | INTEGER | NOT NULL | Số dư credit của Workspace trước khi biến động |
| `balanceAfter` | INTEGER | NOT NULL | Số dư credit của Workspace sau khi biến động |
| `reason` | VARCHAR(255) | Nullable | Ghi chú cụ thể (ví dụ: "Hoàn credit do sinh ảnh lỗi") |
| `createdById` | VARCHAR(36) | FK -> `users.id`, SetNull | Người thực hiện hành động tạo giao dịch |
| `createdAt` | TIMESTAMP | Default: NOW(), NOT NULL | Thời điểm giao dịch hoàn thành |

### 2.11. Bảng `credit_packages` (Danh mục gói credit)
Lưu trữ danh mục các gói credit bán cho Workspace.

| Tên cột | Kiểu dữ liệu | Ràng buộc | Mô tả |
| :--- | :--- | :--- | :--- |
| `id` | VARCHAR(36) | PK, Default: UUID | ID duy nhất của gói credit |
| `name` | VARCHAR(255) | NOT NULL | Tên gói credit |
| `description` | VARCHAR(500) | Nullable | Mô tả chi tiết gói credit |
| `creditAmount` | INTEGER | NOT NULL | Số credit cung cấp khi mua gói |
| `price` | INTEGER | NOT NULL | Giá bán của gói (VND) |
| `sortOrder` | INTEGER | Default: 0, NOT NULL | Thứ tự hiển thị gói trong danh sách |
| `isActive` | BOOLEAN | Default: TRUE, NOT NULL | Trạng thái mở bán của gói |
| `deletedAt` | TIMESTAMP | Nullable | Thời điểm xóa mềm gói credit |
| `createdAt` | TIMESTAMP | Default: NOW(), NOT NULL | Thời điểm khởi tạo gói |
| `updatedAt` | TIMESTAMP | NOT NULL | Thời điểm cập nhật gói |

### 2.12. Bảng `orders` (Hóa đơn nâng cấp & nạp credit)
Quản lý tích hợp cổng thanh toán PayOS.

| Tên cột | Kiểu dữ liệu | Ràng buộc | Mô tả |
| :--- | :--- | :--- | :--- |
| `id` | VARCHAR(36) | PK, Default: UUID | ID hóa đơn |
| `orderCode` | VARCHAR(100) | Unique, NOT NULL | Mã đơn hàng đối chiếu duy nhất gửi sang cổng PayOS |
| `workspaceId` | VARCHAR(36) | FK -> `workspaces.id`, Cascade | Workspace mua credit/gói cước |
| `packageId` | VARCHAR(36) | FK -> `credit_packages.id`, SetNull, Nullable | Gói credit được mua (nếu có) |
| `amount` | INTEGER | NOT NULL | Số tiền thanh toán (VND) |
| `creditAmount` | INTEGER | Nullable | Số credit được mua (nếu mua credit lẻ) |
| `targetPlan` | ENUM | Nullable | Gói cước nâng cấp mục tiêu (nếu mua gói cước PRO/ENTERPRISE) |
| `payosTransId` | VARCHAR(255) | Unique, Nullable | Mã giao dịch thành công đối chiếu từ PayOS (unique hỗ trợ idempotency webhook — D4) |
| `paidAt` | TIMESTAMP | Nullable | Thời điểm hoàn thành thanh toán |
| `status` | ENUM | Default: 'PENDING', NOT NULL | Trạng thái đơn hàng (`PENDING`, `PAID`, `CANCELLED`) |
| `createdById` | VARCHAR(36) | FK -> `users.id`, SetNull | Người tạo đơn hàng thanh toán |
| `createdAt` | TIMESTAMP | Default: NOW(), NOT NULL | Thời điểm khởi tạo đơn hàng |
| `updatedAt` | TIMESTAMP | NOT NULL | Thời điểm cập nhật trạng thái đơn hàng |

### 2.13. Bảng `notifications` (Thông báo in-app hệ thống)
Lưu thông tin phục vụ trung tâm thông báo (chuông thông báo).

| Tên cột | Kiểu dữ liệu | Ràng buộc | Mô tả |
| :--- | :--- | :--- | :--- |
| `id` | VARCHAR(36) | PK, Default: UUID | ID thông báo |
| `userId` | VARCHAR(36) | FK -> `users.id`, Cascade, NOT NULL | Người nhận thông báo |
| `workspaceId` | VARCHAR(36) | FK -> `workspaces.id`, Cascade | Workspace phát sinh thông báo (nếu có) |
| `type` | VARCHAR(100) | NOT NULL | Loại sự kiện thông báo (ví dụ: `POST_PENDING`, `POST_APPROVED`) |
| `payload` | JSON | NOT NULL | Metadata động (tên bài viết, lý do reject, ID bài viết để click chuyển hướng) |
| `isRead` | BOOLEAN | Default: FALSE, NOT NULL | Trạng thái đã đọc thông báo |
| `createdAt` | TIMESTAMP | Default: NOW(), NOT NULL | Thời điểm gửi thông báo |

### 2.14. Bảng `audit_logs` (Nhật ký kiểm toán hệ thống)
Bảng ghi sự kiện bảo mật toàn hệ thống dành cho System Admin quản lý. Đã gộp lịch sử duyệt bài (ApprovalHistory) qua cột `reason`.

| Tên cột | Kiểu dữ liệu | Ràng buộc | Mô tả |
| :--- | :--- | :--- | :--- |
| `id` | VARCHAR(36) | PK, Default: UUID | ID bản ghi |
| `workspaceId` | VARCHAR(36) | FK -> `workspaces.id`, SetNull | Workspace liên quan đến hành động (nếu có) |
| `actorId` | VARCHAR(36) | FK -> `users.id`, SetNull | ID tài khoản thực hiện hành động |
| `action` | VARCHAR(100) | NOT NULL | Tên hành động (ví dụ: `LOGIN`, `DELETE_WORKSPACE`, `REVIEW_POST`) |
| `targetType` | VARCHAR(100) | NOT NULL | Loại thực thể bị tác động (ví dụ: `POST`, `WORKSPACE`, `USER`) |
| `targetId` | VARCHAR(255) | Nullable | ID cụ thể của thực thể bị tác động |
| `reason` | VARCHAR(255) | Nullable | Lý do hành động (kế thừa từ ApprovalHistory cho thao tác duyệt/từ chối bài viết) |
| `metadata` | JSON | Nullable | Dữ liệu chi tiết về thay đổi trước/sau hoặc tham số request |
| `createdAt` | TIMESTAMP | Default: NOW(), NOT NULL | Thời điểm hành động diễn ra |

* **Index**: Composite Index trên `(targetType, targetId, createdAt)`, `(workspaceId, createdAt)` và `(actorId, createdAt)` (D8).

### 2.15. Bảng `post_metrics` (Chỉ số tương tác bài đăng — Phân hệ 8)
Lưu chỉ số hiệu suất của một bài đã đăng trên kênh; quan hệ **1-1** với `scheduled_posts`.

| Tên cột | Kiểu dữ liệu | Ràng buộc | Mô tả |
| :--- | :--- | :--- | :--- |
| `id` | VARCHAR(36) | PK, Default: UUID | ID duy nhất của bản ghi metrics |
| `scheduledPostId` | VARCHAR(36) | FK -> `scheduled_posts.id`, Cascade, UNIQUE, NOT NULL | Lịch đăng được đo chỉ số (1-1) |
| `reactions` | INTEGER | Default: 0, NOT NULL | Tổng số lượt cảm xúc |
| `reactionsDetail` | JSON | Nullable | Chi tiết cảm xúc theo loại (like/love/haha/...) |
| `comments` | INTEGER | Default: 0, NOT NULL | Tổng số bình luận |
| `shares` | INTEGER | Default: 0, NOT NULL | Tổng số lượt chia sẻ |
| `reach` | INTEGER | Nullable | Số người tiếp cận (reach) |
| `impressions` | INTEGER | Nullable | Số lượt hiển thị (impressions) |
| `permalinkUrl` | VARCHAR(255) | Nullable | URL permalink bài đăng trên nền tảng |
| `syncError` | VARCHAR(255) | Nullable | Lỗi phát sinh khi đồng bộ metrics (n8n/Facebook API) |
| `fetchedAt` | TIMESTAMP | Nullable | Thời điểm lấy chỉ số từ nền tảng |
| `createdAt` | TIMESTAMP | Default: NOW(), NOT NULL | Thời điểm tạo bản ghi |
| `updatedAt` | TIMESTAMP | NOT NULL | Thời điểm cập nhật bản ghi |

* **Index**: Unique Constraint trên `scheduledPostId` (đảm bảo quan hệ 1-1).

---

## 3. Các Quy Tắc Thiết Kế Cơ Sở Dữ Liệu Đặc Thù

### 3.1. Quy tắc Xóa mềm (Soft Delete)
Để phục vụ audit log lưu trữ và khôi phục dữ liệu khi lỡ tay, các thực thể chính gồm **Workspace**, **Post**, **CreditPackage** và **MediaAsset** không bao giờ bị xóa cứng (hard delete) khỏi database khi người dùng thao tác xóa.
* Sử dụng trường `deletedAt` kiểu dữ liệu TIMESTAMP (mặc định là `null`).
* Khi xóa: Hệ thống cập nhật `deletedAt = NOW()`.
* Khi truy vấn: Mọi câu lệnh SELECT thông thường tại backend bắt buộc phải bổ sung điều kiện lọc `deletedAt: null` (đối với Prisma là `{ deletedAt: null }`).

### 3.2. Mã hóa dữ liệu nhạy cảm (Field-Level Encryption)
Các dữ liệu liên quan đến quyền truy cập tài khoản bên thứ ba (Page Access Token của Facebook Page, Client Secret) bắt buộc phải được mã hóa trước khi lưu xuống database nhằm phòng ngừa lộ lọt dữ liệu khi file backup DB bị rò rỉ.
* Sử dụng thuật toán mã hóa đối xứng **AES-256-GCM** hoặc **AES-256-CBC**.
* Khóa bảo mật `AES_SECRET_KEY` được lưu trong file cấu hình môi trường `.env` ở server và tuyệt đối không được đưa lên Git.
* Dữ liệu trong database sẽ ở dạng chuỗi Hex/Base64 đã mã hóa. Backend thực hiện giải mã (decrypt) ngay khi truy vấn lên lớp Service để sử dụng.

### 3.3. Múi giờ (Timezone) — D19
Toàn hệ thống dùng **UTC**: cột `DateTime` trong DB lưu UTC, API trao đổi theo **ISO-8601 UTC**, server/worker đặt `TZ=UTC`. Frontend tự chuyển đổi sang giờ địa phương khi hiển thị.
