# API Documentation — Marka

> **Nguồn sự thật:** `backend/src/routes/index.ts`, các file `*.validation.ts`, `*.controller.ts`, `*.service.ts`.
> Tài liệu chỉ liệt kê endpoint **đang tồn tại trong code**. Base URL: `/api/v1`.
> Swagger UI: `GET /api-docs` (chỉ bật khi `NODE_ENV !== "production"`).

## Quy ước chung

- Request/response dùng JSON (trừ upload ảnh dùng `multipart/form-data`).
- Access token gửi qua header: `Authorization: Bearer <accessToken>`.
- API đa tenant nhận workspace qua một trong các cách: header `x-workspace-id`, param `:workspaceId`, query `workspaceId`, hoặc body `workspaceId`. Nếu dùng cả header và param thì **hai giá trị phải trùng nhau**.
- Response thành công:

```json
{ "status": "success", "message": "...", "data": { } }
```

- Response lỗi:

```json
{ "status": "fail", "message": "..." }
```

- Lỗi validation (Zod) trả `422`:

```json
{
  "status": "fail",
  "message": "Dữ liệu không hợp lệ",
  "errors": [{ "field": "email", "message": "Email không hợp lệ" }]
}
```

- `status` = `success` | `fail` (4xx) | `error` (5xx).
- Thời gian trong DB/API là UTC (ISO-8601).

### Bảng mã lỗi thường gặp

| Mã | Khi nào |
| :--- | :--- |
| `400` | Thiếu file, file sai định dạng/quá dung lượng, tham số không hợp lệ |
| `401` | Thiếu/sai access token, token hết hạn, sai mật khẩu, refresh token không hợp lệ |
| `403` | Không phải thành viên workspace, không đủ vai trò, tài khoản bị tạm khoá |
| `404` | Không tìm thấy workspace/bài viết/kênh/thành viên/lời mời |
| `409` | Email đã tồn tại, trùng tên workspace, chuyển trạng thái không hợp lệ, lời mời đã dùng/hết hạn, còn 1 Owner |
| `422` | Dữ liệu không đúng schema Zod |
| `429` | Vượt rate limit |
| `500` | Lỗi không xác định |
| `502` | Gửi email mời thất bại |

---

## 1. Health

### `GET /health`

Công khai. Kiểm tra DB (`SELECT 1`) và Redis (`PING`).

**Response 200**

```json
{
  "status": "success",
  "message": "Hệ thống Marka đang hoạt động ổn định",
  "data": {
    "uptime": 123.45,
    "database": "connected",
    "redis": "connected",
    "memoryUsage": 104857600,
    "timestamp": "2026-10-20T12:00:00.000Z",
    "version": "1.0.0"
  }
}
```

Nếu DB hoặc Redis lỗi, controller trả `503` với `status: "error"`, message `"Hệ thống đang gặp sự cố kết nối"` và cùng cấu trúc `data` (`database`/`redis` = `"error"` hoặc `"disconnected"`).

---

## 2. Auth

### `POST /auth/register`

Rate limit: `authLimiter` (15 request/15 phút/IP).

**Body**

| Field | Kiểu | Ràng buộc |
| :--- | :--- | :--- |
| `email` | string | email hợp lệ, trim, lowercase |
| `password` | string | 8–100 ký tự, có ít nhất 1 chữ cái và 1 chữ số |
| `name` | string | 2–100 ký tự |

```json
{
  "email": "user@marka.vn",
  "password": "password123",
  "name": "Nguyễn Văn A"
}
```

**Xử lý**

1. Kiểm tra email đã tồn tại → `409`.
2. Hash mật khẩu bcrypt (10 rounds).
3. Tạo `User` + `Workspace` mặc định (`Workspace của <name>`, plan `FREE`) + `WorkspaceMember` role `OWNER`, `allowDirectPublish=true` trong 1 transaction.
4. Ghi audit `USER_REGISTER`.
5. Cấp access token + refresh token; refresh token ghi vào cookie `refreshToken` (HttpOnly).

