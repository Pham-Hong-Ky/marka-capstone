# Phân hệ 1 — Xác thực, Hồ sơ & Workspace

> [Quay lại Mục lục](README.md)
>
> **Phạm vi:** toàn bộ phần đã có trong code: đăng ký, đăng nhập (email/mật khẩu + Google), logout, refresh token, hồ sơ cá nhân, đổi mật khẩu, workspace, thành viên, lời mời.
> Mã nguồn: `backend/src/modules/auth`, `modules/user`, `modules/workspace`, `middlewares/auth.ts`, `utils/jwt.ts`, `utils/cookies.ts`, `utils/password.ts`.

---

## 1.1. Đăng ký (UC01)

`POST /auth/register` — công khai, rate limit `authLimiter` (15 request/15 phút/IP, bỏ qua khi test).

### Validation

| Field | Kiểu | Ràng buộc |
| :--- | :--- | :--- |
| `email` | string | email hợp lệ, `trim`, chuyển lowercase |
| `password` | string | 8–100 ký tự, chứa ít nhất 1 chữ cái và 1 chữ số |
| `name` | string | 2–100 ký tự, `trim` |

### Xử lý

1. Nếu email đã tồn tại → `409` `"Email này đã được đăng ký trong hệ thống"`.
2. Hash mật khẩu bằng bcrypt (10 salt rounds).
3. Trong **một transaction**: tạo `User` (`authProvider = LOCAL`, `systemRole = USER`, `emailVerified = false`) → tạo `Workspace` tên `Workspace của <name>` (các giá trị `plan = FREE`, `remainingCredit = 100`, `monthlyQuota = 100` lấy từ default của schema) → tạo `WorkspaceMember(role = OWNER, allowDirectPublish = true)`.
4. Ghi audit `USER_REGISTER` (kèm `workspaceId`, `metadata { email, name }`).
5. Cấp cặp token, đặt refresh token vào cookie `refreshToken`.

### Response `201`

```json
{
  "status": "success",
  "message": "Đăng ký tài khoản thành công",
  "data": {
    "accessToken": "<jwt>",
    "user": {
      "id": "uuid",
      "email": "user@marka.vn",
      "name": "Nguyễn Văn A",
      "avatar": null,
      "systemRole": "USER",
      "emailVerified": false,
      "workspaces": [
        {
          "id": "uuid",
          "name": "Workspace của Nguyễn Văn A",
          "plan": "FREE",
          "role": "OWNER",
          "remainingCredit": 100,
          "monthlyQuota": 100
        }
      ]
    }
  }
}
```

- Refresh token **không** nằm trong body, chỉ nằm trong cookie `HttpOnly`.
- Không có bước xác thực email; đăng ký xong dùng được ngay.

### Lỗi

| Mã | Trường hợp |
| :--- | :--- |
| `409` | Email đã tồn tại |
| `422` | Sai schema (email sai, mật khẩu yếu, tên quá ngắn...) |
| `429` | Vượt `authLimiter` |

---

## 1.2. Đăng nhập (UC02)

`POST /auth/login` — công khai, rate limit `loginLimiter` (5 lần **thất bại**/15 phút theo `IP:email`, bỏ qua khi test).

### Validation

| Field | Ràng buộc |
| :--- | :--- |
| `email` | email hợp lệ, `trim`, lowercase |
| `password` | không rỗng |

### Xử lý

1. Tìm user theo email; so khớp mật khẩu bằng bcrypt.
2. Sai email **hoặc** sai mật khẩu → cùng một lỗi `401` `"Email hoặc mật khẩu không chính xác"` (không tiết lộ email tồn tại).
3. Tài khoản chỉ đăng nhập bằng Google (`passwordHash = null`) cũng nhận đúng lỗi `401` này khi thử đăng nhập mật khẩu.
4. `isSuspended = true` → `403` `"Tài khoản của bạn đã bị tạm khóa"` (kiểm tra **sau** khi mật khẩu đúng).
5. Ghi audit `USER_LOGIN`, cấp token, đặt cookie refresh token.

### Response `200`

```json
{
  "status": "success",
  "message": "Đăng nhập thành công",
  "data": {
    "accessToken": "<jwt>",
    "user": { "id": "uuid", "email": "...", "name": "...", "avatar": null, "systemRole": "USER", "emailVerified": false, "workspaces": [] }
  }
}
```

### Lỗi

