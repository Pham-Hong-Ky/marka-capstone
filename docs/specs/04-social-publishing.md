# Phân hệ 4 — Kênh, Facebook/Threads OAuth & Lịch đăng bài

> [Quay lại Mục lục](README.md)
>
> **Phạm vi:** phần đã có trong code: xem kênh đã kết nối, kết nối **Facebook Page + Threads thật** qua OAuth, ngắt kết nối kênh, đăng ngay/lên lịch bài đã duyệt lên nhiều kênh.
> Mã nguồn: `backend/src/modules/channel/`, `backend/src/modules/schedule/`, `utils/encryption.ts`, `config/redis.ts`, `workers/`.
>
> **Không có trong code:** Instagram/TikTok/Zalo (kể cả giả lập), calendar kéo-thả, sửa giờ sau khi tạo, video, tự làm mới token Facebook. Các mục này ở Roadmap cuối file.

---

## 4.1. Mô hình dữ liệu

`ChannelConnection`:

| Trường | Ghi chú |
| :--- | :--- |
| `workspaceId` | Chủ sở hữu kênh |
| `platform` | Enum `FACEBOOK` / `THREADS` (schema còn giá trị khác nhưng code chỉ tạo 2 loại này) |
| `type` | `REAL` khi tạo qua OAuth; `SIMULATED` chỉ là default của schema, chưa có luồng nào tạo |
| `name`, `avatar` | Tên/ảnh lấy từ Graph API hoặc Threads API |
| `externalAccountId` | Page ID (Facebook) hoặc user ID (Threads) |
| `accessToken` | Token **đã mã hoá AES-256-GCM**; không bao giờ trả ra API |
| `status` | `ACTIVE` / `EXPIRED` |
| unique | `(workspaceId, platform, externalAccountId)` — kết nối lại cùng tài khoản sẽ upsert, không tạo trùng |

API chỉ trả các trường công khai (`CHANNEL_PUBLIC_SELECT`): `id`, `platform`, `type`, `name`, `avatar`, `externalAccountId`, `status`, `createdAt`, `updatedAt`.

Mã hoá token (`utils/encryption.ts`): AES-256-GCM, key = `sha256(AES_SECRET_KEY)`, chuỗi lưu DB dạng `<iv_hex>:<tag_hex>:<cipher_hex>`.

---

## 4.2. Xem kênh đã kết nối (UC28)

`GET /workspaces/:workspaceId/channels`

