# Bộ test case — Marka Backend

> Tài liệu lập từ **test tự động có thật** trong repo, không phải từ đề xuất tính năng.
> Nguồn đối chiếu: `backend/tests/**/*.test.ts`, `backend/src/routes/index.ts`, `docs/api_documentation.md`.
> Cập nhật: 2026-10-24. Tổng: **225 test case** trong **22 file**.

## 1. Bảng tổng hợp

| # | Module / nhóm | Số test | File test |
|---|---------------|---------|-----------|
| 1 | Auth, RBAC, refresh/logout (UC01–UC04, UC34) | 12 | `backend/tests/modules/auth/auth.test.ts` |
| 2 | Google login (UC03) | 3 | `backend/tests/modules/auth/auth.google.test.ts` |
| 3 | User — hồ sơ & mật khẩu (UC05, UC33) | 4 | `backend/tests/modules/user/user.test.ts` |
| 4 | Workspace, thành viên, lời mời (UC17–UC24, UC35, UC36) | 22 | `backend/tests/modules/workspace/workspace.test.ts` |
| 5 | Brand Voice (UC25–UC27) | 12 | `backend/tests/modules/brandvoice/brandvoice.test.ts` |
| 6 | Channel & Facebook OAuth (UC28–UC30) | 28 | `backend/tests/modules/channel/*.test.ts` |
| 7 | Post, media, gửi duyệt & duyệt bài (UC06, UC08–UC12, UC15) | 52 | `backend/tests/modules/post/post.test.ts` |
| 7.1 | AI service, processor, provider, prompt, route, credit | 36 | `backend/tests/modules/ai/*.test.ts`, `backend/tests/modules/credit/*.test.ts` |
| 7.2 | Schedule đăng bài Facebook | 32 | `backend/tests/modules/schedule/*.test.ts` |
| 7.3 | Nạp credit, PayOS (UC31, UC40, UC41) | 11 | `backend/tests/modules/billing/billing.test.ts` |
| 8 | Health check | 1 | `backend/tests/modules/health/health.test.ts` |
| 8.1 | Health service (Redis/DB) | 3 | `backend/tests/modules/health/health.service.test.ts` |
| 9 | Queue Manager (BullMQ) | 6 | `backend/tests/workers/queue-manager.test.ts` |
| 10 | Middleware `enforceHttps` | 2 | `backend/tests/middlewares/enforceHttps.test.ts` |
| 11 | Swagger spec | 1 | `backend/tests/config/swagger.test.ts` |
| **Tổng** | | **225** | |

Ghi chú:

- Test dùng **DB thật** (Prisma) và **Redis thật**; dữ liệu tạo/xoá theo `Date.now()` trong `beforeAll`/`afterAll`.
- Mã test (`A01`, `W01`, `P01`…) do tài liệu đặt để tra cứu; **tên test giữ nguyên theo `it(...)`** trong code.
- Endpoint trong bảng dùng tiền tố `/api/v1`.
- Các test gắn nhãn `setup` là bước chuẩn bị dữ liệu, vẫn là test thật (có assert).

---

## 2. Auth, phân quyền, refresh/logout

**File:** `backend/tests/modules/auth/auth.test.ts`

### 2.1. Đăng ký / đăng nhập (UC01, UC02)

| Mã | Tên test case (theo `it(...)`) | Endpoint / hàm | Input chính | Kết quả mong đợi | File |
|----|-------------------------------|----------------|-------------|------------------|------|
| A01 | Báo lỗi 422 nếu dữ liệu đầu vào không hợp lệ | `POST /api/v1/auth/register` | `email: "invalid-email"`, `password: "123"`, `name: ""` | 422; `status = "fail"`; `errors` là mảng | `auth.test.ts` |
| A02 | Đăng ký thành công tài khoản mới, tự động đăng nhập (201 Created) | `POST /api/v1/auth/register` | email/password/name hợp lệ | 201; có `accessToken`; `user.email`, `user.name` đúng; `workspaces[0].role = OWNER`, `monthlyQuota = 100`; body **không** có `refreshToken`; `Set-Cookie` có `refreshToken=` | `auth.test.ts` |
| A03 | Báo lỗi 409 Conflict nếu email đã tồn tại | `POST /api/v1/auth/register` | email vừa đăng ký | 409; `status = "fail"`; message chứa `đã được đăng ký` | `auth.test.ts` |
| A04 | Báo lỗi 401 nếu email không tồn tại | `POST /api/v1/auth/login` | email không có trong DB | 401; `status = "fail"`; message `Email hoặc mật khẩu không chính xác` | `auth.test.ts` |
| A05 | Báo lỗi 401 nếu sai mật khẩu | `POST /api/v1/auth/login` | email đúng, `password: "wrong_password"` | 401; cùng message như A04 | `auth.test.ts` |
| A06 | Đăng nhập thành công, ẩn refreshToken khỏi JSON và set HttpOnly Cookie (200 OK) | `POST /api/v1/auth/login` | email + mật khẩu đúng | 200; `accessToken`; `refreshToken` là `undefined` trong body; cookie `refreshToken` tồn tại | `auth.test.ts` |

### 2.2. RBAC (middleware `requireAuth`, `requireRoles`, `requireWorkspaceRole`)

| Mã | Tên test case (theo `it(...)`) | Endpoint / hàm | Input chính | Kết quả mong đợi | File |
|----|-------------------------------|----------------|-------------|------------------|------|
| A07 | Chặn người dùng thường truy cập API của SYSTEM_ADMIN (403 Forbidden) | App test `GET /test/admin` (`requireRoles('SYSTEM_ADMIN')`) | Bearer token user thường | 403 | `auth.test.ts` |
| A08 | Cho phép OWNER truy cập tài nguyên của Workspace với header x-workspace-id | App test `GET /test/workspace/owner` | Bearer token + `x-workspace-id` = workspace của mình | 200; message `Owner access granted` | `auth.test.ts` |
| A09 | Từ chối nếu người dùng là OWNER nhưng API yêu cầu role CONTENT_CREATOR riêng | App test `GET /test/workspace/creator` | Bearer token OWNER + `x-workspace-id` | 403 | `auth.test.ts` |

