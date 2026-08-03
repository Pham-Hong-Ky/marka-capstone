# Project Overview — Marka

> Nền tảng AI Content đa kênh dành riêng cho Marketer Việt Nam.

---

## 1. Mục tiêu sản phẩm

Giải quyết bài toán **phân phối nội dung đa kênh (omnichannel content)** cho các nhà tiếp thị (marketer) Việt Nam.

Từ một ý tưởng/nội dung gốc ban đầu hoặc nguồn trích xuất (URL), marketer thường mất nhiều giờ để chỉnh sửa (adapt) cho phù hợp với định dạng, văn phong và thuật toán của từng nền tảng (Facebook, LinkedIn, TikTok, SEO). Marka giúp tự động hóa quy trình này bằng AI chỉ trong vòng chưa đầy 30 giây, tích hợp cổng thanh toán thực tế (PayOS) và trang quản trị hệ thống (Admin Panel) để theo dõi và vận hành hiệu quả.

---

## 2. Tổng quan kiến trúc chức năng

Hệ thống được chia thành 5 module nghiệp vụ dành cho người dùng và 1 module dành cho quản trị viên, liên kết chặt chẽ qua một luồng nghiệp vụ xuyên suốt:

**Đăng nhập → Tạo/Quản lý Workspace → Thiết lập Brand Voice → Tạo nội dung (trừ Credit) → Đánh giá & tối ưu → Lên lịch → Theo dõi lịch sử → Quản lý gói/Credits.**

```
┌───────────────────────────────────────────────────────────────────────────────────┐
│                                      MARKA                                        │
├─────────────┬─────────────┬─────────────┬───────────────┬─────────────┬───────────┤
│  Auth &     │  AI Content │  Brand      │  Calendar &   │  Billing &  │  System   │
│  Workspace  │  Generator  │  Voice      │  History      │  Credits    │  Admin    │
│  (CRUD)     │             │             │               │  (PayOS)    │           │
└─────────────┴─────────────┴─────────────┴───────────────┴─────────────┴───────────┘
```

---

## 3. Đặc tả chi tiết các Module & Luồng hoạt động

### 3.1. Module 1 — Auth & Workspace (CRUD)

#### Chức năng

- **Xác thực**: Đăng ký/Đăng nhập bằng Email+Password và Google OAuth (NextAuth.js v5).
- **CRUD Workspace đầy đủ**:
  - **Create**: Tạo Workspace mới (tên workspace, tải lên logo/avatar tùy chọn). Một người dùng có thể sở hữu hoặc tham gia nhiều Workspace khác nhau.
  - **Read**: Xem danh sách các Workspace, xem chi tiết thông tin Workspace (thông tin chung, danh sách thành viên, gói dịch vụ đang sử dụng).
  - **Update**: Thay đổi tên/logo của Workspace, thay đổi vai trò thành viên, chuyển quyền sở hữu (Owner) cho thành viên khác.
  - **Delete**: Xóa Workspace (chỉ Owner được phép thực hiện, yêu cầu xác nhận 2 bước để tránh nhầm lẫn; áp dụng cơ chế soft delete để có thể khôi phục trong vòng X ngày).
- **Cộng tác nhóm**: Mời thành viên mới tham gia Workspace qua email, xóa thành viên khỏi Workspace.
- **Phân quyền 2 cấp**:
  - `OWNER` (Toàn quyền quản trị Workspace và quản lý Billing/thanh toán nâng cấp gói).
  - `MEMBER` (Tạo/sửa nội dung, lên lịch, không có quyền chỉnh sửa cấu hình Workspace và Billing).
- **Hồ sơ cá nhân (User Profile)**: Người dùng tự quản lý thông tin độc lập với Workspace:
  - Thay đổi tên hiển thị.
  - Thay đổi ảnh đại diện (upload ảnh mới lên CDN Cloudinary/S3 hoặc chọn avatar mặc định).
  - Thay đổi email: Hệ thống gửi mã OTP xác thực tới email mới → Xác minh OTP thành công mới áp dụng đổi email.
  - Đổi mật khẩu: Yêu cầu mật khẩu cũ (ẩn nếu đăng nhập qua Google OAuth).
