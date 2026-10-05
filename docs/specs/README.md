# Product Specification — Marka (Index & Overview)

> Nền tảng AI Content đa kênh & Quản lý chiến dịch tiếp thị dành riêng cho Marketer Việt Nam.
> Thư mục này chứa đặc tả chi tiết từng phân hệ của hệ thống Marka.

---

## 0. Vai trò & Tác nhân (Actors & Roles)

| Tác nhân / Vai trò  | Cấp       | Quyền chính                                                                                     |
| ------------------- | --------- | ----------------------------------------------------------------------------------------------- |
| **Guest** (Khách)   | Chưa ĐN   | Đăng ký tài khoản, đăng nhập hệ thống, nhấn link chấp nhận lời mời tham gia workspace           |
| **System Admin**    | Hệ thống  | Quản lý user, xem metadata workspace, audit log, dashboard, cấu hình API/thanh toán             |
| **Workspace Owner** | Workspace | Quản lý workspace/thành viên, Brand Voice, Billing, **duyệt bài**, kết nối kênh, **đăng bài**   |
| **Content Creator** | Workspace | Soạn bài, quản lý media, dùng AI sinh nội dung, gửi duyệt, đăng bài **nếu được Owner ủy quyền** |

Không có vai trò tùy chỉnh, không có Reviewer/Social Media Manager/Viewer riêng — mọi quyền đăng/duyệt gói trong Owner + Creator (ủy quyền).

---

## Danh mục Phân hệ & Danh sách Use Cases (UC01 – UC51)