### 2.3. Refresh token & đăng xuất (UC34, UC04)

| Mã | Tên test case (theo `it(...)`) | Endpoint / hàm | Input chính | Kết quả mong đợi | File |
|----|-------------------------------|----------------|-------------|------------------|------|
| A10 | Báo lỗi 401 nếu refresh token không hợp lệ | `POST /api/v1/auth/refresh-token` | body `{ refreshToken: "invalid_token" }` | 401 | `auth.test.ts` |
| A11 | Cấp lại access token mới qua HttpOnly Cookie thành công | `POST /api/v1/auth/refresh-token` | Cookie `refreshToken=<token thật>` | 200; có `accessToken` mới; body không có `refreshToken`; cookie refresh mới được set | `auth.test.ts` |
| A12 | Đăng xuất thành công, xóa cookie và vô hiệu hóa token cũ (200 OK) | `POST /api/v1/auth/logout` → `GET /api/v1/users/me` | Bearer token hiện tại | 200; message `Đăng xuất thành công`; gọi lại `/users/me` bằng token cũ trả 401 | `auth.test.ts` |

---

## 3. Google login (UC03)

**File:** `backend/tests/modules/auth/auth.google.test.ts` (mock `google-auth-library`)

| Mã | Tên test case (theo `it(...)`) | Endpoint / hàm | Input chính | Kết quả mong đợi | File |
|----|-------------------------------|----------------|-------------|------------------|------|
| G01 | Từ chối email Google chưa xác minh (401), không liên kết tài khoản có sẵn | `POST /api/v1/auth/google` | payload `email_verified: false`, email trùng tài khoản local | 401; `user.googleId` trong DB vẫn `null` | `auth.google.test.ts` |
| G02 | Chuẩn hóa email Google về chữ thường khi tìm tài khoản | `POST /api/v1/auth/google` | payload email viết HOA, `email_verified: true`, email đã tồn tại | 200; `user.email` là email local chữ thường | `auth.google.test.ts` |
| G03 | Tạo tài khoản mới kèm workspace mặc định | `POST /api/v1/auth/google` | email mới + `email_verified: true` | 200; `workspaces` có đúng 1 phần tử; role `OWNER` | `auth.google.test.ts` |

---

## 4. User — hồ sơ & mật khẩu

**File:** `backend/tests/modules/user/user.test.ts`

| Mã | Tên test case (theo `it(...)`) | Endpoint / hàm | Input chính | Kết quả mong đợi | File |
|----|-------------------------------|----------------|-------------|------------------|------|
| U01 | GET /api/v1/users/me - Lấy thông tin tài khoản hiện tại | `GET /api/v1/users/me` | Bearer token | 200; `status = "success"`; `email`, `name` khớp DB | `user.test.ts` |
| U02 | PATCH /api/v1/users/me - Cập nhật thông tin profile | `PATCH /api/v1/users/me` | `{ name: "Nguyễn Văn Đã Đổi Tên" }` | 200; `data.name` là tên mới | `user.test.ts` |
| U03 | PATCH /api/v1/users/me/password - Báo lỗi nếu sai mật khẩu cũ | `PATCH /api/v1/users/me/password` | `oldPassword: "wrong_password"`, `newPassword: "newPassword456"` | 401 | `user.test.ts` |
| U04 | PATCH /api/v1/users/me/password - Đổi mật khẩu thành công | `PATCH /api/v1/users/me/password` | mật khẩu cũ đúng | 200; message chứa `Đổi mật khẩu thành công` | `user.test.ts` |

---

## 5. Workspace, thành viên & lời mời

**File:** `backend/tests/modules/workspace/workspace.test.ts` (mock `mailerClient.sendEmail`)

