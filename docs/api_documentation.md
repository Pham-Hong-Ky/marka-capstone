# Tài liệu Mô tả API — Hệ thống Marka

> Tài liệu này mô tả toàn bộ các API endpoint của hệ thống Marka, được tổng hợp từ sequence diagram theo từng Use Case.
> Mỗi API bao gồm: **Method & Path**, **Mô tả**, **Đầu vào**, **Xử lý nội bộ** và **Kết quả trả về**.

---

## Phân hệ 1 — Auth & Workspace

---

### UC01 — Register (Đăng ký tài khoản)

| Thuộc tính | Giá trị |
|---|---|
| **Method** | `POST` |
| **Path** | `/auth/register` |
| **Controller** | Auth Controller |
| **Service** | Auth Service |
| **Actors** | Admin / Workspace owner / Content creator (chưa có tài khoản) |

#### Đầu vào (Request Body)
```json
{
  "email": "string",
  "password": "string",
  "name": "string"
}
```

#### Xử lý nội bộ
1. **Validate** định dạng email, password tại front-end trước khi gửi.
2. `findUserByEmail(email)` — Kiểm tra email có tồn tại trong DB chưa.
3. `hashPassword(password)` — Mã hoá mật khẩu bằng bcrypt.
4. `createUser(data)` — Tạo bản ghi user mới trong DB.
5. `sendVerificationEmail()` — Gửi email xác thực đến người dùng.
6. `createAuditLog()` — Ghi nhật ký hành động.

#### Kết quả trả về

| Trường hợp | HTTP Status | Body |
|---|---|---|
| ✅ Đăng ký thành công | `201 Created` | `UserDto` (thông tin user vừa tạo) |
| ❌ Email đã tồn tại | `409 Conflict` | `{ message: "Email already exists" }` |

#### Ý nghĩa
Cho phép người dùng mới tạo tài khoản trong hệ thống. Sau khi đăng ký, email xác thực được gửi đến hộp thư. Không cho phép trùng email.

---

### UC02 — Login (Đăng nhập)

| Thuộc tính | Giá trị |
|---|---|
| **Method** | `POST` |
| **Path** | `/auth/login` |
| **Controller** | Auth Controller |
| **Service** | Auth Service |
| **Actors** | Admin / Workspace owner / Content creator |

#### Đầu vào (Request Body)
```json
{
  "email": "string",
  "password": "string"
}
```

#### Xử lý nội bộ
1. **Validate** định dạng email, password tại front-end.
2. `findUserByEmail(email)` — Tìm user theo email.
3. `verifyPassword(password, hash)` — So sánh mật khẩu nhập với hash trong DB.
4. Tạo `access_token` + `refresh_token` và trả về `AuthSessionDto`.

#### Kết quả trả về

| Trường hợp | HTTP Status | Body |
|---|---|---|
| ✅ Đăng nhập thành công | `200 OK` | `AuthSessionDto` (access token, refresh token, user info) |
| ❌ Sai email (không tìm thấy user) | `401 Unauthorized` | `{ message: "Invalid credentials" }` |
| ❌ Sai mật khẩu | `401 Unauthorized` | `{ message: "Invalid credentials" }` |

#### Ý nghĩa
Xác thực danh tính người dùng. Trả về session token dùng cho các request tiếp theo. Thông báo lỗi được giữ chung (không tiết lộ sai email hay sai mật khẩu) để tránh enumeration attack.

---

### UC03 — Logout (Đăng xuất)

| Thuộc tính | Giá trị |
|---|---|
| **Method** | `POST` |
| **Path** | `/auth/logout` |
| **Controller** | Auth Controller |
| **Service** | Auth Service |
| **Actors** | Admin / Workspace owner / Content creator (đã đăng nhập) |

#### Đầu vào (Request Body / Header)
```json
{
  "refreshToken": "string"
}
```
> `userId` lấy từ JWT token trong header `Authorization`.

#### Xử lý nội bộ
1. `revokeRefreshToken(refreshToken)` — Đánh dấu refresh token đã bị thu hồi trong DB (UPDATE `refresh_tokens`).
2. `createAuditLog()` — Ghi nhật ký hành động.
3. Xoá cookie trên response.

#### Kết quả trả về

| Trường hợp | HTTP Status | Body |
|---|---|---|
| ✅ Đăng xuất thành công | `200 OK` | `{}` (kèm Clear-Cookie header) |

#### Ý nghĩa
Kết thúc phiên làm việc của người dùng. Vô hiệu hoá refresh token trên server để ngăn tái sử dụng. Front-end xoá token khỏi store và chuyển về trang login.

---

### UC33 — Refresh Token (Làm mới access token)

| Thuộc tính | Giá trị |
|---|---|
| **Method** | `POST` |
| **Path** | `/auth/refresh-token` |
| **Controller** | Auth Controller |
| **Service** | Auth Service |
| **Actors** | Admin / Workspace owner / Content creator (đã đăng nhập) |

#### Đầu vào (Request Body)
```json
{
  "refreshToken": "string"
}
```

#### Xử lý nội bộ
1. `verifyRefreshToken(refreshToken)` — Xác thực refresh token (kiểm tra hết hạn, bị thu hồi).
2. `findUserById(userId)` — Lấy thông tin user từ payload token.
3. `generateAccessToken(user)` — Tạo access token mới.
4. `generateRefreshToken(user)` — Tạo refresh token mới (rotation).
5. `revokeRefreshToken(oldRefreshToken)` — Thu hồi refresh token cũ.

#### Kết quả trả về

| Trường hợp | HTTP Status | Body |
|---|---|---|
| ✅ Làm mới thành công | `200 OK` | `{ accessToken, refreshToken }` |
| ❌ Refresh token không hợp lệ / hết hạn | `401 Unauthorized` | `{ message: "Invalid or expired refresh token" }` |

#### Ý nghĩa
Làm mới access token khi hết hạn mà không cần đăng nhập lại. Áp dụng cơ chế **token rotation** (mỗi lần refresh sẽ cấp refresh token mới và thu hồi token cũ) để tăng bảo mật.

---

### UC34 — Verify Email (Xác thực email)

| Thuộc tính | Giá trị |
|---|---|
| **Method** | `GET` |
| **Path** | `/auth/verify-email` |
| **Controller** | Auth Controller |
| **Service** | Auth Service |
| **Actors** | Người dùng vừa đăng ký (qua link email) |

#### Đầu vào (Query Params)
| Param | Kiểu | Mô tả |
|---|---|---|
| `token` | `string` | Token xác thực email (bắt buộc) |

#### Xử lý nội bộ
1. `findUserByVerificationToken(token)` — Tìm user theo verification token.
2. **Nếu không tìm thấy hoặc token đã dùng**: Trả về lỗi.
3. `updateUser(userId, { emailVerified: true, verificationToken: null })` — Đánh dấu email đã xác thực.
4. `createAuditLog()` — Ghi nhật ký.

#### Kết quả trả về

| Trường hợp | HTTP Status | Body |
|---|---|---|
| ✅ Xác thực thành công | `200 OK` | `{ message: "Email verified successfully" }` |
| ❌ Token không hợp lệ / đã dùng | `400 Bad Request` | `{ message: "Invalid or expired verification token" }` |

#### Ý nghĩa
Xác thực email sau khi đăng ký. Link xác thực được gửi trong email ở UC01. Sau khi xác thực, user có thể sử dụng đầy đủ tính năng hệ thống.

---

### UC04 — Change Password (Đổi mật khẩu)

| Thuộc tính | Giá trị |
|---|---|
| **Method** | `PATCH` |
| **Path** | `/users/me/password` |
| **Controller** | User Controller |
| **Service** | User Service |
| **Actors** | Admin / Workspace owner / Content creator (đã đăng nhập) |

#### Đầu vào (Request Body)
```json
{
  "oldPassword": "string",
  "newPassword": "string"
}
```
> `userId` lấy từ JWT token.

#### Xử lý nội bộ
1. `findUserById(userId)` — Lấy thông tin user hiện tại.
2. `verifyPassword(oldPassword, user.passwordHash)` — Kiểm tra mật khẩu cũ.
3. `hashPassword(newPassword)` — Mã hoá mật khẩu mới.
4. `updateUser(userId, { passwordHash })` — Cập nhật mật khẩu trong DB.
5. `revokeAllRefreshTokens(userId)` — Thu hồi tất cả refresh token cũ (bắt buộc đăng nhập lại trên các thiết bị khác).
6. `createAuditLog()` — Ghi nhật ký hành động.

#### Kết quả trả về

