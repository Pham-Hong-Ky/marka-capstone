# Project Overview — Marka

> Nền tảng AI Content đa kênh & Quản lý chiến dịch tiếp thị dành riêng cho Marketer Việt Nam.

---

## 0. Ghi chú phạm vi (đọc trước khi code)

Tài liệu này dùng làm cơ sở code cho đồ án **1 người - 24 tuần (~6 tháng)**. Mục 3 và Mục 3.1 (Roadmap) là **nguồn sự thật về phạm vi** — nếu một tính năng không nằm trong Phase 1-4, mặc định là _Could-have / Won't-have_, không code trước khi các phase trước hoàn thành và ổn định.

> **Đồng bộ với tài liệu Khảo sát hệ thống**: mô hình vai trò và phạm vi kênh đăng bài trong tài liệu này đã được cập nhật để khớp 100% với tài liệu "Khảo sát hệ thống" — cố định **3 vai trò** (System Admin, Workspace Owner, Content Creator) và **không** có Telegram trong danh sách kênh đăng thật.

---

## 1. Mục tiêu sản phẩm

Giải quyết bài toán **phân phối nội dung đa kênh (omnichannel content)** và **quản lý quy trình xuất bản** cho các nhà tiếp thị (marketer) Việt Nam.

Từ một ý tưởng/nội dung gốc ban đầu, marketer thường mất nhiều giờ để chỉnh sửa (adapt) cho phù hợp với định dạng, văn phong và thuật toán của từng nền tảng (Facebook, Zalo, Instagram, TikTok). Marka giúp tự động hóa quy trình này bằng AI, quản lý luồng phê duyệt nội dung chặt chẽ giữa các vai trò (Creator → Owner), tích hợp cổng thanh toán thực tế (PayOS) và trang quản trị hệ thống (Admin Panel) để theo dõi và vận hành hiệu quả.

---

## 2. Tổng quan hệ thống vai trò & Phân quyền (RBAC)

Hệ thống thiết lập mô hình phân quyền 2 cấp: **Cấp hệ thống (System level)** và **Cấp không gian làm việc (Workspace level)**, cố định **3 vai trò chính** (đáp ứng `FR-AD-04`), không hỗ trợ tạo vai trò tùy chỉnh (Custom Role).

### 2.1. Cấp hệ thống (System Roles)

- **System Admin**: Quản trị toàn bộ hệ thống, quản lý tài khoản, cấu hình kết nối API nền tảng, cổng thanh toán, xem audit logs và quản lý các Workspace.
  - System Admin **không** có quyền chỉnh sửa nội dung/bài viết bên trong một Workspace theo mặc định. Admin chỉ có quyền: suspend/unsuspend account, xem metadata Workspace (tên, chủ sở hữu, gói cước, số credit), và xem audit log tổng hệ thống.

### 2.2. Cấp không gian làm việc (Workspace Roles)

Mỗi Workspace đại diện cho một thương hiệu hoặc doanh nghiệp cụ thể (`FR-AD-11`). Trong mỗi Workspace, người dùng được phân vào **2 vai trò cố định**:

- **Workspace Owner**: Toàn quyền cấu hình Workspace, quản lý thành viên, cài đặt Brand Voice, quản lý gói cước/Billing, **phê duyệt/từ chối bài viết** (gộp vai trò Reviewer), quản lý kết nối kênh mạng xã hội, và **thực hiện hoặc ủy quyền đăng bài** (gộp vai trò Social Media Manager).
- **Content Creator**: Soạn thảo bài viết, tải media, sử dụng AI sinh nội dung, gửi bài duyệt, nhận phản hồi khi bị từ chối và cập nhật lại để nộp lại. Nếu được Owner **ủy quyền**, Creator có thể tự lên lịch/đăng bài đối với các bài đã `Approved`.

Không có vai trò Reviewer/Approver, Social Media Manager hay Viewer/Guest riêng biệt — các chức năng tương ứng được gộp vào 2 vai trò trên để giữ mô hình phân quyền đơn giản, đúng phạm vi đồ án cá nhân.