| Mã | Tên test case (theo `it(...)`) | Endpoint / hàm | Input chính | Kết quả mong đợi | File |
|----|-------------------------------|----------------|-------------|------------------|------|
| W01 | UC35 — Đăng ký owner và tạo workspace mặc định | `POST /api/v1/auth/register` | owner mới | 201; `workspaces[0].role = OWNER` | `workspace.test.ts` |
| W02 | UC17 — Tạo workspace mới thành công (201) | `POST /api/v1/workspaces` | `{ name: "WS Test <stamp>" }` | 201; `data.name` đúng; `data.role = OWNER` | `workspace.test.ts` |
| W03 | UC17 — Báo lỗi 409 khi tạo trùng tên workspace | `POST /api/v1/workspaces` | trùng `name` với W02 | 409; `status = "fail"` | `workspace.test.ts` |
| W04 | UC17 — Báo lỗi 422 khi tên không hợp lệ | `POST /api/v1/workspaces` | `{ name: "x" }` | 422 | `workspace.test.ts` |
| W05 | UC35 — Danh sách workspace chứa workspace vừa tạo | `GET /api/v1/workspaces` | Bearer owner | 200; danh sách chứa cả workspace mặc định và workspace vừa tạo | `workspace.test.ts` |
| W06 | UC18 — Cập nhật tên workspace thành công (200) | `PATCH /api/v1/workspaces/:workspaceId` | `{ name: "<tên> Updated" }` | 200; `data.name` là tên mới | `workspace.test.ts` |
| W07 | UC20 — Xem thành viên: ban đầu chỉ có Owner | `GET /api/v1/workspaces/:workspaceId/members` | Bearer owner | 200; 1 member role `OWNER`; `pendingInvites` rỗng | `workspace.test.ts` |
| W08 | UC21 — Mời thành viên thành công, trả invite token (201) | `POST /api/v1/workspaces/:workspaceId/invites` | `{ email, role: "CONTENT_CREATOR" }` | 201; `invite.email` đúng; `inviteUrl` chứa `/invites/` | `workspace.test.ts` |
| W09 | UC21 — Mời lại email đang chờ: cấp token mới, token cũ hết hiệu lực (201) | `POST .../invites` + `GET /api/v1/invites/:oldToken` | mời lại cùng email | 201; token mới khác token cũ; token cũ trả 404 | `workspace.test.ts` |
| W10 | UC21 — Gửi email thất bại: báo lỗi 502 và không lưu lời mời | `POST .../invites` | `mailerClient.sendEmail` mock trả `false` | 502; `pendingInvites` **không** chứa email vừa mời | `workspace.test.ts` |
| W11 | UC22 — Khách chưa đăng nhập xem lời mời cần đăng ký | `GET /api/v1/invites/:token` | không gửi token đăng nhập | 200; `requiresRegistration = true`; `email` đúng | `workspace.test.ts` |
| W12 | UC22 — Đăng ký member rồi chấp nhận lời mời thành công (200) | `POST /auth/register` + `GET /api/v1/invites/:token` | member mới + Bearer token | Đăng ký 201; xem lời mời 200; `workspaceId` đúng workspace được mời | `workspace.test.ts` |
| W13 | UC22 — Dùng lại token đã dùng báo lỗi 409 | `GET /api/v1/invites/:token` | token đã chấp nhận | 409 | `workspace.test.ts` |
| W14 | UC20 — Sau khi tham gia có 2 thành viên | `GET .../members` | Bearer owner | 200; 2 member; có role `CONTENT_CREATOR` | `workspace.test.ts` |
| W15 | RBAC — Content Creator không được cập nhật workspace (403) | `PATCH /api/v1/workspaces/:workspaceId` | Bearer CONTENT_CREATOR, `{ name: "Hack name" }` | 403 | `workspace.test.ts` |
| W16 | UC36 — Owner đổi vai trò member thành OWNER (200) | `PATCH .../members/:memberId` | `{ role: "OWNER" }` | 200; `data.role = OWNER` | `workspace.test.ts` |
| W17 | UC36 — Không thể hạ Owner duy nhất (409) | `PATCH .../members/:memberId` | workspace chỉ có 1 owner, `{ role: "CONTENT_CREATOR" }` | 409 | `workspace.test.ts` |
| W18 | UC24 — Owner xóa thành viên (200) | `DELETE .../members/:memberId` | memberId của CONTENT_CREATOR | 200; `data.removedMemberId` đúng | `workspace.test.ts` |
| W19 | UC23 — Owner duy nhất không thể rời workspace (409) | `DELETE .../members/me` | Bearer sole owner | 409 | `workspace.test.ts` |
| W20 | UC19 — Xóa mềm workspace và ẩn khỏi danh sách (200) | `DELETE /api/v1/workspaces/:workspaceId` + `GET /workspaces` | Bearer owner | 200; workspace không còn trong danh sách | `workspace.test.ts` |
| W21 | UC19 — Workspace đã xóa trả 404 khi truy cập thành viên | `GET .../members` | workspace vừa xoá | 404 | `workspace.test.ts` |

---

## 6. Brand Voice

**File:** `backend/tests/modules/brandvoice/brandvoice.test.ts`

| Mã | Tên test case (theo `it(...)`) | Endpoint / hàm | Input chính | Kết quả mong đợi | File |
|----|-------------------------------|----------------|-------------|------------------|------|
| B01 | UC27 — Creator xem Brand Voice khi chưa cấu hình (200, chưa thiết lập) | `GET .../brand-voice` | Bearer CONTENT_CREATOR | 200; `brandVoice = null`; `isConfigured = false` | `brandvoice.test.ts` |
| B02 | UC25 — Owner tạo Brand Voice lần đầu (200) | `PUT .../brand-voice` | industry, targetAudience, writingStyle, keywords, 1 fewShotExample | 200; `isConfigured = true`; `brandVoice` bằng payload | `brandvoice.test.ts` |
| B03 | UC27 — Creator xem đúng cấu hình Owner vừa lưu | `GET .../brand-voice` | Bearer CONTENT_CREATOR | 200; `brandVoice` bằng cấu hình ở B02 | `brandvoice.test.ts` |
| B04 | UC26 — Owner cập nhật Brand Voice: dữ liệu cũ bị thay thế, không nhân bản | `PUT .../brand-voice` | payload mới (mỹ phẩm, 18–25 tuổi) | 200; response và `workspace.brandVoice` trong DB đều bằng payload mới | `brandvoice.test.ts` |
| B05 | UC25 — Từ khoá trùng lặp được khử trùng lặp | `PUT .../brand-voice` | `keywordsShouldUse: ["ưu đãi","ưu đãi","sale"]` | 200; kết quả `["ưu đãi","sale"]` | `brandvoice.test.ts` |
| B06 | UC26 — Ghi audit log khi cập nhật Brand Voice | DB `auditLog.findFirst` | sau khi PUT | Có log `BRAND_VOICE_UPDATED`; `actorId` = owner; `targetType = "Workspace"`; `targetId` = workspaceId | `brandvoice.test.ts` |
| B07 | RBAC — Content Creator không được cập nhật Brand Voice (403) | `PUT .../brand-voice` | Bearer CONTENT_CREATOR | 403 | `brandvoice.test.ts` |
| B08 | RBAC — Người ngoài workspace không xem được Brand Voice (403) | `GET .../brand-voice` | Bearer outsider | 403 | `brandvoice.test.ts` |
| B09 | RBAC — Người ngoài workspace không cập nhật được Brand Voice (403) | `PUT .../brand-voice` | Bearer outsider | 403 | `brandvoice.test.ts` |
| B10 | Validate — Thiếu ngành hàng trả 422 | `PUT .../brand-voice` | chỉ có `targetAudience` | 422; `errors[0].field = "industry"` | `brandvoice.test.ts` |
| B11 | Validate — Quá 3 bài viết mẫu trả 422 | `PUT .../brand-voice` | `fewShotExamples` gồm 4 phần tử | 422; `errors[0].field = "fewShotExamples"` | `brandvoice.test.ts` |
| B12 | Validate — Quá 30 từ khoá trả 422 | `PUT .../brand-voice` | `keywordsAvoid` gồm 31 phần tử | 422; `errors[0].field = "keywordsAvoid"` | `brandvoice.test.ts` |