| Trường hợp | HTTP Status | Body |
|---|---|---|
| ✅ Đổi mật khẩu thành công | `200 OK` | `{ message: "Password updated" }` |
| ❌ Mật khẩu cũ không đúng | `401 Unauthorized` | `{ message: "Old password incorrect" }` |

#### Ý nghĩa
Cho phép người dùng tự đổi mật khẩu. Sau khi đổi, tất cả phiên đăng nhập khác bị vô hiệu hoá nhằm bảo mật tài khoản.

---

### UC32 — Update Profile (Cập nhật thông tin cá nhân)

| Thuộc tính | Giá trị |
|---|---|
| **Method** | `PATCH` |
| **Path** | `/users/me` |
| **Controller** | User Controller |
| **Service** | User Service |
| **Actors** | Admin / Workspace owner / Content creator |

#### Đầu vào (Request Body)
```json
{
  "name": "string",
  "avatarUrl": "string (optional)"
}
```

#### Xử lý nội bộ
1. `updateUser(userId, data)` — Cập nhật thông tin user trong DB.
2. `createAuditLog()` — Ghi nhật ký.

#### Kết quả trả về

| Trường hợp | HTTP Status | Body |
|---|---|---|
| ✅ Cập nhật thành công | `200 OK` | `User` (thông tin user sau cập nhật) |

#### Ý nghĩa
Cho phép người dùng cập nhật tên hiển thị và ảnh đại diện.

---

## Phân hệ 1.2 — Workspace Management

---

### UC16 — Create Workspace (Tạo workspace)

| Thuộc tính | Giá trị |
|---|---|
| **Method** | `POST` |
| **Path** | `/workspaces` |
| **Controller** | Workspace Controller |
| **Service** | Workspace Service |
| **Actors** | Admin / Workspace owner |

#### Đầu vào (Request Body)
```json
{
  "name": "string",
  "logoUrl": "string (optional)"
}
```
> `userId` (owner) lấy từ JWT token.

#### Xử lý nội bộ
1. `findWorkspaceByNameAndOwner(userId, name)` — Kiểm tra tên workspace đã tồn tại trong tài khoản của user chưa.
2. `createWorkspaceRecord(data)` — Tạo bản ghi workspace.
3. `createWorkspaceMember(workspaceId, userId, role=OWNER)` — Thêm người tạo vào workspace với vai trò **OWNER**.
4. `createAuditLog()` — Ghi nhật ký.

#### Kết quả trả về

| Trường hợp | HTTP Status | Body |
|---|---|---|
| ✅ Tạo thành công | `201 Created` | `Workspace` |
| ❌ Tên workspace đã tồn tại (trong cùng tài khoản) | `409 Conflict` | `{ message: "Workspace name already exists" }` |

#### Ý nghĩa
Tạo một không gian làm việc mới. Người tạo tự động trở thành **Owner** của workspace đó.

---

### UC17 — Update Workspace (Cập nhật workspace)

| Thuộc tính | Giá trị |
|---|---|
| **Method** | `PATCH` |
| **Path** | `/workspaces/:id` |
| **Controller** | Workspace Controller |
| **Service** | Workspace Service |
| **Actors** | Workspace owner |

#### Đầu vào
- **Path param**: `id` — ID của workspace cần cập nhật
- **Request Body**:
```json
{
  "name": "string (optional)",
  "logoUrl": "string (optional)"
}
```

#### Xử lý nội bộ
1. `updateWorkspaceRecord(id, data)` — Cập nhật thông tin workspace.
2. `createAuditLog()` — Ghi nhật ký.

#### Kết quả trả về

| Trường hợp | HTTP Status | Body |
|---|---|---|
| ✅ Cập nhật thành công | `200 OK` | `Workspace` (thông tin mới) |

---

### UC18 — Delete Workspace (Xoá workspace)

| Thuộc tính | Giá trị |
|---|---|
| **Method** | `DELETE` |
| **Path** | `/workspaces/:id` |
| **Controller** | Workspace Controller |
| **Service** | Workspace Service |
| **Actors** | Workspace owner |

#### Đầu vào
- **Path param**: `id` — ID workspace cần xoá
- **Request Body**: Mật khẩu xác nhận (tùy triển khai)

#### Xử lý nội bộ
1. `removeAllWorkspaceMembers(workspaceId)` — Xoá toàn bộ thành viên.
2. `revokeAllChannelConnections(workspaceId)` — Đặt tất cả channel connection thành `EXPIRED`.
3. `softDeleteWorkspace(workspaceId)` — Đánh dấu workspace đã xoá (`deletedAt = now()`), **không xoá cứng**.
4. `createAuditLog()` — Ghi nhật ký.

#### Kết quả trả về

| Trường hợp | HTTP Status | Body |
|---|---|---|
| ✅ Xoá thành công | `200 OK` | `{ success: true }` |

#### Ý nghĩa
Xoá mềm workspace. Toàn bộ kết nối kênh và thành viên bị dọn dẹp trước khi đánh dấu xoá.

---

### UC19 — View Members (Xem danh sách thành viên)

| Thuộc tính | Giá trị |
|---|---|
| **Method** | `GET` |
| **Path** | `/workspaces/:id/members` |
| **Controller** | Workspace Controller |
| **Service** | Workspace Service |
| **Actors** | Workspace member |

#### Đầu vào
- **Path param**: `id` — ID workspace

#### Xử lý nội bộ
1. `findMembersByWorkspace(workspaceId)` — Lấy danh sách thành viên hiện tại (JOIN với bảng `users`).
2. `findPendingInvitesByWorkspace(workspaceId)` — Lấy danh sách lời mời đang chờ chấp nhận (`isUsed = false`).

#### Kết quả trả về

| Trường hợp | HTTP Status | Body |
|---|---|---|
| ✅ Thành công | `200 OK` | `{ members: Member[], pendingInvites: Invite[] }` |

#### Ý nghĩa
Trả về toàn bộ thành viên đang hoạt động và các lời mời chưa được chấp nhận trong workspace.

---

### UC20 — Invite Member (Mời thành viên)

| Thuộc tính | Giá trị |
|---|---|
| **Method** | `POST` |
| **Path** | `/workspaces/:id/invites` |
| **Controller** | Workspace Controller |
| **Service** | Workspace Service |
| **Actors** | Workspace owner |

#### Đầu vào (Request Body)
```json
{
  "email": "string",
  "role": "ADMIN | MEMBER"
}
```

#### Xử lý nội bộ
1. `findMemberByEmail(workspaceId, email)` — Kiểm tra email có phải thành viên chưa.
2. `createInvite(data)` — Tạo bản ghi lời mời với token ngẫu nhiên.
3. `sendInviteEmail(email, token)` — Gửi email chứa link mời.
4. `createAuditLog()` — Ghi nhật ký.

#### Kết quả trả về

| Trường hợp | HTTP Status | Body |
|---|---|---|
| ✅ Mời thành công | `201 Created` | `Invite` |
| ❌ Email đã là thành viên | `409 Conflict` | `{ message: "User is already a member" }` |

---

### UC21 — Accept Invitation (Chấp nhận lời mời)

| Thuộc tính | Giá trị |
|---|---|
| **Method** | `GET` |
| **Path** | `/invites/:token` |
| **Controller** | Workspace Controller |
| **Service** | Workspace Service |
| **Actors** | Khách được mời (qua link email) |

#### Đầu vào
- **Path param**: `token` — Token mời duy nhất trong email

#### Xử lý nội bộ
1. `findInviteByToken(token)` — Xác thực token lời mời.
2. **Nếu chưa có tài khoản**: Redirect sang `/register?inviteToken=token`.
3. **Nếu đã có tài khoản**:
   - `createWorkspaceMember(workspaceId, userId, role)` — Thêm vào workspace.
   - `markInviteUsed(inviteId)` — Đánh dấu lời mời đã dùng.
   - `createNotification(ownerId, MEMBER_ACCEPTED)` — Thông báo cho owner.
   - `createAuditLog()` — Ghi nhật ký.

#### Kết quả trả về

| Trường hợp | HTTP Status | Body |
|---|---|---|
| ✅ Chưa có tài khoản | `302 Redirect` | Redirect `/register?inviteToken=...` |
| ✅ Đã có tài khoản, tham gia thành công | `200 OK` | `{ workspaceId }` |

---

### UC22 — Leave Workspace (Rời workspace)

| Thuộc tính | Giá trị |
|---|---|
| **Method** | `DELETE` |
| **Path** | `/workspaces/:id/members/me` |
| **Controller** | Workspace Controller |
| **Service** | Workspace Service |
| **Actors** | Workspace member |