**Quy tắc quan trọng**: vai trò được gán **theo từng cặp (User, Workspace)**, không phải toàn cục. Một User có thể là Owner ở Workspace A và Content Creator ở Workspace B cùng lúc. Bảng dữ liệu quan hệ tối thiểu: `WorkspaceMember(userId, workspaceId, role)`. UI phải cho phép chuyển đổi Workspace đang hoạt động (workspace switcher) và cập nhật quyền tương ứng.

---

## 3. Bản đồ Feasibility (Đánh giá tính khả thi cho Đồ án 1 người - 24 tuần)

| Mã FR             | Tên yêu cầu chức năng                                                              | Đánh giá khả thi & Phương án triển khai                                                                                                                                                                                                                                                                                     | Trạng thái phạm vi             | Ưu tiên |
| :---------------- | :--------------------------------------------------------------------------------- | :-------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :----------------------------- | :------ |
| **FR-CC-01 → 11** | Nghiệp vụ Content Creator & Media Library                                          | Sử dụng WYSIWYG editor (TipTap/React-Quill), Cloudinary/S3 cho Media và cơ chế lưu tạm/lưu nháp trong DB.                                                                                                                                                                                                                   | **Full Scope**                 | Must    |
| **FR-CC-12 → 19** | Trợ lý AI Content & Brand Voice                                                    | Tích hợp **1 LLM provider chính** (OpenAI GPT-4o hoặc Claude — chọn 1, không code multi-provider trong MVP) để sinh text theo Brand Voice, chấm điểm Viral Score, và DALL-E 3 để sinh ảnh minh họa. Multi-provider đẩy sang Phase 4 (Could-have) nếu còn thời gian.                                                         | **Full Scope (1 provider)**    | Must    |
| **FR-RV-01 → 06** | Nghiệp vụ Phê duyệt (do **Workspace Owner** đảm nhiệm)                             | Quản lý trạng thái bài viết qua máy trạng thái (State Machine): `Draft` → `Pending` → `Approved` / `Rejected`. Owner là người duyệt, không có vai trò Reviewer riêng.                                                                                                                                                       | **Full Scope**                 | Must    |
| **FR-SM-01 → 11** | Kết nối & Đăng bài đa kênh (do **Owner** hoặc **Creator được ủy quyền** thực hiện) | Do chính sách API cực kỳ khắt khe của Zalo OA, TikTok, Instagram (yêu cầu pháp nhân doanh nghiệp để xét duyệt):<br>- **Facebook Page**: Kết nối và đăng thật qua Facebook Graph API (chế độ Developer/Sandbox).<br>- **Instagram, TikTok, Zalo OA**: Luồng **Giả lập đăng bài (Simulation Mode)** — xem chi tiết mục 4.4.1. | **Tích hợp thực tế + Giả lập** | Must    |
| **FR-EM-01 → 04** | Hệ thống Email Thông báo (System Emails)                                           | Gửi email thông báo tự động (hết hạn gói, hết credit, nhắc lịch đăng bài, lời mời tham gia workspace) qua SMTP/Resend.                                                                                                                                                                                                      | **Full Scope**                 | Should  |
| **FR-AD-01 → 13** | Quản trị hệ thống (System Admin)                                                   | Quản lý tài khoản (suspend/unsuspend), cấu hình kết nối API, thống kê dashboard, lịch sử gọi AI. Bỏ FR-AD-05 (Tạo vai trò tùy chỉnh).                                                                                                                                                                                       | **Full Scope (Trừ FR-AD-05)**  | Should  |
| **FR-VW-01 → 02** | Calendar View (lịch đăng bài đa kênh)                                              | Hiển thị lịch tháng cho toàn bộ bài đã lên lịch/đã đăng trong Workspace, hỗ trợ đổi ngày đăng (chỉ áp dụng cho bài ở trạng thái `Scheduled`, chưa `Published`).                                                                                                                                                             | **Full Scope**                 | Should  |
| **N/A**           | Cổng thanh toán (PayOS)                                                            | Tích hợp cổng PayOS thực tế để nạp credit và tự động nâng cấp gói qua Webhook có xác thực chữ ký bảo mật.                                                                                                                                                                                                                   | **Full Scope**                 | Must    |

### 3.1. Roadmap đề xuất (6 phase / 24 tuần)