---

## 7. Channel & Facebook OAuth

**File:** `backend/tests/modules/channel/channel.test.ts` (mock `fetch`, env Facebook)

| Mã | Tên test case (theo `it(...)`) | Endpoint / hàm | Input chính | Kết quả mong đợi | File |
|----|-------------------------------|----------------|-------------|------------------|------|
| C01 | UC28 — Creator xem danh sách kênh, không lộ accessToken | `GET /api/v1/workspaces/:workspaceId/channels` | Bearer CONTENT_CREATOR | 200; `data.channels = []` | `channel.test.ts` |
| C02 | UC28 — Outsider không xem được kênh workspace khác | `GET .../channels` | Bearer outsider | 403 | `channel.test.ts` |
| C03 | UC29 — Owner lấy URL đăng nhập Facebook | `GET /api/v1/channels/facebook/oauth/url?workspaceId=` | Bearer OWNER | 200; host `www.facebook.com`; `client_id` đúng env; `redirect_uri` đúng env; `scope` chứa `pages_show_list` | `channel.test.ts` |
| C04 | UC29 — Creator không lấy được URL đăng nhập Facebook | `GET /channels/facebook/oauth/url` | Bearer CONTENT_CREATOR | 403 | `channel.test.ts` |
| C05 | UC29 — Callback tạo session và redirect về trang chọn Page | `GET /channels/facebook/oauth/callback` | `code`, `state` hợp lệ | 302; gọi Facebook 3 lần; `location` có path `/channels`, `fb=select`, `session` khớp `^[a-f0-9]{48}$` | `channel.test.ts` |
| C06 | UC29 — State sai bị từ chối | callback | `state=bad` | 302; `location` chứa `reason=invalid_state` | `channel.test.ts` |
| C07 | UC29 — State dùng lại lần hai bị từ chối | callback | dùng lại cùng `state` | Lần 1 `fb=select`; lần 2 `reason=invalid_state` | `channel.test.ts` |
| C08 | UC29 — Người dùng từ chối cấp quyền được báo lỗi | callback | `error=access_denied` | 302; `location` chứa `reason=access_denied` | `channel.test.ts` |
| C09 | UC29 — Tài khoản không có Page nào trả no_pages | callback | Facebook trả `data: []` | 302; `location` chứa `reason=no_pages` | `channel.test.ts` |
| C10 | UC29 — Owner xem danh sách Page chờ chọn, không có token | `GET .../oauth/session/:sessionId` | Bearer OWNER + `x-workspace-id` | 200; `pages` chỉ gồm `{ id, name, avatar }` | `channel.test.ts` |
| C11 | UC29 — Người khác không đọc được session chọn Page | `GET .../oauth/session/:sessionId` | Bearer outsider + workspace của outsider | 404 | `channel.test.ts` |
| C12 | UC29 — Chọn Page lưu token đã mã hoá, không trả token | `POST .../oauth/session/:sessionId/connect` | `{ pageIds: ["page-1"] }` | 201; `channels[0].name` đúng; `accessToken` là `undefined`; token trong DB khác plaintext và `decrypt(token)` = `page-token-1` | `channel.test.ts` |
| C13 | UC29 — Page không thuộc session bị từ chối | `POST .../connect` | `{ pageIds: ["page-khac"] }` | 400; không tạo `channelConnection` cho page đó | `channel.test.ts` |
| C14 | UC29 — Bỏ Page thiếu access_token khỏi danh sách chọn | callback + `GET .../oauth/session/:sessionId` | danh sách Page có 1 page thiếu token | 200; `pages` chỉ còn page có token | `channel.test.ts` |
| C15 | UC29 — URL lấy workspace từ header, không dùng query lệch | `GET /channels/facebook/oauth/url` | query workspaceId của outsider + header workspace của owner | 200; session tạo ra vẫn đọc được bằng owner + `x-workspace-id` | `channel.test.ts` |
| C16 | UC29 — Creator không được kết nối Page | `POST .../connect` | Bearer CONTENT_CREATOR | 403 | `channel.test.ts` |
| C17 | UC29 — Kết nối lại cùng Page giữ nguyên channel id | `POST .../connect` hai lần | cùng `pageIds: ["page-1"]`, token mới | 201; cùng `channel.id`; tên mới được cập nhật; DB decrypt ra token mới | `channel.test.ts` |
| C18 | UC29 — Session bị xoá sau khi kết nối | `GET .../oauth/session/:sessionId` | session vừa connect | 404 | `channel.test.ts` |
| C19 | UC30 — Creator không được ngắt kết nối | `DELETE /api/v1/channels/:channelId` | Bearer CONTENT_CREATOR | 403 | `channel.test.ts` |
| C20 | UC30 — Ngắt kết nối huỷ lịch đăng và xoá kênh | `DELETE /api/v1/channels/:channelId` | Bearer OWNER; kênh có 1 `ScheduledPost` | 200; `data.success = true`; `channelConnection` bị xoá; bản ghi `scheduledPost` không còn (service chuyển `CANCELLED`, sau đó FK cascade xoá khi xoá kênh) | `channel.test.ts` |
| C21 | UC30 — Thiếu workspace header bị từ chối | `DELETE /api/v1/channels/:channelId` | Bearer owner, **không** có `x-workspace-id` | 400 | `channel.test.ts` |

---

## 8. Post, media, gửi duyệt & duyệt bài

**File:** `backend/tests/modules/post/post.test.ts` (mock `cloudinary`)

### 8.1. Tạo, xem, danh sách (UC06, UC09, UC10)

