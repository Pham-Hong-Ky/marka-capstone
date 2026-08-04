# Product Spec — Marka

> Nền tảng AI Content đa kênh & Quản lý chiến dịch tiếp thị dành riêng cho Marketer Việt Nam.
> Tài liệu này mô tả **chi tiết từng chức năng**, **luồng hoạt động** và **lưu ý khi triển khai**. Dùng song song với `Project Overview` (phạm vi/roadmap) và `Khảo sát hệ thống` (bối cảnh nghiệp vụ).

---

## 0. Vai trò tham chiếu nhanh

| Vai trò             | Cấp       | Quyền chính                                                                                     |
| ------------------- | --------- | ----------------------------------------------------------------------------------------------- |
| **System Admin**    | Hệ thống  | Quản lý user, xem metadata workspace, audit log, dashboard, cấu hình API/thanh toán             |
| **Workspace Owner** | Workspace | Quản lý workspace/thành viên, Brand Voice, Billing, **duyệt bài**, kết nối kênh, **đăng bài**   |
| **Content Creator** | Workspace | Soạn bài, quản lý media, dùng AI sinh nội dung, gửi duyệt, đăng bài **nếu được Owner ủy quyền** |

Không có vai trò tùy chỉnh, không có Reviewer/Social Media Manager/Viewer riêng — mọi quyền đăng/duyệt gói trong Owner + Creator (ủy quyền).

---

## 1. Phân hệ: Xác thực & Không gian làm việc

### 1.1. Đăng ký / Đăng nhập

**Mô tả**: Người dùng tạo tài khoản bằng Email/Password hoặc Google OAuth.

**Luồng hoạt động**:

1. User nhập email + password (hoặc bấm "Đăng nhập với Google").
2. Hệ thống validate định dạng email, độ mạnh password (tối thiểu 8 ký tự, có chữ + số).
3. Nếu đăng ký bằng email: gửi email xác thực (link/OTP) → tài khoản ở trạng thái `unverified` cho đến khi xác thực.
4. Đăng nhập thành công → server tạo `accessToken` (JWT, hạn ngắn ~15 phút) + `refreshToken` (lưu HTTP-Only Cookie, hạn dài ~7-30 ngày) → trả về client.
5. Nếu sai quá 5 lần trong 15 phút cho cùng 1 IP/email → khóa tạm thời (rate limit), trả lỗi `429`.

**Lưu ý khi làm**:

- Google OAuth: dùng `passport-google-oauth20` hoặc tự implement OAuth2 code flow; map theo `email` để tránh tạo trùng account nếu user từng đăng ký bằng email/password.
- Password hash bằng `bcrypt` (cost factor ≥ 10), **không** tự chế thuật toán hash.
- `refreshToken` phải rotate mỗi lần dùng (refresh token rotation) để giảm rủi ro replay.
- Trường `tokenVersion` trên bảng `User`: tăng +1 khi đổi mật khẩu hoặc bị Admin khóa → mọi accessToken cũ cấp trước đó lập tức bị coi là invalid dù chưa hết hạn.

### 1.2. Quản lý Workspace

**Mô tả**: Tạo, cập nhật, chuyển đổi giữa các Workspace.

**Luồng hoạt động**:

1. User đăng nhập lần đầu → hệ thống gợi ý "Tạo Workspace mới" (mỗi user tối thiểu 1 workspace mà mình là Owner).
2. Tạo workspace: nhập tên, upload logo (optional) → tạo bản ghi `Workspace` + `WorkspaceMember(userId, workspaceId, role=OWNER)`.
3. Owner mời thành viên: nhập email + chọn role (`OWNER` hoặc `CONTENT_CREATOR`) → hệ thống gửi email mời kèm token mời (hạn 7 ngày).
4. Người được mời bấm link → nếu đã có tài khoản, xác nhận tham gia ngay; nếu chưa có, chuyển sang luồng đăng ký rồi tự động join.
5. **Workspace switcher**: UI hiển thị danh sách workspace mà user là thành viên → chọn 1 làm "workspace đang hoạt động" (lưu trong session/local state), mọi API call sau đó đính kèm `workspaceId` hiện tại.

**Lưu ý khi làm**:

- Middleware xác thực quyền phải luôn kiểm tra `(userId, workspaceId) -> role` cho **mọi** request liên quan đến workspace, không chỉ dựa vào role global của user.
- Token mời cần một-lần-dùng (invalidate sau khi accept) và có thể bị Owner thu hồi (revoke) trước khi được chấp nhận.
- Xóa thành viên / Thành viên rời workspace: Không xóa cascade các bài viết/media do người đó tạo; chúng vẫn thuộc về workspace. Giữ nguyên ID của user đã rời tại trường `createdBy` để phục vụ truy vết. Chỉ Owner mới có quyền sửa tiếp các bài viết này. Nếu bài viết đang ở trạng thái `PENDING` (chờ duyệt), Owner vẫn có quyền duyệt hoặc từ chối bài viết bình thường.