#### Đầu vào
- **Path param**: `id` — ID workspace

#### Xử lý nội bộ
1. `countOwners(workspaceId)` — Đếm số lượng Owner còn lại.
2. **Nếu là Owner duy nhất**: Từ chối, trả về lỗi.
3. `deleteWorkspaceMember(workspaceId, userId)` — Xoá thành viên.
4. `createAuditLog(action=MEMBER_LEFT)` — Ghi nhật ký.

#### Kết quả trả về

| Trường hợp | HTTP Status | Body |
|---|---|---|
| ✅ Rời thành công | `200 OK` | `{ success: true }` |
| ❌ Là Owner duy nhất | `409 Conflict` | `{ message: "Cannot leave as sole owner" }` |

> **Ghi chú**: Logic xoá thành viên dùng chung hàm `removeMemberInternal()` với UC23, khác nhau ở giá trị `action` trong audit log.

---

### UC23 — Remove Member (Xoá thành viên)

| Thuộc tính | Giá trị |
|---|---|
| **Method** | `DELETE` |
| **Path** | `/workspaces/:id/members/:memberId` |
| **Controller** | Workspace Controller |
| **Service** | Workspace Service |
| **Actors** | Workspace owner / Admin |

#### Đầu vào
- **Path param**: `id` — ID workspace, `memberId` — ID thành viên cần xoá

#### Xử lý nội bộ
1. `findMember(workspaceId, actorId)` — Kiểm tra quyền của người thực hiện.
2. `findMember(workspaceId, memberId)` — Lấy thông tin thành viên bị xoá.
3. Nếu member bị xoá là Owner: `countOwners()` — kiểm tra còn Owner khác không.
4. `deleteWorkspaceMember(workspaceId, memberId)` — Xoá thành viên.
5. `createAuditLog(action=MEMBER_REMOVED)` — Ghi nhật ký.

#### Kết quả trả về

| Trường hợp | HTTP Status | Body |
|---|---|---|
| ✅ Xoá thành công | `200 OK` | `{ removedMemberId }` |
| ❌ Actor không đủ quyền | `403 Forbidden` | `{ message: "Only owner/admin can remove members" }` |
| ❌ Xoá Owner duy nhất | `409 Conflict` | `{ message: "Cannot remove the sole owner" }` |

---

### UC35 — List Workspaces (Xem danh sách workspace)

| Thuộc tính | Giá trị |
|---|---|
| **Method** | `GET` |
| **Path** | `/workspaces` |
| **Controller** | Workspace Controller |
| **Service** | Workspace Service |
| **Actors** | Admin / Workspace owner / Content creator (đã đăng nhập) |

#### Đầu vào
> `userId` lấy từ JWT token.

#### Xử lý nội bộ
1. `findWorkspacesByUserId(userId)` — Lấy tất cả workspace mà user là thành viên (JOIN `workspace_members` với `workspaces`).

#### Kết quả trả về

| Trường hợp | HTTP Status | Body |
|---|---|---|
| ✅ Thành công | `200 OK` | `{ workspaces: Workspace[] }` |

#### Ý nghĩa
Trả về danh sách tất cả workspace mà user đang tham gia, kèm vai trò (OWNER / CONTENT_CREATOR). Dùng cho sidebar hoặc trang chọn workspace sau đăng nhập.

---

### UC36 — Change Member Role (Thay đổi vai trò thành viên)

| Thuộc tính | Giá trị |
|---|---|
| **Method** | `PATCH` |
| **Path** | `/workspaces/:id/members/:memberId` |
| **Controller** | Workspace Controller |
| **Service** | Workspace Service |
| **Actors** | Workspace owner |

#### Đầu vào
- **Path param**: `id` — ID workspace, `memberId` — ID thành viên cần đổi role
- **Request Body**:
```json
{
  "role": "OWNER | CONTENT_CREATOR"
}
```

#### Xử lý nội bộ
1. `findMember(workspaceId, actorId)` — Kiểm tra quyền của người thực hiện (phải là OWNER).
2. `findMember(workspaceId, memberId)` — Lấy thông tin thành viên cần đổi role.
3. **Nếu hạ role Owner cuối cùng**: `countOwners(workspaceId)` — Kiểm tra còn Owner khác không.
4. `updateMemberRole(workspaceId, memberId, newRole)` — Cập nhật vai trò.
5. `createAuditLog()` — Ghi nhật ký.

#### Kết quả trả về

| Trường hợp | HTTP Status | Body |
|---|---|---|
| ✅ Đổi role thành công | `200 OK` | `{ memberId, newRole }` |
| ❌ Không đủ quyền | `403 Forbidden` | `{ message: "Only owner can change roles" }` |
| ❌ Hạ Owner duy nhất | `409 Conflict` | `{ message: "Cannot demote the sole owner" }` |

#### Ý nghĩa
Cho phép Workspace owner thay đổi vai trò thành viên. Bảo vệ workspace luôn có ít nhất một Owner.

---

## Phân hệ 2 — Nội dung & Media

---

### UC05 — Create Content (Tạo bài viết)

| Thuộc tính | Giá trị |
|---|---|
| **Method** | `POST` |
| **Path** | `/posts` |
| **Controller** | Post Controller |
| **Service** | Post Service |
| **Actors** | Content creator |

#### Đầu vào (Request Body)
```json
{
  "workspaceId": "string",
  "title": "string",
  "content": "string",
  "mediaUrls": ["string"] 
}
```
> `creatorId` lấy từ JWT token.

#### Xử lý nội bộ
1. **Validate** dữ liệu đầu vào tại front-end.
2. `createPost(data)` — Tạo bài viết với trạng thái khởi tạo là **`DRAFT`**.
3. `createAuditLog()` — Ghi nhật ký.

#### Kết quả trả về

| Trường hợp | HTTP Status | Body |
|---|---|---|
| ✅ Tạo thành công | `201 Created` | `Post` (trạng thái DRAFT) |

#### Ý nghĩa
Tạo bài viết mới ở trạng thái **nháp (DRAFT)**. Người dùng sẽ được chuyển sang màn hình soạn thảo để tiếp tục chỉnh sửa nội dung.

---

### UC07 — Update Content (Cập nhật bài viết)

| Thuộc tính | Giá trị |
|---|---|
| **Method** | `PATCH` |
| **Path** | `/posts/:id` |
| **Controller** | Post Controller |
| **Service** | Post Service |
| **Actors** | Content creator |

#### Đầu vào
- **Path param**: `id` — ID bài viết
- **Request Body**:
```json
{
  "title": "string (optional)",
  "content": "string (optional)",
  "mediaUrls": ["string (optional)"]
}
```

#### Xử lý nội bộ
1. `findPostById(postId)` — Tìm bài viết, kiểm tra trạng thái.
2. **Nếu bài đã PUBLISHED**: Từ chối cập nhật.
3. `updatePost(postId, data)` — Lưu thay đổi.
4. `createAuditLog()` — Ghi nhật ký.

#### Kết quả trả về

| Trường hợp | HTTP Status | Body |
|---|---|---|
| ✅ Cập nhật thành công | `200 OK` | `Post` (thông tin mới) |
| ❌ Bài viết không thể sửa (đã PUBLISHED) | `403 Forbidden` | `{ message: "Post cannot be edited" }` |

#### Ý nghĩa
Hỗ trợ cả **lưu thủ công** và **auto-save**. Chỉ cho phép sửa khi bài ở trạng thái DRAFT, PENDING, REJECTED — không cho phép sửa bài đã đăng.

---

### UC08 — View Content (Xem chi tiết bài viết)

| Thuộc tính | Giá trị |
|---|---|
| **Method** | `GET` |
| **Path** | `/posts/:id` |
| **Controller** | Post Controller |
| **Service** | Post Service |
| **Actors** | Workspace member |

#### Đầu vào
- **Path param**: `id` — ID bài viết

#### Xử lý nội bộ
1. `findPostById(postId)` — Lấy thông tin bài viết.
2. `findApprovalHistoryByPost(postId)` — Lấy lịch sử duyệt bài.
3. `findScheduledPostsByPost(postId)` — Lấy danh sách lịch đăng bài đã đặt.

#### Kết quả trả về

| Trường hợp | HTTP Status | Body |
|---|---|---|
| ✅ Thành công | `200 OK` | `{ post, history: ApprovalHistory[], schedules: ScheduledPost[] }` |

#### Ý nghĩa
Trả về toàn bộ thông tin chi tiết bài viết bao gồm: nội dung, lịch sử duyệt và các lịch đăng bài liên quan.

