# Bảng Test Cases — Hệ thống Marka

> Tài liệu kiểm thử chức năng cho toàn bộ các API của hệ thống Marka.  
> Cột **Dữ liệu đầu ra thực tế** và **Trạng thái** sẽ được điền trong quá trình kiểm thử thực tế.

---

## Phân hệ 1 — Auth & Workspace

### UC01 — Đăng ký tài khoản (`POST /auth/register`)

| STT | Mô tả | Dữ liệu đầu vào | Dữ liệu đầu ra mong muốn | Dữ liệu đầu ra thực tế | Trạng thái |
|-----|-------|----------------|--------------------------|------------------------|------------|
| 1.1 | Đăng ký thành công với thông tin hợp lệ | `{ "email": "user@test.com", "password": "Abc@12345", "name": "Test User" }` | HTTP 201, trả về `UserDto` (id, email, name), email xác thực được gửi | | |
| 1.2 | Đăng ký thất bại — email đã tồn tại | `{ "email": "existed@test.com", "password": "Abc@12345", "name": "Test User" }` | HTTP 409, `{ "message": "Email already exists" }` | | |
| 1.3 | Đăng ký thất bại — email sai định dạng | `{ "email": "not-an-email", "password": "Abc@12345", "name": "Test User" }` | HTTP 400, lỗi validation email | | |
| 1.4 | Đăng ký thất bại — thiếu trường bắt buộc (`name`) | `{ "email": "user2@test.com", "password": "Abc@12345" }` | HTTP 400, lỗi validation thiếu trường | | |
| 1.5 | Đăng ký thất bại — mật khẩu quá ngắn (< 8 ký tự) | `{ "email": "user3@test.com", "password": "123", "name": "Test" }` | HTTP 400, lỗi validation password | | |

---

### UC02 — Đăng nhập (`POST /auth/login`)

| STT | Mô tả | Dữ liệu đầu vào | Dữ liệu đầu ra mong muốn | Dữ liệu đầu ra thực tế | Trạng thái |
|-----|-------|----------------|--------------------------|------------------------|------------|
| 2.1 | Đăng nhập thành công với thông tin đúng | `{ "email": "user@test.com", "password": "Abc@12345" }` | HTTP 200, trả về `AuthSessionDto` (access_token, refresh_token, user info) | | |
| 2.2 | Đăng nhập thất bại — email không tồn tại | `{ "email": "notfound@test.com", "password": "Abc@12345" }` | HTTP 401, `{ "message": "Invalid credentials" }` | | |
| 2.3 | Đăng nhập thất bại — sai mật khẩu | `{ "email": "user@test.com", "password": "WrongPass!" }` | HTTP 401, `{ "message": "Invalid credentials" }` | | |
| 2.4 | Đăng nhập thất bại — thiếu trường email | `{ "password": "Abc@12345" }` | HTTP 400, lỗi validation | | |
| 2.5 | Thông báo lỗi sai email và sai mật khẩu phải giống nhau | Gọi TC 2.2 và TC 2.3 rồi so sánh body | Cả hai đều trả về `{ "message": "Invalid credentials" }` | | |

---

### UC03 — Đăng xuất (`POST /auth/logout`)

| STT | Mô tả | Dữ liệu đầu vào | Dữ liệu đầu ra mong muốn | Dữ liệu đầu ra thực tế | Trạng thái |
|-----|-------|----------------|--------------------------|------------------------|------------|
| 3.1 | Đăng xuất thành công | Header: `Authorization: Bearer <access_token>`, Body: `{ "refreshToken": "<refresh_token>" }` | HTTP 200, body `{}`, có Clear-Cookie header, refresh token bị vô hiệu hóa trong DB | | |
| 3.2 | Đăng xuất không có token | Không có Authorization header | HTTP 401, lỗi unauthorized | | |
| 3.3 | Dùng refresh token cũ sau khi đăng xuất | Sau TC 3.1, dùng lại `refresh_token` để refresh | HTTP 401, token đã bị thu hồi | | |

---

### UC04 — Đổi mật khẩu (`PATCH /users/me/password`)

