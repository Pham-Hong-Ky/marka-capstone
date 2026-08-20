# Phân hệ 4: Kết nối & Đăng bài đa kênh

> [Quay lại Mục lục chính](file:///f:/DATN/marka-capstone/docs/specs/README.md)

---

## 4.0. Ủy quyền đăng bài cho Creator

**Mô tả**: Xác định cơ chế cho phép Content Creator thực hiện đăng bài trực tiếp hoặc lên lịch đăng đối với các bài đã được Workspace Owner duyệt.

**Quy trình**:

1. Mặc định quyền: Creator chỉ có quyền soạn thảo và gửi bài duyệt. Quyền đăng bài/lên lịch đăng thuộc về Workspace Owner.
2. Thiết lập ủy quyền: Workspace Owner truy cập trang "Quản lý thành viên", chọn thành viên có vai trò Creator và bật toggle **"Cho phép đăng bài trực tiếp"** (mặc định là `OFF`).
3. Khi toggle là `ON`: Creator có thể nhấn đăng ngay hoặc lên lịch đăng bài cho các bài viết đã ở trạng thái `APPROVED` (Đã duyệt).
4. Lưu ý quan trọng: Creator **không** bao giờ có quyền phê duyệt bài viết (duyệt trạng thái `PENDING` sang `APPROVED`), họ chỉ được đăng/lên lịch đăng đối với bài đã được duyệt bởi Owner trước đó.

---

## 4.1. Kết nối & Quản lý kênh liên kết (UC27, UC28, UC29)

**Mô tả**: Liên kết Facebook Page (thật) và Instagram/TikTok/Zalo OA (giả lập), hiển thị trạng thái kết nối, cập nhật/làm mới kết nối hoặc hủy ngắt kết nối các kênh.

**Tác nhân (Actors)**:
- **UC27 (View Connected Channels)**: Workspace Owner
- **UC28 (Connect Social Channels)**: Workspace Owner
- **UC29 (Disconnect Social Channel)**: Workspace Owner

**Luồng hoạt động**:

- **Kết nối kênh (UC28)**:
  - **Facebook Page (thật)**: Owner bấm "Kết nối Facebook" → redirect sang OAuth flow của Facebook (yêu cầu quyền `pages_manage_posts`, `pages_read_engagement`). Facebook trả về `accessToken` (Page token) → server **mã hóa AES-256** trước khi lưu vào `ChannelConnection`.
  - **Instagram/TikTok/Zalo (giả lập)**: Owner bấm "Kết nối" → hiển thị form nhập thông tin giả lập (tên kênh, avatar demo) — **không** gọi OAuth thật → Lưu `ChannelConnection(type=SIMULATED, platform=INSTAGRAM/TIKTOK/ZALO)`.
- **Cập nhật kênh liên kết (UC29)**:
  - **Làm mới kết nối (Re-authenticate)**: Hệ thống định kỳ (cron) kiểm tra hiệu lực token (endpoint `debug_token`) → nếu hết hạn/sắp hết hạn, đánh dấu `status: EXPIRED`. Workspace Owner bấm nút "Kết nối lại" (Reconnect) trên UI để tiến hành lại OAuth flow lấy accessToken mới mà không làm thay đổi ID liên kết của kênh.
  - **Cập nhật thông tin kênh giả lập**: Với kênh giả lập, cho phép Owner thay đổi tên hiển thị, hình ảnh avatar demo, hoặc tạm dừng hoạt động.
- **Hủy kết nối kênh (Disconnect)**:
  - Workspace Owner truy cập trang quản lý kênh kết nối (UC27) và bấm "Hủy kết nối" bên cạnh kênh muốn xóa.
  - Hệ thống hiển thị popup xác nhận: "Ngắt kết nối kênh này sẽ tự động hủy các bài đăng đang chờ đăng (Scheduled) trên kênh tương ứng. Bạn có chắc chắn?".
  - Xác nhận → Client gửi yêu cầu `DELETE /channels/{channelConnectionId}` lên Server.
  - Server xác thực quyền Owner, tiến hành xóa bản ghi kết nối, tìm kiếm các `ScheduledPost` có `status = SCHEDULED` liên quan đến kênh này để chuyển trạng thái sang `FAILED` (Hủy do ngắt kết nối) và xóa job trong hàng đợi BullMQ/Redis.

**Lưu ý khi làm**:

- Access token **luôn** mã hóa ở tầng application trước khi ghi DB (không dựa hoàn toàn vào encryption-at-rest của hệ quản trị CSDL).
- Với Facebook: cần đăng ký Facebook App ở chế độ Development, thêm tài khoản test/tester để không bị giới hạn khi demo — nên xác nhận việc này **sớm** (Phase 1-2), tránh phát hiện muộn ở Phase 4 rằng app chưa được cấp quyền cần thiết.

---

## 4.2. Biên tập & lên lịch đăng theo từng kênh (Schedule Content - UC12)

**Mô tả**: Từ 1 bài đã `Approved`, chọn kênh, tùy biến nội dung riêng theo kênh, đăng ngay hoặc lên lịch.

**Tác nhân (Actors)**:
- **UC12 (Schedule Content)**: Workspace Owner (hoặc Content Creator được ủy quyền)

**Luồng hoạt động**:

1. Owner (hoặc Creator được ủy quyền) mở bài `Approved` → chọn 1 hoặc nhiều kênh đã kết nối.
2. Với mỗi kênh, cho phép chỉnh nội dung riêng (đã có bản AI sinh theo kênh từ Phân hệ 3, có thể sửa tiếp) + chọn media đính kèm.
3. Chọn **Đăng ngay** hoặc **Lên lịch** (chọn ngày giờ) → tạo bản ghi `ScheduledPost(postId, channelId, scheduledAt, status)`.
4. Nếu **Đăng ngay**: đẩy job vào queue xử lý ngay lập tức.
5. Nếu **Lên lịch**: worker cron quét các `ScheduledPost` có `scheduledAt <= now` và `status = SCHEDULED` mỗi phút → kích hoạt job đăng bài.

**Lưu ý khi làm**: Một bài viết có thể đăng đồng thời lên nhiều kênh — mỗi kênh nên có `ScheduledPost` + trạng thái đăng **độc lập** (kênh A thành công, kênh B thất bại vẫn xử lý riêng, không rollback lẫn nhau).

---

## 4.3. Thực thi đăng bài (thật & giả lập - UC15)

**Mô tả**: Worker chạy tác vụ ngầm tự động gọi API thật (Facebook Page) hoặc mô phỏng quá trình xuất bản bài đăng (Instagram/TikTok/Zalo).

**Tác nhân (Actors)**:
- **UC15 (Post Content to Social Media)**: Workspace Owner (hoặc Content Creator được ủy quyền)

**Luồng hoạt động (Thật — Facebook Page)**:

1. **Kích hoạt Job**: Khi đến đúng thời gian hẹn đăng, hệ thống hàng đợi ngầm (BullMQ/Redis) tự động kích hoạt tiến trình xử lý bài viết (Worker).
2. **Xử lý thông tin & Gọi API**:
   - Worker truy xuất dữ liệu bài viết và giải mã Page Access Token tương ứng từ database.
   - Gửi yêu cầu HTTP POST (Facebook Graph API) chứa nội dung bài đăng (văn bản, link, danh sách hình ảnh hoặc video) kèm theo Page Access Token tới endpoint thích hợp (ví dụ: `POST /{page-id}/feed` hoặc `POST /{page-id}/photos`).
3. **Cập nhật kết quả**:
   - **Thành công**: Facebook trả về mã ID của bài đăng trên mạng xã hội (`externalPostId`). Hệ thống cập nhật trạng thái bài viết trên Marka thành `PUBLISHED`, lưu `externalPostId` và ghi nhận lịch sử vào database.
   - **Thất bại**: Hệ thống ghi nhận mã lỗi chi tiết (lỗi mạng, token hết hạn, vi phạm chính sách...), cập nhật trạng thái bài viết thành `FAILED`, thực hiện tự động đăng lại (Retry) tối đa 3 lần (exponential backoff). Nếu vẫn thất bại sau 3 lần, thông báo lỗi tới người dùng.

**Luồng hoạt động (Giả lập — Instagram/TikTok/Zalo)**:

1. Worker nhận Job đăng bài giả lập, thực hiện độ trễ ngẫu nhiên từ 2-5 giây (để mô phỏng thời gian phản hồi API thật).
2. Ghi nhận bài viết vào bảng `SimulatedPost` với trạng thái `PUBLISHED`.
3. Giao diện (UI) hiển thị nhãn **"Chế độ giả lập"** nổi bật trên tất cả các bài thuộc nhóm kênh này.
4. Cung cấp nút **"Copy nội dung nhanh"** và **"Tải file đính kèm"** để người dùng tự tay đăng thủ công lên nền tảng thật nếu cần.

**Retry thủ công**: Nếu trạng thái đăng bài là `FAILED`, hệ thống hiển thị nút **Thử lại (Retry)** cho người dùng → Tạo lại Job đăng bài mà không yêu cầu duyệt lại nội dung (cập nhật lại record hiện tại, tăng số lần thử `retryCount`).

**Lưu ý khi làm**:

- Luôn phân biệt rõ ràng bằng UI (nhãn, màu sắc) giữa kênh thật và kênh giả lập — đây là yêu cầu bắt buộc để không gây hiểu nhầm cho người dùng và cho hội đồng chấm khi demo.
- Log đầy đủ response lỗi từ Facebook (không chỉ status code) để hiển thị lý do thất bại hữu ích cho user (VD: token hết hạn, ảnh vượt kích thước, vi phạm chính sách nội dung...).

**Edge Cases**:

- **Facebook Access Token hết hạn hoặc bị hủy**: Chuyển đổi trạng thái kết nối của kênh sang `EXPIRED`, gửi thông báo đến Owner và hiển thị modal yêu cầu "Kết nối lại".
- **Gặp giới hạn tần suất API (Rate Limit / Too many requests)**: Tạm dừng việc gửi request tiếp theo và tự động lên lịch retry sau một khoảng thời gian được tính toán dựa trên header phản hồi của Facebook (`X-FB-RR` hoặc `Retry-After`).
- **Nội dung bị Facebook từ chối vì vi phạm chính sách**: Đánh dấu trạng thái bài đăng là `FAILED`, lưu vết thông tin lỗi và hiển thị rõ lý do cho người dùng: "Facebook từ chối bài viết vì lý do..." để user chủ động điều chỉnh.

---

## 4.4. Calendar View (View Content Schedule - UC13)

**Mô tả**: Lịch tháng hiển thị toàn bộ bài đã lên lịch/đã đăng, hỗ trợ kéo-thả đổi lịch.

**Tác nhân (Actors)**:
- **UC13 (View Content Schedule)**: Content Creator, Workspace Owner

**Luồng hoạt động**:

1. Client gọi API lấy danh sách `ScheduledPost` trong khoảng thời gian hiển thị (tháng hiện tại + buffer).
2. Hiển thị theo từng ô ngày, phân biệt màu theo trạng thái (Scheduled/Published/Failed).
3. Kéo-thả 1 bài `Scheduled` sang ngày khác → gọi API cập nhật `scheduledAt` → **chỉ cho phép** nếu `status = SCHEDULED` (không cho kéo bài đã `Published`).

**Lưu ý khi làm**: Dùng thư viện có sẵn (FullCalendar, react-big-calendar) thay vì tự viết drag-drop từ đầu để tiết kiệm thời gian cho 1 người làm.

---

## 4.5. Chỉnh sửa bài đã đăng (Re-publish)

**Mô tả**: Quy định cách thức xử lý khi người dùng muốn thay đổi nội dung của bài viết đã được xuất bản thành công trên các kênh thật (Facebook Page).

**Tác nhân (Actors)**: Content Creator, Workspace Owner

**Quy tắc hoạt động**:

1. Không sửa trực tiếp: Các bài viết ở trạng thái `PUBLISHED` **không được phép chỉnh sửa trực tiếp** nội dung hiện tại trên hệ thống (vì bài viết đã được xuất bản và đồng bộ lên nền tảng thật thông qua API).
2. Tạo bản sao (Duplicate): Nếu phát hiện sai sót (ví dụ: sai chính tả) và cần đăng lại bài đã chỉnh sửa, người dùng có thể nhấn nút **"Nhân bản" (Duplicate)** từ bài cũ.
3. Luồng phê duyệt mới: Bản sao sẽ được khởi tạo như một bài viết mới ở trạng thái `DRAFT`. Người dùng chỉnh sửa nội dung, sau đó tiến hành gửi duyệt lại qua luồng phê duyệt bình thường trước khi đăng bài mới.
4. Xóa bài: Hệ thống **không hỗ trợ** xóa bài viết trên nền tảng thật (Facebook Page) thông qua ứng dụng do giới hạn về API quyền hạn thông thường. Người dùng cần truy cập trực tiếp trang Facebook Page để thực hiện xóa thủ công nếu cần thiết.