| Phase                                     | Tuần  | Nội dung                                                                                                                                                                                                    |
| :---------------------------------------- | :---- | :---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Phase 1 — Nền tảng**                    | 1-4   | Phân tích thiết kế (ERD, API contract), Auth (Email/Password + Google OAuth), Workspace CRUD + RBAC (2 vai trò workspace), User Profile, cấu hình bảo mật cơ bản (mục 5), setup CI/CD + môi trường dev/prod |
| **Phase 2 — Content Core**                | 5-9   | Content Creator + Media Library, luồng duyệt bài (Draft→Pending→Approved/Rejected do Owner duyệt), Brand Voice                                                                                              |
| **Phase 3 — AI Assistant**                | 10-13 | Tích hợp AI sinh nội dung (1 provider chính), sinh biến thể đa kênh, sinh ảnh AI (DALL-E 3), Viral Score & 1-Click Fix                                                                                      |
| **Phase 4 — Phân phối & Lịch đăng**       | 14-17 | Facebook thật, Instagram/TikTok/Zalo giả lập, Calendar View, BullMQ + Redis worker, cơ chế Retry                                                                                                            |
| **Phase 5 — Thanh toán & Email**          | 18-21 | PayOS + Credit system + Webhook, Hệ thống Email Thông báo (hết hạn gói, hết credit, nhắc lịch đăng bài, lời mời workspace)                                                                                  |
| **Phase 6 — Admin, hoàn thiện & báo cáo** | 22-24 | Admin Panel + Audit Log, kiểm thử toàn hệ thống, sửa lỗi, tối ưu hiệu năng, viết báo cáo/slide bảo vệ                                                                                                       |

Với quỹ thời gian rộng hơn, các hạng mục sau chuyển từ Could-have lên **Should-have** nếu Phase 1-5 đúng tiến độ: hỗ trợ thêm 1 LLM provider thứ hai (fallback khi provider chính lỗi/quá tải), 2FA cho Workspace Owner, môi trường `staging` riêng biệt. Viral Score radar nâng cao vẫn giữ **Could-have**.

### 3.2. Ngoài phạm vi (Out of Scope — nêu rõ để tránh hiểu nhầm)

- Chiến dịch Email Marketing hàng loạt, trình soạn thảo Email chiến dịch và quản lý danh bạ khách hàng (import CSV/Excel).
- Drag-and-drop Email Builder tự viết từ đầu.
- Đăng bài thật lên Instagram, TikTok, Zalo OA (chỉ giả lập).
- Đăng bài qua Telegram (ngoài phạm vi — không nằm trong danh sách kênh của tài liệu khảo sát).
- Tạo vai trò tùy chỉnh (custom role) hoặc vai trò Reviewer/Social Media Manager/Viewer riêng biệt — chỉ 2 vai trò workspace cố định (Owner, Content Creator).
- Đa ngôn ngữ (i18n) giao diện — chỉ tiếng Việt.
- Ứng dụng di động — chỉ web responsive.
- Hỗ trợ nhiều LLM provider song song trong MVP.
- **Gửi email xác thực tài khoản (UC34) và luồng đổi email qua OTP** — dời sang Phase 5; Phase 1 đăng ký xong đăng nhập tự động, chưa gửi email xác thực.

---

## 4. Đặc tả chi tiết các Phân hệ & Luồng nghiệp vụ

### 4.1. Phân hệ 1 — Xác thực & Không gian làm việc (Auth & Workspace)

- **Xác thực (`FR-AD-01`, `FR-AD-02`, `FR-AD-03`)**: Đăng ký/Đăng nhập bằng Email/Password và Google OAuth. Hỗ trợ Admin khóa/mở khóa tài khoản người dùng (`FR-AD-02`). Áp dụng rate-limit đăng nhập (ví dụ tối đa 5 lần sai/15 phút/IP) để chống brute-force.
- **Quản lý Workspace (`FR-AD-11`)**:
  - Mỗi Workspace đại diện cho một thương hiệu riêng biệt.
  - Người dùng có thể tạo Workspace mới, cập nhật thông tin (tên, logo), và mời thành viên qua email (chỉ 2 vai trò để chọn: Owner, Content Creator).
  - **Phân quyền Workspace (RBAC)**: theo mô hình `(User, Workspace) -> Role` như mô tả ở mục 2.2.