- **Bảo mật & Ghi vết**:
  - Ghi nhận Audit Log khi có thay đổi email, đổi mật khẩu hoặc xoá Workspace.
  - **Quản lý Session**: Khi thay đổi mật khẩu hoặc bị khóa tài khoản, hệ thống tự động tăng `tokenVersion` của User trong cơ sở dữ liệu để vô hiệu hóa tức thì toàn bộ các JWT session hiện tại của tài khoản đó.

#### Luồng hoạt động

1. Người dùng truy cập trang chủ → chọn **Đăng ký** → nhập email/mật khẩu hoặc đăng nhập nhanh bằng Google.
2. Hệ thống tự động khởi tạo một Workspace mặc định (ví dụ: `Workspace của Nguyễn`) và gán quyền `OWNER` cho người dùng đó.
3. Người dùng có thể tạo thêm các Workspace mới từ **Workspace Switcher** trên thanh công cụ điều hướng.
4. Owner mời thành viên bằng cách truy cập **Workspace Settings → Members** → nhập email → gửi thư mời → thành viên nhấp link, tạo tài khoản và tự động gia nhập Workspace dưới vai trò `MEMBER`.
5. Khi xóa Workspace tại **Workspace Settings → Danger Zone**, hệ thống yêu cầu gõ lại chính xác tên Workspace để xác nhận → Workspace chuyển sang trạng thái đã xóa (soft-delete), ghi nhận vào Audit Log.
6. Để cập nhật hồ sơ, người dùng truy cập **Hồ sơ cá nhân** → chỉnh sửa thông tin hoặc nhập OTP đổi email → thực hiện thành công, hệ thống cập nhật DB và ghi Audit Log.

---

### 3.2. Module 2 — Brand Voice (Giọng văn thương hiệu)

#### Chức năng

- **Thiết lập thủ công**: Khai báo tone giọng (chuyên nghiệp, gần gũi, hài hước...), đối tượng khách hàng mục tiêu (persona), các từ khóa bắt buộc phải có và các từ cấm sử dụng (banned words).
- **Phân tích giọng văn (Brand Voice Analyzer)**: Người dùng dán vào 2-3 bài viết mẫu có sẵn → AI tự động phân tích và trích xuất tone giọng, độ dài câu trung bình, sắc thái biểu đạt để đề xuất bộ Brand Voice tự động điền vào form (tối đa 1 yêu cầu/phút/user).
- **So sánh trước/sau**: Sinh thử một đoạn văn bản mẫu trước và sau khi áp dụng Brand Voice để người dùng dễ dàng trực quan hóa kết quả.

#### Luồng hoạt động

1. Người dùng vào **Brand Voice Settings** của Workspace:
   - **Cách A (Điền thủ công)**: Người dùng tự điền các thông tin mô tả tone giọng, từ khóa cấm/bắt buộc và đối tượng mục tiêu.
   - **Cách B (Analyzer)**: Dán 2-3 bài viết chuẩn của doanh nghiệp → Bấm **Phân tích** → Hệ thống gọi AI để bóc tách văn phong và tự động hoàn thiện form thiết lập → Người dùng tinh chỉnh lại nếu muốn và bấm Lưu.
2. Hệ thống tạo và hiển thị phần so sánh trước/sau khi lưu: lấy 1 nội dung brief gốc và hiển thị bản chưa áp giọng văn bên cạnh bản đã áp giọng văn để đối chiếu.
3. Bộ hồ sơ Brand Voice này sẽ được áp dụng làm luật mặc định cho mọi tác vụ sinh nội dung AI tiếp theo trong Workspace.

---

### 3.3. Module 3 — AI Content Generator (Lõi sáng tạo nội dung)

#### Chức năng