| Mã | Trường hợp |
| :--- | :--- |
| `401` | Sai email/mật khẩu |
| `403` | Tài khoản bị tạm khoá |
| `422` | Sai schema |
| `429` | Sai quá 5 lần/15 phút cho cùng `IP:email` |

---

## 1.3. Đăng nhập Google (UC03)

`POST /auth/google` — công khai, dùng chung `authLimiter`.

### Validation

| Field | Ràng buộc |
| :--- | :--- |
| `idToken` | chuỗi không rỗng — Google ID token do frontend lấy từ Google Identity |

### Xử lý

1. Verify `idToken` với `google-auth-library` (`audience = GOOGLE_CLIENT_ID`). Token sai/hết hạn → `401` `"Xác thực tài khoản Google không hợp lệ"`.
2. Thiếu email trong payload → `401` `"Không thể lấy thông tin email từ Google"`.
3. **Bắt buộc `email_verified = true`** → nếu không, `401` `"Email Google chưa được xác minh"` (chống chiếm tài khoản khi liên kết theo email).
4. Tìm user theo email (lowercase):
   - **Chưa có** → tạo `User` (`authProvider = GOOGLE`, `googleId`, `avatar`, `emailVerified = true`, **không có `passwordHash`**) + workspace mặc định như đăng ký local.
   - **Đã có, đang bị khoá** → `403`.
   - **Đã có `googleId`** → đăng nhập luôn (không cập nhật avatar, không đối chiếu `sub` của token với `googleId` đã lưu).
   - **Đã có nhưng chưa liên kết Google** → gắn `googleId`, giữ avatar cũ nếu có, đặt `emailVerified = true`. `authProvider` **giữ nguyên** (vẫn là `LOCAL` nếu tài khoản tạo bằng mật khẩu).
5. Ghi audit `USER_GOOGLE_LOGIN`, cấp token, đặt cookie.

### Response `200`

Cùng cấu trúc `POST /auth/login`, message `"Đăng nhập Google thành công"`.

---

## 1.4. Đăng xuất (UC04)

`POST /auth/logout` — yêu cầu `Authorization: Bearer <accessToken>`.

- Body `{ "refreshToken": "..." }` **không bắt buộc và hiện không được dùng**; logout thu hồi theo **tài khoản**, không theo từng phiên.
- Xử lý: tăng `User.tokenVersion` lên 1 → mọi access/refresh token cũ mất hiệu lực; xoá cookie `refreshToken`; ghi audit `USER_LOGOUT`.
- Response `200` `"Đăng xuất thành công"` (không có `data`).

---

## 1.5. Refresh token (UC34)

`POST /auth/refresh-token` — không cần access token.

### Đầu vào

Token lấy theo thứ tự: cookie `refreshToken` → `body.refreshToken`. Body là tuỳ chọn.

### Xử lý & lỗi

| Trường hợp | Kết quả |
| :--- | :--- |
| Không có token | `401` `"Refresh token không được để trống"` |
| Token sai chữ ký/hết hạn | `401` `"Refresh token không hợp lệ hoặc đã hết hạn"` |
| User không tồn tại hoặc `tokenVersion` khác token | `401` `"Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại"` |
| Tài khoản bị tạm khoá | `403` `"Tài khoản của bạn đã bị tạm khóa"` |

Thành công: cấp **access token mới** và **refresh token mới** (cùng `tokenVersion`), ghi đè cookie.

```json
{
  "status": "success",
  "message": "Làm mới token thành công",
  "data": { "accessToken": "<jwt>" }
}
```

Không có rotation theo từng phiên hay phát hiện reuse: refresh token cũ vẫn dùng được cho tới khi hết hạn hoặc `tokenVersion` thay đổi.

---

## 1.6. Token, cookie & middleware xác thực

### Token

| Loại | Secret | Hạn mặc định | Payload |
| :--- | :--- | :--- | :--- |
| Access | `JWT_ACCESS_SECRET` | `JWT_ACCESS_EXPIRES_IN` = `15m` | `{ id, email, systemRole, tokenVersion }` |
| Refresh | `JWT_REFRESH_SECRET` | `JWT_REFRESH_EXPIRES_IN` = `7d` | `{ id, tokenVersion }` |

### Cookie refresh token

`HttpOnly: true`; `Secure` + `SameSite=None` khi `NODE_ENV=production`, ngược lại `SameSite=Lax`; `path=/`; `maxAge` **cố định 7 ngày** (không đọc theo `JWT_REFRESH_EXPIRES_IN`).