- **Hồ sơ cá nhân (User Profile)**: Đổi tên hiển thị, ảnh đại diện (upload Cloudinary/S3), thay đổi mật khẩu. Luồng đổi email (xác thực OTP qua email mới) và gửi email xác thực tài khoản được dời sang Phase 5.

### 4.2. Phân hệ 2 — Thư viện & Quy trình Biên tập Nội dung

- **Soạn thảo (`FR-CC-01`, `FR-CC-03`, `FR-CC-04`, `FR-CC-05`)**: Sử dụng Rich Text Editor để định dạng văn bản, chèn link, emoji, hashtag. Hỗ trợ chọn mẫu template có sẵn và gắn nhãn/phân loại theo chiến dịch. Tự động lưu bản nháp sau mỗi 30 giây.
- **Thư viện Media (`FR-CC-02`, `FR-CC-06`, `FR-CC-07`)**: Upload ảnh/video trực tiếp lên thư viện độc lập hoặc đính kèm khi soạn bài. Lọc media theo tên, loại file, thẻ tag và ngày tạo. Giới hạn: ảnh ≤ 10MB, video ≤ 100MB; chỉ chấp nhận đuôi file whitelist (jpg, png, webp, mp4, mov); mỗi Workspace có quota lưu trữ theo gói cước.
- **Quy trình Duyệt bài (`FR-CC-09`, `FR-CC-10`, `FR-CC-11`, `FR-RV-01 → 04`)**:
  1. Creator hoàn thành bài viết → Bấm **Gửi duyệt** → Trạng thái chuyển thành `Pending Review`.
  2. **Workspace Owner** nhận thông báo, xem danh sách bài viết chờ duyệt (`FR-RV-01`, `FR-RV-05`).
  3. Owner xem trước (Preview) hiển thị của bài viết (`FR-RV-02`) và đưa ra quyết định:
     - **Duyệt (Approve)**: Chuyển trạng thái sang `Approved` → Chuyển tiếp sang luồng đăng bài.
     - **Từ chối (Reject)**: Chuyển trạng thái sang `Rejected` → Bắt buộc nhập lý do từ chối để Creator chỉnh sửa lại.

```
                     ┌───────────┐
                     │   Draft   │◄────────────────────────┐
                     └─────┬─────┘                         │
                           │ Gửi duyệt (Creator)           │
                           ▼                               │ Từ chối
                     ┌───────────┐ (Ghi lý do)             │ (Owner)
                     │  Pending  ├─────────────────────────┤
                     └─────┬─────┘                         │
                           │ Duyệt (Owner)                 │
                           ▼                               │
                     ┌───────────┐                         │
                     │ Approved  │                         │
                     └─────┬─────┘                         │
                           │ Lên lịch/Đăng (Owner hoặc     │
                           │ Creator được ủy quyền)        │
                           ▼                               │
                     ┌───────────┐                         │
         Lịch đến giờ│ Scheduled │                         │
      ──────────────►└─────┬─────┘                         │
                           │ Đăng thành công / Thất bại    │
                    ┌──────┴──────┐                        │
                    ▼             ▼                        │
             ┌───────────┐  ┌───────────┐  Thử lại (Retry) │
             │ Published │  │  Failed   ├──────────────────┤
             └───────────┘  └───────────┘  (giữ nguyên nội │
                                             dung, không cần│
                                             duyệt lại)     │
```

Ghi chú: `Failed` → Retry quay lại `Scheduled` (gọi lại API đăng bài), **không** quay lại `Draft`/`Pending` — nội dung đã duyệt không cần duyệt lại.

### 4.3. Phân hệ 3 — Trợ lý AI Content & Brand Voice

- **Quản lý Brand Voice (`FR-CC-12`)**: Lưu trữ thông tin định dạng tông giọng của thương hiệu (ngành hàng, khách hàng mục tiêu, từ khóa nên/không nên dùng, bài viết mẫu few-shot).
- **Sinh nội dung bằng AI (`FR-CC-13`, `FR-CC-14`, `FR-CC-15`, `FR-CC-16`)**:
  - Nhập chủ đề/ý chính hoặc dán URL bài viết nguồn → AI tự động áp dụng Brand Voice để tạo bài viết.
  - Sinh biến thể đa kênh: Tự động tối ưu nội dung theo đặc thù của Facebook (ngắn gọn, emoji), TikTok (kịch bản thoại/phân cảnh), các kênh khác trong danh sách hỗ trợ.
  - Hỗ trợ **Regenerate** (sinh lại phương án khác kèm góp ý chỉnh sửa) và chỉnh sửa trực tiếp nội dung do AI tạo trước khi lưu.
  - MVP dùng **1 LLM provider duy nhất** (xem mục 3).