- **Đầu vào linh hoạt**: Cho phép nhập tay văn bản thô hoặc dán URL bài viết bất kỳ để hệ thống tự động cào và trích xuất nội dung chính (loại bỏ menu, quảng cáo).
- **Chuyển đổi sang 4 định dạng nền tảng**: Tối ưu hóa định dạng và phong cách cho:
  1. _Facebook Post_ (tập trung Hook, emoji, CTA và hashtag).
  2. _LinkedIn Post_ (văn phong chuyên nghiệp B2B, bullet points).
  3. _TikTok Script_ (kịch bản phân cảnh chi tiết: bối cảnh, góc máy, action, overlay text, âm thanh).
  4. _SEO Article_ (bài viết dài có tiêu đề H1, thẻ Meta description và các thẻ H2/H3).
- **Tham số tùy chọn**: Điều chỉnh độ dài (ngắn, vừa, dài) và mức độ trang trọng (formal/casual).
- **Sinh nhiều phiên bản (variants)**: AI tự tạo ra 2-3 phiên bản khác nhau của cùng một định dạng đích để người dùng lựa chọn.
- **Tối ưu hóa hiệu năng & Chi phí AI**:
  - **Prompt Engineering**: Sử dụng các prompt mẫu được tối ưu hóa kỹ lưỡng (không fine-tune mô hình) để kiểm soát chất lượng đầu ra và giảm tối đa chi phí API.
  - **Prompt Caching**: Lưu trữ các prompt và response của các yêu cầu phổ biến/trùng lặp vào Redis cache (TTL 7 ngày) giúp trả về kết quả tức thì và không tốn credit/cost.
  - **Streaming Response**: Sử dụng kết nối Server-Sent Events (SSE) để truyền phát văn bản thời gian thực (hiệu ứng chữ gõ), cải thiện đáng kể trải nghiệm người dùng (UX) tránh "đứng hình".
  - **Xử lý nền bất đồng bộ (BullMQ)**: Đối với các bài viết dài (như SEO Article) hoặc các tác vụ tạo đồng thời nhiều variant, hệ thống đẩy công việc vào hàng đợi BullMQ (lưu trong Redis) để xử lý bất đồng bộ ở background, tránh HTTP timeout.
- **Đánh giá Viral Score & 1-Click Fix**:
  - Chấm điểm bài viết trên thang điểm từ 0–100 dựa trên 5 tiêu chí: Hook (câu mở đầu thu hút), CTA (kêu gọi hành động), Readability (độ dễ đọc), Emotion (cảm xúc tác động), và Brand Voice Match (độ khớp giọng văn). Điển hiển thị trực quan dưới dạng biểu đồ mạng nhện (radar chart).
  - Nút **"1-Click Fix" (Cải thiện nhanh)**: AI tự động phân tích tiêu chí có điểm thấp nhất và viết lại đoạn văn bản tương ứng để tối ưu hóa.
- **Lịch sử chỉnh sửa phiên bản (Version History)**: Lưu lại lịch sử mỗi lần chỉnh sửa tay hoặc bấm cải thiện tự động (`ContentVersion`) để người dùng có thể xem lại hoặc khôi phục phiên bản trước đó.

#### Luồng hoạt động

1. Người dùng vào chức năng **Tạo nội dung mới** → Chọn nguồn nhập (nhập tay hoặc dán URL bài viết) → Nhập dữ liệu và bấm tiếp tục.
2. Chọn các định dạng đầu ra mong muốn và thiết lập độ dài, tone giọng.
3. Hệ thống kiểm tra hạn mức tín dụng (credit) của Workspace. Nếu đủ:
   - Các tác vụ tạo bài đăng ngắn hoặc trích xuất nhanh sẽ khởi chạy kết nối Streaming (SSE) trả dữ liệu trực tiếp về UI.
   - Các tác vụ tạo SEO Article dài hoặc nhiều định dạng cùng lúc sẽ được đẩy vào hàng đợi **BullMQ**. Client nhận về một `jobId` để theo dõi tiến độ qua endpoint `/api/jobs/{jobId}`. Khi job hoàn thành, variants nội dung được trả về kèm theo Viral Score tương ứng.