| STT | Mô tả | Dữ liệu đầu vào | Dữ liệu đầu ra mong muốn | Dữ liệu đầu ra thực tế | Trạng thái |
|-----|-------|----------------|--------------------------|------------------------|------------|
| 4.1 | Đổi mật khẩu thành công | Header: `Authorization: Bearer <token>`, Body: `{ "oldPassword": "Abc@12345", "newPassword": "NewPass@99" }` | HTTP 200, `{ "message": "Password updated" }`, tất cả refresh token cũ bị thu hồi | | |
| 4.2 | Đổi mật khẩu thất bại — mật khẩu cũ sai | Header: `Authorization: Bearer <token>`, Body: `{ "oldPassword": "WrongOld!", "newPassword": "NewPass@99" }` | HTTP 401, `{ "message": "Old password incorrect" }` | | |
| 4.3 | Đổi mật khẩu thất bại — không có token | Không có Authorization header | HTTP 401, lỗi unauthorized | | |
| 4.4 | Đăng nhập lại bằng mật khẩu cũ sau khi đổi | Dùng mật khẩu cũ để login sau TC 4.1 | HTTP 401, đăng nhập thất bại | | |

---

### UC32 — Cập nhật hồ sơ cá nhân (`PATCH /users/me`)

| STT | Mô tả | Dữ liệu đầu vào | Dữ liệu đầu ra mong muốn | Dữ liệu đầu ra thực tế | Trạng thái |
|-----|-------|----------------|--------------------------|------------------------|------------|
| 5.1 | Cập nhật tên thành công | Header: `Authorization: Bearer <token>`, Body: `{ "name": "New Name" }` | HTTP 200, trả về `User` với tên mới | | |
| 5.2 | Cập nhật ảnh đại diện thành công | Header: `Authorization: Bearer <token>`, Body: `{ "avatarUrl": "https://example.com/avatar.png" }` | HTTP 200, trả về `User` với `avatarUrl` mới | | |
| 5.3 | Cập nhật không có token | Không có Authorization header | HTTP 401, lỗi unauthorized | | |

---

## Phân hệ 1.2 — Workspace Management

### UC16 — Tạo Workspace (`POST /workspaces`)

| STT | Mô tả | Dữ liệu đầu vào | Dữ liệu đầu ra mong muốn | Dữ liệu đầu ra thực tế | Trạng thái |
|-----|-------|----------------|--------------------------|------------------------|------------|
| 6.1 | Tạo workspace thành công | Header: `Authorization: Bearer <token>`, Body: `{ "name": "My Workspace" }` | HTTP 201, trả về `Workspace`, người tạo có role OWNER | | |
| 6.2 | Tạo workspace thất bại — tên đã tồn tại trong tài khoản | Body: `{ "name": "My Workspace" }` (tên trùng TC 6.1) | HTTP 409, `{ "message": "Workspace name already exists" }` | | |
| 6.3 | Tạo workspace với logo | Body: `{ "name": "Logo WS", "logoUrl": "https://example.com/logo.png" }` | HTTP 201, trả về `Workspace` có `logoUrl` | | |
| 6.4 | Tạo workspace không có token | Không có Authorization header | HTTP 401, lỗi unauthorized | | |

---

### UC17 — Cập nhật Workspace (`PATCH /workspaces/:id`)

| STT | Mô tả | Dữ liệu đầu vào | Dữ liệu đầu ra mong muốn | Dữ liệu đầu ra thực tế | Trạng thái |
|-----|-------|----------------|--------------------------|------------------------|------------|
| 7.1 | Cập nhật tên workspace thành công | Path: `/workspaces/<id>`, Body: `{ "name": "Updated Name" }` (owner token) | HTTP 200, trả về `Workspace` với tên mới | | |
| 7.2 | Cập nhật thất bại — không phải owner | Path: `/workspaces/<id>`, Body: `{ "name": "Hacked" }` (member token) | HTTP 403, lỗi phân quyền | | |
| 7.3 | Cập nhật workspace không tồn tại | Path: `/workspaces/invalid-id` | HTTP 404, workspace không tìm thấy | | |

---

### UC18 — Xoá Workspace (`DELETE /workspaces/:id`)

| STT | Mô tả | Dữ liệu đầu vào | Dữ liệu đầu ra mong muốn | Dữ liệu đầu ra thực tế | Trạng thái |
|-----|-------|----------------|--------------------------|------------------------|------------|
| 8.1 | Xoá workspace thành công | Path: `/workspaces/<id>` (owner token) | HTTP 200, `{ "success": true }`, workspace bị soft-delete (`deletedAt` != null) | | |
| 8.2 | Xoá thất bại — không phải owner | Path: `/workspaces/<id>` (member token) | HTTP 403, lỗi phân quyền | | |
| 8.3 | Kiểm tra channel connections sau khi xoá workspace | Sau TC 8.1, kiểm tra DB | Tất cả channel connections chuyển trạng thái EXPIRED | | |