- **Sinh ảnh minh họa bằng AI (`FR-CC-17`, `FR-CC-18`, `FR-CC-19`)**: Gọi API Text-to-Image (DALL-E 3) để sinh ảnh minh họa dựa trên nội dung bài viết và lưu vào thư viện media của Workspace.
- **Viral Score & 1-Click Fix**: Đánh giá chất lượng bài viết theo biểu đồ radar (tiêu chí Hook, CTA, độ dễ đọc...) và cung cấp nút tối ưu hóa nhanh bằng AI.

### 4.4. Phân hệ 4 — Kết nối & Đăng bài đa kênh

- **Kết nối kênh (`FR-SM-01`, `FR-SM-02`, `FR-AD-06`)**:
  - **Facebook Page**: Kết nối tài khoản thông qua luồng OAuth của Facebook (sử dụng Facebook App chế độ thử nghiệm/nhà phát triển).
  - **Instagram, TikTok, Zalo OA (Sandbox/Giả lập)**: Cấu hình tài khoản giả lập trên hệ thống để phục vụ luồng chạy demo.

#### 4.4.1. Định nghĩa "Simulation Mode" (làm rõ để tránh hiểu sai khi code)

Với Instagram, TikTok, Zalo OA: khi bấm "Đăng", hệ thống **không** gọi API thật. Thay vào đó:

1. Ghi nhận kết quả vào `ScheduledPost` của kênh đó (`ChannelType.SIMULATED`, `status = PUBLISHED`, `externalPostId` sinh giả) sau một độ trễ giả lập (2-5 giây, để mô phỏng trải nghiệm thật) — **không có bảng `SimulatedPost`** (D9).
2. Giao diện hiển thị rõ nhãn **"Chế độ giả lập"** trên mọi bài đăng thuộc nhóm kênh này (không được để người dùng nhầm là đã đăng thật).
3. Cung cấp nút **Copy nội dung nhanh** và **Tải ảnh/video** để người dùng tự đăng thủ công lên nền tảng thật nếu muốn.

- **Biên tập & Lên lịch đăng (`FR-SM-03` → `FR-SM-09`, `FR-VW-01`, `FR-VW-02`)**:
  - Chọn 1 hoặc nhiều kênh đã liên kết để đăng bài (`FR-SM-03`).
  - Cho phép điều chỉnh nội dung riêng biệt phù hợp với từng kênh trước khi xuất bản (`FR-SM-04`).
  - **Calendar View**: Hiển thị toàn bộ lịch trình đăng bài dưới dạng lịch tháng trực quan, hỗ trợ kéo thả để thay đổi ngày đăng (chỉ với bài `Scheduled`).
  - **Đăng bài**, thực hiện bởi **Owner** hoặc **Creator được ủy quyền**:
    - **Lên lịch (Schedule)**: Hệ thống đẩy job vào **BullMQ + Redis** với độ trễ tới `scheduledAt` (delayed job). Khi tới hạn, Worker tự động kích hoạt API đăng bài. **n8n không tham gia luồng đăng bài** (chỉ dùng cho đồng bộ metrics).
    - **Đăng ngay (Publish Now)**: Gửi request đăng bài lập tức lên các API nền tảng đã chọn.
- **Kết quả đăng bài (`FR-SM-10`, `FR-SM-11`)**: Ghi nhận trạng thái đăng bài (Thành công / Thất bại kèm mã lỗi chi tiết). Hỗ trợ nút **Thử lại (Retry)** khi đăng bài bị lỗi mà không cần soạn lại từ đầu (xem sơ đồ trạng thái mục 4.2).

### 4.5. Phân hệ 5 — Hệ thống Email & Thông báo Tự động (System & Notification Emails)