---

### UC09 — Search Content (Tìm kiếm bài viết)

| Thuộc tính | Giá trị |
|---|---|
| **Method** | `GET` |
| **Path** | `/posts` |
| **Controller** | Post Controller |
| **Service** | Post Service |
| **Actors** | Workspace member |

#### Đầu vào (Query Params)
| Param | Kiểu | Mô tả |
|---|---|---|
| `workspaceId` | `string` | ID workspace (bắt buộc) |
| `keyword` | `string` | Từ khoá tìm kiếm |
| `status` | `string` | Lọc theo trạng thái (DRAFT, PENDING, APPROVED, ...) |
| `creatorId` | `string` | Lọc theo người tạo |
| `page` | `number` | Trang hiện tại |
| `limit` | `number` | Số bản ghi mỗi trang |

#### Xử lý nội bộ
1. `findPostsByFilters(workspaceId, filters)` — Truy vấn DB với các điều kiện lọc + phân trang.

#### Kết quả trả về

| Trường hợp | HTTP Status | Body |
|---|---|---|
| ✅ Thành công | `200 OK` | `{ posts: Post[], total: number }` |

---

### UC10 — Delete Content (Xoá bài viết)

| Thuộc tính | Giá trị |
|---|---|
| **Method** | `DELETE` |
| **Path** | `/posts/:id` |
| **Controller** | Post Controller |
| **Service** | Post Service |
| **Actors** | Content creator / Workspace owner |

#### Đầu vào
- **Path param**: `id` — ID bài viết

#### Xử lý nội bộ
1. `findPostById(postId)` — Lấy thông tin và trạng thái bài viết.
2. **Nếu trạng thái `SCHEDULED`**: Huỷ job trong hàng đợi `BullMQ` trước (`cancelScheduledJob(postId)`).
3. `softDeletePost(postId)` — Đánh dấu `deletedAt = now()` (xoá mềm).
4. `createAuditLog()` — Ghi nhật ký.

#### Kết quả trả về

| Trường hợp | HTTP Status | Body |
|---|---|---|
| ✅ Xoá thành công | `200 OK` | `{ success: true }` |

#### Ý nghĩa
Xoá mềm bài viết. Nếu bài đang **lên lịch**, job trong queue sẽ bị huỷ trước để tránh đăng bài sau khi xoá.

---

### UC37 — Upload Media (Tải lên file media)

| Thuộc tính | Giá trị |
|---|---|
| **Method** | `POST` |
| **Path** | `/workspaces/:id/media` |
| **Controller** | Media Controller |
| **Service** | Media Service |
| **Actors** | Content creator / Workspace member |

#### Đầu vào
- **Path param**: `id` — ID workspace
- **Request Body** (multipart/form-data):
| Field | Kiểu | Mô tả |
|---|---|---|
| `file` | `File` | File ảnh hoặc video (bắt buộc) |
| `tags` | `string` | Tag phân loại (tuỳ chọn) |

#### Xử lý nội bộ
1. **Validate** loại file (chỉ chấp nhận image/video) và kích thước (giới hạn tuỳ cấu hình).
2. `uploadToCloudinary(file)` — Upload file lên **Cloudinary**, nhận về URL + metadata.
3. `createMediaAsset({ workspaceId, url, type, mimeType, size, tags, createdById })` — Lưu bản ghi media vào DB.
4. `createAuditLog()` — Ghi nhật ký.

#### Kết quả trả về

| Trường hợp | HTTP Status | Body |
|---|---|---|
| ✅ Upload thành công | `201 Created` | `MediaAsset` (url, type, size, ...) |
| ❌ File không hợp lệ (sai định dạng / quá lớn) | `400 Bad Request` | `{ message: "Invalid file type or size exceeded" }` |

#### Ý nghĩa
Upload file media lên Cloudinary và lưu thông tin vào DB. File sau khi upload có thể được đính kèm vào bài viết thông qua `mediaUrls` khi tạo/cập nhật bài.

---

## Phân hệ 2.3 — Duyệt bài

---

### UC11 — Submit for Approval (Gửi duyệt bài viết)

| Thuộc tính | Giá trị |
|---|---|
| **Method** | `POST` |
| **Path** | `/posts/:id/submit` |
| **Controller** | Post Controller |
| **Service** | Post Service |
| **Actors** | Content creator |

#### Đầu vào
- **Path param**: `id` — ID bài viết cần gửi duyệt
> `submitterId` lấy từ JWT token.

#### Xử lý nội bộ
1. `findPostById(postId)` — Lấy thông tin bài viết.
2. `updatePostStatus(postId, PENDING, details)` — Cập nhật trạng thái sang **PENDING**.
3. `createNotification(ownerId, POST_PENDING)` — Gửi thông báo cho Owner.
4. `createAuditLog()` — Ghi nhật ký.

#### Kết quả trả về

| Trường hợp | HTTP Status | Body |
|---|---|---|
| ✅ Gửi duyệt thành công | `200 OK` | `Post` (trạng thái PENDING) |

#### Ý nghĩa
Chuyển bài viết từ DRAFT sang trạng thái **chờ duyệt (PENDING)**. Owner sẽ nhận thông báo để tiến hành review.

---

### UC14 — Review Content (Duyệt / Từ chối bài viết)

| Thuộc tính | Giá trị |
|---|---|
| **Method** | `POST` |
| **Path** | `/posts/:id/review` |
| **Controller** | Post Controller |
| **Service** | Post Service |
| **Actors** | Workspace owner |

#### Đầu vào
- **Path param**: `id` — ID bài viết
- **Request Body**:
```json
{
  "action": "APPROVE | REJECT",
  "reason": "string (bắt buộc nếu REJECT)"
}
```

#### Xử lý nội bộ — Trường hợp APPROVE
1. `updatePostStatus(postId, APPROVED, details)` — Cập nhật trạng thái.
2. `createApprovalHistory(postId, reviewerId, APPROVE)` — Lưu lịch sử duyệt.
3. `createNotification(creatorId, POST_APPROVED)` — Thông báo cho người tạo.
4. `createAuditLog()` — Ghi nhật ký.

#### Xử lý nội bộ — Trường hợp REJECT
1. `updatePostStatus(postId, REJECTED, details)` — Cập nhật trạng thái.
2. `createApprovalHistory(postId, reviewerId, REJECT, reason)` — Lưu lịch sử từ chối kèm lý do.
3. `createNotification(creatorId, POST_REJECTED)` — Thông báo cho người tạo.
4. `createAuditLog()` — Ghi nhật ký.

#### Kết quả trả về

| Trường hợp | HTTP Status | Body |
|---|---|---|
| ✅ Duyệt thành công | `200 OK` | `{ status: "APPROVED" }` |
| ✅ Từ chối thành công | `200 OK` | `{ status: "REJECTED" }` |

#### Ý nghĩa
Workspace owner ra quyết định phê duyệt hoặc từ chối bài viết. Kết quả được lưu lại trong `approval_histories` để theo dõi.

---

## Phân hệ 3 — AI Content

---

### UC06 — Generate AI Content (Sinh nội dung bằng AI)

| Thuộc tính | Giá trị |
|---|---|
| **Method** | `POST` |
| **Path** | `/workspaces/:id/ai/generate-text` |
| **Controller** | AI Controller |
| **Service** | AI Service |
| **Actors** | Content creator / Workspace member |

#### Đầu vào
- **Path param**: `id` — ID workspace
- **Request Body**:
```json
{
  "prompt": "string",
  "tone": "string (optional)",
  "platform": "string (optional)"
}
```

#### Xử lý nội bộ
1. `findWorkspaceById(workspaceId)` — Kiểm tra số dư credit của workspace.
2. `findBrandVoiceByWorkspace(workspaceId)` — Lấy cấu hình Brand Voice để đưa vào prompt.
3. `generateText(prompt)` — Gọi **OpenAI API** sinh nội dung.
4. **Nếu thành công**:
   - `deductCredit(workspaceId, cost)` — Trừ credit.
   - `createAiGeneration({ status: SUCCESS })` — Lưu lịch sử generation.
   - `createAuditLog()` — Ghi nhật ký.
5. **Nếu thất bại**:
   - `createAiGeneration({ status: FAILED })` — Lưu lịch sử generation với trạng thái lỗi.

#### Kết quả trả về

| Trường hợp | HTTP Status | Body |
|---|---|---|
| ✅ Sinh nội dung thành công | `200 OK` | `{ generationId, content: string }` |
| ❌ Lỗi từ OpenAI | `502 Bad Gateway` | `{ message: "AI generation failed" }` |