---

### UC19 — Xem danh sách thành viên (`GET /workspaces/:id/members`)

| STT | Mô tả | Dữ liệu đầu vào | Dữ liệu đầu ra mong muốn | Dữ liệu đầu ra thực tế | Trạng thái |
|-----|-------|----------------|--------------------------|------------------------|------------|
| 9.1 | Xem danh sách thành viên thành công | Path: `/workspaces/<id>` (member token) | HTTP 200, `{ "members": [...], "pendingInvites": [...] }` | | |
| 9.2 | Xem thất bại — không phải thành viên workspace | Path: `/workspaces/<id>` (outsider token) | HTTP 403, lỗi phân quyền | | |

---

### UC20 — Mời thành viên (`POST /workspaces/:id/invites`)

| STT | Mô tả | Dữ liệu đầu vào | Dữ liệu đầu ra mong muốn | Dữ liệu đầu ra thực tế | Trạng thái |
|-----|-------|----------------|--------------------------|------------------------|------------|
| 10.1 | Mời thành viên mới thành công | Path: `/workspaces/<id>/invites`, Body: `{ "email": "newmember@test.com", "role": "MEMBER" }` (owner token) | HTTP 201, trả về `Invite`, email mời được gửi | | |
| 10.2 | Mời thất bại — email đã là thành viên | Body: `{ "email": "existedmember@test.com", "role": "MEMBER" }` | HTTP 409, `{ "message": "User is already a member" }` | | |
| 10.3 | Mời thất bại — không phải owner | Body: `{ "email": "new@test.com", "role": "MEMBER" }` (member token) | HTTP 403, lỗi phân quyền | | |

---

### UC21 — Chấp nhận lời mời (`GET /invites/:token`)

| STT | Mô tả | Dữ liệu đầu vào | Dữ liệu đầu ra mong muốn | Dữ liệu đầu ra thực tế | Trạng thái |
|-----|-------|----------------|--------------------------|------------------------|------------|
| 11.1 | Chấp nhận lời mời — đã có tài khoản | Path: `/invites/<valid_token>` (đã đăng nhập) | HTTP 200, `{ "workspaceId": "..." }`, user được thêm vào workspace, owner nhận thông báo | | |
| 11.2 | Chấp nhận lời mời — chưa có tài khoản | Path: `/invites/<valid_token>` (chưa đăng nhập) | HTTP 302, redirect đến `/register?inviteToken=...` | | |
| 11.3 | Chấp nhận lời mời — token không hợp lệ | Path: `/invites/invalid-token` | HTTP 400 hoặc 404, token không tìm thấy | | |
| 11.4 | Chấp nhận lời mời đã dùng | Path: `/invites/<used_token>` | HTTP 400 hoặc 409, token đã được sử dụng | | |

---

### UC22 — Rời workspace (`DELETE /workspaces/:id/members/me`)

| STT | Mô tả | Dữ liệu đầu vào | Dữ liệu đầu ra mong muốn | Dữ liệu đầu ra thực tế | Trạng thái |
|-----|-------|----------------|--------------------------|------------------------|------------|
| 12.1 | Rời workspace thành công (thành viên thường) | Path: `/workspaces/<id>/members/me` (member token) | HTTP 200, `{ "success": true }` | | |
| 12.2 | Rời thất bại — là owner duy nhất | Path: `/workspaces/<id>/members/me` (sole owner token) | HTTP 409, `{ "message": "Cannot leave as sole owner" }` | | |

---

### UC23 — Xoá thành viên (`DELETE /workspaces/:id/members/:memberId`)

| STT | Mô tả | Dữ liệu đầu vào | Dữ liệu đầu ra mong muốn | Dữ liệu đầu ra thực tế | Trạng thái |
|-----|-------|----------------|--------------------------|------------------------|------------|
| 13.1 | Xoá thành viên thành công | Path: `/workspaces/<id>/members/<memberId>` (owner token) | HTTP 200, `{ "removedMemberId": "..." }` | | |
| 13.2 | Xoá thất bại — actor không đủ quyền | Path: `/workspaces/<id>/members/<memberId>` (member token) | HTTP 403, `{ "message": "Only owner/admin can remove members" }` | | |
| 13.3 | Xoá thất bại — xoá owner duy nhất | Path: `/workspaces/<id>/members/<ownerId>`, chỉ còn 1 owner | HTTP 409, `{ "message": "Cannot remove the sole owner" }` | | |

---