- **Email mời tham gia Workspace (`FR-EM-01`)**: Khi Workspace Owner mời một thành viên mới qua email, hệ thống tự động gửi email kèm đường dẫn xác thực và mã kích hoạt để người dùng chấp nhận tham gia Workspace.
- **Email nhắc nhở gói cước & Credit (`FR-EM-02`, `FR-EM-03`)**:
  - Tự động gửi email cảnh báo khi gói dịch vụ sắp hết hạn (ví dụ trước 3 ngày) để nhắc nhở nạp tiền/gia hạn.
  - Tự động gửi email cảnh báo khi credit khả dụng trong Workspace sắp hết (dưới 10% hạn mức tháng) để người dùng cân đối hoặc mua thêm.
- **Email nhắc nhở lịch đăng bài (`FR-EM-04`)**:
  - Trước thời điểm lên lịch đăng bài (Scheduled) khoảng 15 phút, hệ thống tự động gửi email nhắc nhở cho **người phụ trách đăng bài** (Owner hoặc Creator được ủy quyền) để kiểm tra nội dung và trạng thái tài khoản liên kết.
- **Cơ chế gửi & Tự động hóa**:
  - Tác vụ kiểm tra hạn gói, credit và nhắc lịch đăng bài được vận hành bởi Cron Job định kỳ kết hợp hàng đợi BullMQ + Redis worker để gửi email bất đồng bộ.
  - Email được gửi qua giao thức SMTP (Gmail/Outlook) hoặc tích hợp dịch vụ Resend/SendGrid API (`FR-AD-07`).

### 4.6. Phân hệ 6 — Nạp Credit & Cổng thanh toán PayOS

- **Cơ chế Gói dịch vụ & Credit**: Phân chia Workspace thành các gói dịch vụ (FREE, PRO, ENTERPRISE) với hạn mức Credit cấp hàng tháng khác nhau. Mỗi hành động gọi AI (sinh bài viết, cải thiện bài viết, sinh ảnh) sẽ trừ một lượng credit tương ứng.
  - **Bảng chi phí credit** (khởi điểm, có thể cấu hình qua Admin Panel — không hard-code):

    | Hành động                      | Credit |
    | :----------------------------- | :----- |
    | Sinh 1 bài viết text           | 5      |
    | Regenerate                     | 3      |
    | Sinh 1 ảnh (DALL-E 3)          | 10     |
    | Chấm Viral Score / 1-Click Fix | 2      |

  - **Hạn mức credit theo gói (D6)**: FREE = 100, PRO = 1000, ENTERPRISE = 5000 credit/tháng. `Workspace` lưu `billingCycleStart`/`nextResetAt` làm mốc neo cho cron reset/hạ gói.
  - **Reset hàng tháng**: credit của **cả ba gói (FREE/PRO/ENTERPRISE)** reset về `monthlyQuota` vào đầu chu kỳ, **không cộng dồn** (use-it-or-lose-it) — cần nêu rõ trên UI để tránh khiếu nại.
  - **Credit không đủ**: hệ thống chặn hành động _trước khi_ gọi API AI (kiểm tra số dư ước tính), hiển thị modal mời nạp thêm/nâng cấp gói, không cho phép âm credit.

- **Thanh toán trực tuyến**:
  - Người dùng bấm nâng cấp gói → Gọi API PayOS để tạo mã QR thanh toán kèm theo đường link cổng thanh toán thật.
  - **Webhook tự động**: Nhận thông tin chuyển khoản từ PayOS về server qua Webhook bảo mật để cộng credit tức thì.
  - **Kiểm soát trùng lặp (Idempotency)**: Sử dụng mã đơn hàng duy nhất để kiểm tra chéo, tránh xử lý trùng lặp giao dịch.
  - **Client Polling**: Hỗ trợ cơ chế tự động gửi request kiểm tra trạng thái thanh toán từ giao diện người dùng mỗi 5 giây phòng trường hợp webhook bị chậm.
  - **Hạ gói/Hủy**: khi hết chu kỳ thanh toán mà không gia hạn, Workspace tự động hạ về gói FREE; không hỗ trợ hoàn tiền tự động trong phạm vi đồ án (ghi rõ trong FAQ/điều khoản, xử lý hoàn tiền thủ công qua Admin nếu có).

### 4.7. Phân hệ 7 — Quản trị hệ thống (System Admin)