### 1.3. Hồ sơ cá nhân

**Mô tả**: Đổi tên hiển thị, avatar, mật khẩu, email.

**Luồng hoạt động**:

1. Đổi mật khẩu: yêu cầu nhập mật khẩu cũ → verify → set mật khẩu mới → tăng `tokenVersion` (buộc đăng nhập lại trên các thiết bị khác).
2. Đổi email: nhập email mới → gửi OTP đến email mới → xác nhận OTP → cập nhật email, gửi thông báo đến email cũ ("email tài khoản đã được thay đổi") để phát hiện chiếm đoạt tài khoản.

**Lưu ý khi làm**: OTP nên có hạn ngắn (5-10 phút), giới hạn số lần nhập sai (≤5 lần) để chống brute-force.

---

## 2. Phân hệ: Soạn thảo & Thư viện Media

### 2.1. Soạn thảo nội dung

**Mô tả**: Rich Text Editor cho Creator soạn bài, hỗ trợ template, gắn nhãn chiến dịch, tự động lưu nháp.

**Luồng hoạt động**:

1. Creator chọn "Tạo bài viết mới" → chọn template có sẵn (hoặc bắt đầu trống) → soạn nội dung trên editor (TipTap/React-Quill).
2. Mỗi 30 giây (debounce), client tự động gửi PATCH lưu nháp (`status=DRAFT`) — không cần user bấm Save thủ công.
3. Creator gắn nhãn chiến dịch (campaign tag), chọn media từ thư viện để đính kèm.
4. Khi sẵn sàng, bấm **"Gửi duyệt"** → chuyển `status: DRAFT → PENDING`, ghi nhận `submittedAt`, `submittedBy`.

**Lưu ý khi làm**:

- Auto-save nên dùng debounce phía client (không gửi API mỗi keystroke) và so sánh diff/hash nội dung để tránh gọi API khi không có thay đổi thực sự.
- Rich text nên lưu ở dạng JSON (ProseMirror doc) thay vì HTML thô để dễ transform sang nhiều định dạng kênh khác nhau ở Phân hệ AI.
- Sanitize nội dung (dompurify hoặc tương đương) trước khi render lại, kể cả nội dung do chính user nhập, để chống stored-XSS.

### 2.2. Thư viện Media

**Mô tả**: Upload, lọc, quản lý ảnh/video dùng chung cho workspace.

**Luồng hoạt động**:

1. User chọn file → client validate sơ bộ (đuôi file, kích thước) → upload thẳng lên S3/Cloudinary qua signed URL (không qua server để tránh nghẽn băng thông backend).
2. Server nhận callback/metadata sau khi upload xong → lưu bản ghi `MediaAsset(workspaceId, url, type, size, tags, createdBy)`.
3. Kiểm tra quota lưu trữ của workspace theo gói cước **trước khi** cấp signed URL — nếu vượt quota, chặn ngay từ bước 1.
4. Lọc/tìm kiếm theo tên, loại file, tag, ngày tạo trên trang thư viện.

**Bảng Quota lưu trữ & Giới hạn theo gói cước**:

| Gói | Dung lượng lưu trữ | Thời gian lưu log | Số kênh kết nối tối đa |
| :--- | :--- | :--- | :--- |
| **FREE** | 5 GB | 30 ngày | 3 |
| **PRO** | 50 GB | 90 ngày | 10 |
| **ENTERPRISE** | 200 GB | 365 ngày | Không giới hạn |

**Lưu ý khi làm**:

- Giới hạn: ảnh ≤ 10MB, video ≤ 100MB — validate **cả** phía client (UX nhanh) **và** phía server/S3 policy (bảo mật, không tin client).
- Kiểm tra MIME type thực tế bằng đọc file signature (magic bytes), không chỉ dựa vào đuôi file hay `Content-Type` header do client gửi.
- Video nên tạo thumbnail tự động (ffmpeg hoặc dịch vụ transcode của Cloudinary) để hiển thị preview nhanh trong thư viện.

**Edge Cases**:
- **Vượt dung lượng lưu trữ (Quota Exceeded)**: Chặn upload file mới, hiển thị cảnh báo và hướng dẫn user xóa bớt media cũ hoặc nâng cấp gói cước.
- **File signature / Magic bytes không hợp lệ**: Trả về lỗi định dạng file không an toàn và từ chối xử lý, không cho phép lưu DB hay upload lên cloud.