## Phân hệ 2 — Nội dung & Media

### UC05 — Tạo bài viết (`POST /posts`)

| STT | Mô tả | Dữ liệu đầu vào | Dữ liệu đầu ra mong muốn | Dữ liệu đầu ra thực tế | Trạng thái |
|-----|-------|----------------|--------------------------|------------------------|------------|
| 14.1 | Tạo bài viết thành công | Header: `Authorization: Bearer <token>`, Body: `{ "workspaceId": "<id>", "title": "Test Post", "content": "Nội dung bài test", "mediaUrls": [] }` | HTTP 201, trả về `Post` với trạng thái `DRAFT` | | |
| 14.2 | Tạo bài viết kèm ảnh | Body: `{ ..., "mediaUrls": ["https://example.com/img.jpg"] }` | HTTP 201, trả về `Post` có `mediaUrls` | | |
| 14.3 | Tạo bài viết thiếu workspaceId | Body: `{ "title": "Test", "content": "..." }` | HTTP 400, lỗi validation | | |

---

### UC07 — Cập nhật bài viết (`PATCH /posts/:id`)

| STT | Mô tả | Dữ liệu đầu vào | Dữ liệu đầu ra mong muốn | Dữ liệu đầu ra thực tế | Trạng thái |
|-----|-------|----------------|--------------------------|------------------------|------------|
| 15.1 | Cập nhật bài viết ở trạng thái DRAFT thành công | Path: `/posts/<id>`, Body: `{ "title": "Updated Title" }` | HTTP 200, trả về `Post` với tiêu đề mới | | |
| 15.2 | Cập nhật bài viết ở trạng thái PENDING thành công | Bài viết đang PENDING, Body: `{ "content": "Nội dung mới" }` | HTTP 200, trả về `Post` đã cập nhật | | |
| 15.3 | Cập nhật thất bại — bài đã PUBLISHED | Path: `/posts/<published_id>`, Body: `{ "title": "Sửa" }` | HTTP 403, `{ "message": "Post cannot be edited" }` | | |

---

### UC08 — Xem chi tiết bài viết (`GET /posts/:id`)

| STT | Mô tả | Dữ liệu đầu vào | Dữ liệu đầu ra mong muốn | Dữ liệu đầu ra thực tế | Trạng thái |
|-----|-------|----------------|--------------------------|------------------------|------------|
| 16.1 | Xem chi tiết bài viết thành công | Path: `/posts/<id>` (member token) | HTTP 200, `{ "post": {...}, "history": [...], "schedules": [...] }` | | |
| 16.2 | Xem bài viết không tồn tại | Path: `/posts/invalid-id` | HTTP 404, bài viết không tìm thấy | | |

---

### UC09 — Tìm kiếm bài viết (`GET /posts`)

| STT | Mô tả | Dữ liệu đầu vào | Dữ liệu đầu ra mong muốn | Dữ liệu đầu ra thực tế | Trạng thái |
|-----|-------|----------------|--------------------------|------------------------|------------|
| 17.1 | Lấy tất cả bài viết trong workspace | Query: `?workspaceId=<id>` | HTTP 200, `{ "posts": [...], "total": N }` | | |
| 17.2 | Tìm kiếm theo từ khoá | Query: `?workspaceId=<id>&keyword=test` | HTTP 200, danh sách bài có chứa "test" | | |
| 17.3 | Lọc theo trạng thái DRAFT | Query: `?workspaceId=<id>&status=DRAFT` | HTTP 200, chỉ trả về bài có trạng thái DRAFT | | |
| 17.4 | Phân trang | Query: `?workspaceId=<id>&page=1&limit=5` | HTTP 200, tối đa 5 bài, có trường `total` | | |
| 17.5 | Thiếu workspaceId | Không có query param | HTTP 400, lỗi validation | | |

---

### UC10 — Xoá bài viết (`DELETE /posts/:id`)

| STT | Mô tả | Dữ liệu đầu vào | Dữ liệu đầu ra mong muốn | Dữ liệu đầu ra thực tế | Trạng thái |
|-----|-------|----------------|--------------------------|------------------------|------------|
| 18.1 | Xoá bài viết DRAFT thành công | Path: `/posts/<id>` (creator token) | HTTP 200, `{ "success": true }`, bài viết bị soft-delete | | |
| 18.2 | Xoá bài viết đang SCHEDULED — job bị huỷ | Path: `/posts/<scheduled_id>` (owner token) | HTTP 200, `{ "success": true }`, job BullMQ bị huỷ | | |
| 18.3 | Xoá thất bại — không có quyền | Path: `/posts/<id>` (member không phải creator/owner) | HTTP 403, lỗi phân quyền | | |