4. Người dùng xem các phiên bản, có thể chỉnh sửa trực tiếp hoặc bấm **"1-Click Fix"** để AI cải thiện. Mỗi lần thay đổi tạo ra một `ContentVersion` mới trong lịch sử.

---

### 3.4. Module 4 — Content Calendar & History (Lịch biên tập & Lịch sử)

#### Chức năng

- **Lịch biên tập dạng Tháng (Monthly Calendar)**: Hiển thị trực quan các bài viết đã lên lịch theo ngày, phân biệt rõ ràng bằng màu sắc theo từng nền tảng (Facebook, LinkedIn, TikTok, SEO). Hỗ trợ kéo thả ngày xuất bản.
- **Lên lịch bài viết**: Hỗ trợ đặt ngày và giờ cụ thể để xuất bản bài viết.
- **Lịch Marketing Việt Nam**: Tích hợp danh sách tĩnh các ngày lễ, sự kiện lớn và dịp mua sắm tại Việt Nam (hỗ trợ cả âm lịch) trong vòng 30 ngày tới. Với mỗi ngày lễ, AI sinh sẵn gợi ý góc nội dung (Content Angle) theo đúng Brand Voice hiện tại.
- **Lịch sử bài viết (/history)**: Tìm kiếm bài viết theo từ khóa, lọc theo kênh, lọc theo trạng thái (`Draft`, `Scheduled`, `Published`). Hỗ trợ copy nhanh nội dung bài viết chỉ với 1 click.

#### Luồng hoạt động

1. Từ màn hình tạo nội dung, sau khi chọn **Lên lịch** → Hiện lên popup chọn ngày/giờ → Xác nhận → Trạng thái bài viết chuyển sang `Scheduled` và hiển thị trên Lịch tháng.
2. Tại màn hình **Calendar**, người dùng có thể nhấp vào một bài đăng bất kỳ để xem nhanh nội dung, điều chỉnh ngày giờ hoặc sửa đổi thông tin.
3. Khi xem danh sách ngày lễ ở tab **Lịch Marketing Việt Nam**, người dùng chọn một dịp lễ → Bấm **Tạo bài viết cho ngày này** → Hệ thống tự động chuyển tiếp sang Module 3 và điền sẵn ý tưởng tiếp cận do AI đề xuất làm brief đầu vào.
4. Sau khi đăng bài lên mạng xã hội theo lịch, người dùng vào `/history` để đổi trạng thái bài viết thành `Published` nhằm theo dõi tiến độ.

---

### 3.5. Module 5 — Billing & Credits (Thanh toán & Hạn ngạch)

#### Chức năng

- **Hệ thống Gói dịch vụ (3 hạng gói)**:
  - **FREE**: Cấp 20 credit/tháng, giới hạn tối đa 1 Brand Voice, chỉ hoạt động cá nhân.
  - **PRO**: Cấp 300 credit/tháng, không giới hạn Brand Voice, tối đa mời được 5 thành viên.
  - **ENTERPRISE**: Cấp 1000 credit/tháng, không giới hạn số lượng Brand Voice và thành viên.
- **Kiểm soát & Khóa hành động**: Mọi hành động gọi AI (Tạo bài, 1-Click Fix, Phân tích Brand Voice) sẽ bị chặn và yêu cầu nâng cấp gói nếu credit hiện tại của Workspace bằng 0.
- **Tích hợp thanh toán thật qua PayOS**:
  - Tạo link thanh toán/mã QR qua API PayOS.
  - **Webhook an toàn**: Nhận thông báo giao dịch thành công tự động từ PayOS để cập nhật gói cước và cộng credit. Xác thực chữ ký webhook bằng cơ chế kiểm tra `checksum` (HMAC-SHA256).
  - **Idempotency Key (Chống thanh toán trùng lặp)**: Sử dụng mã đơn hàng duy nhất (`payos_order_code`) làm mã khoá giao dịch trong cơ sở dữ liệu. Ngăn chặn hoàn toàn việc xử lý trùng lặp một giao dịch nhiều lần khi nhận webhook lặp hoặc lỗi mạng.
  - **Chiến lược Polling kiểm tra (Retry)**: Hỗ trợ kiểm tra trạng thái đơn hàng tự động từ Client. Nếu webhook bị chậm/lỗi, trang thanh toán sẽ thực hiện gửi request truy vấn `/api/billing/payos/status/{orderCode}` mỗi 5 giây/lần, kéo dài tối đa trong vòng 10 phút (120 lượt thử) trước khi kết thúc và hiển thị thông báo liên hệ hỗ trợ.
