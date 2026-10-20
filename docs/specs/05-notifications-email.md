# Phân hệ 5 — Email & Thông báo

> [Quay lại Mục lục](README.md)
>
> **Phạm vi:** phần đã có trong code: gửi email qua Resend (mời workspace, bài gửi duyệt, kết quả duyệt) và ghi notification in-app.
> Mã nguồn: `backend/src/utils/mailer.client.ts`, `backend/src/templates/`, `modules/workspace/workspace.service.ts`, `modules/post/post.notification.ts`.
>
> **Không có trong code:** API đọc/đánh dấu notification (UC39–UC41), email nhắc hạn gói/hết credit/lịch đăng, email xác thực tài khoản, đẩy email qua `email-queue`.

---

## 5.1. Cơ chế gửi email

`mailerClient.sendEmail({ to, subject, html })` (`utils/mailer.client.ts`) trả về `boolean`:

| Tình huống | Kết quả |
| :--- | :--- |
| `NODE_ENV = test` | Trả `true` ngay, **không gọi Resend** |
| Thiếu `RESEND_API_KEY` | Log warn `"RESEND_API_KEY chưa cấu hình — bỏ qua gửi email tới <email>"`, trả `false` |
| Resend trả lỗi | Log error, trả `false` |
| Exception khi gọi Resend | Log error, trả `false` |
| Thành công | Trả `true` |

- Email gửi **đồng bộ trong request**, không qua BullMQ. Queue `email-queue` và `emailWorker` đã có khung nhưng chưa được dùng.
- Người gửi lấy từ `MAIL_FROM` (mặc định `no-reply@marka.vn`).
- Không lưu log email vào DB, không có trạng thái "đã gửi" cho từng email.

Template hiện có:

| File | Hàm | Dùng cho |
| :--- | :--- | :--- |
| `templates/workspaceInviteEmail.ts` | `buildWorkspaceInviteEmail` | Mời thành viên workspace |
| `templates/postReviewEmail.ts` | `buildPostSubmittedEmail` | Thông báo có bài chờ duyệt |
| `templates/postReviewEmail.ts` | `buildPostReviewedEmail` | Thông báo bài được duyệt / bị từ chối |

---

## 5.2. Email mời tham gia workspace

**Kích hoạt:** `POST /workspaces/:workspaceId/invites` (OWNER) — chi tiết luồng ở [01 §1.11](./01-auth-workspace.md).

- Nội dung: tên workspace, tên người mời, nhãn vai trò (`Chủ sở hữu` / `Người sáng tạo nội dung`), nút "Chấp nhận lời mời".
- Link: `${APP_BASE_URL}/invites/<token>`; token là UUID, hạn **7 ngày**.
- **Thứ tự quan trọng:** gửi email **trước**, chỉ lưu/cập nhật `WorkspaceInvite` khi `mailerClient.sendEmail` trả `true`.
  - Gửi thất bại (kể cả chưa cấu hình Resend) → `502` `"Gửi email mời thất bại. Vui lòng thử lại."`, DB không thay đổi.
- Mời lại cùng email khi đã có lời mời đang chờ → gửi email mới, sau đó **cấp token + hạn mới** trên bản ghi cũ (token cũ hết hiệu lực), cập nhật `role`.
- Không gửi email khi: email đã là thành viên (`409`), hoặc workspace không tồn tại.
- Response trả thêm `inviteUrl` để tiện dev/test; email vẫn chứa link này.

Không có email thông báo khi lời mời được chấp nhận, bị thu hồi, hay khi thành viên bị xoá/đổi vai trò.

---

## 5.3. Email luồng duyệt bài

Được gọi từ `modules/post/post.notification.ts`, **ngay trong request** submit/review, sau khi trạng thái bài đã đổi.

### 5.3.1. Khi gửi duyệt (`POST .../submit`)

- Người nhận: toàn bộ **Owner của workspace trừ người gửi duyệt**.
- Với mỗi Owner:
  1. Tạo notification in-app `POST_SUBMITTED`.
  2. Nếu tìm thấy user → gửi email `buildPostSubmittedEmail` (tiêu đề `[Marka] Bài viết "<title>" đang chờ duyệt`).
- Nếu không còn Owner nào khác (workspace chỉ có 1 Owner và chính họ gửi) → không gửi gì.
- Kết quả `mailerClient.sendEmail` **bị bỏ qua**: email lỗi chỉ log, request vẫn trả `200`.

### 5.3.2. Khi duyệt / từ chối (`PATCH .../review`)