---

## Phân hệ 2.3 — Duyệt bài

### UC11 — Gửi bài duyệt (`POST /posts/:id/submit`)

| STT | Mô tả | Dữ liệu đầu vào | Dữ liệu đầu ra mong muốn | Dữ liệu đầu ra thực tế | Trạng thái |
|-----|-------|----------------|--------------------------|------------------------|------------|
| 19.1 | Gửi bài DRAFT lên duyệt thành công | Path: `/posts/<draft_id>/submit` (creator token) | HTTP 200, `Post` trạng thái `PENDING`, owner nhận thông báo | | |
| 19.2 | Gửi bài đã PENDING lần nữa | Path: `/posts/<pending_id>/submit` | HTTP 400 hoặc 409, bài đã ở PENDING | | |
| 19.3 | Gửi duyệt thất bại — không phải creator | Path: `/posts/<id>/submit` (owner token của người khác) | HTTP 403, lỗi phân quyền | | |

---

### UC14 — Duyệt / Từ chối bài viết (`POST /posts/:id/review`)

| STT | Mô tả | Dữ liệu đầu vào | Dữ liệu đầu ra mong muốn | Dữ liệu đầu ra thực tế | Trạng thái |
|-----|-------|----------------|--------------------------|------------------------|------------|
| 20.1 | Duyệt bài thành công | Path: `/posts/<id>/review` (owner token), Body: `{ "action": "APPROVE" }` | HTTP 200, `{ "status": "APPROVED" }`, creator nhận thông báo | | |
| 20.2 | Từ chối bài thành công kèm lý do | Body: `{ "action": "REJECT", "reason": "Nội dung chưa phù hợp" }` | HTTP 200, `{ "status": "REJECTED" }`, creator nhận thông báo | | |
| 20.3 | Từ chối không có lý do | Body: `{ "action": "REJECT" }` (không có `reason`) | HTTP 400, lỗi validation (reason bắt buộc khi REJECT) | | |
| 20.4 | Duyệt bài không phải trạng thái PENDING | Bài ở trạng thái DRAFT | HTTP 400 hoặc 409, không thể review bài chưa nộp | | |
| 20.5 | Duyệt thất bại — không phải owner | Path: `/posts/<id>/review` (content creator token) | HTTP 403, lỗi phân quyền | | |

---

## Phân hệ 3 — AI Content

### UC06 — Sinh nội dung AI (`POST /workspaces/:id/ai/generate-text`)

| STT | Mô tả | Dữ liệu đầu vào | Dữ liệu đầu ra mong muốn | Dữ liệu đầu ra thực tế | Trạng thái |
|-----|-------|----------------|--------------------------|------------------------|------------|
| 21.1 | Sinh nội dung thành công | Path: `/workspaces/<id>/ai/generate-text`, Body: `{ "prompt": "Viết bài quảng cáo sản phẩm X" }` (workspace đủ credit) | HTTP 200, `{ "generationId": "...", "content": "..." }`, credit bị trừ | | |
| 21.2 | Sinh nội dung với tone và platform | Body: `{ "prompt": "Quảng cáo kem dưỡng da", "tone": "friendly", "platform": "facebook" }` | HTTP 200, nội dung phù hợp với brand voice | | |
| 21.3 | Sinh thất bại — không đủ credit | Workspace không có credit | HTTP 402 hoặc 400, lỗi không đủ credit | | |
| 21.4 | Sinh thất bại — lỗi OpenAI API | Giả lập OpenAI API lỗi | HTTP 502, `{ "message": "AI generation failed" }` | | |

---

## Phân hệ 4 — Kết nối & Đăng bài

### UC27 — Xem kênh đã kết nối (`GET /workspaces/:id/channels`)

| STT | Mô tả | Dữ liệu đầu vào | Dữ liệu đầu ra mong muốn | Dữ liệu đầu ra thực tế | Trạng thái |
|-----|-------|----------------|--------------------------|------------------------|------------|
| 22.1 | Xem danh sách kênh thành công | Path: `/workspaces/<id>/channels` (member token) | HTTP 200, `{ "channels": [...] }` | | |
| 22.2 | Workspace chưa có kênh nào | Path: `/workspaces/<new_id>/channels` | HTTP 200, `{ "channels": [] }` | | |

---

### UC28 — Kết nối kênh mạng xã hội