- **Lịch sử giao dịch chi tiết**: Lịch sử nạp/trừ credit đơn giản và lịch sử các giao dịch chuyển khoản PayOS.

#### Luồng hoạt động

1. Khi gọi AI tạo bài, hệ thống trừ credit và ghi nhận vào lịch sử credit. Nếu credit hết, các nút gọi AI bị vô hiệu hóa.
2. Người dùng truy cập trang **Settings → Billing** → Chọn gói PRO hoặc ENTERPRISE → Bấm nâng cấp.
3. Hệ thống tạo đơn hàng trong DB (`PaymentTransaction` trạng thái `PENDING`), gọi API PayOS sinh mã QR và hiển thị lên màn hình.
4. Người dùng chuyển khoản quét mã QR.
   - Khi thanh toán thành công, PayOS gọi Webhook về server → Server kiểm tra chữ ký webhook hợp lệ, đối chiếu mã đơn hàng để đảm bảo tính duy nhất (Idempotency) → Cập nhật đơn hàng thành `PAID`, nâng cấp gói và cộng credit, ghi Audit Log.
   - Nếu Webhook lỗi/chậm, client chạy background polling trong 10 phút liên tục gọi API kiểm tra trạng thái đơn hàng từ PayOS để đồng bộ và cập nhật gói.
5. Định kỳ hàng tháng (đầu chu kỳ), hệ thống reset credit về hạn mức gói hiện tại của Workspace.

---

### 3.6. Module 6 — Trang quản trị hệ thống (System Admin)

#### Chức năng

- **Dashboard tổng quan**: Thống kê số lượng người dùng mới, số lượng workspace, lượng credit tiêu thụ toàn hệ thống và biểu đồ tăng trưởng doanh thu/giao dịch theo ngày/tuần.
- **Quản lý người dùng (Users)**: Xem danh sách, tìm kiếm người dùng. Hỗ trợ tính năng **Khoá/Mở khoá tài khoản (Suspend/Unsuspend)** nếu phát hiện tài khoản vi phạm chính sách hoặc spam hệ thống.
- **Quản lý Workspace**: Xem danh sách các workspace trên hệ thống, kiểm tra gói cước đang dùng và số credit còn lại. Hỗ trợ **Khoá/Xoá workspace**.
- **Quản lý Gói dịch vụ (Plan)**: Cho phép Admin chỉnh sửa thông tin các gói cước (giá tiền, hạn mức credit cấp hàng tháng, số thành viên tối đa).
- **Log giao dịch toàn hệ thống**: Theo dõi toàn bộ lịch sử trừ credit và giao dịch thanh toán để đối soát khi cần thiết.
- **Xem Audit Logs**: Cho phép Admin giám sát toàn bộ log hoạt động quan trọng trong hệ thống để phục vụ điều tra bảo mật hoặc đối soát giao dịch.

#### Luồng hoạt động

1. Tài khoản được phân quyền `role = ADMIN` đăng nhập vào hệ thống → Hiển thị thêm tùy chọn truy cập **Trang quản trị** (đường dẫn `/admin` được bảo vệ bằng middleware kiểm tra quyền).
2. Admin theo dõi sức khỏe hệ thống qua trang Dashboard tổng quan.
3. Khi có khiếu nại hoặc dấu hiệu lạm dụng, Admin tìm kiếm User/Workspace qua thanh tìm kiếm và thực hiện hành động Khoá/Mở khoá nhanh chóng.
4. Khi cần thay đổi chính sách kinh doanh, Admin vào mục quản lý Plan để điều chỉnh giá gói PRO hoặc đổi hạn ngạch credit mặc định.

---