#### Ý nghĩa
Tích hợp OpenAI để sinh nội dung marketing theo brand voice của workspace. Mỗi lần sinh thành công sẽ trừ credit. Toàn bộ lịch sử generation (cả thành công lẫn thất bại) đều được lưu lại.

---

## Phân hệ 4 — Kết nối & Đăng bài

---

### UC27 — View Connected Channels (Xem kênh đã kết nối)

| Thuộc tính | Giá trị |
|---|---|
| **Method** | `GET` |
| **Path** | `/workspaces/:id/channels` |
| **Controller** | Channel Controller |
| **Service** | Channel Service |
| **Actors** | Workspace member |

#### Đầu vào
- **Path param**: `id` — ID workspace

#### Xử lý nội bộ
1. `findChannelsByWorkspace(workspaceId)` — Lấy tất cả kênh mạng xã hội đã kết nối.

#### Kết quả trả về

| Trường hợp | HTTP Status | Body |
|---|---|---|
| ✅ Thành công | `200 OK` | `{ channels: ChannelConnection[] }` |

---

### UC28 — Connect Social Channel (Kết nối kênh mạng xã hội)

Hỗ trợ **2 kịch bản**:

#### Kịch bản 1: Kết nối Facebook thật

| Thuộc tính | Giá trị |
|---|---|
| **Method** | `POST` |
| **Path** | `/channels/facebook/connect` |
| **Actors** | Workspace owner |

##### Đầu vào (Request Body)
```json
{
  "workspaceId": "string",
  "pageId": "string",
  "pageAccessToken": "string",
  "appId": "string",
  "appSecret": "string"
}
```

##### Xử lý nội bộ
1. `verifyPageAccessToken(pageId, accessToken)` — Gọi **Facebook API** để xác thực token.
2. **Nếu token không hợp lệ**: Ghi log thất bại, trả về lỗi.
3. `encryptToken(accessToken)`, `encryptSecret(appSecret)` — Mã hoá thông tin nhạy cảm trước khi lưu.
4. `upsertChannelConnection({ platform: FB, encryptedToken, appId, ... })` — Lưu kết nối (INSERT hoặc UPDATE nếu đã tồn tại).
5. `createAuditLog(CONNECT_SUCCESS)` — Ghi nhật ký.

##### Kết quả trả về

| Trường hợp | HTTP Status | Body |
|---|---|---|
| ✅ Kết nối thành công | `201 Created` | `ConnectionRecord` |
| ❌ Token không hợp lệ | `400 Bad Request` | `{ message: "Invalid page access token" }` |

#### Kịch bản 2: Kết nối kênh giả lập (Simulation)

| Thuộc tính | Giá trị |
|---|---|
| **Method** | `POST` |
| **Path** | `/channels/simulate` |

##### Đầu vào (Request Body)
```json
{
  "workspaceId": "string",
  "channelName": "string",
  "platform": "string"
}
```

##### Xử lý nội bộ
1. `upsertChannelConnection({ type: SIMULATED, ... })` — Tạo kênh giả lập, không cần xác thực API ngoài.
2. `createAuditLog()` — Ghi nhật ký.

##### Kết quả trả về

| Trường hợp | HTTP Status | Body |
|---|---|---|
| ✅ Kết nối giả lập thành công | `201 Created` | `ConnectionRecord` |

#### Ý nghĩa
Cho phép kết nối tài khoản mạng xã hội thật hoặc tạo kênh giả lập phục vụ demo/kiểm thử mà không cần tài khoản Facebook thật.

---

### UC29 — Disconnect Channel (Ngắt kết nối kênh)

| Thuộc tính | Giá trị |
|---|---|
| **Method** | `DELETE` |
| **Path** | `/channels/:id` |
| **Controller** | Channel Controller |
| **Service** | Channel Service |
| **Actors** | Workspace owner |

#### Đầu vào
- **Path param**: `id` — ID kênh cần ngắt kết nối

#### Xử lý nội bộ
1. `cancelScheduledPostsByChannel(channelId)` — Huỷ tất cả lịch đăng bài liên quan đến kênh này (status = CANCELLED).
2. Huỷ các job trong hàng đợi **BullMQ** tương ứng.
3. `deleteChannelConnection(channelId)` — Xoá bản ghi kết nối.
4. `createAuditLog()` — Ghi nhật ký.

#### Kết quả trả về

| Trường hợp | HTTP Status | Body |
|---|---|---|
| ✅ Ngắt kết nối thành công | `200 OK` | `{ success: true }` |

#### Ý nghĩa
Ngắt liên kết mạng xã hội. Tất cả lịch đăng bài sắp tới của kênh này sẽ bị huỷ để tránh lỗi khi job chạy.

---

### UC12 — Schedule Content (Lên lịch đăng bài)

| Thuộc tính | Giá trị |
|---|---|
| **Method** | `POST` |
| **Path** | `/posts/:id/schedule` |
| **Controller** | Post Controller |
| **Service** | Post Service |
| **Actors** | Workspace owner / Admin |

#### Đầu vào
- **Path param**: `id` — ID bài viết (phải ở trạng thái **APPROVED**)
- **Request Body**:
```json
{
  "channels": [
    {
      "channelId": "string",
      "scheduledAt": "ISO8601 datetime"
    }
  ]
}
```

#### Xử lý nội bộ
1. `findPostById(postId)` — Xác nhận bài viết ở trạng thái APPROVED.
2. **Loop qua từng kênh được chọn**:
   - `createScheduledPost(data)` — Tạo bản ghi lịch đăng (INSERT vào `scheduled_posts`).
   - `enqueuePublishJob(scheduledPostId, runAt)` — Đẩy job vào **BullMQ** với thời gian trì hoãn tương ứng.
3. `updatePostStatus(postId, SCHEDULED)` — Cập nhật trạng thái bài viết thành SCHEDULED.
4. `createAuditLog()` — Ghi nhật ký.

#### Kết quả trả về

| Trường hợp | HTTP Status | Body |
|---|---|---|
| ✅ Lên lịch thành công | `201 Created` | `ScheduledPost[]` (danh sách lịch đã tạo) |

#### Ý nghĩa
Lên lịch đăng bài tự động lên một hoặc nhiều kênh. Mỗi kênh tạo ra một job riêng trong queue, được kích hoạt đúng thời điểm `scheduledAt`.

---

### UC13 — View Content Schedule / Calendar (Xem lịch đăng bài)

| Thuộc tính | Giá trị |
|---|---|
| **Method** | `GET` |
| **Path** | `/workspaces/:id/schedule` |
| **Controller** | Post Controller |
| **Service** | Post Service |
| **Actors** | Workspace member |

#### Đầu vào (Query Params)
| Param | Kiểu | Mô tả |
|---|---|---|
| `month` | `number` | Tháng cần xem (1–12) |
| `year` | `number` | Năm cần xem |

#### Xử lý nội bộ
1. `findScheduledPostsByRange(workspaceId, from, to)` — Lấy tất cả lịch đăng trong khoảng thời gian (JOIN với `posts`, `channel_connections`).

#### Kết quả trả về

| Trường hợp | HTTP Status | Body |
|---|---|---|
| ✅ Thành công | `200 OK` | `{ scheduledPosts: ScheduledPost[] }` |

#### Ý nghĩa
Trả về dữ liệu hiển thị trên giao diện **Lịch (Calendar)**, mỗi ô ngày chứa danh sách bài viết được lên lịch đăng ngày đó.

---

### UC38 — Cancel Scheduled Post (Huỷ lịch đăng bài)

| Thuộc tính | Giá trị |
|---|---|
| **Method** | `DELETE` |
| **Path** | `/posts/:id/schedule/:scheduleId` |
| **Controller** | Post Controller |
| **Service** | Post Service |
| **Actors** | Workspace owner / Admin |

#### Đầu vào
- **Path param**: `id` — ID bài viết, `scheduleId` — ID lịch đăng cần huỷ

#### Xử lý nội bộ
1. `findScheduledPostById(scheduleId)` — Lấy thông tin lịch đăng, xác nhận thuộc bài viết `id`.
2. **Nếu trạng thái đã PUBLISHED**: Từ chối huỷ.
3. `cancelBullMQJob(scheduleId)` — Huỷ job trong hàng đợi **BullMQ**.
4. `updateScheduledPostStatus(scheduleId, CANCELLED)` — Cập nhật trạng thái lịch đăng.
5. `checkAndUpdatePostOverallStatus(postId)` — Kiểm tra và cập nhật trạng thái tổng thể bài viết (nếu tất cả lịch đăng đã huỷ, chuyển bài viết về APPROVED).
6. `createAuditLog()` — Ghi nhật ký.