**Response 201**

```json
{
  "status": "success",
  "message": "Đăng ký tài khoản thành công",
  "data": {
    "accessToken": "eyJ...",
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

Cookie: `refreshToken=<jwt>; HttpOnly; SameSite=Lax; Path=/; Max-Age=604800` (production: `Secure; SameSite=None`).

### `POST /auth/login`

Rate limit: `loginLimiter` — tối đa 5 lần **sai**/15 phút theo `IP:email`.

**Body**

```json
{ "email": "user@marka.vn", "password": "password123" }
```

**Xử lý**: tìm user theo email → verify bcrypt → chặn nếu `isSuspended` → ghi audit `USER_LOGIN` → cấp token.

**Response 200**: giống `register`, message `"Đăng nhập thành công"`.
**Lỗi**: `401` `"Email hoặc mật khẩu không chính xác"`; `403` `"Tài khoản của bạn đã bị tạm khóa"`.

### `POST /auth/google`

Rate limit: `authLimiter`.

**Body**

```json
{ "idToken": "eyJhbGciOiJSUzI1NiIs..." }
```

**Xử lý**

1. Verify `idToken` với `GOOGLE_CLIENT_ID`; lỗi → `401`.
2. Bắt buộc `payload.email` và `payload.email_verified=true`.
3. Tìm user theo email:
   - chưa có → tạo user `authProvider=GOOGLE`, `googleId`, `emailVerified=true`, kèm workspace mặc định;
   - đã có và chưa có `googleId` → liên kết Google;
   - đã có `googleId` → đăng nhập.
4. Chặn `isSuspended`; ghi audit `USER_GOOGLE_LOGIN`.

**Response 200**: giống `login`, message `"Đăng nhập Google thành công"`.

### `POST /auth/logout`

Yêu cầu `requireAuth`. Body không bắt buộc và **không được dùng** (có thể bỏ trống hoặc gửi `{ "refreshToken": "..." }`).

**Xử lý**: tăng `User.tokenVersion` lên 1 (mọi access/refresh token cũ mất hiệu lực), ghi audit `USER_LOGOUT`, xoá cookie `refreshToken`.

**Response 200**

```json
{ "status": "success", "message": "Đăng xuất thành công" }
```

### `POST /auth/refresh-token`

Không yêu cầu access token. Refresh token lấy từ cookie `refreshToken` hoặc body `{ "refreshToken": "..." }`.

**Xử lý**: verify JWT refresh → tìm user → so `tokenVersion` với DB → chặn `isSuspended` → cấp cặp token mới, set lại cookie.

**Response 200**

```json
{
  "status": "success",
  "message": "Làm mới token thành công",
  "data": { "accessToken": "eyJ..." }
}
```

**Lỗi**: `401` nếu thiếu/sai/hết hạn token hoặc `tokenVersion` không khớp.

---

## 3. User

### `GET /users/me`

Yêu cầu `requireAuth`.

**Response 200**

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
    "workspaces": []
  }
}
```

### `PATCH /users/me`

Yêu cầu `requireAuth`.

**Body** (ít nhất một field)

| Field | Kiểu | Ràng buộc |
| :--- | :--- | :--- |
| `name` | string? | 2–100 ký tự |
| `avatar` | string \| null? | URL hợp lệ |

**Response 200**

```json
{
  "status": "success",
  "message": "Cập nhật thông tin tài khoản thành công",
  "data": {
    "id": "uuid",
    "email": "user@marka.vn",
    "name": "Nguyễn Văn B",
    "avatar": "https://example.com/avatar.jpg",
    "systemRole": "USER",
    "emailVerified": false,
    "updatedAt": "2026-10-20T12:00:00.000Z"
  }
}
```

Ghi audit `USER_UPDATE_PROFILE`.

### `PATCH /users/me/password`