- **Dashboard Thống kê**: Hiển thị tổng quan số lượng User, số Workspace, lượng Credit tiêu thụ và doanh thu thực tế.
- **Quản lý Tài nguyên**: Danh sách tài khoản người dùng, danh sách các Workspace, xem trạng thái hoạt động và cấu hình giới hạn sử dụng AI (`FR-AD-13`).
- **Audit Logs (`FR-AD-09`)**: Lưu nhật ký các hoạt động quan trọng như đăng nhập, đổi mật khẩu, thay đổi email, xóa workspace, phê duyệt bài viết, giao dịch thanh toán thành công.

---

## 5. Đặc tả Bảo mật & Quản lý Session

- **CSRF & XSS Protection**: Tự động validate CSRF Tokens cho mọi request nhạy cảm. Áp dụng thư viện `dompurify` làm sạch dữ liệu nhập vào trước khi lưu trữ hoặc hiển thị trên giao diện.
- **SQL Injection Prevention**: Giao tiếp dữ liệu sử dụng Prisma ORM với Parameterized Queries, không cộng chuỗi thô để tránh lỗi SQL Injection.
- **CORS Configuration**: Cấu hình CORS nghiêm ngặt chỉ cho phép các domain được định nghĩa cố định trong `.env` truy cập tài nguyên API.
- **JWT Session & Revocation**: Thiết lập Access Token có thời hạn ngắn kết hợp Refresh Token lưu trong HTTP-Only Cookie. Sử dụng trường `tokenVersion` trên DB để lập tức vô hiệu hóa tất cả session cũ khi người dùng đổi mật khẩu hoặc bị khóa tài khoản.
- **Rate limiting**: giới hạn số lần đăng nhập sai, giới hạn tần suất gọi API sinh nội dung AI theo User/Workspace để chống lạm dụng (ngoài kiểm soát bằng credit).
- **File upload validation**: kiểm tra MIME type thực tế (không chỉ đuôi file), giới hạn kích thước theo mục 4.2, quét virus cơ bản nếu thời gian cho phép (Could-have).

---

## 6. Cơ chế Tự phục hồi & Tối ưu hóa hiệu năng

- **Xử lý nền bất đồng bộ (BullMQ + Redis)**: Đối với các tác vụ tốn thời gian như sinh bài viết dài, tạo nhiều biến thể, sinh ảnh bằng AI hoặc lên lịch đăng bài, hệ thống đẩy vào hàng đợi BullMQ để xử lý bất đồng bộ ở background, tránh nghẽn kết nối và HTTP timeout.
- **Tự động thử lại (Retry)**: Khi gọi API OpenAI/DALL-E bị lỗi hoặc timeout, BullMQ tự động thực hiện thử lại tối đa 3 lần với giãn cách lũy thừa. Nếu thất bại hoàn toàn, hệ thống sẽ trả lại credit cho Workspace.
- **Redis Caching**: Lưu trữ các prompt mẫu, cấu hình hệ thống, và dữ liệu ngày lễ Việt Nam vào Redis để phản hồi lập tức và giảm số lượng truy vấn trực tiếp vào Database.
- **Connection Pooling**: Cấu hình PgBouncer hoặc Prisma Accelerate để quản lý hiệu quả số lượng kết nối đồng thời vào cơ sở dữ liệu PostgreSQL.

---

## 7. Yêu cầu phi chức năng (NFR) & Tuân thủ

- **Hiệu năng**: API thông thường phản hồi < 500ms (p95, không tính các tác vụ AI/queue). Tác vụ AI xử lý bất đồng bộ; **MVP dùng polling**, còn WebSocket/SSE là **Phase sau (tùy chọn)** (D20).
- **Backup & Retention**: Backup PostgreSQL hàng ngày (tối thiểu snapshot thủ công định kỳ trong phạm vi đồ án). Audit log lưu tối thiểu 90 ngày.
- **Bảo vệ dữ liệu cá nhân**: Thông tin cá nhân của người dùng (email, họ tên) được bảo mật nghiêm ngặt. Chỉ gửi email thông báo hệ thống khi thật sự cần thiết (mời workspace, xác nhận tài khoản, cảnh báo hết hạn gói/credit) và tuân thủ các quy định bảo mật hiện hành.
- **Môi trường triển khai**: tối thiểu 2 môi trường — `development` và `production`; môi trường `staging` là Should-have (xem mục 3.1) nếu Phase 1-5 đúng tiến độ.