## 4. Đặc tả Bảo mật & Quản lý Session

Để đảm bảo hệ thống an toàn trước các cuộc tấn công mạng phổ biến, các cơ chế bảo mật sau đây được cấu hình chặt chẽ:

- **CSRF Protection (Chống giả mạo request)**: Sử dụng NextAuth.js v5 để tự động validate CSRF Tokens cho mọi request nhạy cảm (POST/PUT/DELETE). Các API tùy chỉnh được bảo vệ bằng việc kiểm tra tiêu đề `Origin` và `Referer`.
- **XSS Prevention (Chống chèn mã độc)**: Áp dụng thư viện `dompurify` để làm sạch toàn bộ dữ liệu nhập vào từ phía người dùng (input sanitization) trước khi lưu trữ hoặc hiển thị trên giao diện.
- **SQL Injection Prevention (Chống chèn truy vấn DB)**: Toàn bộ quá trình giao tiếp dữ liệu sử dụng **Prisma ORM với Parameterized Queries** (Prepared Statements). Không sử dụng cộng chuỗi thô để sinh truy vấn cơ sở dữ liệu.
- **CORS Configuration (Cấu hình CORS nghiêm ngặt)**: Chỉ cho phép các domain được cấu hình cố định trong `.env` (ví dụ: domain chính của app và domain webhook PayOS) truy cập vào tài nguyên API. Tuyệt đối không sử dụng wildcard `*` cho các API yêu cầu xác thực.
- **API Key Rotation Policy (Xoay vòng khoá)**: Các API Keys của hệ thống (OpenAI, PayOS) được xoay vòng định kỳ 90 ngày. Với các API Keys được lưu trong Workspace, hệ thống cung cấp nút "Rotate Key" giúp thu hồi khoá cũ và tạo khoá mới ngay lập tức.
- **JWT Refresh Token Strategy**: Thời gian sống của Access Token JWT là 1 ngày, Refresh Token là 30 ngày. Hệ thống triển khai JWT rotation callback trong NextAuth để tự động refresh session cho người dùng mà không cần bắt họ đăng nhập lại.
- **Session Revocation (Thu hồi phiên làm việc)**: Bảng `User` chứa trường `tokenVersion`. Mỗi khi người dùng đổi mật khẩu, hoặc bị Admin khóa tài khoản (suspend), giá trị `tokenVersion` sẽ tự động được tăng thêm 1. Khi đó, toàn bộ JWT session cũ chứa `tokenVersion` không khớp sẽ lập tức bị hệ thống từ chối và yêu cầu đăng nhập lại.
- **Chi tiết Audit Logs (Ghi vết hoạt động)**: Bảng `AuditLog` ghi nhận chi tiết:
  - **Ai làm** (`userId`)
  - **Ở đâu** (`workspaceId`)
  - **Khi nào** (`createdAt`)
  - **Hành động gì** (`action`: `DELETE_WORKSPACE`, `CHANGE_EMAIL`, `PAYMENT_SUCCESS`, `SUSPEND_USER`...)
  - **Từ đâu** (`ipAddress`, `userAgent`)
  - **Chi tiết thay đổi** (`details` lưu dưới dạng JSON)

---

## 5. Cơ chế Tự phục hồi & Xử lý lỗi (Resilience)

Hệ thống được thiết kế để duy trì tính hoạt động liên tục (Liveness) và tự phục hồi khi có sự cố phát sinh từ bên thứ ba hoặc môi trường:

- **Xử lý Timeout & Lỗi AI API**:
  - Cuộc gọi AI API có thời hạn timeout tối đa là 15 giây.
  - Khi gặp lỗi hoặc timeout, **BullMQ** sẽ tự động thực hiện thử lại (retry) tối đa 3 lần với cơ chế giãn cách lũy thừa (exponential backoff).
  - Nếu tác vụ hoàn toàn thất bại sau 3 lần thử, job được đánh dấu là `FAILED` và hệ thống **không trừ credit** của Workspace.