### 2.3. Quy trình duyệt bài (State Machine)

**Mô tả**: `Draft → Pending → Approved / Rejected`, do Owner thực hiện duyệt.

**Luồng hoạt động**:

1. Creator gửi duyệt → hệ thống tạo thông báo (in-app + email) đến tất cả Owner của workspace.
2. Owner mở danh sách "Chờ duyệt" → xem Preview (hiển thị mô phỏng giao diện từng kênh: Facebook post, TikTok script...).
3. Owner quyết định:
   - **Approve** → `status: PENDING → APPROVED`, ghi `reviewedBy`, `reviewedAt`.
   - **Reject** → bắt buộc nhập `rejectReason` (text, tối thiểu vài ký tự, không cho submit rỗng) → `status: PENDING → REJECTED`.
4. Nếu Rejected: Creator nhận thông báo kèm lý do → chỉnh sửa bài → bấm "Gửi duyệt lại" → quay về `PENDING` (không tạo bài mới, giữ nguyên `postId`, chỉ tăng version/lịch sử chỉnh sửa).
5. Nếu Approved: bài chuyển sang khả dụng ở Phân hệ 4 (chọn kênh, lên lịch/đăng ngay).

**Lưu ý khi làm**:

- Đây là state machine trung tâm của hệ thống — nên implement rõ ràng bằng enum + bảng chuyển trạng thái hợp lệ (validate transition ở tầng service, không để FE tự ý set status).
- Lưu lịch sử duyệt (`ApprovalHistory`: ai, khi nào, hành động, lý do) phục vụ Audit Log và tránh tranh chấp "ai duyệt/từ chối bài này".
- `Failed` (ở Phân hệ 4) quay lại `Scheduled` để retry, **không** quay lại `Pending` — bài đã duyệt nội dung thì không cần duyệt lại chỉ vì lỗi kỹ thuật khi đăng.

### 2.4. Tìm kiếm & Lọc nội dung

**Mô tả**: Tìm kiếm và lọc linh hoạt các bài viết, media, và workspace trên toàn hệ thống.

**Luồng hoạt động**:
1. Lọc bài viết: hỗ trợ tìm kiếm bài viết theo tiêu đề/từ khóa và lọc theo trạng thái (Draft, Pending, Approved, Rejected, Scheduled, Published, Failed), ngày tạo/đăng, người tạo (createdBy), và nhãn chiến dịch (campaign tag).
2. Lọc thư viện media: tìm kiếm theo tên file, loại định dạng (ảnh/video), nhãn tag đi kèm và khoảng thời gian tải lên.
3. Tìm kiếm workspace: dành cho cả người dùng (chuyển đổi nhanh qua workspace switcher) và Admin (quản lý danh sách workspace).

### 2.5. Xuất bản báo cáo & Dữ liệu (Export & Report)

**Mô tả**: Cung cấp khả năng xuất dữ liệu lịch đăng bài và báo cáo hiệu suất cơ bản phục vụ báo cáo.

**Luồng hoạt động**:
1. Xuất lịch đăng bài: hỗ trợ xuất toàn bộ danh sách hoặc lịch đăng bài trong khoảng thời gian đã chọn ra định dạng CSV/Excel.
2. Báo cáo hiệu suất bài viết: thống kê các chỉ số tương tác thực tế từ Facebook (like, share, comment, click) lấy qua Graph API định kỳ, hiển thị biểu đồ trực quan và cho phép xuất file báo cáo tổng hợp.

---

## 3. Phân hệ: Trợ lý AI Content & Brand Voice

### 3.1. Cấu hình Brand Voice

**Mô tả**: Owner thiết lập tông giọng thương hiệu để AI dùng làm ngữ cảnh khi sinh nội dung.

**Luồng hoạt động**:

1. Owner vào "Cài đặt Brand Voice" → nhập: ngành hàng, khách hàng mục tiêu, từ khóa nên dùng/cần tránh, 1-3 bài viết mẫu (few-shot).
2. Hệ thống lưu thành 1 bản ghi `BrandVoice` gắn với workspace (mỗi workspace 1 cấu hình chính; có thể mở rộng nhiều bộ Brand Voice cho nhiều dòng sản phẩm nếu còn thời gian — Could-have).
3. Cấu hình này được nạp làm system prompt / context mỗi khi gọi AI sinh nội dung cho workspace đó.

**Lưu ý khi làm**: Giới hạn độ dài few-shot examples để không vượt quá context window hợp lý và không đội chi phí token mỗi lần gọi API.

### 3.2. Sinh nội dung bằng AI