#### Kết quả trả về

| Trường hợp | HTTP Status | Body |
|---|---|---|
| ✅ Huỷ thành công | `200 OK` | `{ success: true }` |
| ❌ Lịch đăng đã publish | `409 Conflict` | `{ message: "Cannot cancel a published schedule" }` |

#### Ý nghĩa
Huỷ một lịch đăng bài cụ thể. Job tương ứng trong BullMQ sẽ bị xoá để tránh đăng bài. Nếu bài viết không còn lịch đăng nào, trạng thái sẽ quay về APPROVED.

---

### UC15 — Publish Now (Đăng bài ngay lập tức)

| Thuộc tính | Giá trị |
|---|---|
| **Method** | `POST` |
| **Path** | `/posts/:id/publish` |
| **Controller** | Post Controller |
| **Service** | Post Service |
| **Actors** | Workspace owner / Content creator |

#### Đầu vào
- **Path param**: `id` — ID bài viết (phải ở trạng thái **APPROVED**)
- **Request Body**:
```json
{
  "channelId": "string"
}
```

#### Xử lý nội bộ
1. `findPostById(postId)` — Lấy bài viết (APPROVED).
2. `findChannelById(channelId)` — Lấy thông tin kênh Facebook.
3. `publishToFacebook(pageToken, content)` — Gọi **Facebook Graph API** đăng bài.
4. **Nếu thành công**:
   - `updatePostStatus(postId, PUBLISHED)` — Cập nhật trạng thái.
   - `createAuditLog()` — Ghi nhật ký.
5. **Nếu thất bại**:
   - `updatePostStatus(postId, FAILED, errorMsg)` — Ghi nhận thất bại.
   - `createAuditLog()` — Ghi nhật ký.

#### Kết quả trả về

| Trường hợp | HTTP Status | Body |
|---|---|---|
| ✅ Đăng bài thành công | `200 OK` | `Post` (trạng thái PUBLISHED) |
| ❌ Lỗi Facebook API | `502 Bad Gateway` | `{ message: "Publish failed" }` |

---

## Phân hệ 5 — Brand Voice

---

### UC24/UC25 — Create / Update Brand Voice (Tạo / Cập nhật Brand Voice)

| Thuộc tính | Giá trị |
|---|---|
| **Method** | `PUT` |
| **Path** | `/workspaces/:id/brand-voice` |
| **Controller** | Brand Voice Controller |
| **Service** | Brand Voice Service |
| **Actors** | Workspace owner |

#### Đầu vào
- **Path param**: `id` — ID workspace
- **Request Body**:
```json
{
  "industry": "string",
  "targetAudience": "string",
  "keywords": ["string"],
  "writingStyle": "string",
  "sampleContent": "string (optional)"
}
```

#### Xử lý nội bộ
1. `findBrandVoiceByWorkspace(workspaceId)` — Kiểm tra brand voice đã tồn tại chưa.
2. `upsertBrandVoiceRecord(workspaceId, data)` — INSERT nếu chưa có, UPDATE nếu đã có.
3. `createAuditLog()` — Ghi nhật ký.

#### Kết quả trả về

| Trường hợp | HTTP Status | Body |
|---|---|---|
| ✅ Lưu thành công (tạo mới hoặc cập nhật) | `200 OK` | `BrandVoice` |

#### Ý nghĩa
Dùng một endpoint duy nhất (`PUT` = upsert) để xử lý cả tạo mới lẫn cập nhật Brand Voice. Brand Voice được sử dụng như context khi sinh nội dung bằng AI (UC06).

---

### UC26 — View Brand Voice (Xem Brand Voice)

| Thuộc tính | Giá trị |
|---|---|
| **Method** | `GET` |
| **Path** | `/workspaces/:id/brand-voice` |
| **Controller** | Brand Voice Controller |
| **Service** | Brand Voice Service |
| **Actors** | Workspace member |

#### Đầu vào
- **Path param**: `id` — ID workspace

#### Xử lý nội bộ
1. `findBrandVoiceByWorkspace(workspaceId)` — Lấy cấu hình Brand Voice.

#### Kết quả trả về

| Trường hợp | HTTP Status | Body |
|---|---|---|
| ✅ Thành công | `200 OK` | `BrandVoice` |

---

## Phân hệ 6 — Credit & PayOS

---

### UC30 — Purchase Credits (Mua credit)

Bao gồm **2 luồng song song**: Tạo đơn hàng + Webhook xác nhận thanh toán.

#### Luồng 1: Tạo đơn hàng & lấy link thanh toán

| Thuộc tính | Giá trị |
|---|---|
| **Method** | `POST` |
| **Path** | `/workspaces/:id/orders` |
| **Controller** | Order Controller |
| **Service** | Order Service |
| **Actors** | Workspace owner |

##### Đầu vào
- **Path param**: `id` — ID workspace
- **Request Body**:
```json
{
  "packageId": "string",
  "amount": "number",
  "creditAmount": "number"
}
```

##### Xử lý nội bộ
1. `createOrderRecord(data)` — Tạo đơn hàng với trạng thái **PENDING**.
2. `createPayosPaymentLink(orderCode, amount)` — Gọi **PayOS API** tạo link thanh toán.
3. `createAuditLog()` — Ghi nhật ký.

##### Kết quả trả về

| Trường hợp | HTTP Status | Body |
|---|---|---|
| ✅ Tạo đơn thành công | `201 Created` | `{ payUrl, qrCode }` |

---

#### Luồng 2: Webhook xác nhận thanh toán (từ PayOS)

| Thuộc tính | Giá trị |
|---|---|
| **Method** | `POST` |
| **Path** | `/payos/webhook` |
| **Actors** | PayOS (bên thứ ba gọi vào) |

##### Xử lý nội bộ
1. `verifyPayosSignature()` — Xác thực chữ ký webhook để tránh giả mạo.
2. `findOrderByCode(orderCode)` — Tìm đơn hàng.
3. `updateOrderStatus(orderCode, PAID)` — Cập nhật trạng thái đơn.
4. `addCredit(workspaceId, creditAmount)` — Cộng credit vào workspace (UPDATE `workspaces` + INSERT `credit_transactions`).
5. `createNotification(ownerId, ORDER_COMPLETED)` — Thông báo nạp tiền thành công.
6. `createAuditLog()` — Ghi nhật ký.

##### Kết quả trả về

| Trường hợp | HTTP Status | Body |
|---|---|---|
| ✅ Xác nhận thành công | `200 OK` | `{}` (xác nhận cho PayOS) |

---

#### Luồng 3: Polling trạng thái đơn hàng

| Thuộc tính | Giá trị |
|---|---|
| **Method** | `GET` |
| **Path** | `/orders/:code` |

##### Đầu vào
- **Path param**: `code` — Mã đơn hàng

##### Kết quả trả về

| Trường hợp | HTTP Status | Body |
|---|---|---|
| ✅ Thành công | `200 OK` | `{ status: "PENDING | PAID | FAILED" }` |

#### Ý nghĩa (toàn bộ UC30)
Luồng thanh toán QR code qua PayOS. Front-end hiển thị QR và **polling** mỗi 5 giây để kiểm tra trạng thái. PayOS tự động gọi webhook sau khi khách chuyển khoản thành công. Credit được cộng ngay vào workspace khi webhook xác nhận.

---

## Phân hệ 7 — Admin

---

### UC31 — View Dashboard & Audit Log

#### Kịch bản 1: Xem thống kê Dashboard

| Thuộc tính | Giá trị |
|---|---|
| **Method** | `GET` |
| **Path** | `/admin/dashboard` hoặc `/workspaces/:id/dashboard` |
| **Controller** | Admin Controller |
| **Service** | Admin Service |
| **Actors** | System Admin / Workspace owner |

##### Đầu vào
- **Query param**: `workspaceId` — tuỳ chọn (nếu bỏ trống = thống kê toàn hệ thống)

##### Xử lý nội bộ
1. **Nếu là Admin hệ thống**: `aggregateUsersAndWorkspaces()` — Đếm tổng user và workspace.
2. `aggregateCreditAndRevenue(workspaceId?)` — Tổng hợp doanh thu từ `orders`/`credit_transactions`.

##### Kết quả trả về

| Trường hợp | HTTP Status | Body |
|---|---|---|
| ✅ Thành công | `200 OK` | `{ stats: StatsData }` (biểu đồ, tổng số liệu) |

