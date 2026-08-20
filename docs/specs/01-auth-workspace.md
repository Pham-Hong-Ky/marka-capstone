# Phân hệ 1: Xác thực & Không gian làm việc

> [Quay lại Mục lục chính](file:///f:/DATN/marka-capstone/docs/specs/README.md)

---

## 1.1. Đăng ký / Đăng nhập / Đăng xuất (UC01, UC02, UC03)

**Mô tả**: Người dùng tạo tài khoản bằng Email/Password hoặc Google OAuth, đăng nhập hệ thống và thực hiện đăng xuất để bảo mật phiên làm việc.

**Tác nhân (Actors)**:
- **UC01 (Register)**: Guest
- **UC02 (Login)**: Guest
- **UC03 (Logout)**: User (All Roles)

**Luồng hoạt động**:

- **Đăng ký / Đăng nhập (UC01, UC02)**:
  1. Guest nhập email + password (hoặc bấm "Đăng nhập với Google").
  2. Hệ thống validate định dạng email, độ mạnh password (tối thiểu 8 ký tự, có chữ + số).
  3. Nếu đăng ký bằng email: gửi email xác thực (link/OTP) → tài khoản ở trạng thái `unverified` cho đến khi xác thực.
  4. Đăng nhập thành công → server tạo `accessToken` (JWT, hạn ngắn ~15 phút) + `refreshToken` (lưu HTTP-Only Cookie, hạn dài ~7-30 ngày) → trả về client (chuyển sang trạng thái User đã xác thực).
  5. Nếu sai quá 5 lần trong 15 phút cho cùng 1 IP/email → khóa tạm thời (rate limit), trả lỗi `429`.
- **Đăng xuất (Logout - UC03)**:
  1. Người dùng (User) nhấn nút "Đăng xuất" trên giao diện.
  2. Client gửi yêu cầu `POST /auth/logout` đồng thời đính kèm `refreshToken` hiện tại (thường gửi qua HTTP-Only cookie).
  3. Server nhận yêu cầu:
     - Xóa hoặc thu hồi (revoke) `refreshToken` tương ứng trong database để ngăn chặn việc sử dụng lại.
     - Phản hồi xóa cookie chứa `refreshToken` trên trình duyệt bằng cách đặt thời gian hết hạn trong quá khứ (`max-age = 0`).
  4. Client nhận kết quả thành công, tiến hành xóa sạch token tạm thời (`accessToken`) lưu trong bộ nhớ cục bộ (Redux Store/React Context), sau đó điều hướng người dùng quay trở lại màn hình Đăng nhập (`/login`).

**Lưu ý khi làm**:

- Google OAuth: dùng `passport-google-oauth20` hoặc tự implement OAuth2 code flow; map theo `email` để tránh tạo trùng account nếu user từng đăng ký bằng email/password.
- Password hash bằng `bcrypt` (cost factor ≥ 10), **không** tự chế thuật toán hash.
- `refreshToken` phải rotate mỗi lần dùng (refresh token rotation) để giảm rủi ro replay.
- Trường `tokenVersion` trên bảng `User`: tăng +1 khi đổi mật khẩu hoặc bị Admin khóa → mọi accessToken cũ cấp trước đó lập tức bị coi là invalid dù chưa hết hạn.

---

## 1.2. Quản lý Workspace & Thành viên (UC16, UC17, UC18, UC19, UC20, UC21, UC22, UC23)

**Mô tả**: Tạo Workspace mới, xem danh sách thành viên, cập nhật cấu hình Workspace, mời hoặc loại bỏ thành viên, rời khỏi không gian làm việc hoặc xóa hoàn toàn Workspace.

**Tác nhân (Actors)**:
- **UC16 (Create Workspace)**: User (All Roles)
- **UC17 (Update Workspace)**: Workspace Owner
- **UC18 (Delete Workspace)**: Workspace Owner
- **UC19 (View Members)**: Content Creator, Workspace Owner
- **UC20 (Invite Member)**: Workspace Owner
- **UC21 (Accept Invitation)**: Guest / User
- **UC22 (Leave Workspace)**: Content Creator, Workspace Owner
- **UC23 (Remove Member)**: Workspace Owner

**Luồng hoạt động**:

- **Tạo Workspace (UC16)**:
  1. User đăng nhập lần đầu hoặc nhấn "Tạo Workspace mới" từ Workspace switcher.
  2. Người dùng nhập tên Workspace, tải lên logo (optional) → Hệ thống tạo bản ghi `Workspace` mới và tự động gán `WorkspaceMember` cho user đó với vai trò `OWNER`.
- **Cập nhật Workspace (UC17)**:
  1. Workspace Owner truy cập cài đặt Workspace và thay đổi thông tin (tên Workspace, upload logo mới hoặc xóa logo cũ).
  2. Bấm "Lưu" → Server kiểm tra tính hợp lệ (tên không được để trống, file logo ≤ 2MB, định dạng .jpg, .png, .webp).
  3. Cập nhật bản ghi `Workspace` trong DB và cập nhật hiển thị phía client.
- **Xóa Workspace (UC18)**:
  1. Workspace Owner truy cập trang cài đặt nâng cao và nhấn nút "Xóa Workspace".
  2. Hệ thống hiển thị modal yêu cầu xác nhận: nhập mật khẩu hiện tại của tài khoản và nhập chính xác tên Workspace để xác nhận hành vi hủy bỏ.
  3. Server xác nhận thông tin hợp lệ, tiến hành thu hồi toàn bộ kết nối kênh (`ChannelConnection`), xóa mềm (Soft Delete) bản ghi `Workspace` cùng các bài viết, file media, chiến dịch, và lịch sử duyệt bài liên kết.
  4. Hệ thống tự động chuyển hướng người dùng sang một Workspace còn hoạt động khác của họ, hoặc chuyển về trang yêu cầu tạo mới nếu không còn Workspace nào.
- **Xem thành viên (UC19)**:
  1. Mọi thành viên trong Workspace truy cập trang "Quản lý thành viên" để xem danh sách thành viên.
  2. **Truy vấn & Hợp nhất dữ liệu**: Vì thành viên chưa chấp nhận lời mời chỉ tồn tại trong bảng `WorkspaceInvite`, còn thành viên đã hoạt động nằm ở bảng `WorkspaceMember`, hệ thống sẽ thực hiện hợp nhất kết quả truy vấn (UNION) từ cả hai bảng:
     - Dữ liệu từ `WorkspaceMember` được đánh dấu trạng thái là `ACTIVE` ("Hoạt động").
     - Dữ liệu từ `WorkspaceInvite` chưa hết hạn và chưa được sử dụng được đánh dấu trạng thái là `PENDING` ("Chờ chấp nhận").
  3. UI hiển thị danh sách hợp nhất: ảnh đại diện, tên (hoặc email nếu chưa có tài khoản), email, vai trò (`OWNER` hoặc `CONTENT_CREATOR`), trạng thái (Hoạt động / Chờ chấp nhận) và ngày tham gia/ngày mời.
- **Mời thành viên & Chấp nhận lời mời (UC20, UC21)**:
  1. Owner nhập email và chọn vai trò (`OWNER` hoặc `CONTENT_CREATOR`) → Hệ thống tạo `WorkspaceInvite(token, expiresAt)` và gửi email lời mời kèm liên kết xác thực (hạn 7 ngày).
  2. Người nhận (Guest hoặc User) bấm liên kết trong email → Nếu đã có tài khoản, thực hiện tham gia ngay; nếu là Guest (chưa có tài khoản), hệ thống chuyển hướng qua trang Đăng ký và tự động liên kết thành viên sau khi đăng ký thành công.
- **Xóa thành viên & Rời Workspace (UC22, UC23)**:
  1. **Rời Workspace (Leave Workspace - UC22)**: Thành viên nhấn nút "Rời khỏi Workspace" → Hệ thống yêu cầu xác nhận. Nếu user là Owner duy nhất, hệ thống chặn hành động và bắt buộc phải chỉ định Owner mới hoặc thực hiện xóa Workspace.
  2. **Xóa thành viên (Remove Member - UC23)**: Workspace Owner nhấn nút "Xóa" cạnh tên thành viên trong danh sách → Server xóa bản ghi `WorkspaceMember` tương ứng, thu hồi quyền truy cập của user đó vào Workspace ngay lập tức.
- **Workspace switcher**: UI hiển thị danh sách workspace mà user là thành viên → chọn 1 làm "workspace đang hoạt động" (lưu trong session/local state), mọi API call sau đó đính kèm `workspaceId` hiện tại.

**Lưu ý khi làm**:

- Middleware xác thực quyền phải luôn kiểm tra `(userId, workspaceId) -> role` cho **mọi** request liên quan đến workspace, không chỉ dựa vào role global của user.
- Token mời cần một-lần-dùng (invalidate sau khi accept) và có thể bị Owner thu hồi (revoke) trước khi được chấp nhận.
- Xóa thành viên / Thành viên rời workspace: Không xóa cascade các bài viết/media do người đó tạo; chúng vẫn thuộc về workspace. Giữ nguyên ID của user đã rời tại trường `createdBy` để phục vụ truy vết. Chỉ Owner mới có quyền sửa tiếp các bài viết này. Nếu bài viết đang ở trạng thái `PENDING` (chờ duyệt), Owner vẫn có quyền duyệt hoặc từ chối bài viết bình thường.
- **Xóa mềm Workspace (UC18)**: Cần cập nhật trường `deletedAt` trên bảng `Workspace` thay vì xóa cứng. Các truy vấn workspace thông thường phải lọc các bản ghi có `deletedAt IS NULL`.

---

## 1.3. Hồ sơ cá nhân (Update Profile & Change Password - UC04, UC32)

**Mô tả**: Cho phép người dùng cập nhật thông tin hồ sơ cá nhân (tên hiển thị, avatar) và thay đổi mật khẩu tài khoản hoặc email để bảo mật thông tin.

**Tác nhân (Actors)**:
- **UC04 (Change Password)**: User (All Roles)
- **UC32 (Update Profile)**: User (All Roles)

**Luồng hoạt động**:

1. Đổi mật khẩu: yêu cầu nhập mật khẩu cũ → verify → set mật khẩu mới → tăng `tokenVersion` (buộc đăng nhập lại trên các thiết bị khác).
2. Đổi email: nhập email mới → gửi OTP đến email mới → xác nhận OTP → cập nhật email, gửi thông báo đến email cũ ("email tài khoản đã được thay đổi") để phát hiện chiếm đoạt tài khoản.

**Lưu ý khi làm**: OTP nên có hạn ngắn (5-10 phút), giới hạn số lần nhập sai (≤5 lần) để chống brute-force.