**Mô tả**: Từ chủ đề/ý chính hoặc URL nguồn, AI sinh bài viết theo Brand Voice, tạo biến thể cho từng kênh.

**Luồng hoạt động**:

1. Creator nhập chủ đề hoặc dán URL bài viết nguồn.
2. Nếu là URL: server crawl nội dung trang (giới hạn kích thước, timeout) → tóm tắt ý chính trước khi đưa vào prompt.
3. Server kiểm tra số dư Credit của workspace **trước khi** gọi AI (ví dụ cần 5 credit cho sinh text). Nếu không đủ → trả lỗi, hiển thị modal nạp thêm, **không gọi API AI**.
4. Job được đẩy vào hàng đợi BullMQ (`content-generation` queue) để xử lý bất đồng bộ → trả về `jobId` cho client, client poll hoặc nhận qua WebSocket/SSE khi hoàn tất.
5. Worker gọi LLM provider với prompt = Brand Voice + chủ đề + hướng dẫn định dạng theo từng kênh được chọn (Facebook: ngắn gọn + emoji; TikTok: kịch bản phân cảnh...).
6. Gọi thành công → **trừ credit ngay lúc này** (không trừ trước) → lưu kết quả vào `AIGeneration` + tạo/nối vào bản ghi bài viết ở trạng thái `DRAFT`.
7. Gọi thất bại sau 3 lần retry (exponential backoff) → **không trừ credit**, trả lỗi rõ ràng cho Creator.
8. Creator có thể **Regenerate** (sinh lại, tốn thêm credit riêng) hoặc chỉnh sửa trực tiếp nội dung AI tạo trước khi lưu/gửi duyệt.

**Lưu ý khi làm**:

- Đây là nơi áp dụng nguyên tắc **Atomic Credit** quan trọng nhất trong hệ thống — viết test riêng cho case: gọi AI fail giữa chừng, mất kết nối worker, timeout provider... đảm bảo credit luôn được hoàn đúng.
- Dùng transaction DB khi trừ/hoàn credit để tránh race condition khi user bấm generate nhiều lần liên tiếp (double-submit).
- Giới hạn độ dài input (chủ đề, nội dung crawl từ URL) để kiểm soát chi phí token.
- Rate-limit số lần gọi AI theo user/workspace/phút, tách biệt với kiểm soát bằng credit (chống spam gây quá tải hệ thống dù vẫn đủ credit).

**Edge Cases**:
- **Prompt/Input vượt quá context window (ví dụ >20.000 tokens)**: Hệ thống tự động cắt ngắn bớt nội dung (ví dụ tóm tắt URL nguồn trước) hoặc từ chối và báo lỗi kèm hướng dẫn cụ thể cho user giảm bớt độ dài.
- **AI trả về nội dung rỗng/không đúng định dạng mong đợi (JSON/Format error)**: Tự động retry tối đa 3 lần với prompt hướng dẫn định dạng khắt khe hơn; nếu vẫn lỗi, áp dụng cơ chế fallback (hiển thị thông báo và không trừ credit).
- **URL crawl bị timeout (>10s) hoặc gặp trang lỗi (paywall, Javascript rendering bắt buộc)**: Báo lỗi "Không thể đọc nội dung tự động từ URL này, vui lòng sao chép nội dung và nhập thủ công".

### 3.3. Sinh ảnh minh họa bằng AI

**Mô tả**: Gọi DALL-E 3 sinh ảnh dựa trên nội dung bài viết.

**Luồng hoạt động**:

1. Creator bấm "Sinh ảnh minh họa" từ trong bài viết → hệ thống tự tạo prompt ảnh từ nội dung bài (hoặc cho phép Creator tự chỉnh prompt).
2. Kiểm tra credit (10 credit/ảnh) → đẩy job vào queue riêng (`image-generation`) → gọi API DALL-E 3.
3. Ảnh trả về → tải xuống và lưu vào S3/Cloudinary (không dùng trực tiếp URL tạm của OpenAI vì có hạn sử dụng) → tạo `MediaAsset` gắn `source=AI_GENERATED` → trừ credit.
4. Thất bại → hoàn credit, thông báo lỗi.

**Lưu ý khi làm**: URL ảnh do DALL-E trả về thường hết hạn sau ~1 giờ — **bắt buộc** phải tải về lưu trữ lâu dài ngay trong worker, không lưu trực tiếp URL gốc vào DB.

### 3.4. Viral Score & 1-Click Fix

**Mô tả**: Chấm điểm chất lượng bài viết theo các tiêu chí (Hook, CTA, độ dễ đọc...) và gợi ý sửa nhanh.

**Luồng hoạt động**:

1. Creator bấm "Chấm điểm" → gửi nội dung bài cho AI với prompt đánh giá theo rubric cố định (Hook, CTA, Readability, Length phù hợp kênh...).
2. AI trả về JSON có điểm từng tiêu chí + gợi ý cải thiện → hiển thị dạng radar chart.
3. Creator bấm "1-Click Fix" → AI sinh lại bản cải thiện dựa trên gợi ý → Creator xem trước, chọn Apply hoặc Discard.

**Lưu ý khi làm**: Prompt yêu cầu AI trả JSON có schema cố định — nên validate output bằng Zod, có fallback nếu AI trả sai định dạng (retry với prompt nhắc lại format).

---

## 4. Phân hệ: Kết nối & Đăng bài đa kênh

### 4.0. Ủy quyền đăng bài cho Creator

**Mô tả**: Xác định cơ chế cho phép Content Creator thực hiện đăng bài trực tiếp hoặc lên lịch đăng đối với các bài đã được Workspace Owner duyệt.

**Quy trình**:
1. Mặc định quyền: Creator chỉ có quyền soạn thảo và gửi bài duyệt. Quyền đăng bài/lên lịch đăng thuộc về Workspace Owner.
2. Thiết lập ủy quyền: Workspace Owner truy cập trang "Quản lý thành viên", chọn thành viên có vai trò Creator và bật toggle **"Cho phép đăng bài trực tiếp"** (mặc định là `OFF`).
3. Khi toggle là `ON`: Creator có thể nhấn đăng ngay hoặc lên lịch đăng bài cho các bài viết đã ở trạng thái `APPROVED` (Đã duyệt).
4. Lưu ý quan trọng: Creator **không** bao giờ có quyền phê duyệt bài viết (duyệt trạng thái `PENDING` sang `APPROVED`), họ chỉ được đăng/lên lịch đăng đối với bài đã được duyệt bởi Owner trước đó.

### 4.1. Kết nối kênh

**Mô tả**: Liên kết Facebook Page (thật) và Instagram/TikTok/Zalo OA (giả lập).

**Luồng hoạt động (Facebook)**:

1. Owner bấm "Kết nối Facebook" → redirect sang OAuth flow của Facebook (yêu cầu quyền `pages_manage_posts`, `pages_read_engagement`).
2. Facebook trả về `accessToken` (Page token) → server **mã hóa AES-256** trước khi lưu vào `ChannelConnection`.
3. Hệ thống định kỳ (cron) kiểm tra hiệu lực token (gọi endpoint debug_token) → nếu sắp hết hạn/hết hạn, đánh dấu `status: EXPIRED` và thông báo Owner kết nối lại.

**Luồng hoạt động (Instagram/TikTok/Zalo — giả lập)**:

1. Owner bấm "Kết nối" → hiển thị form nhập thông tin giả lập (tên kênh, avatar demo) — **không** gọi OAuth thật.
2. Lưu `ChannelConnection(type=SIMULATED, platform=INSTAGRAM/TIKTOK/ZALO)`.

**Lưu ý khi làm**:

- Access token **luôn** mã hóa ở tầng application trước khi ghi DB (không dựa hoàn toàn vào encryption-at-rest của hệ quản trị CSDL).
- Với Facebook: cần đăng ký Facebook App ở chế độ Development, thêm tài khoản test/tester để không bị giới hạn khi demo — nên xác nhận việc này **sớm** (Phase 1-2), tránh phát hiện muộn ở Phase 4 rằng app chưa được cấp quyền cần thiết.

### 4.2. Biên tập & lên lịch đăng theo từng kênh

**Mô tả**: Từ 1 bài đã `Approved`, chọn kênh, tùy biến nội dung riêng theo kênh, đăng ngay hoặc lên lịch.

**Luồng hoạt động**:

1. Owner (hoặc Creator được ủy quyền) mở bài `Approved` → chọn 1 hoặc nhiều kênh đã kết nối.
2. Với mỗi kênh, cho phép chỉnh nội dung riêng (đã có bản AI sinh theo kênh từ Phân hệ 3, có thể sửa tiếp) + chọn media đính kèm.
3. Chọn **Đăng ngay** hoặc **Lên lịch** (chọn ngày giờ) → tạo bản ghi `ScheduledPost(postId, channelId, scheduledAt, status)`.
4. Nếu **Đăng ngay**: đẩy job vào queue xử lý ngay lập tức.
5. Nếu **Lên lịch**: worker cron quét các `ScheduledPost` có `scheduledAt <= now` và `status = SCHEDULED` mỗi phút → kích hoạt job đăng bài.

**Lưu ý khi làm**: Một bài viết có thể đăng đồng thời lên nhiều kênh — mỗi kênh nên có `ScheduledPost` + trạng thái đăng **độc lập** (kênh A thành công, kênh B thất bại vẫn xử lý riêng, không rollback lẫn nhau).