### `requireAuth`

1. Thiếu header hoặc không đúng dạng `Bearer ` → `401` `"Vui lòng đăng nhập để tiếp tục"`.
2. Verify JWT; sai/hết hạn → `401` `"Token không hợp lệ hoặc đã hết hạn"`.
3. Nạp user từ DB **mỗi request**; không tồn tại → `401` `"Tài khoản không tồn tại"`.
4. `isSuspended` → `403` `"Tài khoản của bạn đã bị tạm khóa"`; `tokenVersion` lệch → `401` `"Phiên đăng nhập đã hết hiệu lực. Vui lòng đăng nhập lại"`.
5. Gán `req.user = { id, email, name, avatar, systemRole, tokenVersion, isSuspended, emailVerified }`.

### `optionalAuth`

Dùng cho `GET /invites/:token`: nếu có Bearer hợp lệ thì gán `req.user`; mọi lỗi token đều bị bỏ qua (chỉ log warn) và request tiếp tục như khách.

---

## 1.7. Hồ sơ cá nhân (UC33)

### `GET /users/me`

Yêu cầu `requireAuth`.

```json
{
  "status": "success",
  "message": "Lấy thông tin tài khoản thành công",
  "data": {
    "id": "uuid",
    "email": "user@marka.vn",
    "name": "Nguyễn Văn A",
    "avatar": null,
    "systemRole": "USER",
    "emailVerified": false,
    "workspaces": [ { "id": "uuid", "name": "...", "plan": "FREE", "role": "OWNER", "remainingCredit": 100, "monthlyQuota": 100 } ]
  }
}
```

- Không trả `passwordHash`, `googleId`, `tokenVersion`, `isSuspended`.
- `workspaces` lấy từ toàn bộ `WorkspaceMember` của user (map qua `toWorkspaceSummary`); danh sách này **không lọc workspace đã xoá mềm** (khác với `GET /workspaces`) vì điều kiện xoá mềm không áp dụng cho dữ liệu nạp lồng qua `include`.

### `PATCH /users/me`

| Field | Ràng buộc |
| :--- | :--- |
| `name` | 2–100 ký tự, tuỳ chọn |
| `avatar` | URL hợp lệ hoặc `null` (xoá avatar), tuỳ chọn |

- **Không có upload avatar**: `avatar` là URL do client cung cấp, không đi qua Cloudinary.
- Cả hai field đều tuỳ chọn; body rỗng vẫn hợp lệ (không có ràng buộc "ít nhất một field").
- Ghi audit `USER_UPDATE_PROFILE`.
- Response `200` trả subset: `{ id, email, name, avatar, systemRole, emailVerified, updatedAt }` — **không kèm `workspaces`**.

---

## 1.8. Đổi mật khẩu (UC05)

`PATCH /users/me/password` — yêu cầu `requireAuth`.

### Validation

| Field | Ràng buộc |
| :--- | :--- |
| `oldPassword` | không rỗng |
| `newPassword` | 8–100 ký tự, có ít nhất 1 chữ cái và 1 chữ số |

### Xử lý & lỗi

1. Không tìm thấy user → `404` `"Người dùng không tồn tại"`.
2. `passwordHash = null` (tài khoản tạo bằng Google) → `400` `"Tài khoản liên kết mạng xã hội không thể đổi mật khẩu trực tiếp"`.
3. Mật khẩu cũ sai → `401` `"Mật khẩu cũ không chính xác"`.
4. Hash mật khẩu mới, cập nhật DB, **tăng `tokenVersion`** → mọi token cũ (kể cả access token đang dùng) hết hiệu lực ở request kế tiếp; ghi audit `USER_CHANGE_PASSWORD`.
5. Response `200`: `"Đổi mật khẩu thành công. Vui lòng đăng nhập lại trên các thiết bị khác"` (không có `data`).

Không kiểm tra `newPassword` khác `oldPassword`, không có OTP/email xác nhận.

---

## 1.9. Workspace (UC17, UC18, UC19, UC35)

### `POST /workspaces` (UC17)

Yêu cầu `requireAuth`.

| Field | Ràng buộc |
| :--- | :--- |
| `name` | 2–100 ký tự, `trim` |

