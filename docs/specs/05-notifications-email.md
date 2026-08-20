# Phân hệ 5: Email & Thông báo tự động

> [Quay lại Mục lục chính](file:///f:/DATN/marka-capstone/docs/specs/README.md)

---

## 5.1. Email mời tham gia Workspace

**Mô tả**: Gửi thư mời tham gia không gian làm việc qua đường dẫn xác thực một lần.

**Tác nhân (Actors)**: Workspace Owner (người gửi), Guest / User (người nhận)

**Luồng hoạt động**: 

Owner mời → tạo `WorkspaceInvite(token, expiresAt)` → gửi email chứa link `https://app.marka.vn/invite/{token}` → user bấm → verify token còn hạn & chưa dùng → join workspace → đánh dấu token đã dùng.

---

## 5.2. Email nhắc hạn gói & hết credit

**Mô tả**: Tự động thông báo qua email khi tài nguyên Workspace sắp cạn kiệt.

**Tác nhân (Actors)**: Hệ thống (Background Cron Job), Workspace Owner (người nhận)

**Luồng hoạt động**:

1. Cron job chạy hàng ngày, quét các workspace có `planExpiresAt` trong vòng 3 ngày tới → gửi email nhắc gia hạn (mỗi workspace chỉ gửi 1 lần cho mốc 3 ngày, tránh spam).
2. Cron job (hoặc trigger ngay sau mỗi lần trừ credit) kiểm tra nếu `remainingCredit / monthlyQuota < 10%` → gửi email cảnh báo (đánh dấu đã gửi trong tháng để không lặp lại nhiều lần).

---

## 5.3. Email nhắc lịch đăng bài

**Mô tả**: Nhắc nhở người phụ trách chuẩn bị hoặc kiểm tra trước giờ xuất bản bài đăng.

**Tác nhân (Actors)**: Hệ thống (Background Cron Job), Content Creator / Owner (người nhận)

**Luồng hoạt động**: 

Cron job quét mỗi phút các `ScheduledPost` có `scheduledAt` trong khoảng 14-16 phút tới (buffer 2 phút quanh mốc 15 phút) → gửi email nhắc cho người phụ trách đăng bài → đánh dấu đã gửi (tránh gửi trùng nếu cron chạy lại).

---

## 5.4. Thông báo In-App (Hệ thống chuông thông báo)

**Mô tả**: Lưu trữ và hiển thị các hoạt động cần phản hồi hoặc thông tin quan trọng trực tiếp trên giao diện của người dùng.

**Tác nhân (Actors)**: User (All Roles)

**Luồng hoạt động**:

1. **Kích hoạt sự kiện**: Khi xảy ra các hành động (Creator gửi duyệt bài viết, Owner duyệt hoặc từ chối bài viết, Owner mời thành viên mới vào Workspace), server đồng thời tạo một bản ghi mới trong bảng `Notification` lưu thông tin: `userId` (người nhận), `type` (loại thông báo, ví dụ: `POST_PENDING`, `POST_APPROVED`, `POST_REJECTED`, `WORKSPACE_INVITE`), và `payload` (chứa metadata dạng JSON như tên bài viết, lý do từ chối, tên workspace).
2. **Realtime push**: Hệ thống có thể gửi thông báo realtime tới trình duyệt của người dùng qua WebSockets/SSE nếu họ đang online.
3. **Đọc thông báo**: Trên UI, người dùng bấm vào biểu tượng chuông thông báo để xem danh sách. Khi click vào từng mục thông báo, client gửi request cập nhật trạng thái `isRead = true` và điều hướng người dùng tới trang nghiệp vụ liên quan (VD: trang chi tiết bài viết, trang chấp nhận lời mời).

---

## Lưu ý khi triển khai Phân hệ 5:

- Tất cả job gửi email nên qua BullMQ queue riêng (`email-queue`), tách khỏi luồng chính, để lỗi SMTP/Resend không ảnh hưởng đến các API khác.
- Dùng template engine (React Email, MJML, hoặc Handlebars) để quản lý email template gọn gàng, dễ bảo trì.
- Luôn có cờ đánh dấu "đã gửi" (idempotency) cho các email dạng nhắc nhở định kỳ, tránh gửi trùng khi cron chạy lại do lỗi/restart server.