### 4.3. Thực thi đăng bài (thật & giả lập)

**Mô tả**: Worker gọi API thật (Facebook) hoặc mô phỏng (Instagram/TikTok/Zalo).

**Luồng hoạt động (thật — Facebook)**:

1. Worker lấy `accessToken` đã giải mã → gọi Facebook Graph API `POST /{page-id}/feed` (hoặc `/photos`, `/videos` tùy loại nội dung).
2. Thành công → `status: PUBLISHED`, lưu `externalPostId` trả về từ Facebook.
3. Thất bại → retry tối đa 3 lần (exponential backoff) → nếu vẫn thất bại: `status: FAILED`, lưu mã lỗi chi tiết từ Facebook.

**Luồng hoạt động (giả lập)**:

1. Worker ghi vào bảng `SimulatedPost` với `status: PUBLISHED` sau độ trễ giả lập 2-5 giây (dùng `setTimeout` trong job hoặc delayed job của BullMQ).
2. UI hiển thị rõ nhãn **"Chế độ giả lập"** trên mọi bài thuộc nhóm kênh này.
3. Cung cấp nút "Copy nội dung" và "Tải media" để user tự đăng thủ công nếu muốn.

**Retry thủ công**: Nếu `status: FAILED`, hiển thị nút **Retry** cho user → tạo lại job đăng bài mà **không** yêu cầu duyệt lại nội dung, không tạo lại `ScheduledPost` mới (update lại record cũ, tăng `retryCount`).

**Lưu ý khi làm**:

- Luôn phân biệt rõ ràng bằng UI (nhãn, màu sắc) giữa kênh thật và kênh giả lập — đây là yêu cầu bắt buộc để không gây hiểu nhầm cho người dùng và cho hội đồng chấm khi demo.
- Log đầy đủ response lỗi từ Facebook (không chỉ status code) để hiển thị lý do thất bại hữu ích cho user (VD: token hết hạn, ảnh vượt kích thước, vi phạm chính sách nội dung...).

**Edge Cases**:
- **Facebook Access Token hết hạn hoặc bị hủy**: Chuyển đổi trạng thái kết nối của kênh sang `EXPIRED`, gửi thông báo đến Owner và hiển thị modal yêu cầu "Kết nối lại".
- **Gặp giới hạn tần suất API (Rate Limit / Too many requests)**: Tạm dừng việc gửi request tiếp theo và tự động lên lịch retry sau một khoảng thời gian được tính toán dựa trên header phản hồi của Facebook (`X-FB-RR` hoặc `Retry-After`).
- **Nội dung bị Facebook từ chối vì vi phạm chính sách**: Đánh dấu trạng thái bài đăng là `FAILED`, lưu vết thông tin lỗi và hiển thị rõ lý do cho người dùng: "Facebook từ chối bài viết vì lý do..." để user chủ động điều chỉnh.

### 4.4. Calendar View

**Mô tả**: Lịch tháng hiển thị toàn bộ bài đã lên lịch/đã đăng, hỗ trợ kéo-thả đổi lịch.

**Luồng hoạt động**:

1. Client gọi API lấy danh sách `ScheduledPost` trong khoảng thời gian hiển thị (tháng hiện tại + buffer).
2. Hiển thị theo từng ô ngày, phân biệt màu theo trạng thái (Scheduled/Published/Failed).
3. Kéo-thả 1 bài `Scheduled` sang ngày khác → gọi API cập nhật `scheduledAt` → **chỉ cho phép** nếu `status = SCHEDULED` (không cho kéo bài đã `Published`).

**Lưu ý khi làm**: Dùng thư viện có sẵn (FullCalendar, react-big-calendar) thay vì tự viết drag-drop từ đầu để tiết kiệm thời gian cho 1 người làm.

### 4.5. Chỉnh sửa bài đã đăng (Re-publish)

**Mô tả**: Quy định cách thức xử lý khi người dùng muốn thay đổi nội dung của bài viết đã được xuất bản thành công trên các kênh thật (Facebook Page).