- Trùng tên với workspace khác **cùng owner** (chưa xoá mềm) → `409` `"Bạn đã có workspace trùng tên này"`.
- Transaction: tạo `Workspace` + `WorkspaceMember(role = OWNER, allowDirectPublish = true)`.
- Ghi audit `WORKSPACE_CREATE`.
- Response `201` trả `WorkspaceSummary`: `{ id, name, plan, role, remainingCredit, monthlyQuota }`.

### `GET /workspaces` (UC35)

Yêu cầu `requireAuth`. Trả các workspace user là thành viên, **bỏ qua workspace đã xoá mềm**, sắp xếp theo ngày tham gia tăng dần.

```json
{ "status": "success", "message": "Lấy danh sách workspace thành công", "data": { "workspaces": [ { "id": "uuid", "name": "...", "plan": "FREE", "role": "OWNER", "remainingCredit": 100, "monthlyQuota": 100 } ] } }
```

### `PATCH /workspaces/:workspaceId` (UC18)

Yêu cầu `requireAuth` + `OWNER`.

| Field | Ràng buộc |
| :--- | :--- |
| `name` | 2–100 ký tự, tuỳ chọn |

- Body phải có `name` → nếu không: `422` `"Cần cung cấp tên workspace để cập nhật"`.
- Workspace không tồn tại/đã xoá → `404` `"Workspace không tồn tại"`.
- **Không kiểm tra trùng tên khi cập nhật** (chỉ kiểm tra lúc tạo).
- Ghi audit `WORKSPACE_UPDATE` với `metadata` là body.
- Response `200`: `{ id, name, plan, remainingCredit, monthlyQuota }` — **không có `role`**.

### `DELETE /workspaces/:workspaceId` (UC19)

Yêu cầu `requireAuth` + `OWNER`.