| Mã | Tên test case (theo `it(...)`) | Endpoint / hàm | Input chính | Kết quả mong đợi | File |
|----|-------------------------------|----------------|-------------|------------------|------|
| P01 | UC06 — Tạo bản nháp thành công (201) | `POST .../posts` | `title: "Nháp đầu tiên"`, `content: { type: "doc", content: [] }` | 201; title đúng; `status = DRAFT`; `createdById` = owner | `post.test.ts` |
| P02 | UC06 — Thiếu title trả 422 | `POST .../posts` | chỉ có `content` | 422 | `post.test.ts` |
| P03 | UC09 — Xem chi tiết bản nháp (200), kèm mediaAssets rỗng | `GET .../posts/:postId` | Bearer owner | 200; `data.id` đúng; `mediaAssets = []` | `post.test.ts` |
| P04 | UC09 — Bài thuộc workspace khác trả 404 khi đổi workspaceId | `GET /workspaces/:wsKhác/posts/:postId` | Bearer creator A, workspace riêng của A | 404 | `post.test.ts` |
| P05 | UC10 — Danh sách trả posts + meta phân trang | `GET .../posts?page=1&limit=10` | Bearer owner | 200; `data.posts` là mảng; `meta` gồm `page = 1`, `limit = 10`, `total` là number | `post.test.ts` |
| P06 | UC10 — Tìm theo tiêu đề (không phân biệt hoa/thường) | `GET .../posts?search=NHÁP` | từ khoá viết hoa | 200; danh sách chứa `postId` của P01 | `post.test.ts` |
| P07 | UC10 — Lọc theo người tạo | `GET .../posts?createdById=<ownerId>` | ownerId | 200; mọi post có `createdById` = ownerId | `post.test.ts` |
| P08 | UC10 — Lọc theo trạng thái | `GET .../posts?status=DRAFT` | `status = DRAFT` | 200; mọi post `status = DRAFT`; chứa `postId` P01 | `post.test.ts` |
| P09 | UC10 — Trạng thái không hợp lệ trả 422 | `GET .../posts?status=KHONGCO` | giá trị ngoài enum | 422 | `post.test.ts` |
| P10 | UC10 — Query sai trả 422 (page=0, limit=99, dateTo<dateFrom) | `GET .../posts` | 3 request: `page=0`; `limit=99`; `dateFrom > dateTo` | Cả 3 trả 422 | `post.test.ts` |
| P11 | UC10 — Không lộ bài viết của workspace khác | `GET .../posts` | workspace của owner; có bài tạo ở workspace riêng của A | 200; không chứa bài `"Bài workspace riêng A"` | `post.test.ts` |
| P12 | setup — Creator A tạo bản nháp của mình | `POST .../posts` | Bearer creator A | 201; lưu `creatorAPostId` | `post.test.ts` |
| P13 | UC10 — page tràn số trả 422 (không 500) | `GET .../posts?page=1000000000000000000000` | page vượt giới hạn | 422 | `post.test.ts` |

### 8.2. Cập nhật bài (UC08)

| Mã | Tên test case (theo `it(...)`) | Endpoint / hàm | Input chính | Kết quả mong đợi | File |
|----|-------------------------------|----------------|-------------|------------------|------|
| P14 | UC08 — Chủ bài (Creator) sửa bản nháp của mình (200) | `PATCH .../posts/:postId` | Bearer creator A, `{ title: "Đã sửa" }` | 200; title mới | `post.test.ts` |
| P15 | UC08 — Creator khác sửa bài người khác trả 403 | `PATCH .../posts/:postId` | Bearer creator B | 403 | `post.test.ts` |
| P16 | UC08 — Owner sửa được bài của Creator (200) | `PATCH .../posts/:postId` | Bearer owner, đổi `content` | 200 | `post.test.ts` |
| P17 | UC08 — PATCH rỗng trả 422 | `PATCH .../posts/:postId` | `{}` | 422 | `post.test.ts` |
| P18 | UC08 — Sửa bài không phải DRAFT trả 409 | `PATCH .../posts/:postId` | bài tạo trực tiếp ở DB với `status = PENDING` | 409 | `post.test.ts` |
| P19 | UC08 — Sửa được bài đã bị từ chối (200) | `PATCH .../posts/:postId` | bài `REJECTED`, `{ title: "Đã bổ sung thông tin" }` | 200; title mới | `post.test.ts` |

### 8.3. Xoá bài (UC11)

| Mã | Tên test case (theo `it(...)`) | Endpoint / hàm | Input chính | Kết quả mong đợi | File |
|----|-------------------------------|----------------|-------------|------------------|------|
| P20 | setup — Creator A tạo 2 bản nháp để xóa | `POST .../posts` | 2 request | Cả 2 trả 201; lưu id | `post.test.ts` |
| P21 | UC11 — Chủ bài xóa bản nháp của mình (200) | `DELETE .../posts/:postId` | Bearer creator A | 200 | `post.test.ts` |
| P22 | UC11 — Sau khi xóa, chi tiết trả 404 | `GET .../posts/:postId` | bài vừa xoá | 404 | `post.test.ts` |
| P23 | UC11 — Creator khác xóa bài người khác trả 403 | `DELETE .../posts/:postId` | Bearer creator B | 403 | `post.test.ts` |
| P24 | UC11 — Owner xóa được bài của Creator (200) | `DELETE .../posts/:postId` | Bearer owner | 200 | `post.test.ts` |

### 8.4. Media (thuộc UC06/UC08)