**Quy tắc hoạt động**:
1. Không sửa trực tiếp: Các bài viết ở trạng thái `PUBLISHED` **không được phép chỉnh sửa trực tiếp** nội dung hiện tại trên hệ thống (vì bài viết đã được xuất bản và đồng bộ lên nền tảng thật thông qua API).
2. Tạo bản sao (Duplicate): Nếu phát hiện sai sót (ví dụ: sai chính tả) và cần đăng lại bài đã chỉnh sửa, người dùng có thể nhấn nút **"Nhân bản" (Duplicate)** từ bài cũ.
3. Luồng phê duyệt mới: Bản sao sẽ được khởi tạo như một bài viết mới ở trạng thái `DRAFT`. Người dùng chỉnh sửa nội dung, sau đó tiến hành gửi duyệt lại qua luồng phê duyệt bình thường trước khi đăng bài mới.
4. Xóa bài: Hệ thống **không hỗ trợ** xóa bài viết trên nền tảng thật (Facebook Page) thông qua ứng dụng do giới hạn về API quyền hạn thông thường. Người dùng cần truy cập trực tiếp trang Facebook Page để thực hiện xóa thủ công nếu cần thiết.

---

## 5. Phân hệ: Email & Thông báo tự động

### 5.1. Email mời tham gia Workspace

**Luồng hoạt động**: Owner mời → tạo `WorkspaceInvite(token, expiresAt)` → gửi email chứa link `https://app.marka.vn/invite/{token}` → user bấm → verify token còn hạn & chưa dùng → join workspace → đánh dấu token đã dùng.

### 5.2. Email nhắc hạn gói & hết credit

**Luồng hoạt động**:

1. Cron job chạy hàng ngày, quét các workspace có `planExpiresAt` trong vòng 3 ngày tới → gửi email nhắc gia hạn (mỗi workspace chỉ gửi 1 lần cho mốc 3 ngày, tránh spam).
2. Cron job (hoặc trigger ngay sau mỗi lần trừ credit) kiểm tra nếu `remainingCredit / monthlyQuota < 10%` → gửi email cảnh báo (đánh dấu đã gửi trong tháng để không lặp lại nhiều lần).

### 5.3. Email nhắc lịch đăng bài

**Luồng hoạt động**: Cron job quét mỗi phút các `ScheduledPost` có `scheduledAt` trong khoảng 14-16 phút tới (buffer 2 phút quanh mốc 15 phút) → gửi email nhắc cho người phụ trách đăng bài → đánh dấu đã gửi (tránh gửi trùng nếu cron chạy lại).

**Lưu ý khi làm chung cho Phân hệ 5**:

- Tất cả job gửi email nên qua BullMQ queue riêng (`email-queue`), tách khỏi luồng chính, để lỗi SMTP/Resend không ảnh hưởng đến các API khác.
- Dùng template engine (React Email, MJML, hoặc Handlebars) để quản lý email template gọn gàng, dễ bảo trì.
- Luôn có cờ đánh dấu "đã gửi" (idempotency) cho các email dạng nhắc nhở định kỳ, tránh gửi trùng khi cron chạy lại do lỗi/restart server.

---

## 6. Phân hệ: Credit & Thanh toán PayOS

### 6.1. Nạp credit / nâng cấp gói

**Luồng hoạt động**:

1. User chọn gói (FREE/PRO/ENTERPRISE) hoặc gói credit lẻ → bấm "Thanh toán".
2. Server tạo `Order(orderId duy nhất, amount, status=PENDING)` → gọi API PayOS tạo link/QR thanh toán → trả về cho client hiển thị QR.
3. Client polling API `GET /orders/{orderId}/status` mỗi 5 giây để cập nhật UI (phòng khi webhook chậm).
4. PayOS gửi Webhook về server khi giao dịch thành công → server **verify chữ ký webhook** (HMAC theo secret key PayOS cấp) → nếu hợp lệ và `orderId` chưa được xử lý trước đó (kiểm tra idempotency) → cập nhật `Order.status = PAID`, cộng credit/nâng gói cho workspace.
5. Nếu webhook đến trễ nhưng client polling phát hiện `status = PAID` trước → UI vẫn cập nhật đúng vì cùng đọc từ 1 nguồn `Order.status`.

**Lưu ý khi làm**:

- **Không bao giờ** cộng credit chỉ dựa vào response redirect phía client (có thể bị giả mạo) — chỉ cộng credit khi webhook đã verify chữ ký hợp lệ.
- Idempotency: dùng `orderId` làm khóa duy nhất, nếu webhook gọi lại (PayOS có thể retry) mà `Order` đã `PAID` rồi thì bỏ qua, không cộng credit 2 lần.
- Nên có endpoint nội bộ để Admin xác nhận thủ công một giao dịch nếu webhook lỗi (dự phòng, vì không có hoàn tiền tự động).

### 6.2. Trừ/hoàn Credit

Đã mô tả chi tiết ở mục 3.2 (Atomic Credit) — nhắc lại nguyên tắc: **trừ sau khi thành công, hoàn khi thất bại hoàn toàn sau retry**, luôn dùng transaction DB, log mọi thay đổi vào `CreditTransaction` (loại giao dịch, số lượng, số dư trước/sau, lý do) để phục vụ audit và tránh tranh chấp.