- Transaction: chuyển toàn bộ `ChannelConnection` chưa `EXPIRED` sang `EXPIRED`, đặt `Workspace.deletedAt = now`.
- **Xoá mềm**: thành viên, lời mời, bài viết, media vẫn còn trong DB nhưng workspace không còn hiện ở `GET /workspaces` và các API có kiểm tra workspace (sửa/xoá workspace, thành viên, Brand Voice, lời mời) trả `404`. API bài viết/kênh chỉ kiểm tra membership nên thành viên cũ vẫn gọi được nếu còn `workspaceId` — xem ghi chú ở [02](./02-content-media.md#29-lỗi-thường-gặp).
- Ghi audit `WORKSPACE_DELETE` (bản ghi này **không kèm `workspaceId`** vì workspace đã bị xoá mềm).
- Response `200`: `data = { "success": true }`.
- Không có endpoint khôi phục.

### Logo workspace (đã bỏ)

> Workspace dùng icon mặc định ở frontend; không còn endpoint upload logo, không còn audit `WORKSPACE_LOGO_UPDATE`. Cột `Workspace.logo` đã được xoá khỏi `schema.prisma` bằng migration `remove_workspace_logo`.

---

## 1.10. Thành viên workspace (UC20, UC23, UC24, UC36)

### `GET /workspaces/:workspaceId/members` (UC20)

Yêu cầu `requireAuth` + là thành viên (không giới hạn vai trò).

```json
{
  "status": "success",
  "message": "Lấy danh sách thành viên thành công",
  "data": {
    "members": [
      { "memberId": "uuid", "userId": "uuid", "name": "Nguyễn Văn A", "email": "user@marka.vn", "avatar": null, "role": "OWNER", "status": "ACTIVE", "joinedAt": "2026-10-20T12:00:00.000Z" }
    ],
    "pendingInvites": [
      { "inviteId": "uuid", "email": "member@marka.vn", "role": "CONTENT_CREATOR", "status": "PENDING", "invitedAt": "2026-10-20T12:00:00.000Z", "expiresAt": "2026-10-27T12:00:00.000Z" }
    ]
  }
}
```

`WorkspaceMember.allowDirectPublish` là cột reserved trong DB, **không có trong response** và chưa được dùng để phân quyền.

- `members` sắp xếp theo ngày tham gia tăng dần; `status` luôn là `"ACTIVE"` (giá trị cố định, không lưu DB).
- `pendingInvites` chỉ gồm lời mời `isUsed = false` và còn hạn, mới nhất trước.
- **`memberId` là id bản ghi `WorkspaceMember`**, còn hai API sửa/xoá bên dưới nhận **`userId`** ở cùng vị trí path — client phải dùng đúng trường.

### `DELETE /workspaces/:workspaceId/members/me` (UC23)

Yêu cầu `requireAuth` + là thành viên.

- Không phải thành viên → `404` `"Bạn không phải là thành viên của workspace này"`.
- Là `OWNER` và là Owner duy nhất → `409` `"Bạn là Owner duy nhất. Hãy chuyển quyền hoặc xóa workspace"`.
- Xoá bản ghi `WorkspaceMember`, ghi audit `MEMBER_LEFT`; response `200` `{ success: true }`.

### `DELETE /workspaces/:workspaceId/members/:memberId` (UC24)

Yêu cầu `requireAuth` + `OWNER`; `:memberId` là **userId**.

- Không phải thành viên → `404` `"Thành viên không tồn tại trong workspace"`.
- Xoá Owner cuối cùng → `409` `"Không thể xóa Owner duy nhất của workspace"`.
- Xoá membership, ghi audit `MEMBER_REMOVED`; response `200` `{ "removedMemberId": "<userId>" }`.
- **Không** chặn Owner tự xoá chính mình nếu còn Owner khác.

### `PATCH /workspaces/:workspaceId/members/:memberId` (UC36)

Yêu cầu `requireAuth` + `OWNER`; `:memberId` là **userId**.

| Field | Ràng buộc |
| :--- | :--- |
| `role` | `OWNER` hoặc `CONTENT_CREATOR` |

- Không phải thành viên → `404` `"Thành viên không tồn tại trong workspace"`.
- Vai trò mới trùng vai trò cũ → trả luôn `{ memberId, userId, role }` (không ghi audit).
- Hạ vai trò Owner cuối cùng (`OWNER → CONTENT_CREATOR` khi chỉ còn 1 Owner) → `409` `"Không thể hạ vai trò Owner duy nhất của workspace"`.
- Ghi audit `MEMBER_ROLE_CHANGED` (`metadata { from, to }`).
- **Không** cập nhật `allowDirectPublish` khi đổi vai trò.

---

## 1.11. Lời mời tham gia (UC21, UC22)

### `POST /workspaces/:workspaceId/invites` (UC21)

Yêu cầu `requireAuth` + `OWNER`.

| Field | Ràng buộc |
| :--- | :--- |
| `email` | email hợp lệ, `trim`, lowercase, ≤ 255 |
| `role` | `OWNER` hoặc `CONTENT_CREATOR`, mặc định `CONTENT_CREATOR` |

Xử lý theo thứ tự:

1. Workspace không tồn tại/đã xoá → `404` `"Workspace không tồn tại"`.
2. Nếu email đã có tài khoản và đã là thành viên → `409` `"Email này đã là thành viên của workspace"`.
3. Tìm lời mời đang chờ cùng email (`isUsed = false`, còn hạn):
   - Có → sẽ **cấp lại token + hạn mới** (token cũ hết hiệu lực), cập nhật luôn `role`.
   - Chưa → tạo lời mời mới.
4. Token = `randomUUID()`, hạn **7 ngày**, link `${APP_BASE_URL}/invites/<token>`.
5. **Gửi email trước, lưu DB sau**: gửi thất bại (Resend lỗi hoặc chưa cấu hình `RESEND_API_KEY`) → `502` `"Gửi email mời thất bại. Vui lòng thử lại."` và **không** tạo/cập nhật lời mời.
6. Ghi audit `MEMBER_INVITED` (`metadata { email, role, resent }`).

Response `201`:

```json
{
  "status": "success",
  "message": "Đã tạo lời mời tham gia workspace",
  "data": {
    "invite": { "inviteId": "uuid", "email": "member@marka.vn", "role": "CONTENT_CREATOR", "expiresAt": "2026-10-27T12:00:00.000Z" },
    "inviteUrl": "http://localhost:5173/invites/<token>"
  }
}
```

`inviteUrl` được trả về để tiện test/dev; trong production link thật nằm trong email.

### `GET /invites/:token` (UC22)

Công khai, dùng `optionalAuth` (có thể gọi khi chưa đăng nhập).

Thứ tự kiểm tra & lỗi:

| Trường hợp | Kết quả |
| :--- | :--- |
| Token không tồn tại hoặc workspace đã xoá mềm | `404` `"Lời mời không tồn tại"` |
| `isUsed = true` | `409` `"Lời mời đã được sử dụng"` |
| `expiresAt < now` | `409` `"Lời mời đã hết hạn"` |
| Chưa đăng nhập | `200` `{ requiresRegistration: true, email, workspaceName }` |
| Đã đăng nhập nhưng email khác email được mời | `403` `"Lời mời này dành cho một email khác"` |
| Đã là thành viên workspace | `200`, đánh dấu lời mời đã dùng, `{ workspaceId, workspaceName, alreadyMember: true }` |
| Hợp lệ | Tham gia workspace, `{ workspaceId, workspaceName }` |

Khi tham gia thành công (nhánh cuối):

- Transaction đánh dấu `isUsed = true` + tạo `WorkspaceMember` (kèm `allowDirectPublish = role === 'OWNER'`); nếu lời mời đã bị dùng đồng thời ở request khác thì trả `409` `"Lời mời đã được sử dụng"`.
- Ghi audit `MEMBER_JOINED`.
- Tạo notification `MEMBER_JOINED` cho **các Owner còn lại** (trừ người vừa tham gia) với `payload { workspaceId, userId, role }`. Không gửi email cho sự kiện này.

Luồng chưa đăng nhập: frontend nhận `requiresRegistration` → chuyển sang trang đăng ký → sau khi đăng ký, gọi lại endpoint này bằng token mới.

---

## 1.12. Bảng tổng hợp endpoint

| Method | Path | Xác thực | Vai trò |
| :--- | :--- | :--- | :--- |
| POST | `/auth/register` | — | — |
| POST | `/auth/login` | — | — |
| POST | `/auth/google` | — | — |
| POST | `/auth/logout` | Bearer | User |
| POST | `/auth/refresh-token` | Cookie/body | — |
| GET | `/users/me` | Bearer | User |
| PATCH | `/users/me` | Bearer | User |
| PATCH | `/users/me/password` | Bearer | User |
| POST | `/workspaces` | Bearer | User |
| GET | `/workspaces` | Bearer | User |
| PATCH | `/workspaces/:workspaceId` | Bearer | OWNER |
| DELETE | `/workspaces/:workspaceId` | Bearer | OWNER |
| GET | `/workspaces/:workspaceId/members` | Bearer | Thành viên |
| DELETE | `/workspaces/:workspaceId/members/me` | Bearer | Thành viên |
| PATCH | `/workspaces/:workspaceId/members/:memberId` | Bearer | OWNER |
| DELETE | `/workspaces/:workspaceId/members/:memberId` | Bearer | OWNER |
| POST | `/workspaces/:workspaceId/invites` | Bearer | OWNER |
| GET | `/invites/:token` | Optional | — |

---

## 1.13. Audit log phát sinh trong phân hệ

| Action | Khi nào | `targetType` |
| :--- | :--- | :--- |
| `USER_REGISTER` | Đăng ký local | `User` |
| `USER_LOGIN` / `USER_GOOGLE_LOGIN` | Đăng nhập | `User` |
| `USER_LOGOUT` | Logout | `User` |
| `USER_UPDATE_PROFILE` | Cập nhật hồ sơ | `User` |
| `USER_CHANGE_PASSWORD` | Đổi mật khẩu | `User` |
| `WORKSPACE_CREATE` / `WORKSPACE_UPDATE` / `WORKSPACE_DELETE` | Thao tác workspace | `Workspace` |
| `MEMBER_INVITED` | Gửi/gửi lại lời mời | `WorkspaceInvite` |
| `MEMBER_JOINED` | Chấp nhận lời mời | `WorkspaceMember` |
| `MEMBER_LEFT` / `MEMBER_REMOVED` / `MEMBER_ROLE_CHANGED` | Rời/xoá/đổi vai trò | `WorkspaceMember` |

Đọc audit log qua `GET /admin/audit-logs` (SYSTEM_ADMIN) hoặc `GET /workspaces/:workspaceId/audit-logs` (OWNER) — xem [07](./07-admin-analytics.md).

---

## 1.14. Chưa triển khai (Roadmap)

- Quên mật khẩu / đặt lại mật khẩu qua email.
- Upload avatar người dùng (hiện chỉ nhận URL).
- Đổi email (cần OTP), xoá tài khoản.
- Quản trị user: khoá/mở khoá (`isSuspended` có trong schema nhưng không có API), đổi `systemRole`.
- Refresh token rotation & phát hiện reuse theo từng phiên.
- 2FA, đăng nhập mạng xã hội khác ngoài Google.