| Mã | Tên test case (theo `it(...)`) | Endpoint / hàm | Input chính | Kết quả mong đợi | File |
|----|-------------------------------|----------------|-------------|------------------|------|
| P25 | UC06/UC08 — Upload ảnh vào bài của mình (201) | `POST .../posts/:postId/media` | Bearer creator A, file `a.png` (`image/png`) | 201; `url` chứa `res.cloudinary.com`; `type = IMAGE` | `post.test.ts` |
| P26 | UC06/UC08 — Chi tiết bài chứa ảnh vừa upload | `GET .../posts/:postId` | Bearer creator A | `mediaAssets.length > 0` | `post.test.ts` |
| P27 | UC06/UC08 — Upload sai định dạng trả 400 | `POST .../media` | file `a.txt` (`text/plain`) | 400 | `post.test.ts` |
| P28 | UC06/UC08 — Upload ảnh vượt 10MB trả 400 | `POST .../media` | buffer 10MB + 1 byte | 400 | `post.test.ts` |
| P29 | UC06/UC08 — Creator khác upload vào bài người khác trả 403 | `POST .../media` | Bearer creator B | 403 | `post.test.ts` |
| P30 | setup — Upload thêm 1 ảnh để test quyền gỡ | `POST .../media` | file `b.png` | 201; lưu `mediaId2` | `post.test.ts` |
| P31 | UC06/UC08 — Gỡ ảnh khỏi bài của mình (200) | `DELETE .../posts/:postId/media/:mediaId` | Bearer creator A | 200 | `post.test.ts` |
| P32 | UC06/UC08 — Gỡ ảnh không thuộc bài trả 404 | `DELETE .../media/00000000-0000-0000-0000-000000000000` | mediaId không tồn tại | 404 | `post.test.ts` |
| P33 | UC06/UC08 — Creator khác gỡ ảnh bài người khác trả 403 | `DELETE .../media/:mediaId2` | Bearer creator B | 403 | `post.test.ts` |

### 8.5. Cách ly workspace (RBAC)

| Mã | Tên test case (theo `it(...)`) | Endpoint / hàm | Input chính | Kết quả mong đợi | File |
|----|-------------------------------|----------------|-------------|------------------|------|
| P34 | RBAC — Chặn lệch workspace giữa header và URL (403, không lộ dữ liệu) | `GET /workspaces/:wsA/posts` | token owner, `x-workspace-id` = workspace khác | 403 | `post.test.ts` |
| P35 | RBAC — Không tạo được bài chéo workspace qua header (403) | `POST /workspaces/:wsA/posts` | token + header lệch workspace | 403 | `post.test.ts` |

### 8.6. Gửi duyệt (UC12)

| Mã | Tên test case (theo `it(...)`) | Endpoint / hàm | Input chính | Kết quả mong đợi | File |
|----|-------------------------------|----------------|-------------|------------------|------|
| P36 | setup — Creator A tạo bài để gửi duyệt | `POST .../posts` | Bearer creator A | 201; `status = DRAFT` | `post.test.ts` |
| P37 | UC12 — Creator khác gửi duyệt bài của người khác trả 403 | `POST .../posts/:postId/submit` | Bearer creator B | 403 | `post.test.ts` |
| P38 | UC12 — Gửi duyệt bài của workspace khác trả 404 | `POST /workspaces/:wsKhác/posts/:postId/submit` | Bearer creator A | 404 | `post.test.ts` |
| P39 | UC12 — Tác giả gửi duyệt bài của mình (200) → PENDING | `POST .../submit` | Bearer creator A | 200; `status = PENDING`; `submittedById` = creator A; `submittedAt` có giá trị | `post.test.ts` |
| P40 | UC12 — Gửi duyệt thông báo cho Owner | DB `notification.count` | sau khi submit | Có ≥ 1 notification `POST_SUBMITTED` cho owner trong workspace | `post.test.ts` |
| P41 | UC12 — Gửi duyệt lại khi bài đang PENDING trả 409 | `POST .../submit` | bài đang `PENDING` | 409 | `post.test.ts` |
| P42 | UC12 — Gửi lại bài bị từ chối (200) → PENDING, xoá lý do cũ | `POST .../submit` | bài `REJECTED` | 200; `status = PENDING`; `rejectReason = null` | `post.test.ts` |
| P43 | UC12 — Owner gửi duyệt bài của Creator (200) | `POST .../submit` | Bearer owner trên bài của creator A | 200; `status = PENDING` | `post.test.ts` |

### 8.7. Duyệt / từ chối (UC15)

| Mã | Tên test case (theo `it(...)`) | Endpoint / hàm | Input chính | Kết quả mong đợi | File |
|----|-------------------------------|----------------|-------------|------------------|------|
| P44 | UC15 — Creator gọi duyệt bài trả 403 | `PATCH .../posts/:postId/review` | Bearer CONTENT_CREATOR, `{ decision: "APPROVED" }` | 403 | `post.test.ts` |
| P45 | UC15 — Từ chối thiếu lý do trả 422 | `PATCH .../review` | `{ decision: "REJECTED" }` | 422 | `post.test.ts` |
| P46 | UC15 — Owner từ chối kèm lý do (200) → REJECTED | `PATCH .../review` | `{ decision: "REJECTED", rejectReason: "Thiếu thông tin sản phẩm" }` | 200; `status = REJECTED`; `rejectReason` đúng; `reviewedById` = owner; `reviewedAt` có giá trị | `post.test.ts` |
| P47 | UC15 — Từ chối thông báo cho tác giả | DB `notification.count` | sau khi từ chối | Có ≥ 1 notification `POST_REJECTED` cho creator A | `post.test.ts` |
| P48 | UC15 — Owner duyệt bài (200) → APPROVED | `PATCH .../review` | `{ decision: "APPROVED" }` | 200; `status = APPROVED`; `reviewedById` = owner | `post.test.ts` |
| P49 | UC15 — Duyệt thông báo cho tác giả | DB `notification.count` | sau khi duyệt | Có ≥ 1 notification `POST_APPROVED` cho creator A | `post.test.ts` |
| P50 | UC15 — Duyệt lại bài đã APPROVED trả 409 | `PATCH .../review` | bài `APPROVED` | 409 | `post.test.ts` |
| P51 | UC15 — Hai lượt duyệt đồng thời chỉ một lượt thành công | `PATCH .../review` gọi song song | 1 `APPROVED` + 1 `REJECTED` cùng lúc | Status sắp xếp = `[200, 409]`; DB chỉ có đúng 1 audit log `POST_APPROVED`/`POST_REJECTED` cho bài đó | `post.test.ts` |