**Cấu hình Credit Cost & Bảng giá hệ thống**:
Bảng giá credit cho từng hành động được quản lý tập trung thông qua biến môi trường để thuận tiện thay đổi mà không phải code lại logic trừ credit:

```javascript
// config/credit-cost.js hoặc qua process.env
export const CREDIT_COST = {
  GENERATE_TEXT: parseInt(process.env.COST_GENERATE_TEXT) || 5,   // Sinh bài viết mới
  REGENERATE: parseInt(process.env.COST_REGENERATE) || 3,         // Yêu cầu sinh lại bài viết
  GENERATE_IMAGE: parseInt(process.env.COST_GENERATE_IMAGE) || 10, // Sinh ảnh minh họa bằng AI
  VIRAL_SCORE: parseInt(process.env.COST_VIRAL_SCORE) || 2,       // Chấm điểm chất lượng bài viết
};
```

| Hành động | Số Credit tiêu thụ | Biến môi trường tương ứng |
| :--- | :---: | :--- |
| Sinh 1 bài viết text | 5 | `COST_GENERATE_TEXT` |
| Sinh lại (Regenerate) | 3 | `COST_REGENERATE` |
| Sinh 1 ảnh (DALL-E 3) | 10 | `COST_GENERATE_IMAGE` |
| Chấm Viral Score / 1-Click Fix | 2 | `COST_VIRAL_SCORE` |

### 6.3. Reset credit hàng tháng & hạ gói

**Luồng hoạt động**: Cron job chạy đầu mỗi chu kỳ billing của từng workspace → reset `remainingCredit = monthlyQuota` theo gói hiện tại (không cộng dồn credit cũ) → nếu gói đã hết hạn mà không gia hạn, tự động chuyển `plan = FREE`.

---

## 7. Phân hệ: Quản trị hệ thống (Admin)

### 7.1. Dashboard thống kê

**Luồng hoạt động**: Admin xem tổng số user, workspace, credit tiêu thụ, doanh thu — tổng hợp qua query aggregate định kỳ hoặc cache vào Redis (refresh mỗi vài phút) để tránh query nặng trực tiếp trên bảng giao dịch mỗi lần Admin load dashboard.

### 7.2. Quản lý user & workspace

**Luồng hoạt động**: Admin xem danh sách user → khóa/mở khóa (`isSuspended = true/false`) → khi khóa, tăng `tokenVersion` của user đó để đăng xuất ngay lập tức khỏi mọi phiên đang hoạt động.

### 7.3. Audit Log

**Mô tả**: Ghi lại các hành động quan trọng: đăng nhập, đổi mật khẩu/email, xóa workspace, duyệt/từ chối bài, giao dịch thanh toán thành công.

**Luồng hoạt động**: Mỗi hành động quan trọng, sau khi xử lý thành công ở tầng service, ghi 1 bản ghi `AuditLog(actorId, action, targetType, targetId, metadata, createdAt)` — nên làm qua 1 hàm helper dùng chung (`logAudit(...)`) gọi ở cuối mỗi service method liên quan, tránh rải rác logic ghi log khắp nơi.

**Lưu ý khi làm**: Audit log lưu tối thiểu 90 ngày — cân nhắc archive/xóa bản ghi cũ hơn bằng cron job định kỳ để bảng không phình quá lớn.

---

## 8. Lưu ý triển khai chung (áp dụng toàn hệ thống)

1. **State machine là trung tâm**: Post status (`Draft/Pending/Approved/Rejected/Scheduled/Published/Failed`) nên định nghĩa transition hợp lệ ở 1 nơi duy nhất (service layer), có validate rõ ràng — tránh để nhiều chỗ trong code tự ý set status trực tiếp.
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
- **Crawl nội dung từ URL**: Cài đặt thời gian phản hồi tối đa (timeout) là 10 giây, giới hạn kích thước nội dung tải về (max content length) tối đa 50 KB để tối ưu hóa tài nguyên mạng.
- **Giới hạn Context OpenAI**: Hạn mức token tối đa gửi nhận là 4.096 tokens cho mỗi request khi gọi GPT-4o để tối ưu hóa chi phí và tốc độ phản hồi.
- **Dung lượng cơ sở dữ liệu**: Cấu hình tối thiểu 10 GB cho database PostgreSQL ở môi trường Development, và tối thiểu 50 GB cho môi trường Production (để lưu trữ lịch sử audit log và thông tin bài viết).
- **Upload tệp tin**: Giới hạn tải lên đồng thời tối đa 5 file cho mỗi request (phía client và server).