Yêu cầu `requireAuth`.

**Body**

```json
{ "oldPassword": "password123", "newPassword": "newPassword456" }
```

`newPassword`: 8–100 ký tự, có chữ cái và chữ số.

**Xử lý**: kiểm tra mật khẩu cũ → hash mới → cập nhật → tăng `tokenVersion` (đăng xuất các thiết bị khác) → audit `USER_CHANGE_PASSWORD`.

**Response 200**

```json
{
  "status": "success",
  "message": "Đổi mật khẩu thành công. Vui lòng đăng nhập lại trên các thiết bị khác"
}
```

**Lỗi**: `401` `"Mật khẩu cũ không chính xác"`; `400` nếu tài khoản Google không có `passwordHash`.

---

## 4. Workspace

### `POST /workspaces`

Yêu cầu `requireAuth`.

**Body**

```json
{ "name": "Công ty Truyền thông ABC" }
```

- `name`: 2–100 ký tự, không trùng với workspace khác **cùng owner**.

**Xử lý**: tạo `Workspace` + `WorkspaceMember(OWNER)` trong transaction; audit `WORKSPACE_CREATE`.

**Response 201**

```json
{
  "status": "success",
  "message": "Tạo workspace thành công",
  "data": {
    "id": "uuid",
    "name": "Công ty Truyền thông ABC",
    "plan": "FREE",
    "role": "OWNER",
    "remainingCredit": 100,
    "monthlyQuota": 100
  }
}
```

**Lỗi**: `409` `"Bạn đã có workspace trùng tên này"`.

### `GET /workspaces`

Yêu cầu `requireAuth`. Trả các workspace user là thành viên (bỏ qua workspace đã xoá mềm), sắp xếp theo ngày tham gia tăng dần.

**Response 200**

```json
{
  "status": "success",
  "message": "Lấy danh sách workspace thành công",
  "data": { "workspaces": [ { "id": "uuid", "name": "...", "plan": "FREE", "role": "OWNER", "remainingCredit": 100, "monthlyQuota": 100 } ] }
}
```

### `PATCH /workspaces/:workspaceId`

Yêu cầu `requireAuth` + `requireWorkspaceRole("OWNER")`.

**Body**: `{ "name": "..." }` (2–100 ký tự).

**Response 200**

```json
{
  "status": "success",
  "message": "Cập nhật workspace thành công",
  "data": { "id": "uuid", "name": "...", "plan": "FREE", "remainingCredit": 100, "monthlyQuota": 100 }
}
```

Audit `WORKSPACE_UPDATE`.

### `DELETE /workspaces/:workspaceId`

Yêu cầu `requireAuth` + `OWNER`.

**Xử lý**: chuyển các `ChannelConnection` chưa `EXPIRED` sang `EXPIRED`, đánh dấu `Workspace.deletedAt` (xoá mềm) trong transaction; audit `WORKSPACE_DELETE`.

**Response 200**

```json
{ "status": "success", "message": "Xóa workspace thành công", "data": { "success": true } }
```

### `GET /workspaces/:workspaceId/members`

Yêu cầu `requireAuth` + là thành viên (`requireWorkspaceRole()` không giới hạn role).

**Response 200**

```json
{
  "status": "success",
  "message": "Lấy danh sách thành viên thành công",
  "data": {
    "members": [
      {
        "memberId": "uuid",
        "userId": "uuid",
        "name": "Nguyễn Văn A",
        "email": "user@marka.vn",
        "avatar": null,
        "role": "OWNER",
        "allowDirectPublish": true,
        "status": "ACTIVE",
        "joinedAt": "2026-10-20T12:00:00.000Z"
      }
    ],
    "pendingInvites": [
      {
        "inviteId": "uuid",
        "email": "member@marka.vn",
        "role": "CONTENT_CREATOR",
        "status": "PENDING",
        "invitedAt": "2026-10-20T12:00:00.000Z",
        "expiresAt": "2026-10-27T12:00:00.000Z"
      }
    ]
  }
}
```