#### Kịch bản 1: Kết nối Facebook thật (`POST /channels/facebook/connect`)

| STT | Mô tả | Dữ liệu đầu vào | Dữ liệu đầu ra mong muốn | Dữ liệu đầu ra thực tế | Trạng thái |
|-----|-------|----------------|--------------------------|------------------------|------------|
| 23.1 | Kết nối Facebook thành công | Body: `{ "workspaceId": "<id>", "pageId": "<pageId>", "pageAccessToken": "<valid_token>", "appId": "<appId>", "appSecret": "<secret>" }` | HTTP 201, trả về `ConnectionRecord` | | |
| 23.2 | Kết nối thất bại — token không hợp lệ | Body: `{ ..., "pageAccessToken": "invalid_token" }` | HTTP 400, `{ "message": "Invalid page access token" }` | | |

#### Kịch bản 2: Kết nối kênh giả lập (`POST /channels/simulate`)

| STT | Mô tả | Dữ liệu đầu vào | Dữ liệu đầu ra mong muốn | Dữ liệu đầu ra thực tế | Trạng thái |
|-----|-------|----------------|--------------------------|------------------------|------------|
| 23.3 | Kết nối kênh giả lập thành công | Body: `{ "workspaceId": "<id>", "channelName": "Fanpage Test", "platform": "FACEBOOK" }` | HTTP 201, trả về `ConnectionRecord` (type: SIMULATED) | | |

---

### UC29 — Ngắt kết nối kênh (`DELETE /channels/:id`)

| STT | Mô tả | Dữ liệu đầu vào | Dữ liệu đầu ra mong muốn | Dữ liệu đầu ra thực tế | Trạng thái |
|-----|-------|----------------|--------------------------|------------------------|------------|
| 24.1 | Ngắt kết nối thành công | Path: `/channels/<id>` (owner token) | HTTP 200, `{ "success": true }`, scheduled posts bị CANCELLED, job BullMQ bị huỷ | | |
| 24.2 | Ngắt kết nối kênh không tồn tại | Path: `/channels/invalid-id` | HTTP 404 | | |
| 24.3 | Ngắt kết nối thất bại — không phải owner | Path: `/channels/<id>` (member token) | HTTP 403, lỗi phân quyền | | |

---

### UC12 — Lên lịch đăng bài (`POST /posts/:id/schedule`)

| STT | Mô tả | Dữ liệu đầu vào | Dữ liệu đầu ra mong muốn | Dữ liệu đầu ra thực tế | Trạng thái |
|-----|-------|----------------|--------------------------|------------------------|------------|
| 25.1 | Lên lịch thành công (1 kênh) | Path: `/posts/<approved_id>/schedule`, Body: `{ "channels": [{ "channelId": "<id>", "scheduledAt": "2026-09-01T10:00:00Z" }] }` | HTTP 201, trả về `ScheduledPost[]`, bài chuyển SCHEDULED, job vào BullMQ | | |
| 25.2 | Lên lịch thành công (nhiều kênh) | Body: `{ "channels": [{ "channelId": "<id1>", "scheduledAt": "..." }, { "channelId": "<id2>", "scheduledAt": "..." }] }` | HTTP 201, tạo 2 ScheduledPost, 2 job BullMQ riêng biệt | | |
| 25.3 | Lên lịch thất bại — bài chưa APPROVED | Path: `/posts/<draft_id>/schedule` | HTTP 400 hoặc 409, chỉ bài APPROVED mới được lên lịch | | |
| 25.4 | Lên lịch với thời gian trong quá khứ | Body: `{ "channels": [{ "channelId": "<id>", "scheduledAt": "2020-01-01T00:00:00Z" }] }` | HTTP 400, lỗi thời gian không hợp lệ | | |

---

### UC13 — Xem lịch đăng bài / Calendar (`GET /workspaces/:id/schedule`)

| STT | Mô tả | Dữ liệu đầu vào | Dữ liệu đầu ra mong muốn | Dữ liệu đầu ra thực tế | Trạng thái |
|-----|-------|----------------|--------------------------|------------------------|------------|
| 26.1 | Xem lịch tháng hiện tại | Path: `/workspaces/<id>/schedule?month=9&year=2026` | HTTP 200, `{ "scheduledPosts": [...] }` chứa các bài trong tháng 9/2026 | | |
| 26.2 | Xem lịch tháng không có bài | Query: `?month=1&year=2025` | HTTP 200, `{ "scheduledPosts": [] }` | | |