---

#### Kịch bản 2: Xem nhật ký hệ thống (Audit Log)

| Thuộc tính | Giá trị |
|---|---|
| **Method** | `GET` |
| **Path** | `/admin/audit-logs` |

##### Đầu vào (Query Params)
| Param | Mô tả |
|---|---|
| `userId` | Lọc theo người thực hiện |
| `action` | Lọc theo loại hành động |
| `workspaceId` | Lọc theo workspace |
| `from` / `to` | Khoảng thời gian |
| `page` / `limit` | Phân trang |

##### Xử lý nội bộ
1. `findAuditLogsByFilters(filters)` — Truy vấn `audit_logs` JOIN `users` theo bộ lọc.

##### Kết quả trả về

| Trường hợp | HTTP Status | Body |
|---|---|---|
| ✅ Thành công | `200 OK` | `{ logs: AuditLog[], total: number }` |

#### Ý nghĩa
Cung cấp khả năng giám sát toàn bộ hoạt động hệ thống. Admin hệ thống thấy toàn bộ dữ liệu; Workspace owner thấy dữ liệu trong phạm vi workspace của mình.

---

## Phân hệ 8 — Notification

---

### UC39 — List Notifications (Xem danh sách thông báo)

| Thuộc tính | Giá trị |
|---|---|
| **Method** | `GET` |
| **Path** | `/notifications` |
| **Controller** | Notification Controller |
| **Service** | Notification Service |
| **Actors** | Admin / Workspace owner / Content creator (đã đăng nhập) |

#### Đầu vào (Query Params)
| Param | Kiểu | Mô tả |
|---|---|---|
| `isRead` | `boolean` | Lọc theo trạng thái đã đọc (tuỳ chọn) |
| `page` | `number` | Trang hiện tại |
| `limit` | `number` | Số bản ghi mỗi trang |

> `userId` lấy từ JWT token.

#### Xử lý nội bộ
1. `findNotificationsByUserId(userId, filters)` — Truy vấn notifications của user, sắp xếp mới nhất trước, hỗ trợ phân trang.

#### Kết quả trả về

| Trường hợp | HTTP Status | Body |
|---|---|---|
| ✅ Thành công | `200 OK` | `{ notifications: Notification[], total: number, unreadCount: number }` |

#### Ý nghĩa
Trả về danh sách thông báo của user kèm số lượng chưa đọc. Hỗ trợ lọc theo trạng thái và phân trang.

---

### UC40 — Mark Notification as Read (Đánh dấu đã đọc)

| Thuộc tính | Giá trị |
|---|---|
| **Method** | `PATCH` |
| **Path** | `/notifications/:id/read` |
| **Controller** | Notification Controller |
| **Service** | Notification Service |
| **Actors** | Admin / Workspace owner / Content creator (đã đăng nhập) |

#### Đầu vào
- **Path param**: `id` — ID thông báo

#### Xử lý nội bộ
1. `findNotificationById(id)` — Tìm thông báo, kiểm tra thuộc về user hiện tại.
2. `updateNotification(id, { isRead: true })` — Đánh dấu đã đọc.

#### Kết quả trả về

| Trường hợp | HTTP Status | Body |
|---|---|---|
| ✅ Thành công | `200 OK` | `{ success: true }` |
| ❌ Thông báo không tồn tại / không thuộc user | `404 Not Found` | `{ message: "Notification not found" }` |

---

### UC41 — Mark All Notifications as Read (Đánh dấu tất cả đã đọc)

| Thuộc tính | Giá trị |
|---|---|
| **Method** | `PATCH` |
| **Path** | `/notifications/read-all` |
| **Controller** | Notification Controller |
| **Service** | Notification Service |
| **Actors** | Admin / Workspace owner / Content creator (đã đăng nhập) |

#### Đầu vào
> `userId` lấy từ JWT token. Không có request body.

#### Xử lý nội bộ
1. `markAllNotificationsRead(userId)` — Cập nhật tất cả thông báo chưa đọc của user thành đã đọc (`UPDATE notifications SET isRead=true WHERE userId=userId AND isRead=false`).

#### Kết quả trả về

| Trường hợp | HTTP Status | Body |
|---|---|---|
| ✅ Thành công | `200 OK` | `{ updatedCount: number }` |

#### Ý nghĩa
Đánh dấu tất cả thông báo chưa đọc thành đã đọc. Thường được gọi khi user nhấn "Đánh dấu tất cả đã đọc" trên giao diện.

---

## Phân hệ 9 — Credit Package Management

---

### UC42 — List Credit Packages (Xem danh sách gói credit)

| Thuộc tính | Giá trị |
|---|---|
| **Method** | `GET` |
| **Path** | `/credit-packages` |
| **Controller** | Credit Package Controller |
| **Service** | Credit Package Service |
| **Actors** | Tất cả user (public, không cần đăng nhập cho danh sách active) |

#### Đầu vào (Query Params)
| Param | Kiểu | Mô tả |
|---|---|---|
| `includeInactive` | `boolean` | Nếu `true`, trả cả gói bị ẩn (chỉ Admin) |

#### Xử lý nội bộ
1. **Nếu là Admin và `includeInactive=true`**: `findAllCreditPackages()` — Lấy tất cả gói (kể cả inactive, trừ đã xoá mềm).
2. **Mặc định**: `findActiveCreditPackages()` — Chỉ lấy gói `isActive=true AND deletedAt IS NULL`, sắp xếp theo `sortOrder`.

#### Kết quả trả về

| Trường hợp | HTTP Status | Body |
|---|---|---|
| ✅ Thành công | `200 OK` | `{ packages: CreditPackage[] }` |

#### Ý nghĩa
Trả về danh sách gói credit để hiển thị trên trang nạp tiền. Admin hệ thống có thể xem cả gói bị ẩn.

---

### UC43 — Create Credit Package (Tạo gói credit mới)

| Thuộc tính | Giá trị |
|---|---|
| **Method** | `POST` |
| **Path** | `/credit-packages` |
| **Controller** | Credit Package Controller |
| **Service** | Credit Package Service |
| **Actors** | System Admin |

#### Đầu vào (Request Body)
```json
{
  "name": "string",
  "description": "string (optional)",
  "creditAmount": "number",
  "price": "number",
  "sortOrder": "number (optional, default: 0)"
}
```

#### Xử lý nội bộ
1. `findCreditPackageByName(name)` — Kiểm tra tên gói đã tồn tại chưa.
2. `createCreditPackageRecord(data)` — Tạo bản ghi gói credit.
3. `createAuditLog()` — Ghi nhật ký.

#### Kết quả trả về

| Trường hợp | HTTP Status | Body |
|---|---|---|
| ✅ Tạo thành công | `201 Created` | `CreditPackage` |
| ❌ Tên gói đã tồn tại | `409 Conflict` | `{ message: "Package name already exists" }` |
| ❌ Không phải Admin | `403 Forbidden` | `{ message: "Admin access required" }` |

#### Ý nghĩa
System Admin tạo gói credit mới để người dùng có thể mua. Mỗi gói xác định số credit nhận được và giá tiền tương ứng.

---

### UC44 — Update Credit Package (Cập nhật gói credit)

| Thuộc tính | Giá trị |
|---|---|
| **Method** | `PATCH` |
| **Path** | `/credit-packages/:id` |
| **Controller** | Credit Package Controller |
| **Service** | Credit Package Service |
| **Actors** | System Admin |

#### Đầu vào
- **Path param**: `id` — ID gói credit
- **Request Body**:
```json
{
  "name": "string (optional)",
  "description": "string (optional)",
  "creditAmount": "number (optional)",
  "price": "number (optional)",
  "sortOrder": "number (optional)",
  "isActive": "boolean (optional)"
}
```

#### Xử lý nội bộ
1. `findCreditPackageById(id)` — Kiểm tra gói tồn tại.
2. `updateCreditPackageRecord(id, data)` — Cập nhật thông tin gói.
3. `createAuditLog()` — Ghi nhật ký.

#### Kết quả trả về

| Trường hợp | HTTP Status | Body |
|---|---|---|
| ✅ Cập nhật thành công | `200 OK` | `CreditPackage` (thông tin mới) |
| ❌ Gói không tồn tại | `404 Not Found` | `{ message: "Credit package not found" }` |

#### Ý nghĩa
Cho phép Admin chỉnh sửa tên, mô tả, giá tiền, số credit, thứ tự hiển thị và trạng thái ẩn/hiện của gói credit. Có thể dùng `isActive: false` để tạm ẩn gói mà không cần xoá.