`pendingInvites` chỉ gồm lời mời chưa dùng và còn hạn.

### `POST /workspaces/:workspaceId/invites`

Yêu cầu `requireAuth` + `OWNER`.

**Body**

```json
{ "email": "member@marka.vn", "role": "CONTENT_CREATOR" }
```

- `role`: `OWNER` | `CONTENT_CREATOR`, mặc định `CONTENT_CREATOR`.
- `email` phải chưa là thành viên.
- Lời mời có hạn 7 ngày; nếu đã có lời mời đang chờ cùng email thì cấp lại token/hạn mới.
- Gửi email qua Resend; gửi thất bại → `502` `"Gửi email mời thất bại. Vui lòng thử lại."`
- Audit `MEMBER_INVITED`.

**Response 201**

```json
{
  "status": "success",
  "message": "Đã tạo lời mời tham gia workspace",
  "data": {
    "invite": { "inviteId": "uuid", "email": "member@marka.vn", "role": "CONTENT_CREATOR", "expiresAt": "2026-10-27T12:00:00.000Z" },
    "inviteUrl": "https://app.marka.vn/invites/<token>"
  }
}
```

### `GET /invites/:token`

Công khai, dùng `optionalAuth`.

**Trường hợp 1 — chưa đăng nhập** (không gửi access token):

```json
{
  "status": "success",
  "message": "Bạn cần đăng ký tài khoản để tham gia workspace",
  "data": { "requiresRegistration": true, "email": "member@marka.vn", "workspaceName": "Công ty ABC" }
}
```

**Trường hợp 2 — đã đăng nhập, đúng email**:

```json
{
  "status": "success",
  "message": "Tham gia workspace thành công",
  "data": { "workspaceId": "uuid", "workspaceName": "Công ty ABC" }
}
```

Nếu đã là thành viên: `data` có thêm `"alreadyMember": true`.
**Lỗi**: `404` lời mời không tồn tại/workspace đã xoá; `409` đã dùng/hết hạn; `403` email không khớp. Access token sai/hết hạn bị `optionalAuth` bỏ qua và request được xử lý như khách.

### `DELETE /workspaces/:workspaceId/members/me`

Yêu cầu `requireAuth` + là thành viên. Owner cuối cùng không được rời → `409`.

**Response 200**: `{ "status": "success", "message": "Rời workspace thành công", "data": { "success": true } }`
Audit `MEMBER_LEFT`.

### `PATCH /workspaces/:workspaceId/members/:memberId`

Yêu cầu `requireAuth` + `OWNER`. `memberId` là **userId** (không phải id bản ghi member).

**Body**

```json
{ "role": "OWNER" }
```

**Xử lý**: không cho hạ vai trò Owner cuối cùng; nếu role không đổi thì trả luôn; audit `MEMBER_ROLE_CHANGED`.

**Response 200**

```json
{
  "status": "success",
  "message": "Cập nhật vai trò thành viên thành công",
  "data": { "memberId": "uuid", "userId": "uuid", "role": "OWNER" }
}
```

`memberId` trong response là id bản ghi `WorkspaceMember`.

### `DELETE /workspaces/:workspaceId/members/:memberId`

Yêu cầu `requireAuth` + `OWNER`. `memberId` là userId.

**Response 200**: `{ "status": "success", "message": "Xóa thành viên thành công", "data": { "removedMemberId": "uuid" } }`
Không cho xoá Owner cuối cùng → `409`. Audit `MEMBER_REMOVED`.

---

## 5. Brand Voice

### `GET /workspaces/:workspaceId/brand-voice`

Yêu cầu `requireAuth` + là thành viên.

**Response 200** (chưa cấu hình)

```json
{
  "status": "success",
  "message": "Lấy Brand Voice thành công",
  "data": { "brandVoice": null, "isConfigured": false }
}
```