---

### 8.1. AI Assistant (UC07)

**Files:** `backend/tests/modules/ai/ai.test.ts`, `ai.service.test.ts`, `ai.processor.test.ts`, `ai.providers.test.ts`, `ai.prompt.test.ts`, `backend/tests/modules/credit/credit.service.test.ts`

| Mã | Test | Kỳ vọng |
| :--- | :--- | :--- |
| AI01 | Tạo text generation | `202`, trừ 10 credit, `AiGeneration` PENDING, enqueue `ai:text` |
| AI02 | Không đủ credit | `402`, không tạo generation, số dư không đổi |
| AI03 | Ảnh cho bài mới | Tạo Post DRAFT + generation trong cùng transaction, trừ 20 credit |
| AI04 | Ảnh bài mới thiếu credit | Rollback, không còn Post nháp mồ côi |
| AI05 | Ảnh cho post workspace khác | `404`, không trừ credit |
| AI06 | Enqueue lỗi | Hoàn credit, generation `FAILED`, có giao dịch `REFUND` |
| AI07 | GET generation | Chỉ trả trong đúng workspace; workspace khác `404` |
| AI08 | Text success | Lưu Tiptap JSON vào `response`, `status=SUCCESS` |
| AI09 | Image success | Upload Cloudinary, tạo `MediaAsset` `AI_GENERATED`, response chứa media |
| AI10 | Schema text sai | Retry lần đầu, lần hai `UnrecoverableError` |
| AI11 | Bài rời DRAFT/REJECTED | Fail + hoàn credit, không tạo media |
| AI12 | Chạy lại generation đã SUCCESS | Không tạo media trùng |
| AI13 | `failGeneration` idempotent | Chỉ hoàn credit một lần |
| AI14 | Provider tests | Gemini structured output, content policy, JSON lỗi, HTTP lỗi; Cloudflare decode JPEG/lỗi |
| AI15 | Prompt helpers | Parse/title, Tiptap heading/list, Brand Voice, giới hạn 2048 ký tự |
| AI16 | Credit service | OUTFLOW đúng số dư, 402, REFUND INFLOW đúng số dư |
| AI17 | Route | `202` text/image, `422` body sai, `403` người ngoài workspace |

---

## 9. Health check

**File:** `backend/tests/modules/health/health.test.ts`

| Mã | Tên test case (theo `it(...)`) | Endpoint / hàm | Input chính | Kết quả mong đợi | File |
|----|-------------------------------|----------------|-------------|------------------|------|
| H01 | GET /api/v1/health - Trả về mã HTTP tương ứng và thông tin chẩn đoán kết nối | `GET /api/v1/health` | không cần auth | 200 hoặc 503; nếu 200: `status = success`, message `Hệ thống Marka đang hoạt động ổn định`, `database = connected`, `redis = connected`; nếu 503: `status = error`; `data` luôn có `uptime`, `database`, `redis`, `version` | `health.test.ts` |

---

## 10. Queue Manager (BullMQ)

**File:** `backend/tests/workers/queue-manager.test.ts` (Redis thật, dùng queue `email`)

| Mã | Tên test case (theo `it(...)`) | Endpoint / hàm | Input chính | Kết quả mong đợi | File |
|----|-------------------------------|----------------|-------------|------------------|------|
| Q01 | enqueue tạo job ở trạng thái waiting và đọc được trạng thái | `enqueue` + `getJobStatus` | queue `email`, job `test-job`, data `{ hello: "world" }` | `status` khác null; `state = waiting`; `queue` đúng; `attemptsMade = 0`; `maxAttempts = 3`; `isFinalFailure = false` | `queue-manager.test.ts` |
| Q02 | getJobStatus trả null với job không tồn tại | `getJobStatus` | id `khong-ton-tai` | `null` | `queue-manager.test.ts` |
| Q03 | cancelJob xoá job khỏi hàng đợi | `cancelJob` + `getJobStatus` | job vừa enqueue | `cancelJob` trả `true`; trạng thái sau đó `null` | `queue-manager.test.ts` |
| Q04 | retryJob từ chối job không ở trạng thái failed | `retryJob` | job đang `waiting` | Trả `false` | `queue-manager.test.ts` |
| Q05 | pauseQueue/resumeQueue hoạt động và getQueueStats trả đủ các trường | `pauseQueue`, `resumeQueue`, `getQueueStats` | queue `email` | Không lỗi; stats có đủ `waiting`, `active`, `completed`, `failed`, `delayed` (đều là number) | `queue-manager.test.ts` |
| Q06 | hasRemainingAttempts phân biệt lỗi còn retry và lỗi hẳn | `hasRemainingAttempts` | job giả `attemptsMade=1, attempts=3` và `3, 3` | `true` với 1/3; `false` với 3/3 | `queue-manager.test.ts` |

---

## 11. Middleware & cấu hình

**File:** `backend/tests/middlewares/enforceHttps.test.ts`, `backend/tests/config/swagger.test.ts`

| Mã | Tên test case (theo `it(...)`) | Endpoint / hàm | Input chính | Kết quả mong đợi | File |
|----|-------------------------------|----------------|-------------|------------------|------|
| M01 | Chuyển hướng 301 sang HTTPS khi request là HTTP | middleware `enforceHttps` trên `GET /ping` | `Host: api.marka.vn`, không có `x-forwarded-proto` | 301; `location = https://api.marka.vn/ping` | `enforceHttps.test.ts` |
| M02 | Cho qua khi reverse proxy báo x-forwarded-proto = https | `enforceHttps` trên `GET /ping` | `x-forwarded-proto: https` | 200; body `{ ok: true }` | `enforceHttps.test.ts` |
| S01 | đăng ký luồng duyệt bài UC12/UC15 | `swaggerSpec.paths` | — | Có path `/workspaces/{workspaceId}/posts/{postId}/submit` và `.../review` | `swagger.test.ts` |