---

### UC45 — Delete Credit Package (Xoá gói credit)

| Thuộc tính | Giá trị |
|---|---|
| **Method** | `DELETE` |
| **Path** | `/credit-packages/:id` |
| **Controller** | Credit Package Controller |
| **Service** | Credit Package Service |
| **Actors** | System Admin |

#### Đầu vào
- **Path param**: `id` — ID gói credit cần xoá

#### Xử lý nội bộ
1. `findCreditPackageById(id)` — Kiểm tra gói tồn tại.
2. `softDeleteCreditPackage(id)` — Đánh dấu `deletedAt = now()` (xoá mềm).
3. `createAuditLog()` — Ghi nhật ký.

#### Kết quả trả về

| Trường hợp | HTTP Status | Body |
|---|---|---|
| ✅ Xoá thành công | `200 OK` | `{ success: true }` |
| ❌ Gói không tồn tại | `404 Not Found` | `{ message: "Credit package not found" }` |

#### Ý nghĩa
Xoá mềm gói credit. Gói đã xoá sẽ không hiển thị cho người dùng nhưng vẫn giữ lại trong DB để truy vết các đơn hàng liên quan.

---

### UC46 — View Credit Balance & History (Xem số dư và lịch sử credit)

| Thuộc tính | Giá trị |
|---|---|
| **Method** | `GET` |
| **Path** | `/workspaces/:id/credits` |
| **Controller** | Credit Controller |
| **Service** | Credit Service |
| **Actors** | Workspace member |

#### Đầu vào
- **Path param**: `id` — ID workspace
- **Query Params**:

| Param | Kiểu | Mô tả |
|---|---|---|
| `page` | `number` | Trang hiện tại |
| `limit` | `number` | Số bản ghi mỗi trang |

#### Xử lý nội bộ
1. `findWorkspaceById(workspaceId)` — Lấy thông tin workspace (bao gồm `remainingCredit`, `monthlyQuota`).
2. `findCreditTransactionsByWorkspace(workspaceId, pagination)` — Lấy lịch sử giao dịch credit có phân trang.

#### Kết quả trả về

| Trường hợp | HTTP Status | Body |
|---|---|---|
| ✅ Thành công | `200 OK` | `{ remainingCredit, monthlyQuota, transactions: CreditTransaction[], total: number }` |

#### Ý nghĩa
Trả về số dư credit hiện tại và lịch sử giao dịch (nạp tiền, trừ credit khi dùng AI, hoàn tiền...) của workspace.

---

## Phụ lục — Background Worker (BullMQ Job Processor)

> Đây **không phải API** do người dùng gọi trực tiếp. Đây là tiến trình nền tự động chạy khi đến thời điểm `runAt` của một `ScheduledPost`.

### Worker: processPublishJob(scheduledPostId)

#### Kích hoạt bởi
BullMQ Queue — khi job đến hạn `runAt` (được đặt bởi UC12).

#### Luồng xử lý
1. `findScheduledPostById(scheduledPostId)` — Lấy thông tin lịch đăng.
2. `findChannelById(channelId)` — Lấy thông tin kênh.
3. **Kênh thật (Facebook)**: Gọi `publishToFacebook(pageToken, content)`.
4. **Kênh giả lập**: Gọi `simulatePublish(content)` với delay 2 giây.

#### Trường hợp thành công
- `updateScheduledPostStatus(id, PUBLISHED)` — Cập nhật trạng thái lịch đăng.
- `checkAndUpdatePostOverallStatus(postId)` — Cập nhật trạng thái bài viết tổng thể nếu tất cả kênh đã đăng.
- `createAuditLog()` — Ghi nhật ký.

#### Trường hợp thất bại
- `updateScheduledPostStatus(id, FAILED, errorMsg)` — Ghi nhận lỗi.
- `checkAndUpdatePostOverallStatus(postId)` — Cập nhật trạng thái bài viết.
- `createNotification(ownerId, PUBLISH_FAILED)` — Thông báo lỗi cho owner.
- `createAuditLog()` — Ghi nhật ký.

#### Ý nghĩa
Thực hiện đăng bài tự động theo lịch đã đặt. Hỗ trợ cả kênh Facebook thật lẫn kênh mô phỏng. Thất bại sẽ được ghi nhận và chủ workspace nhận thông báo để xử lý kịp thời.

---

## Tổng hợp nhanh — Danh sách Endpoint

| # | Method | Path | Mô tả |
|---|---|---|---|
| UC01 | POST | `/auth/register` | Đăng ký tài khoản |
| UC02 | POST | `/auth/login` | Đăng nhập |
| UC03 | POST | `/auth/logout` | Đăng xuất |
| UC33 | POST | `/auth/refresh-token` | Làm mới access token |
| UC34 | GET | `/auth/verify-email` | Xác thực email |
| UC04 | PATCH | `/users/me/password` | Đổi mật khẩu |
| UC32 | PATCH | `/users/me` | Cập nhật hồ sơ cá nhân |
| UC35 | GET | `/workspaces` | Xem danh sách workspace |
| UC16 | POST | `/workspaces` | Tạo workspace |
| UC17 | PATCH | `/workspaces/:id` | Cập nhật workspace |
| UC18 | DELETE | `/workspaces/:id` | Xoá workspace |
| UC19 | GET | `/workspaces/:id/members` | Xem thành viên workspace |
| UC20 | POST | `/workspaces/:id/invites` | Mời thành viên |
| UC21 | GET | `/invites/:token` | Chấp nhận lời mời |
| UC22 | DELETE | `/workspaces/:id/members/me` | Rời workspace |
| UC23 | DELETE | `/workspaces/:id/members/:memberId` | Xoá thành viên |
| UC36 | PATCH | `/workspaces/:id/members/:memberId` | Thay đổi vai trò thành viên |
| UC05 | POST | `/posts` | Tạo bài viết |
| UC07 | PATCH | `/posts/:id` | Cập nhật bài viết |
| UC08 | GET | `/posts/:id` | Xem chi tiết bài viết |
| UC09 | GET | `/posts` | Tìm kiếm bài viết |
| UC10 | DELETE | `/posts/:id` | Xoá bài viết |
| UC37 | POST | `/workspaces/:id/media` | Upload file media |
| UC11 | POST | `/posts/:id/submit` | Gửi bài viết lên duyệt |
| UC14 | POST | `/posts/:id/review` | Duyệt / Từ chối bài viết |
| UC12 | POST | `/posts/:id/schedule` | Lên lịch đăng bài |
| UC13 | GET | `/workspaces/:id/schedule` | Xem lịch đăng (Calendar) |
| UC38 | DELETE | `/posts/:id/schedule/:scheduleId` | Huỷ lịch đăng bài |
| UC15 | POST | `/posts/:id/publish` | Đăng bài ngay |
| UC06 | POST | `/workspaces/:id/ai/generate-text` | Sinh nội dung AI |
| UC27 | GET | `/workspaces/:id/channels` | Xem kênh đã kết nối |
| UC28a | POST | `/channels/facebook/connect` | Kết nối Facebook thật |
| UC28b | POST | `/channels/simulate` | Kết nối kênh giả lập |
| UC29 | DELETE | `/channels/:id` | Ngắt kết nối kênh |
| UC24/25 | PUT | `/workspaces/:id/brand-voice` | Tạo/Cập nhật Brand Voice |
| UC26 | GET | `/workspaces/:id/brand-voice` | Xem Brand Voice |
| UC30a | POST | `/workspaces/:id/orders` | Tạo đơn mua credit |
| UC30b | POST | `/payos/webhook` | Webhook xác nhận thanh toán |
| UC30c | GET | `/orders/:code` | Polling trạng thái đơn hàng |
| UC46 | GET | `/workspaces/:id/credits` | Xem số dư & lịch sử credit |
| UC42 | GET | `/credit-packages` | Xem danh sách gói credit |
| UC43 | POST | `/credit-packages` | Tạo gói credit |
| UC44 | PATCH | `/credit-packages/:id` | Cập nhật gói credit |
| UC45 | DELETE | `/credit-packages/:id` | Xoá gói credit |
| UC31a | GET | `/admin/dashboard` | Xem thống kê Dashboard |
| UC31b | GET | `/admin/audit-logs` | Xem nhật ký hệ thống |
| UC39 | GET | `/notifications` | Xem danh sách thông báo |
| UC40 | PATCH | `/notifications/:id/read` | Đánh dấu thông báo đã đọc |
| UC41 | PATCH | `/notifications/read-all` | Đánh dấu tất cả đã đọc |