---

### UC15 — Đăng bài ngay (`POST /posts/:id/publish`)

| STT | Mô tả | Dữ liệu đầu vào | Dữ liệu đầu ra mong muốn | Dữ liệu đầu ra thực tế | Trạng thái |
|-----|-------|----------------|--------------------------|------------------------|------------|
| 27.1 | Đăng bài ngay thành công | Path: `/posts/<approved_id>/publish`, Body: `{ "channelId": "<id>" }` | HTTP 200, trả về `Post` trạng thái `PUBLISHED` | | |
| 27.2 | Đăng bài thất bại — bài chưa APPROVED | Path: `/posts/<draft_id>/publish` | HTTP 400 hoặc 409, chỉ bài APPROVED mới được đăng | | |
| 27.3 | Đăng bài thất bại — lỗi Facebook API | Giả lập Facebook API lỗi | HTTP 502, `{ "message": "Publish failed" }`, bài chuyển FAILED | | |

---

## Phân hệ 5 — Brand Voice

### UC24/25 — Tạo / Cập nhật Brand Voice (`PUT /workspaces/:id/brand-voice`)

| STT | Mô tả | Dữ liệu đầu vào | Dữ liệu đầu ra mong muốn | Dữ liệu đầu ra thực tế | Trạng thái |
|-----|-------|----------------|--------------------------|------------------------|------------|
| 28.1 | Tạo Brand Voice mới thành công | Path: `/workspaces/<id>/brand-voice`, Body: `{ "industry": "Thời trang", "targetAudience": "Nữ 18-35", "keywords": ["trendy", "affordable"], "writingStyle": "casual" }` | HTTP 200, trả về `BrandVoice` mới tạo | | |
| 28.2 | Cập nhật Brand Voice đã có | Body: `{ "industry": "Làm đẹp", "targetAudience": "Nữ 25-40", "keywords": ["luxury"], "writingStyle": "formal" }` | HTTP 200, trả về `BrandVoice` đã cập nhật | | |
| 28.3 | Tạo Brand Voice thất bại — không phải owner | Path: `/workspaces/<id>/brand-voice` (member token) | HTTP 403, lỗi phân quyền | | |
| 28.4 | Tạo Brand Voice với sampleContent | Body: `{ ..., "sampleContent": "Ví dụ nội dung mẫu" }` | HTTP 200, `BrandVoice` có `sampleContent` | | |

---

### UC26 — Xem Brand Voice (`GET /workspaces/:id/brand-voice`)

| STT | Mô tả | Dữ liệu đầu vào | Dữ liệu đầu ra mong muốn | Dữ liệu đầu ra thực tế | Trạng thái |
|-----|-------|----------------|--------------------------|------------------------|------------|
| 29.1 | Xem Brand Voice thành công | Path: `/workspaces/<id>/brand-voice` (member token) | HTTP 200, trả về `BrandVoice` | | |
| 29.2 | Xem Brand Voice workspace chưa có | Path: `/workspaces/<new_id>/brand-voice` | HTTP 404, chưa có Brand Voice | | |

---

## Phân hệ 6 — Credit & PayOS

### UC30 — Mua credit & Thanh toán

| STT | Mô tả | Dữ liệu đầu vào | Dữ liệu đầu ra mong muốn | Dữ liệu đầu ra thực tế | Trạng thái |
|-----|-------|----------------|--------------------------|------------------------|------------|
| 30.1 | Tạo đơn mua credit thành công | Path: `/workspaces/<id>/orders`, Body: `{ "packageId": "<pkg_id>", "amount": 99000, "creditAmount": 100 }` (owner token) | HTTP 201, `{ "payUrl": "...", "qrCode": "..." }` | | |
| 30.2 | Webhook xác nhận thanh toán thành công | POST `/payos/webhook` với payload hợp lệ và chữ ký đúng | HTTP 200, `{}`, đơn chuyển PAID, credit cộng vào workspace, owner nhận thông báo | | |
| 30.3 | Webhook với chữ ký không hợp lệ | POST `/payos/webhook` với chữ ký giả mạo | HTTP 400 hoặc 401, lỗi xác thực chữ ký | | |
| 30.4 | Polling trạng thái đơn hàng — PENDING | GET `/orders/<code>` (trước khi thanh toán) | HTTP 200, `{ "status": "PENDING" }` | | |
| 30.5 | Polling trạng thái đơn hàng — PAID | GET `/orders/<code>` (sau khi thanh toán) | HTTP 200, `{ "status": "PAID" }` | | |
| 30.6 | Credit được cộng đúng vào workspace | Kiểm tra `workspace.creditBalance` sau TC 30.2 | Balance tăng đúng số `creditAmount` đã mua | | |