Đã cấu hình: `brandVoice` là object như body bên dưới, `isConfigured: true`.

### `PUT /workspaces/:workspaceId/brand-voice`

Yêu cầu `requireAuth` + `OWNER`.

**Body**

```json
{
  "industry": "Thời trang nữ",
  "targetAudience": "Nữ 22-30 tuổi tại Hà Nội",
  "writingStyle": "Thân thiện, gần gũi",
  "keywordsShouldUse": ["thanh lịch", "tối giản"],
  "keywordsAvoid": ["sale sốc"],
  "fewShotExamples": [
    { "title": "Bài mẫu", "content": "Chỉ một chiếc sơ mi trắng cũng đủ cho cả tuần đi làm của bạn." }
  ]
}
```

| Field | Ràng buộc |
| :--- | :--- |
| `industry` | 1–100 ký tự |
| `targetAudience` | 1–300 ký tự |
| `writingStyle` | ≤ 300 ký tự, mặc định `""` |
| `keywordsShouldUse` / `keywordsAvoid` | mỗi từ 1–50 ký tự, tối đa 30 từ, mặc định `[]` |
| `fewShotExamples` | tối đa 3 bài; `title` ≤ 100; `content` 10–5000 ký tự |

**Xử lý**: khử trùng lặp hai mảng keyword, lưu vào `Workspace.brandVoice` (Json); audit `BRAND_VOICE_UPDATED`.

**Response 200**: `{ "status": "success", "message": "Cập nhật Brand Voice thành công", "data": { "brandVoice": { ... }, "isConfigured": true } }`

---

## 6. Channel & Facebook OAuth

### `GET /workspaces/:workspaceId/channels`

Yêu cầu `requireAuth` + là thành viên.

**Response 200**

```json
{
  "status": "success",
  "message": "Lấy danh sách kênh thành công",
  "data": {
    "channels": [
      {
        "id": "uuid",
        "platform": "FACEBOOK",
        "type": "REAL",
        "name": "Marka Fanpage",
        "avatar": "https://...",
        "externalAccountId": "123456789",
        "status": "ACTIVE",
        "createdAt": "2026-10-20T12:00:00.000Z",
        "updatedAt": "2026-10-20T12:00:00.000Z"
      }
    ]
  }
}
```

Không trả `accessToken`.

### `GET /channels/facebook/oauth/url?workspaceId=<uuid>`

Yêu cầu `requireAuth` + `OWNER` (workspace lấy từ query).

**Xử lý**: kiểm tra đủ `FACEBOOK_APP_ID`, `FACEBOOK_APP_SECRET`, `FACEBOOK_REDIRECT_URI`; sinh `state` 32 byte, lưu Redis 600 giây.

**Response 200**

```json
{
  "status": "success",
  "message": "Tạo URL đăng nhập Facebook thành công",
  "data": { "url": "https://www.facebook.com/v21.0/dialog/oauth?..." }
}
```

**Lỗi**: `400` `"Chưa cấu hình Facebook App. Vui lòng liên hệ quản trị viên."`

### `GET /channels/facebook/oauth/callback`

Công khai (Facebook gọi). Query: `code?`, `state?`, `error?`, `error_reason?`.

**Xử lý**

1. Nếu `error` → redirect `CLIENT_URL/channels?fb=error&reason=access_denied|token_exchange_failed`.
2. Thiếu `code`/`state` hoặc state không hợp lệ/hết hạn → `reason=invalid_state`.
3. Đổi code → token ngắn → long-lived token; lấy Page; mã hoá token từng Page.
4. Không có Page → `reason=no_pages`.
5. Lưu session Redis 600 giây → redirect `CLIENT_URL/channels?fb=select&session=<sessionId>`.
6. Lỗi khi gọi Facebook → `reason=token_exchange_failed`.

**Response**: `302` redirect (không trả JSON).

### `GET /channels/facebook/oauth/session/:sessionId`

