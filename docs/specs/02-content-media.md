# Phân hệ 2: Soạn thảo & Thư viện Media

> [Quay lại Mục lục chính](file:///f:/DATN/marka-capstone/docs/specs/README.md)

---

## 2.1. Soạn thảo & Cập nhật nội dung (Create & Update Content - UC05, UC07)

**Mô tả**: Rich Text Editor cho Creator soạn bài và cập nhật nội dung bài viết/bản nháp, hỗ trợ template, gắn nhãn chiến dịch, tự động lưu nháp.

**Tác nhân (Actors)**:
- **UC05 (Create Content)**: Content Creator, Workspace Owner
- **UC07 (Update Content)**: Content Creator, Workspace Owner

**Luồng hoạt động**:

1. Creator chọn "Tạo bài viết mới" → chọn template có sẵn (hoặc bắt đầu trống) → soạn nội dung trên editor (TipTap/React-Quill).
2. Mỗi 30 giây (debounce), client tự động gửi PATCH lưu nháp (`status=DRAFT`) — không cần user bấm Save thủ công.
3. Creator gắn nhãn chiến dịch (campaign tag), chọn media từ thư viện để đính kèm.
4. Khi sẵn sàng, bấm **"Gửi duyệt"** → chuyển `status: DRAFT → PENDING`, ghi nhận `submittedAt`, `submittedBy`.

**Lưu ý khi làm**:

- Auto-save nên dùng debounce phía client (không gửi API mỗi keystroke) và so sánh diff/hash nội dung để tránh gọi API khi không có thay đổi thực sự.
- Rich text nên lưu ở dạng JSON (ProseMirror doc) thay vì HTML thô để dễ transform sang nhiều định dạng kênh khác nhau ở Phân hệ AI.
- Sanitize nội dung (dompurify hoặc tương đương) trước khi render lại, kể cả nội dung do chính user nhập, để chống stored-XSS.

---

## 2.2. Thư viện Media

**Mô tả**: Upload, lọc, quản lý ảnh/video dùng chung cho workspace.

**Tác nhân (Actors)**: Content Creator, Workspace Owner

**Luồng hoạt động**:

1. User chọn file → client validate sơ bộ (đuôi file, kích thước) → upload thẳng lên S3/Cloudinary qua signed URL (không qua server để tránh nghẽn băng thông backend).
2. Server nhận callback/metadata sau khi upload xong → lưu bản ghi `MediaAsset(workspaceId, url, type, size, tags, createdBy)`.
3. Kiểm tra quota lưu trữ của workspace theo gói cước **trước khi** cấp signed URL — nếu vượt quota, chặn ngay từ bước 1.
4. Lọc/tìm kiếm theo tên, loại file, tag, ngày tạo trên trang thư viện.

**Lưu ý khi làm**:

- Giới hạn: ảnh ≤ 10MB, video ≤ 100MB — validate **cả** phía client (UX nhanh) **và** phía server/S3 policy (bảo mật, không tin client).
- Kiểm tra MIME type thực tế bằng đọc file signature (magic bytes), không chỉ dựa vào đuôi file hay `Content-Type` header do client gửi.
- Video nên tạo thumbnail tự động (ffmpeg hoặc dịch vụ transcode của Cloudinary) để hiển thị preview nhanh trong thư viện.

**Edge Cases**:

- **Vượt dung lượng lưu trữ (Quota Exceeded)**: Chặn upload file mới, hiển thị cảnh báo và hướng dẫn user xóa bớt media cũ hoặc nâng cấp gói cước.
- **File signature / Magic bytes không hợp lệ**: Trả về lỗi định dạng file không an toàn và từ chối xử lý, không cho phép lưu DB hay upload lên cloud.

---

## 2.3. Quy trình duyệt bài (Submit for Approval & Review Content - UC11, UC14)

**Mô tả**: Luồng chuyển trạng thái `Draft → Pending → Approved / Rejected`, Creator thực hiện gửi duyệt bài viết và Workspace Owner thực hiện duyệt hoặc từ chối bài viết kèm lý do.

**Tác nhân (Actors)**:
- **UC11 (Submit Content for Approval)**: Content Creator
- **UC14 (Review Content)**: Workspace Owner

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
- **Thông báo in-app**: Tất cả các thông báo in-app (như khi gửi duyệt bài, duyệt/từ chối bài, mời tham gia workspace) đều được lưu trữ trong bảng `Notification` để hiển thị trên UI chuông thông báo của người dùng và đánh dấu trạng thái đã đọc (`isRead`).

---

## 2.4. Xem, Tìm kiếm & Lọc nội dung (View & Search Content - UC08, UC09)

**Mô tả**: Cho phép người dùng xem danh sách, xem chi tiết, tìm kiếm và lọc linh hoạt các bài viết, thư viện media, và workspace trong hệ thống.

**Tác nhân (Actors)**:
- **UC08 (View Content)**: Content Creator, Workspace Owner
- **UC09 (Search Content)**: Content Creator, Workspace Owner

**Luồng hoạt động**:

1. **Xem chi tiết bài viết (UC08)**: Creator/Owner có thể bấm chọn một bài viết bất kỳ trong danh sách hoặc trên lịch đăng bài để xem toàn bộ nội dung chi tiết, các kênh liên kết, lịch sử chỉnh sửa, trạng thái duyệt và phản hồi từ Owner.
2. **Tìm kiếm & Lọc bài viết (UC09)**: Hỗ trợ tìm kiếm bài viết theo tiêu đề/từ khóa và lọc theo trạng thái (Draft, Pending, Approved, Rejected, Scheduled, Published, Failed), ngày tạo/đăng, người tạo (createdBy), và nhãn chiến dịch (campaign tag).
3. **Lọc thư viện media**: Tìm kiếm theo tên file, loại định dạng (ảnh/video), nhãn tag đi kèm và khoảng thời gian tải lên.
4. **Tìm kiếm workspace**: Dành cho cả người dùng (chuyển đổi nhanh qua workspace switcher) và Admin (quản lý danh sách workspace) để dễ dàng chuyển đổi không gian làm việc.

---

## 2.5. Xuất bản báo cáo & Dữ liệu (Export & Report)

**Mô tả**: Cung cấp khả năng xuất dữ liệu lịch đăng bài và báo cáo hiệu suất cơ bản phục vụ báo cáo.

**Tác nhân (Actors)**: Content Creator, Workspace Owner

**Luồng hoạt động**:

1. **Xuất lịch đăng bài**: Hỗ trợ xuất toàn bộ danh sách hoặc lịch đăng bài trong khoảng thời gian đã chọn ra định dạng CSV/Excel.
2. **Báo cáo hiệu suất bài viết (Đồng bộ số liệu tương tác định kỳ)**: Thống kê các chỉ số tương tác thực tế của các bài viết từ Facebook Page (like, reactions, share, comment) qua Facebook Graph API để cập nhật lên dashboard.
   - **Lên lịch quét số liệu**: Hệ thống cài đặt một tác vụ chạy tự động định kỳ (Cron Job) trên Server (ví dụ: quét 2 tiếng một lần).
   - **Truy vấn dữ liệu Facebook**:
     - Tác vụ quét qua database để lấy ra tất cả các bài viết của các kênh Facebook đang ở trạng thái `PUBLISHED` (Đã đăng) kèm theo Post ID của chúng.
     - Với từng Post ID, Server sử dụng Page Access Token tương ứng đã giải mã để gửi một yêu cầu truy vấn thông tin tới Facebook API (`GET /vXX.X/{post-id}?fields=shares,likes.summary(true),comments.summary(true)`).
     - Facebook phản hồi dữ liệu thống kê thời gian thực của bài viết đó bao gồm: tổng lượt Like/Reactions, lượt Share và tổng lượt Comment.
   - **Cập nhật và Hiển thị**: Server phân tích kết quả nhận được, lưu các con số mới nhất vào database của hệ thống và hiển thị lên giao diện báo cáo/Dashboard của Workspace.

---

## 2.6. Xóa bài viết (Delete Content - UC10)

**Mô tả**: Cho phép người dùng xóa bài viết/bản nháp trên hệ thống Marka để dọn dẹp không gian làm việc.

**Tác nhân (Actors)**:
- **UC10 (Delete Content)**: Content Creator, Workspace Owner

**Quy tắc phân quyền & Luồng hoạt động**:

1. **Điều kiện xóa bài viết**:
   - Bài viết ở trạng thái `DRAFT` (Bản nháp), `REJECTED` (Bị từ chối) hoặc `FAILED` (Đăng lỗi): Có thể xóa được bởi chính Creator tạo ra bài viết đó hoặc bất kỳ Workspace Owner nào.
   - Bài viết ở trạng thái `PENDING` (Chờ duyệt) hoặc `APPROVED` (Đã duyệt): Phải thu hồi về trạng thái `DRAFT` trước khi xóa, hoặc chỉ có Workspace Owner mới có quyền xóa trực tiếp.
   - Bài viết ở trạng thái `SCHEDULED` (Đã lên lịch): Việc xóa bài viết sẽ đồng thời hủy Job lên lịch tương ứng trong BullMQ/Redis.
   - Bài viết ở trạng thái `PUBLISHED` (Đã đăng): Không cho phép xóa bài viết (chỉ có thể ẩn bài viết trên UI Marka bằng cách chuyển trạng thái hiển thị nội bộ sang `ARCHIVED` hoặc người dùng tự xóa thủ công trên Facebook Page thật).
2. **Luồng thực hiện**:
   - Người dùng bấm nút "Xóa" tại danh sách bài viết hoặc trang chi tiết bài viết.
   - Hệ thống hiển thị popup xác nhận: "Bạn có chắc chắn muốn xóa bài viết này không?".
   - Xác nhận xóa → Client gửi yêu cầu `DELETE /posts/{postId}` lên Server.
   - Server kiểm tra quyền sở hữu và vai trò hiện tại của người dùng đối với bài viết và Workspace.
   - Thực hiện xóa mềm (Soft Delete) bằng cách set trường `deletedAt` trong database (giúp khôi phục lại dữ liệu nếu lỡ tay xóa nhầm và phục vụ audit log truy vết), hoặc xóa cứng khỏi cơ sở dữ liệu nếu bài viết là bản nháp rỗng.