- **Tự động reconnect Database**: Prisma Client được cấu hình tự động thử kết nối lại khi gặp sự cố ngắt kết nối tạm thời. Nếu mất kết nối kéo dài, hệ thống trả về mã lỗi `503 Service Unavailable` kèm mã `DATABASE_DISCONNECTED`.
- **Fallback khi Redis Down**: Vì BullMQ và caching phụ thuộc hoàn toàn vào Redis, khi phát hiện kết nối tới Redis bị ngắt, hệ thống tự động bỏ qua hàng đợi BullMQ và chuyển sang chế độ **Xử lý đồng bộ trực tiếp (Synchronous Direct Processing)** trên luồng HTTP để đảm bảo các chức năng chính (như sinh variants Facebook/LinkedIn ngắn) vẫn hoạt động bình thường cho người dùng.
- **Giao dịch Rollback (Atomicity)**: Các luồng cập nhật dữ liệu tài chính như trừ/nạp credit, thay đổi gói cước, hoặc thanh toán đơn hàng được bọc hoàn toàn trong **Prisma Transactions** (`prisma.$transaction`). Nếu bất kỳ câu lệnh nào trong chuỗi xử lý bị lỗi, toàn bộ các cập nhật trước đó sẽ được rollback hoàn toàn về trạng thái cũ để đảm bảo tính nhất quán dữ liệu.

---

## 6. Các biện pháp Tối ưu hoá hiệu năng hệ thống (Performance)

- **Redis Caching**: Thiết lập caching trên Redis cho các tác vụ tốn tài nguyên (AI responses, ngày lễ Việt Nam, vai trò người dùng trong Workspace) để giảm tải cho DB và giảm chi phí AI API.
- **Tối ưu hóa câu lệnh cơ sở dữ liệu**: Đánh chỉ mục (`@@index`) trên các cột tìm kiếm và khóa ngoại. Sử dụng `select` và `include` của Prisma để ngăn ngừa triệt để lỗi **N+1 Query** khi lấy dữ liệu liên kết (như danh sách bài đăng kèm các phiên bản).
- **CDN (Content Delivery Network)**: Toàn bộ ảnh đại diện của người dùng và logo của Workspace sau khi tải lên sẽ được lưu trữ trên AWS S3/Cloudinary và phân phối qua CDN (Cloudflare/CloudFront) để tăng tốc độ tải tài nguyên tĩnh.
- **Nén phản hồi (Compression)**: Cấu hình Next.js hỗ trợ nén dữ liệu truyền tải Gzip/Brotli giúp tiết kiệm băng thông và tăng tốc độ tải trang trên trình duyệt.
- **Connection Pooling**: Cấu hình PgBouncer hoặc Prisma Accelerate trong môi trường PostgreSQL ở Production để quản lý kết nối cơ sở dữ liệu hiệu quả, tránh cạn kiệt connection pool dưới tải cao.

---

## 8. Các tính năng ngoài phạm vi (Định hướng phát triển tương lai)

Các tính năng sau đây được lược bỏ khỏi phạm vi 4 tháng của đồ án để tập trung hoàn thiện các cơ chế bảo mật, PayOS và vận hành hệ thống:

1. **Content DNA (Machine Learning nâng cao)**: Học phong cách viết sâu qua hàng trăm bài đăng lịch sử.
2. **Vietnamese TTS Preview**: Nghe thử giọng đọc thương hiệu tiếng Việt bằng giọng nói AI.
3. **Trợ lý phản hồi Comment / Inbox tự động (Reply Assistant)**: Đóng vai trả lời comment khách hàng.
4. **Bóc tách đối thủ (Competitor Teardown)**: Cào dữ liệu fanpage đối thủ để phân tích.
5. **Đăng bài tự động trực tiếp qua Social API (Facebook/Zalo Graph API)**: Người dùng copy nội dung thủ công để đăng nhằm tránh việc xét duyệt API phức tạp của bên thứ ba.
6. **Luồng duyệt bài nhiều cấp phức tạp (Multi-level Approval)**: Tinh giản để tập trung vào cơ chế phân quyền Workspace cơ bản (`OWNER` và `MEMBER`).