Yêu cầu `requireAuth` + `OWNER`. `sessionId` là chuỗi hex 48 ký tự; session phải thuộc đúng user + workspace.

**Response 200**

```json
{
  "status": "success",
  "message": "Lấy danh sách Page thành công",
  "data": {
    "pages": [
      { "id": "123456789", "name": "Marka Fanpage", "avatar": "https://..." }
    ]
  }
}
```

**Lỗi**: `404` `"Phiên kết nối không tồn tại hoặc đã hết hạn"`.

### `POST /channels/facebook/oauth/session/:sessionId/connect`

Yêu cầu `requireAuth` + `OWNER`.

**Body**

```json
{ "pageIds": ["123456789"] }
```

`pageIds`: 1–50 phần tử, phải nằm trong session.

**Xử lý**: upsert `ChannelConnection` theo `(workspaceId, FACEBOOK, externalAccountId)`, `type=REAL`, `status=ACTIVE`, lưu token đã mã hoá; audit `CHANNEL_CONNECTED` cho từng kênh; xoá session.

**Response 201**

```json
{
  "status": "success",
  "message": "Kết nối Facebook thành công",
  "data": { "channels": [ { "id": "uuid", "platform": "FACEBOOK", "type": "REAL", "name": "Marka Fanpage", "avatar": "https://...", "externalAccountId": "123456789", "status": "ACTIVE", "createdAt": "...", "updatedAt": "..." } ] }
}
```

### `DELETE /channels/:channelId`

Yêu cầu `requireAuth` + `OWNER`. Kênh phải thuộc workspace hiện tại (lấy từ `x-workspace-id`/query/body).

**Xử lý**: chuyển `ScheduledPost` đang `SCHEDULED` của kênh sang `CANCELLED`, xoá `ChannelConnection`; audit `CHANNEL_DISCONNECTED`.

**Response 200**: `{ "status": "success", "message": "Ngắt kết nối kênh thành công", "data": { "success": true } }`

---

## 7. Post & Media

Mọi endpoint post yêu cầu `requireAuth` + là thành viên workspace.
`workspaceId` lấy từ param; `CONTENT_CREATOR` chỉ sửa/xoá bài do mình tạo; `OWNER` thao tác mọi bài.

### `POST /workspaces/:workspaceId/posts`

**Body**

```json
{ "title": "Bài viết giới thiệu sản phẩm", "content": { "type": "doc", "content": [] } }
```

- `title`: 1–255 ký tự.
- `content`: JSON object bất kỳ (client dùng TipTap).

**Xử lý**: tạo `Post` với `status=DRAFT`, `createdById=req.user.id`.

**Response 201**: trả nguyên bản ghi `Post`:

```json
{
  "status": "success",
  "message": "Tạo bản nháp thành công",
  "data": {
    "id": "uuid",
    "workspaceId": "uuid",
    "title": "Bài viết giới thiệu sản phẩm",
    "content": { "type": "doc", "content": [] },
    "status": "DRAFT",
    "campaignTag": null,
    "rejectReason": null,
    "submittedById": null,
    "createdById": "uuid",
    "submittedAt": null,
    "reviewedById": null,
    "reviewedAt": null,
    "deletedAt": null,
    "createdAt": "2026-10-20T12:00:00.000Z",
    "updatedAt": "2026-10-20T12:00:00.000Z"
  }
}
```

### `GET /workspaces/:workspaceId/posts`

**Query**

| Tham số | Kiểu | Mặc định | Ràng buộc |
| :--- | :--- | :--- | :--- |
| `page` | number | 1 | 1–100000 |
| `limit` | number | 10 | 1–50 |
| `search` | string | — | tìm theo `title` (không phân biệt hoa/thường) |
| `status` | PostStatus | — | `DRAFT`, `PENDING`, `APPROVED`, `REJECTED`, `SCHEDULED`, `PUBLISHED`, `FAILED`, `ARCHIVED` |
| `createdById` | uuid | — | lọc theo người tạo |
| `dateFrom` | date | — | lọc `createdAt >= dateFrom` |
| `dateTo` | date | — | lọc `createdAt <= dateTo`, phải ≥ `dateFrom` |