- Người nhận: **tác giả bài** (`Post.createdById`).
- Nếu `createdById = null` → dừng, không notification/email.
- Tạo notification `POST_APPROVED` hoặc `POST_REJECTED`, sau đó gửi email:
  - Duyệt: tiêu đề `[Marka] Bài viết "<title>" đã được duyệt`.
  - Từ chối: tiêu đề `[Marka] Bài viết "<title>" bị từ chối`, kèm lý do (`rejectReason`).
- Kết quả `mailerClient.sendEmail` cũng **bị bỏ qua** — khác với email mời, lỗi email không làm fail request.

> Nội dung email duyệt hiện có câu "Bạn có thể tiếp tục lên lịch hoặc đăng bài", dù tính năng lên lịch/đăng bài **chưa tồn tại**. Đây là nội dung template, không phản ánh chức năng đã có.

### 5.3.3. Tóm tắt

| Sự kiện | Notification in-app | Email | Lỗi email ảnh hưởng request? |
| :--- | :--- | :--- | :--- |
| Mời thành viên | ❌ | ✅ Resend | ✅ Có — trả `502`, không lưu lời mời |
| Chấp nhận lời mời | ✅ `MEMBER_JOINED` cho Owner khác | ❌ | — |
| Gửi duyệt bài | ✅ `POST_SUBMITTED` cho Owner khác | ✅ cho Owner khác | ❌ Không |
| Duyệt bài | ✅ `POST_APPROVED` cho tác giả | ✅ cho tác giả | ❌ Không |
| Từ chối bài | ✅ `POST_REJECTED` cho tác giả | ✅ cho tác giả | ❌ Không |

---

## 5.4. Notification in-app

Bảng `notifications` (`Notification`): `id`, `userId`, `workspaceId?`, `type`, `payload` (JSON), `isRead` (mặc định `false`), `createdAt`.

### Các loại đang được ghi

| `type` | Người nhận | Khi nào | `payload` |
| :--- | :--- | :--- | :--- |
| `MEMBER_JOINED` | Các Owner **trừ** người vừa tham gia | Chấp nhận lời mời thành công | `{ workspaceId, userId, role }` |
| `POST_SUBMITTED` | Các Owner **trừ** người gửi duyệt | Submit bài thành công | `{ postId, postTitle, submittedById }` |
| `POST_APPROVED` | Tác giả bài | Duyệt bài | `{ postId, postTitle, approved: true, reason: null }` |
| `POST_REJECTED` | Tác giả bài | Từ chối bài | `{ postId, postTitle, approved: false, reason }` |

- Ghi notification **không** nằm trong transaction với thao tác nghiệp vụ chính.
- Không có notification cho: mời thành viên, xoá thành viên, đổi vai trò, cập nhật workspace, kết nối/ngắt kênh, sửa/xoá bài.
- Không có email nào cho `MEMBER_JOINED`.

### Chưa có API

- Chưa có endpoint list notification, đếm chưa đọc, đánh dấu đã đọc, hay đánh dấu tất cả đã đọc (UC39–UC41). Toàn bộ bản ghi `isRead` luôn `false`.
- Chưa có WebSocket/SSE; frontend chưa có cách đọc notification qua API.
- Chưa có endpoint xoá notification hay lọc theo workspace/type.

---

## 5.5. Bảng tổng hợp endpoint liên quan

| Method | Path | Ảnh hưởng |
| :--- | :--- | :--- |
| POST | `/workspaces/:workspaceId/invites` | Gửi email mời (bắt buộc thành công mới lưu DB) |
| GET | `/invites/:token` | Ghi notification `MEMBER_JOINED` khi tham gia |
| POST | `/workspaces/:workspaceId/posts/:postId/submit` | Notification + email cho Owner khác |
| PATCH | `/workspaces/:workspaceId/posts/:postId/review` | Notification + email cho tác giả |

Không có endpoint `/notifications`.

---

## 5.6. Chưa triển khai (Roadmap)

1. **API notification (UC39–UC41):** `GET /notifications` (phân trang, lọc `isRead`), `PATCH /notifications/:id/read`, `PATCH /notifications/read-all`, đếm số chưa đọc.
2. **Realtime:** WebSocket/SSE hoặc polling có kiểm soát; hiện chưa có.
3. **Email nhắc hạn gói / hết credit:** dùng `Workspace.planExpiryWarningSentAt`, `creditWarningSentAt` (cờ đã có trong schema, chưa có cron).
4. **Email nhắc lịch đăng:** dùng `ScheduledPost.reminderSentAt` (chưa có lịch đăng nên chưa dùng).
5. **Email xác thực tài khoản (UC34)** và quên/đặt lại mật khẩu.
6. **Đưa email vào `email-queue`:** processor hiện chỉ log, chưa xử lý job.
7. **Thu hồi lời mời / email mời lại có kiểm soát** và template escape đầy đủ cho mọi trường người dùng nhập.