---

## Phân hệ 7 — Admin

### UC31 — Dashboard & Audit Log

#### Xem thống kê Dashboard

| STT | Mô tả | Dữ liệu đầu vào | Dữ liệu đầu ra mong muốn | Dữ liệu đầu ra thực tế | Trạng thái |
|-----|-------|----------------|--------------------------|------------------------|------------|
| 31.1 | Admin xem dashboard toàn hệ thống | GET `/admin/dashboard` (system admin token) | HTTP 200, `{ "stats": { totalUsers, totalWorkspaces, totalRevenue, ... } }` | | |
| 31.2 | Workspace owner xem dashboard workspace | GET `/workspaces/<id>/dashboard` (owner token) | HTTP 200, thống kê trong phạm vi workspace | | |
| 31.3 | Member không được xem dashboard admin | GET `/admin/dashboard` (member token) | HTTP 403, lỗi phân quyền | | |

#### Xem nhật ký hệ thống

| STT | Mô tả | Dữ liệu đầu vào | Dữ liệu đầu ra mong muốn | Dữ liệu đầu ra thực tế | Trạng thái |
|-----|-------|----------------|--------------------------|------------------------|------------|
| 32.1 | Xem tất cả audit log | GET `/admin/audit-logs` (admin token) | HTTP 200, `{ "logs": [...], "total": N }` | | |
| 32.2 | Lọc audit log theo userId | Query: `?userId=<id>` | HTTP 200, chỉ log của user đó | | |
| 32.3 | Lọc audit log theo action | Query: `?action=MEMBER_REMOVED` | HTTP 200, chỉ log với action MEMBER_REMOVED | | |
| 32.4 | Lọc audit log theo khoảng thời gian | Query: `?from=2026-01-01&to=2026-12-31` | HTTP 200, chỉ log trong khoảng thời gian | | |
| 32.5 | Phân trang audit log | Query: `?page=1&limit=10` | HTTP 200, tối đa 10 bản ghi | | |
| 32.6 | Member không được xem audit log | GET `/admin/audit-logs` (member token) | HTTP 403, lỗi phân quyền | | |

---

## Phụ lục — Background Worker (BullMQ)

### Worker: processPublishJob

| STT | Mô tả | Dữ liệu đầu vào | Dữ liệu đầu ra mong muốn | Dữ liệu đầu ra thực tế | Trạng thái |
|-----|-------|----------------|--------------------------|------------------------|------------|
| 33.1 | Job đăng bài thành công — kênh Facebook thật | `scheduledPostId` hợp lệ, kênh Facebook có token hợp lệ, đến thời điểm `runAt` | `scheduledPost.status = PUBLISHED`, `post.status = PUBLISHED` (nếu tất cả kênh xong) | | |
| 33.2 | Job đăng bài thành công — kênh giả lập | `scheduledPostId` hợp lệ, kênh type SIMULATED | `scheduledPost.status = PUBLISHED` sau khoảng 2 giây | | |
| 33.3 | Job đăng bài thất bại — lỗi Facebook API | Facebook API trả về lỗi | `scheduledPost.status = FAILED`, owner nhận thông báo lỗi | | |
| 33.4 | Kiểm tra trạng thái post tổng thể khi tất cả kênh xong | Tất cả `scheduledPost` của post đều PUBLISHED | `post.status = PUBLISHED` | | |

---

## Tổng kết

| Phân hệ | Số test case | Đã Pass | Đã Fail | Chưa test |
|---------|-------------|---------|---------|-----------|
| Auth & User (UC01–04, UC32) | 17 | | | |
| Workspace Management (UC16–23) | 22 | | | |
| Nội dung & Media (UC05, UC07–10) | 13 | | | |
| Duyệt bài (UC11, UC14) | 8 | | | |
| AI Content (UC06) | 4 | | | |
| Kết nối & Đăng bài (UC12–13, UC15, UC27–29) | 15 | | | |
| Brand Voice (UC24–26) | 6 | | | |
| Credit & PayOS (UC30) | 6 | | | |
| Admin (UC31) | 9 | | | |
| Background Worker | 4 | | | |
| **Tổng** | **104** | | | |

---

*Tài liệu kiểm thử hệ thống Marka — Tạo từ `api_documentation.md` — Cập nhật: 2026-08-21*