Sắp xếp theo `updatedAt` giảm dần; bỏ qua bài đã xoá mềm.

**Response 200**

```json
{
  "status": "success",
  "message": "Lấy danh sách bài viết thành công",
  "data": {
    "posts": [
      { "id": "uuid", "title": "...", "status": "DRAFT", "createdById": "uuid", "createdAt": "...", "updatedAt": "..." }
    ]
  },
  "meta": { "page": 1, "limit": 10, "total": 1, "totalPages": 1 }
}
```

### `GET /workspaces/:workspaceId/posts/:postId`

**Response 200**: `data` là `Post` kèm `mediaAssets` (chỉ media chưa xoá, sắp xếp `createdAt` tăng dần).
**Lỗi**: `404` `"Bài viết không tồn tại"`.

### `PATCH /workspaces/:workspaceId/posts/:postId`

**Body** (ít nhất một field): `title` (1–255), `content` (JSON object).

**Điều kiện**: chỉ bài `DRAFT` hoặc `REJECTED`; nếu không → `409` `"Chỉ có thể thay đổi bản nháp hoặc bài bị từ chối"`.
Quyền: OWNER hoặc người tạo bài; nếu không → `403`.

**Response 200**: `Post` sau cập nhật.

### `DELETE /workspaces/:workspaceId/posts/:postId`

**Điều kiện**: `DRAFT` hoặc `REJECTED`; OWNER hoặc người tạo.
**Xử lý**: `deletedAt = now` (xoá mềm).

**Response 200**: `{ "status": "success", "message": "Xóa bài viết thành công", "data": { "success": true } }`

### `POST /workspaces/:workspaceId/posts/:postId/media`

`multipart/form-data`, field `file`.

- Chỉ JPG/PNG/WEBP, tối đa 10MB.
- Điều kiện bài: `DRAFT` hoặc `REJECTED`; OWNER hoặc người tạo.
- Upload Cloudinary → tạo `MediaAsset` (`type=IMAGE`, `source=UPLOADED`).

**Response 201**: bản ghi `MediaAsset`.

**Lỗi**: `400` `"Vui lòng chọn ảnh để tải lên"`, `"Ảnh vượt quá 10MB"`, `"Chỉ chấp nhận ảnh JPG, PNG hoặc WEBP"`.

### `DELETE /workspaces/:workspaceId/posts/:postId/media/:mediaId`

**Điều kiện**: media thuộc đúng bài; bài `DRAFT`/`REJECTED`; OWNER hoặc người tạo.
**Xử lý**: xoá mềm `MediaAsset`.

**Response 200**: `{ "status": "success", "message": "Xóa ảnh thành công", "data": { "success": true } }`

### `POST /workspaces/:workspaceId/posts/:postId/submit`

Gửi bài duyệt. Không có body.

**Xử lý**

- `DRAFT` hoặc `REJECTED` → `PENDING`.
- Ghi `submittedById`, `submittedAt`, xoá `rejectReason`.
- Tạo notification cho OWNER (qua `notifyPostSubmitted`) và gửi email cho từng OWNER (template `postReviewEmail`).
- Ghi audit `POST_SUBMITTED`.

**Response 200**: `Post` sau chuyển trạng thái.
**Lỗi**: `409` nếu trạng thái hiện tại không cho chuyển sang `PENDING`.

### `PATCH /workspaces/:workspaceId/posts/:postId/review`

Yêu cầu `requireAuth` + `OWNER`. Bài phải đang `PENDING`.

**Body**

```json
{ "decision": "APPROVED" }
```

hoặc

```json
{ "decision": "REJECTED", "rejectReason": "Cần bổ sung thông tin sản phẩm" }
```