---

## 12. Chưa được test

Các hành vi **đã có trong code** nhưng **không có test tự động** tương ứng ở trên.

### 12.1. Auth
- Rate limit: `authLimiter` (15 req/15 phút), `loginLimiter` (5 lần sai/15 phút), `apiLimiter` toàn cục — chưa test 429.
- Đăng nhập khi `isSuspended = true` — chưa test 403.
- Google: thiếu `idToken`, token sai/hết hạn, payload thiếu email, đăng nhập lại khi user đã có `googleId`.
- Refresh token: thiếu token, token hết hạn, `tokenVersion` không khớp sau logout.
- Logout: chưa assert header xoá cookie; chưa assert audit `USER_LOGOUT`.
- Audit `USER_REGISTER`, `USER_LOGIN`, `USER_GOOGLE_LOGIN` chưa được kiểm tra.

### 12.2. User
- Cập nhật `avatar`; validation `name` (2–100) và `avatar` (URL).
- Sau khi đổi mật khẩu, token cũ bị vô hiệu (`tokenVersion` tăng) — chưa test.
- Audit `USER_UPDATE_PROFILE`, `USER_CHANGE_PASSWORD`.

### 12.3. Workspace
- Audit `WORKSPACE_CREATE/UPDATE/DELETE`, `MEMBER_INVITED/JOINED/LEFT/REMOVED/ROLE_CHANGED`.
- Lời mời: token không tồn tại → 404; lời mời hết hạn → 409; email không khớp tài khoản đang đăng nhập → 403; nhánh đã là thành viên (`alreadyMember`).
- `removeMember` chặn xoá Owner duy nhất (409) — mới test hạ vai trò (W17).
- Thành viên thường rời workspace thành công — mới test sole owner bị chặn (W19).
- `deleteWorkspace` chuyển `ChannelConnection` sang `EXPIRED`.
- Thông báo cho owner khi có member tham gia/rời; chi tiết `pendingInvites` (người mời, role, hạn).

### 12.4. Brand Voice
- Validate độ dài từng keyword (1–50), `writingStyle` ≤ 300, `fewShotExamples[].content` (10–5000), `title` ≤ 100.
- Giá trị mặc định khi bỏ trống `writingStyle`, `keywordsShouldUse`, `keywordsAvoid`, `fewShotExamples`.
- Audit khi tạo lần đầu (chỉ assert log ở nhánh cập nhật B06).

### 12.5. Channel
- Lỗi gọi Facebook API: fetch reject, HTTP 5xx, thiếu `access_token` khi exchange → `reason=token_exchange_failed`.
- Thiếu cấu hình Facebook App → 400.
- `state` hết hạn theo thời gian (Redis TTL 600 giây).
- Audit `CHANNEL_CONNECTED`, `CHANNEL_DISCONNECTED`.
- `DELETE /channels/:channelId` với kênh không tồn tại / thuộc workspace khác → 404.
- `GET .../channels` sau khi đã kết nối (test hiện chỉ kiểm tra danh sách rỗng).
- Chuyển `ChannelConnection.status` sang `EXPIRED` khi xoá workspace.

### 12.6. Post & media
- Lọc `dateFrom`/`dateTo` hợp lệ (mới test khoảng ngày sai); `limit` biên 1 và 50; `search` không có kết quả.
- Validate độ dài `title` (255) và `content` khi tạo/cập nhật.
- Xoá bài không ở `DRAFT`/`REJECTED` → 409 (mới test sửa).
- Upload/gỡ media trên bài không editable → 409.
- Danh sách media sau khi gỡ ảnh (P31 chỉ assert 200).
- Audit `POST_SUBMITTED`; `POST_APPROVED`/`POST_REJECTED` chỉ assert gián tiếp ở P51.
- Thông báo khi Owner tự gửi duyệt bài của chính mình.

### 12.7. Schedule & đăng bài
- File `schedule.test.ts` (17 test) + `schedule.content.test.ts` (6 test): tạo lịch nhiều Page, đăng ngay, validate trạng thái/quyền/Page/ảnh/video/giờ hẹn, huỷ lịch, worker đăng thành công nhiều ảnh, token hết hạn, retry, timeout sau feed, recovery, chống đăng trùng, post detail kèm schedules.
- Chưa test job scheduler `schedule-due` chạy thật trong BullMQ; service `processDueSchedules` được test trực tiếp.

### 12.8. Hạ tầng & cấu hình
- Health: nhánh 503 chưa được ép buộc (test chấp nhận 200 hoặc 503).
- Worker processor thật: `content-generation` đã test qua `executeAiGeneration` (không qua Redis); `email` vẫn là processor mẫu, chưa test xử lý job thành công/thất bại.
- `retryJob` thành công trên job `failed`; `hasRemainingAttempts` với job không cấu hình `attempts`.
- Middleware `validate`, `error`, `upload`, `requireAuth` (thiếu/sai token) chưa có test riêng; CORS/helmet/404 handler chưa test.
- Swagger: chỉ assert sự tồn tại của 3 path, chưa assert schema request/response.

---

## 13. Phạm vi chưa triển khai

Các phần sau **không có endpoint/module tương ứng** trong `backend/src/routes/index.ts`, nên không có test:

- **Admin dashboard & API audit log (UC32)** — module `audit` chỉ có service/repository, không expose route.
- **Calendar nâng cao (UC14):** kéo-thả đổi giờ, sửa lịch sau khi tạo — chưa có API/UI.
- **Analytics / `PostMetric` (UC39)** — không có API.
- **Giao việc / trạng thái công việc (UC42, UC43)** — không có module/route.

**UC38 (API đọc notification) đã bỏ khỏi phạm vi**, không tính là phần chưa triển khai.