| Mã UC | Tên chức năng (Use Case) | Tác nhân chính (Actor) | Phân hệ / Tài liệu chi tiết | Ghi chú |
| :--- | :--- | :--- | :--- | :--- |
| **UC01** | Register | Guest | [01. Xác thực & Không gian làm việc](file:///f:/DATN/marka-capstone/docs/specs/01-auth-workspace.md#11-đăng-ký--đăng-nhập--đăng-xuất-uc01-uc02-uc03) | Xác thực qua Email/Password hoặc Google OAuth |
| **UC02** | Login | Guest | [01. Xác thực & Không gian làm việc](file:///f:/DATN/marka-capstone/docs/specs/01-auth-workspace.md#11-đăng-ký--đăng-nhập--đăng-xuất-uc01-uc02-uc03) | Đăng nhập hệ thống |
| **UC02b** | Google OAuth Login | Guest | [01. Xác thực & Không gian làm việc](file:///f:/DATN/marka-capstone/docs/specs/01-auth-workspace.md#11-đăng-ký--đăng-nhập--đăng-xuất-uc01-uc02-uc03) | Đăng nhập/đăng ký bằng Google OAuth |
| **UC03** | Logout | User (All Roles) | [01. Xác thực & Không gian làm việc](file:///f:/DATN/marka-capstone/docs/specs/01-auth-workspace.md#11-đăng-ký--đăng-nhập--đăng-xuất-uc01-uc02-uc03) | Đăng xuất phiên làm việc |
| **UC04** | Change Password | User (All Roles) | [01. Xác thực & Không gian làm việc](file:///f:/DATN/marka-capstone/docs/specs/01-auth-workspace.md#13-hồ-sơ-cá-nhân-update-profile--change-password---uc04-uc32) | Đổi mật khẩu trong cài đặt |
| **UC05** | Create Content | Content Creator, Owner | [02. Soạn thảo & Thư viện Media](file:///f:/DATN/marka-capstone/docs/specs/02-content-media.md#21-soạn-thảo--cập-nhật-nội-dung-create--update-content---uc05-uc07) | Rich Text Editor, Template, Auto-save nháp |
| **UC06** | Generate AI Content | Content Creator, Owner | [03. AI Assistant & Brand Voice](file:///f:/DATN/marka-capstone/docs/specs/03-ai-brandvoice.md#32-sinh-nội-dung-bằng-ai-generate-ai-content---uc06) | Sử dụng LLM & DALL-E 3, trừ credit |
| **UC07** | Update Content | Content Creator, Owner | [02. Soạn thảo & Thư viện Media](file:///f:/DATN/marka-capstone/docs/specs/02-content-media.md#21-soạn-thảo--cập-nhật-nội-dung-create--update-content---uc05-uc07) | Cập nhật nháp hoặc bài bị từ chối |
| **UC08** | View Content | Content Creator, Owner | [02. Soạn thảo & Thư viện Media](file:///f:/DATN/marka-capstone/docs/specs/02-content-media.md#24-xem-tìm-kiếm--lọc-nội-dung-view--search-content---uc08-uc09) | Xem chi tiết bài viết, lịch sử chỉnh sửa |
| **UC09** | Search content | Content Creator, Owner | [02. Soạn thảo & Thư viện Media](file:///f:/DATN/marka-capstone/docs/specs/02-content-media.md#24-xem-tìm-kiếm--lọc-nội-dung-view--search-content---uc08-uc09) | Tìm kiếm theo tiêu đề/từ khóa, lọc trạng thái/tags |
| **UC10** | Delete Content | Content Creator, Owner | [02. Soạn thảo & Thư viện Media](file:///f:/DATN/marka-capstone/docs/specs/02-content-media.md#26-xóa-bài-viết-delete-content---uc10) | Xóa mềm bản nháp, bài bị từ chối/lỗi đăng |
| **UC11** | Submit Content for Approval | Content Creator | [02. Soạn thảo & Thư viện Media](file:///f:/DATN/marka-capstone/docs/specs/02-content-media.md#23-quy-trình-duyệt-bài-submit-for-approval--review-content---uc11-uc14) | Creator gửi duyệt chuyển sang trạng thái Pending |
| **UC12** | Schedule content | Owner (hoặc Creator được ủy quyền) | [04. Kênh & Đăng bài đa kênh](file:///f:/DATN/marka-capstone/docs/specs/04-social-publishing.md#42-biên-tập--lên-lịch-đăng-theo-từng-kênh-schedule-content---uc12) | Đặt ngày giờ đăng tự động cho từng bài Approved |
| **UC13** | View content schedule | Content Creator, Owner | [04. Kênh & Đăng bài đa kênh](file:///f:/DATN/marka-capstone/docs/specs/04-social-publishing.md#44-calendar-view-view-content-schedule---uc13) | Xem lịch tháng bài đăng dưới dạng calendar |
| **UC14** | Review Content | Workspace Owner | [02. Soạn thảo & Thư viện Media](file:///f:/DATN/marka-capstone/docs/specs/02-content-media.md#23-quy-trình-duyệt-bài-submit-for-approval--review-content---uc11-uc14) | Owner phê duyệt hoặc từ chối bài kèm lý do |
| **UC15** | Post content to social media | Owner (hoặc Creator được ủy quyền) | [04. Kênh & Đăng bài đa kênh](file:///f:/DATN/marka-capstone/docs/specs/04-social-publishing.md#43-thực-thi-đăng-bài-thật--giả-lập---uc15) | Đăng thật lên Facebook Page & Giả lập kênh khác |
| **UC16** | Create Workspace | User (All Roles) | [01. Xác thực & Không gian làm việc](file:///f:/DATN/marka-capstone/docs/specs/01-auth-workspace.md#12-quản-lý-workspace--thành-viên-uc16-uc17-uc18-uc19-uc20-uc21-uc22-uc23) | Khởi tạo không gian làm việc mới |
| **UC17** | Update Workspace | Workspace Owner | [01. Xác thực & Không gian làm việc](file:///f:/DATN/marka-capstone/docs/specs/01-auth-workspace.md#12-quản-lý-workspace--thành-viên-uc16-uc17-uc18-uc19-uc20-uc21-uc22-uc23) | Đổi tên, upload logo mới |
| **UC18** | Delete Workspace | Workspace Owner | [01. Xác thực & Không gian làm việc](file:///f:/DATN/marka-capstone/docs/specs/01-auth-workspace.md#12-quản-lý-workspace--thành-viên-uc16-uc17-uc18-uc19-uc20-uc21-uc22-uc23) | Xóa mềm workspace và dữ liệu liên quan |
| **UC19** | View member in workspace | Content Creator, Owner | [01. Xác thực & Không gian làm việc](file:///f:/DATN/marka-capstone/docs/specs/01-auth-workspace.md#12-quản-lý-workspace--thành-viên-uc16-uc17-uc18-uc19-uc20-uc21-uc22-uc23) | Xem danh sách, vai trò, trạng thái thành viên |
| **UC20** | Invite member | Workspace Owner | [01. Xác thực & Không gian làm việc](file:///f:/DATN/marka-capstone/docs/specs/01-auth-workspace.md#12-quản-lý-workspace--thành-viên-uc16-uc17-uc18-uc19-uc20-uc21-uc22-uc23) | Owner gửi email chứa token mời tham gia |
| **UC21** | Accept invitation | Guest / User | [01. Xác thực & Không gian làm việc](file:///f:/DATN/marka-capstone/docs/specs/01-auth-workspace.md#12-quản-lý-workspace--thành-viên-uc16-uc17-uc18-uc19-uc20-uc21-uc22-uc23) | Bấm liên kết trong email để tham gia workspace |
| **UC22** | Leave workspace | Content Creator, Owner | [01. Xác thực & Không gian làm việc](file:///f:/DATN/marka-capstone/docs/specs/01-auth-workspace.md#12-quản-lý-workspace--thành-viên-uc16-uc17-uc18-uc19-uc20-uc21-uc22-uc23) | Rời workspace (Owner duy nhất bị chặn) |
| **UC23** | Remove member | Workspace Owner | [01. Xác thực & Không gian làm việc](file:///f:/DATN/marka-capstone/docs/specs/01-auth-workspace.md#12-quản-lý-workspace--thành-viên-uc16-uc17-uc18-uc19-uc20-uc21-uc22-uc23) | Owner xóa thành viên ra khỏi workspace |
| **UC24** | Create brand voice | Workspace Owner | [03. AI Assistant & Brand Voice](file:///f:/DATN/marka-capstone/docs/specs/03-ai-brandvoice.md#31-cấu-hình--quản-lý-brand-voice-create-update--view-brand-voice---uc24-uc25-uc26) | Thiết lập tông giọng và bài viết few-shot mẫu |
| **UC25** | Update brand voice | Workspace Owner | [03. AI Assistant & Brand Voice](file:///f:/DATN/marka-capstone/docs/specs/03-ai-brandvoice.md#31-cấu-hình--quản-lý-brand-voice-create-update--view-brand-voice---uc24-uc25-uc26) | Chỉnh sửa thông tin Brand Voice hiện tại |
| **UC26** | View brand voice | Content Creator, Owner | [03. AI Assistant & Brand Voice](file:///f:/DATN/marka-capstone/docs/specs/03-ai-brandvoice.md#31-cấu-hình--quản-lý-brand-voice-create-update--view-brand-voice---uc24-uc25-uc26) | Xem cấu hình tông giọng trong cài đặt/soạn thảo |
| **UC27** | View connected channels | Workspace Owner | [04. Kênh & Đăng bài đa kênh](file:///f:/DATN/marka-capstone/docs/specs/04-social-publishing.md#41-kết-nối--quản-lý-kênh-liên-kết-uc27-uc28-uc29) | Xem danh sách và trạng thái các kênh kết nối |
| **UC28** | Connect social channels | Workspace Owner | [04. Kênh & Đăng bài đa kênh](file:///f:/DATN/marka-capstone/docs/specs/04-social-publishing.md#41-kết-nối--quản-lý-kênh-liên-kết-uc27-uc28-uc29) | Kết nối FB Page thật hoặc TikTok/IG/Zalo giả lập |
| **UC28a** | Connect Facebook Page (thật) | Workspace Owner | [04. Kênh & Đăng bài đa kênh](file:///f:/DATN/marka-capstone/docs/specs/04-social-publishing.md#41-kết-nối--quản-lý-kênh-liên-kết-uc27-uc28-uc29) | Nhập thủ công `pageId` + `pageAccessToken`; token mã hóa AES-256 (D13) |
| **UC28b** | Connect simulated channels | Workspace Owner | [04. Kênh & Đăng bài đa kênh](file:///f:/DATN/marka-capstone/docs/specs/04-social-publishing.md#41-kết-nối--quản-lý-kênh-liên-kết-uc27-uc28-uc29) | Kết nối IG/TikTok/Zalo giả lập (`ChannelType.SIMULATED`) |
| **UC29** | Disconnect social channel | Workspace Owner | [04. Kênh & Đăng bài đa kênh](file:///f:/DATN/marka-capstone/docs/specs/04-social-publishing.md#41-kết-nối--quản-lý-kênh-liên-kết-uc27-uc28-uc29) | Ngắt kết nối kênh, tự động hủy các bài scheduled |
| **UC30** | Purchase Credits | Workspace Owner | [06. Credit & Thanh toán PayOS](file:///f:/DATN/marka-capstone/docs/specs/06-billing-payos.md#61-nạp-credit--nâng-cấp-gói-purchase-credits---uc30) | Nạp thêm credit qua cổng thanh toán PayOS |
| **UC30a** | Create Order | Workspace Owner | [06. Credit & Thanh toán PayOS](file:///f:/DATN/marka-capstone/docs/specs/06-billing-payos.md) | Tạo đơn hàng + link/QR PayOS (`status=PENDING`) |
| **UC30b** | PayOS Webhook | System | [06. Credit & Thanh toán PayOS](file:///f:/DATN/marka-capstone/docs/specs/06-billing-payos.md) | Verify chữ ký, idempotent theo `orderCode`, cộng credit |
| **UC30c** | Poll Order Status | Workspace Owner | [06. Credit & Thanh toán PayOS](file:///f:/DATN/marka-capstone/docs/specs/06-billing-payos.md) | Client polling trạng thái đơn mỗi 5 giây |
| **UC31** | View Dashboard & Audit Log | System Admin, Owner, Creator (dashboard); System Admin + Owner (audit log) | [07. Quản trị hệ thống & Báo cáo](file:///f:/DATN/marka-capstone/docs/specs/07-admin-analytics.md#71-dashboard-thống-kê-view-dashboard---uc31) | Xem báo cáo hiệu suất và nhật ký hoạt động |
| **UC31a** | View Admin Dashboard | System Admin, Workspace Owner, Content Creator | [07. Quản trị hệ thống & Báo cáo](file:///f:/DATN/marka-capstone/docs/specs/07-admin-analytics.md#71-dashboard-thống-kê-view-dashboard---uc31) | Thống kê user/workspace/credit/doanh thu |
| **UC31b** | View Audit Log | System Admin, Workspace Owner | [07. Quản trị hệ thống & Báo cáo](file:///f:/DATN/marka-capstone/docs/specs/07-admin-analytics.md#73-audit-log-view-audit-log---uc31) | Xem nhật ký hành động; **Content Creator KHÔNG có quyền** |
| **UC32** | Update Profile | User (All Roles) | [01. Xác thực & Không gian làm việc](file:///f:/DATN/marka-capstone/docs/specs/01-auth-workspace.md#13-hồ-sơ-cá-nhân-update-profile--change-password---uc04-uc32) | Cập nhật tên hiển thị, avatar (đổi email qua OTP dời Phase 5) |
| **UC33** | Refresh Token | User (All Roles) | [01. Xác thực & Không gian làm việc](file:///f:/DATN/marka-capstone/docs/specs/01-auth-workspace.md#11-đăng-ký--đăng-nhập--đăng-xuất-uc01-uc02-uc03) | Làm mới access token từ refresh token trong cookie |
| **UC34** | Verify Email | Guest / User | [01. Xác thực & Không gian làm việc](file:///f:/DATN/marka-capstone/docs/specs/01-auth-workspace.md#11-đăng-ký--đăng-nhập--đăng-xuất-uc01-uc02-uc03) | **Dời Phase 5 — chưa triển khai**; đăng ký xong đăng nhập tự động |
| **UC35** | List Workspaces | User (All Roles) | [01. Xác thực & Không gian làm việc](file:///f:/DATN/marka-capstone/docs/specs/01-auth-workspace.md#12-quản-lý-workspace--thành-viên-uc16-uc17-uc18-uc19-uc20-uc21-uc22-uc23) | Xem danh sách workspace mà user là thành viên |
| **UC36** | Change Member Role | Workspace Owner | [01. Xác thực & Không gian làm việc](file:///f:/DATN/marka-capstone/docs/specs/01-auth-workspace.md#12-quản-lý-workspace--thành-viên-uc16-uc17-uc18-uc19-uc20-uc21-uc22-uc23) | Thay đổi vai trò thành viên trong workspace |
| **UC37** | Upload Media | Content Creator, Workspace Owner | [02. Soạn thảo & Thư viện Media](file:///f:/DATN/marka-capstone/docs/specs/02-content-media.md#22-thư-viện-media) | Upload file vào thư viện media cấp Workspace |
| **UC38** | Cancel Scheduled Post | Workspace Owner (hoặc Creator được ủy quyền) | [04. Kênh & Đăng bài đa kênh](file:///f:/DATN/marka-capstone/docs/specs/04-social-publishing.md#42-biên-tập--lên-lịch-đăng-theo-từng-kênh-schedule-content---uc12) | Huỷ lịch đăng (`ScheduledPost → CANCELLED`) |
| **UC39** | List Notifications | User (All Roles) | [05. Email & Thông báo tự động](file:///f:/DATN/marka-capstone/docs/specs/05-notifications-email.md#54-thông-báo-in-app-hệ-thống-chuông-thông-báo) | Xem danh sách thông báo in-app |
| **UC40** | Mark Notification as Read | User (All Roles) | [05. Email & Thông báo tự động](file:///f:/DATN/marka-capstone/docs/specs/05-notifications-email.md#54-thông-báo-in-app-hệ-thống-chuông-thông-báo) | Đánh dấu 1 thông báo đã đọc |
| **UC41** | Mark All Notifications as Read | User (All Roles) | [05. Email & Thông báo tự động](file:///f:/DATN/marka-capstone/docs/specs/05-notifications-email.md#54-thông-báo-in-app-hệ-thống-chuông-thông-báo) | Đánh dấu tất cả thông báo đã đọc |
| **UC42** | View Post Analytics | Content Creator, Owner | [08. Thống kê hiệu quả bài đăng](file:///f:/DATN/marka-capstone/docs/specs/08-post-analytics.md#85-api-endpoints) | Xem reactions/comments/shares của bài đã đăng |
| **UC42b** | Refresh Post Metrics | Content Creator, Owner | [08. Thống kê hiệu quả bài đăng](file:///f:/DATN/marka-capstone/docs/specs/08-post-analytics.md#85-api-endpoints) | Làm mới số liệu thủ công cho 1 bài (rate-limit 30s) |
| **UC43** | View Workspace Performance Overview | Content Creator, Owner | [08. Thống kê hiệu quả bài đăng](file:///f:/DATN/marka-capstone/docs/specs/08-post-analytics.md#85-api-endpoints) | Dashboard tổng hợp hiệu quả đăng bài theo Workspace |
| **UC47** | List Credit Packages | Tất cả user (gói active) | [06. Credit & Thanh toán PayOS](file:///f:/DATN/marka-capstone/docs/specs/06-billing-payos.md) | Xem danh sách gói credit để nạp |
| **UC48** | Create Credit Package | System Admin | [06. Credit & Thanh toán PayOS](file:///f:/DATN/marka-capstone/docs/specs/06-billing-payos.md) | Tạo gói credit mới |
| **UC49** | Update Credit Package | System Admin | [06. Credit & Thanh toán PayOS](file:///f:/DATN/marka-capstone/docs/specs/06-billing-payos.md) | Cập nhật gói credit (giá, credit, `isActive`) |
| **UC50** | Delete Credit Package | System Admin | [06. Credit & Thanh toán PayOS](file:///f:/DATN/marka-capstone/docs/specs/06-billing-payos.md) | Xoá mềm gói credit (`deletedAt`) |
| **UC51** | View Credit Balance & History | Workspace member | [06. Credit & Thanh toán PayOS](file:///f:/DATN/marka-capstone/docs/specs/06-billing-payos.md) | Xem số dư và lịch sử giao dịch credit |

---

## Các tài liệu phân hệ chi tiết:

1. [01. Phân hệ Xác thực & Không gian làm việc (01-auth-workspace.md)](file:///f:/DATN/marka-capstone/docs/specs/01-auth-workspace.md)
2. [02. Phân hệ Soạn thảo & Thư viện Media (02-content-media.md)](file:///f:/DATN/marka-capstone/docs/specs/02-content-media.md)
3. [03. Phân hệ Trợ lý AI Content & Brand Voice (03-ai-brandvoice.md)](file:///f:/DATN/marka-capstone/docs/specs/03-ai-brandvoice.md)
4. [04. Phân hệ Kết nối & Đăng bài đa kênh (04-social-publishing.md)](file:///f:/DATN/marka-capstone/docs/specs/04-social-publishing.md)
5. [05. Phân hệ Email & Thông báo tự động (05-notifications-email.md)](file:///f:/DATN/marka-capstone/docs/specs/05-notifications-email.md)
6. [06. Phân hệ Credit & Thanh toán PayOS (06-billing-payos.md)](file:///f:/DATN/marka-capstone/docs/specs/06-billing-payos.md)
7. [07. Phân hệ Quản trị hệ thống & Báo cáo (07-admin-analytics.md)](file:///f:/DATN/marka-capstone/docs/specs/07-admin-analytics.md)
8. [08. Phân hệ Thống kê hiệu quả bài đăng — Post Analytics (08-post-analytics.md)](file:///f:/DATN/marka-capstone/docs/specs/08-post-analytics.md)

---

## 8. Lưu ý triển khai chung (áp dụng toàn hệ thống)

1. **State machine là trung tâm (D15)**: Post status gồm `Draft/Pending/Approved/Rejected/Scheduled/Published/Failed/**Archived**`; định nghĩa transition hợp lệ ở **1 nơi duy nhất** (service layer), validate rõ ràng, tránh để nhiều chỗ trong code tự ý set status. Các transition bắt buộc: `REJECTED → PENDING` (gửi duyệt lại), `PENDING/APPROVED → DRAFT` (thu hồi), `FAILED → SCHEDULED` (retry), `PUBLISHED → ARCHIVED` (không xoá bài đã đăng).
2. **Mọi thao tác tốn thời gian đều qua queue**: sinh AI text/ảnh, đăng bài, gửi email — không xử lý đồng bộ trong request-response để tránh timeout và giữ API < 500ms.
3. **Idempotency ở mọi nơi có tiền/credit**: webhook thanh toán, trừ/hoàn credit, email nhắc định kỳ — luôn có cơ chế chống xử lý trùng.
4. **Mã hóa dữ liệu nhạy cảm**: access token (Facebook, PayOS API key) bắt buộc AES-256 trước khi lưu DB, không log ra console/log file.
5. **Test case ưu tiên cao**: luồng Atomic Credit (AI fail giữa chừng), luồng duyệt bài (transition không hợp lệ), luồng webhook thanh toán (trùng lặp, chữ ký sai) — đây là 3 luồng dễ phát sinh lỗi nhất và cũng dễ bị hội đồng hỏi sâu khi bảo vệ.
6. **Xác nhận sớm giới hạn thực tế của Facebook App** (Development mode, tester accounts) ngay từ Phase 1-2, không để đến Phase 4 mới phát hiện vướng.
7. **Viết báo cáo song song, không dồn cuối kỳ**: ghi chú lại quyết định thiết kế, khó khăn kỹ thuật ngay khi làm từng phase, để Phase 6 chỉ cần tổng hợp thay vì viết từ đầu.

### 8.1. Chiến lược xử lý lỗi API bên thứ 3

**OpenAI / DALL-E**:
- **Cơ chế Retry**: Khi xảy ra lỗi kết nối, timeout hoặc lỗi từ OpenAI, hệ thống thực hiện retry tối đa 3 lần với exponential backoff (giãn cách tăng dần: 1s, 2s, 4s).
- **Xử lý thất bại**: Nếu sau 3 lần vẫn lỗi, worker đánh dấu trạng thái tác vụ (job) là `FAILED`, gửi thông báo lỗi chi tiết cho user, và hoàn lại credit cho workspace (không trừ credit).
- **Circuit Breaker**: Theo dõi tỉ lệ lỗi kết nối OpenAI. Nếu tỷ lệ lỗi > 20% trên tổng số request trong vòng 5 phút, hệ thống kích hoạt Circuit Breaker tạm dừng queue `content-generation` để tránh tràn RAM Redis (Redis memory overflow) và gửi cảnh báo khẩn cấp cho System Admin.

**Facebook Graph API**:
- **Hết hạn Token (Token Expired)**: Tự động chuyển đổi kết nối kênh sang trạng thái `EXPIRED` và hiển thị cảnh báo cho Workspace Owner yêu cầu đăng nhập và cấp lại token mới qua modal kết nối.
- **Vượt quá tần suất (Rate Limit)**: Trích xuất thông tin giới hạn từ header phản hồi của Facebook (`X-FB-RR`) và tạm dừng đăng bài/retry trên kênh đó theo khoảng thời gian yêu cầu để tránh bị khóa ứng dụng.
- **Vi phạm chính sách nội dung**: Ghi nhận mã lỗi phản hồi cụ thể từ Facebook, đánh dấu trạng thái bài đăng là `FAILED`, lưu trữ lịch sử lỗi và hiển thị rõ ràng nguyên nhân: "Facebook từ chối bài viết vì lý do..." để user chủ động điều chỉnh.

---

## 9. Quy trình Onboarding người dùng mới (User Onboarding Flow)

**Mô tả**: Trải nghiệm chào đón người dùng mới đăng ký lần đầu để giúp họ làm quen với hệ thống nhanh chóng và trực quan nhất.

**Các bước hành trình (User Journey)**:

1. **Đăng ký thành công**: Hệ thống tự động chuyển hướng người dùng mới đến trang `/dashboard`.
2. **Hiển thị Onboarding Modal**: Một hộp thoại popup "Chào mừng! Bắt đầu với 3 bước đơn giản" xuất hiện ngay lập tức:
   - **Bước 1: Khởi tạo Workspace**: Người dùng nhập tên workspace đầu tiên (hoặc nhập mã mời từ đồng nghiệp để tham gia workspace hiện có).
   - **Bước 2: Thiết lập Brand Voice**: Người dùng điền nhanh thông tin thương hiệu (ngành hàng, khách hàng mục tiêu) hoặc có thể chọn "Bỏ qua để cấu hình sau".
   - **Bước 3: Tạo bài viết đầu tiên**: Gợi ý người dùng thử nghiệm tính năng với các mẫu bài viết (template) có sẵn.
3. **Cung cấp dữ liệu mẫu (Demo Templates)**: Cung cấp sẵn một số bài đăng mẫu chuẩn hóa cho Facebook/TikTok trong Workspace mới tạo để người dùng click thử và trải nghiệm ngay quy trình phê duyệt & đăng bài giả lập mà không cần phải nhập thủ công.

---

## 10. Giới hạn kỹ thuật (Technical Constraints)

Để đảm bảo hệ thống hoạt động ổn định trong môi trường production và tránh quá tải tài nguyên, Marka áp dụng các giới hạn kỹ thuật sau:

- **BullMQ Queue**: Giới hạn tối đa 10.000 jobs trong hàng đợi cho mỗi queue (quản lý dung lượng RAM của Redis tránh bị overflow).
- **Giới hạn Context OpenAI**: Hạn mức token tối đa gửi nhận là 4.096 tokens cho mỗi request khi gọi GPT-4o để tối ưu hóa chi phí và tốc độ phản hồi.
- **Dung lượng cơ sở dữ liệu**: Cấu hình tối thiểu 10 GB cho database PostgreSQL ở môi trường Development, và tối thiểu 50 GB cho môi trường Production (để lưu trữ lịch sử audit log và thông tin bài viết).
- **Upload tệp tin**: Giới hạn tải lên đồng thời tối đa 5 file cho mỗi request (phía client và server).