- Yêu cầu `requireAuth` + là thành viên workspace (mọi vai trò).
- Trả **tất cả** kênh của workspace, không lọc `platform`/`status`, sắp xếp `createdAt` giảm dần.

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
        "name": "Marka Demo Page",
        "avatar": "https://...",
        "externalAccountId": "1234567890",
        "status": "ACTIVE",
        "createdAt": "2026-10-20T12:00:00.000Z",
        "updatedAt": "2026-10-20T12:00:00.000Z"
      }
    ]
  }
}
```

---

## 4.3. Kết nối kênh (UC29)

Luồng dùng route generic `/channels/:platform/oauth/*`; `platform` là `FACEBOOK` hoặc `THREADS`.

### Bước 1 — Lấy URL đăng nhập

`GET /channels/:platform/oauth/url?workspaceId=<uuid>`

- Yêu cầu `requireAuth` + `OWNER` của workspace trong query.
- `workspaceId` phải là UUID, nếu không → `422`.
- Thiếu cấu hình app tương ứng → `400` `"Chưa cấu hình <nền tảng> App..."`.
- Sinh `state` = 32 byte ngẫu nhiên (hex 64 ký tự), lưu Redis với `{ userId, workspaceId, platform }`, **TTL 600 giây**.
- Response `200`:

```json
{
  "status": "success",
  "message": "Tạo URL đăng nhập thành công",
  "data": { "url": "https://www.facebook.com/v21.0/dialog/oauth?..." }
}
```

URL Facebook xin scope: `pages_show_list`, `pages_read_engagement`, `pages_manage_posts`.
URL Threads xin scope: `threads_basic`, `threads_content_publish`, `threads_manage_insights`.

### Bước 2 — Callback từ nền tảng

`GET /channels/:platform/oauth/callback?code=...&state=...`

- Công khai (không `requireAuth`); đây là URL đăng ký với nền tảng (`FACEBOOK_REDIRECT_URI` / `THREADS_REDIRECT_URI`).
- **Luôn redirect** về `CLIENT_URL/channels` kèm query, không trả JSON:

| Tình huống | Redirect |
| :--- | :--- |
| Người dùng từ chối (`error=access_denied`) | `?platform=<platform>&connect_error=access_denied` |
| Lỗi OAuth khác | `?platform=<platform>&connect_error=token_exchange_failed` |
| Thiếu `state`/`code`, state không tồn tại hoặc đã dùng | `?platform=<platform>&connect_error=invalid_state` |
| Không lấy được tài khoản nào | `?platform=<platform>&connect_error=no_accounts` |
| Facebook thành công | `?connect=FACEBOOK&session=<sessionId>` |
| Threads thành công | `?connected=THREADS` |

- `state` được **dùng một lần** (`GETDEL`): request thứ hai với cùng state sẽ nhận `invalid_state`.
- Facebook (multi-account):
  1. Đổi `code` → token ngắn hạn → token dài hạn (`fb_exchange_token`).
  2. Gọi `/me/accounts` (kèm `appsecret_proof`) lấy Page mà user quản lý; bỏ Page không có `access_token`.
  3. Mã hoá từng Page token, lưu session Redis (`{ userId, workspaceId, accounts }`), **TTL 600 giây**; `sessionId` = 24 byte ngẫu nhiên (hex 48 ký tự).
- Threads (single-account): đổi `code` → long-lived token → lấy profile → upsert ngay vào `ChannelConnection` → redirect `?connected=THREADS`.
- Gọi API nền tảng có timeout 10 giây; lỗi mạng/API đều dẫn tới `token_exchange_failed`.

### Bước 3 — Lấy danh sách tài khoản trong phiên (chỉ Facebook)

`GET /channels/:platform/oauth/session/:sessionId`

- Yêu cầu `requireAuth` + `OWNER`.
- `workspaceId` không nằm trong path — phải gửi qua header `x-workspace-id` (hoặc query `workspaceId`).
- `sessionId` phải khớp regex 48 ký tự hex, nếu không → `422`.
- Session không tồn tại/hết hạn/không thuộc đúng `userId` + `workspaceId` → `404` `"Phiên kết nối không tồn tại hoặc đã hết hạn"`.
- Response `200` `"Lấy danh sách tài khoản thành công"`:

```json
{
  "status": "success",
  "message": "Lấy danh sách tài khoản thành công",
  "data": {
    "accounts": [ { "externalAccountId": "1234567890", "name": "Marka Demo Page", "avatar": "https://..." } ]
  }
}
```

Không trả token.

### Bước 4 — Lưu các tài khoản đã chọn (chỉ Facebook)

`POST /channels/:platform/oauth/session/:sessionId/connect`

- Yêu cầu `requireAuth` + `OWNER`; `workspaceId` qua header `x-workspace-id` (hoặc query).
- Body:

| Field | Ràng buộc |
| :--- | :--- |
| `accountIds` | mảng string, 1–50 phần tử, mỗi phần tử không rỗng |

- Account id không có trong session → `400` `"Tài khoản không hợp lệ trong phiên kết nối"`.
- Không giải mã được token đã lưu → `400` `"Không đọc được token của tài khoản. Vui lòng kết nối lại."`.
- Upsert theo `(workspaceId, FACEBOOK, externalAccountId)` trong một transaction:
  - Tạo mới với `type = REAL`, `status = ACTIVE`.
  - Nếu tài khoản đã từng kết nối: cập nhật `name`, `avatar`, token mới, `status = ACTIVE` (kết nối lại kênh đang `EXPIRED` sẽ kích hoạt lại).
- Ghi audit `CHANNEL_CONNECTED` cho từng kênh (`metadata { externalAccountId, name }`).
- Xoá session sau khi lưu thành công.
- Response `201` `"Kết nối kênh thành công"`, `data = { channels: [...] }` (các kênh vừa upsert).

> Token không được gửi lên Facebook để thu hồi khi ngắt kết nối; hệ thống chỉ xoá bản ghi cục bộ.

---

## 4.4. Ngắt kết nối kênh (UC30)

`DELETE /channels/:channelId`

- Yêu cầu `requireAuth` + `OWNER`; `workspaceId` qua header `x-workspace-id` (hoặc query/body vì path chỉ có `channelId`).
- `channelId` phải là UUID → nếu không `422`.
- Kênh không tồn tại hoặc thuộc workspace khác → `404` `"Kênh không tồn tại"`.
- Trong một transaction:
  1. Chuyển các `ScheduledPost` của kênh đang `SCHEDULED` sang `CANCELLED`.
  2. Xoá mềm `ChannelConnection` (`deletedAt`), xoá `accessToken`, đặt `status = EXPIRED`.
- Nếu còn lịch `PROCESSING` → `409` `"Kênh đang đăng bài, vui lòng thử lại sau"`.
- Ghi audit `CHANNEL_DISCONNECTED` (`metadata { externalAccountId, name }`).
- Response `200`: `{ "success": true }`.
- Trạng thái tổng của Post được tính lại sau khi huỷ lịch.

---

## 4.5. Cấu hình & bảo mật

| Biến môi trường | Dùng cho |
| :--- | :--- |
| `FACEBOOK_APP_ID` | `client_id` của OAuth |
| `FACEBOOK_APP_SECRET` | đổi token + `appsecret_proof` |
| `FACEBOOK_REDIRECT_URI` | callback Facebook; mặc định `http://localhost:5000/api/v1/channels/facebook/oauth/callback` |
| `THREADS_APP_ID` / `THREADS_APP_SECRET` | OAuth Threads |
| `THREADS_REDIRECT_URI` | callback Threads; mặc định `http://localhost:5000/api/v1/channels/threads/oauth/callback` |
| `AES_SECRET_KEY` | mã hoá token kênh (≥ 32 ký tự) |
| `CLIENT_URL` | đích redirect sau callback |
| `REDIS_URL` | lưu state/session OAuth |

- Facebook Graph API dùng phiên bản `v21.0`; Threads dùng `graph.threads.com/v1.0`.
- Token chỉ tồn tại dạng mã hoá trong Redis (session, 10 phút) và trong DB.
- API danh sách kênh không trả `accessToken`.
- Threads tự gia hạn token qua `channel-maintenance-queue`; Facebook chưa tự gia hạn.

---

## 4.6. Bảng tổng hợp endpoint

| Method | Path | Xác thực | Vai trò | Ghi chú |
| :--- | :--- | :--- | :--- | :--- |
| GET | `/workspaces/:workspaceId/channels` | Bearer | Thành viên | Danh sách kênh |
| GET | `/workspaces/:workspaceId/channels/:channelId` | Bearer | Thành viên | Chi tiết kênh + thống kê |
| PATCH | `/workspaces/:workspaceId/channels/:channelId` | Bearer | Thành viên | Đổi nhãn nội bộ |
| POST | `/workspaces/:workspaceId/channels/:channelId/refresh` | Bearer | Thành viên | Làm mới tên/avatar |
| GET | `/channels/:platform/oauth/url?workspaceId=` | Bearer | OWNER | Trả URL OAuth |
| GET | `/channels/:platform/oauth/callback` | — | — | Nền tảng gọi về, redirect client |
| GET | `/channels/:platform/oauth/session/:sessionId` | Bearer | OWNER | Danh sách tài khoản trong phiên (Facebook) |
| POST | `/channels/:platform/oauth/session/:sessionId/connect` | Bearer | OWNER | Lưu tài khoản đã chọn (Facebook) |
| DELETE | `/channels/:channelId` | Bearer | OWNER | Ngắt kết nối |

---

## 4.7. Lỗi thường gặp

| Mã | Message | Trường hợp |
| :--- | :--- | :--- |
| `400` | `Chưa cấu hình <nền tảng> App...` | Thiếu env Facebook/Threads |
| `400` | `Tài khoản không hợp lệ trong phiên kết nối` | `accountIds` không thuộc session |
| `400` | `Không đọc được token của tài khoản. Vui lòng kết nối lại.` | Giải mã token thất bại |
| `403` | `Bạn không có quyền thực hiện hành động này trong Workspace` | Creator gọi API OWNER |
| `404` | `Phiên kết nối không tồn tại hoặc đã hết hạn` | Session hết TTL/sai user/workspace |
| `404` | `Kênh không tồn tại` | Sai id hoặc khác workspace |
| `422` | `Phiên kết nối không hợp lệ` | `sessionId` sai định dạng |

---

## 4.8. Lịch đăng & đăng bài (UC13, UC14, UC16, UC37)

Mọi thành viên workspace được đăng/lên lịch bài ở trạng thái `APPROVED`.

| Method | Path | Mô tả |
| :--- | :--- | :--- |
| POST | `/workspaces/:workspaceId/posts/:postId/schedules` | Body `{ channelIds: string[], scheduledAt?: ISO }`; bỏ `scheduledAt` = đăng ngay |
| GET | `/workspaces/:workspaceId/schedules?status=&from=&to=&page=&limit=` | Danh sách lịch cho trang `/schedule` |
| DELETE | `/workspaces/:workspaceId/schedules/:scheduleId` | Huỷ lịch đang `SCHEDULED` |

**Validate:**

- Post tồn tại, chưa xoá, `APPROVED`.
- Chọn 1–10 kênh thuộc workspace, `REAL`, `ACTIVE`, provider hỗ trợ đăng bài.
- `scheduledAt` ≥ hiện tại + 1 phút, ≤ hiện tại + 1 năm; bỏ trống = đăng ngay.
- Nội dung text không rỗng, giới hạn theo provider: Facebook ≤ 63.206 ký tự/10 ảnh; Threads ≤ 500 ký tự/20 ảnh/5 link; chưa hỗ trợ video.
- Mỗi bài/kênh chỉ có một `ScheduledPost` (unique `postId, channelId`).

**Worker (`schedule-queue`):**

- `scheduleWorker` đăng ký job scheduler `schedule-due` chạy mỗi 60 giây.
- Mỗi lượt: recovery `PROCESSING` quá 10 phút → `FAILED`; claim các lịch `SCHEDULED` đến hạn; gọi provider tương ứng (Facebook: upload ảnh + `/{page-id}/feed`; Threads: container + `threads_publish`); lưu `externalPostId`, `publishedAt`.
- Lỗi token 190 → kênh `EXPIRED`, lịch `FAILED`, không retry.
- Lỗi mạng/5xx/rate limit trước khi gửi feed → retry tối đa 3 lần (30s → 2 phút → 10 phút). Thời điểm thử lại lưu ở `retryAt`, giữ nguyên `scheduledAt` gốc.
- Timeout sau khi đã gửi feed → `FAILED`, không tự retry để tránh đăng trùng.
- Bài `FAILED`/`PUBLISHED` được đăng lại hoặc lên lịch trên kênh chưa có lịch `SCHEDULED/PROCESSING/PUBLISHED` (thử lại kênh lỗi, đăng thêm kênh mới); chọn kênh đã đăng/đang chờ → `409`.

**Trạng thái Post:**

- Còn lịch `SCHEDULED`/`PROCESSING` → `SCHEDULED`.
- Tất cả kết thúc, có ít nhất một `PUBLISHED` → `PUBLISHED`.
- Tất cả kết thúc, không có `PUBLISHED`, có `FAILED` → `FAILED`.
- Tất cả `CANCELLED` → `APPROVED`.

**Vận hành:** `ENABLE_WORKERS=true` để chạy worker chung API (dev), hoặc `npm run worker` ở service riêng (production). Backend phải always-on để scheduler chạy đúng giờ.

---

## 4.9. Chưa triển khai (Roadmap)

1. **Kênh khác:** Instagram, TikTok, Zalo — kể cả chế độ giả lập (`ChannelType.SIMULATED`). Hiện chỉ có Facebook/Threads.
2. **Calendar nâng cao (UC14, UC37):** calendar tháng/tuần, kéo-thả đổi giờ, sửa lịch sau khi tạo.
3. **Vòng đời token:** tự làm mới token Facebook, thông báo Owner khi token sắp hết hạn.
4. **Uỷ quyền đăng bài:** dùng `WorkspaceMember.allowDirectPublish` nếu sau này muốn giới hạn Creator (cột đang reserved, không trả API).
5. **Bài đã đăng:** sửa/nhân bản/xoá bài `PUBLISHED`.
6. **Video:** đăng video; analytics đã có trong Dashboard.