- `decision`: `APPROVED` | `REJECTED`.
- `rejectReason`: bắt buộc khi `REJECTED`, 3–255 ký tự.

**Xử lý**: chuyển `PENDING → APPROVED|REJECTED`, ghi `reviewedById`, `reviewedAt`, `rejectReason`; tạo notification và gửi email cho tác giả; audit `POST_APPROVED` / `POST_REJECTED`.

**Response 200**

```json
{
  "status": "success",
  "message": "Duyệt bài viết thành công",
  "data": { "id": "uuid", "status": "APPROVED", "...": "..." }
}
```

Message khi từ chối: `"Từ chối bài viết thành công"`.

---

## 8. Bảng tổng hợp endpoint

| Method | Path | Auth | Workspace role |
| :--- | :--- | :--- | :--- |
| GET | `/health` | — | — |
| POST | `/auth/register` | — | — |
| POST | `/auth/login` | — | — |
| POST | `/auth/google` | — | — |
| POST | `/auth/logout` | Bearer | — |
| POST | `/auth/refresh-token` | Cookie/Body | — |
| GET | `/users/me` | Bearer | — |
| PATCH | `/users/me` | Bearer | — |
| PATCH | `/users/me/password` | Bearer | — |
| POST | `/workspaces` | Bearer | — |
| GET | `/workspaces` | Bearer | — |
| PATCH | `/workspaces/:workspaceId` | Bearer | OWNER |
| DELETE | `/workspaces/:workspaceId` | Bearer | OWNER |
| GET | `/workspaces/:workspaceId/members` | Bearer | Thành viên |
| DELETE | `/workspaces/:workspaceId/members/me` | Bearer | Thành viên |
| PATCH | `/workspaces/:workspaceId/members/:memberId` | Bearer | OWNER |
| DELETE | `/workspaces/:workspaceId/members/:memberId` | Bearer | OWNER |
| POST | `/workspaces/:workspaceId/invites` | Bearer | OWNER |
| GET | `/invites/:token` | Optional | — |
| GET | `/workspaces/:workspaceId/brand-voice` | Bearer | Thành viên |
| PUT | `/workspaces/:workspaceId/brand-voice` | Bearer | OWNER |
| GET | `/workspaces/:workspaceId/channels` | Bearer | Thành viên |
| GET | `/channels/facebook/oauth/url` | Bearer | OWNER |
| GET | `/channels/facebook/oauth/callback` | — | — |
| GET | `/channels/facebook/oauth/session/:sessionId` | Bearer | OWNER |
| POST | `/channels/facebook/oauth/session/:sessionId/connect` | Bearer | OWNER |
| DELETE | `/channels/:channelId` | Bearer | OWNER |
| POST | `/workspaces/:workspaceId/posts` | Bearer | Thành viên |
| GET | `/workspaces/:workspaceId/posts` | Bearer | Thành viên |
| GET | `/workspaces/:workspaceId/posts/:postId` | Bearer | Thành viên |
| PATCH | `/workspaces/:workspaceId/posts/:postId` | Bearer | Thành viên (bài của mình) |
| DELETE | `/workspaces/:workspaceId/posts/:postId` | Bearer | Thành viên (bài của mình) |
| POST | `/workspaces/:workspaceId/posts/:postId/media` | Bearer | Thành viên (bài của mình) |
| DELETE | `/workspaces/:workspaceId/posts/:postId/media/:mediaId` | Bearer | Thành viên (bài của mình) |
| POST | `/workspaces/:workspaceId/posts/:postId/submit` | Bearer | Thành viên (bài của mình) |
| PATCH | `/workspaces/:workspaceId/posts/:postId/review` | Bearer | OWNER |

**Không có trong code** (đừng gọi): endpoint AI sinh nội dung, lịch đăng, publish, credit/PayOS, admin, notification, analytics, upload media độc lập.
