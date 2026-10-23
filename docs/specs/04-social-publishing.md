# Phân hệ 4 — Kênh, Facebook OAuth & Lịch đăng bài

> [Quay lại Mục lục](README.md)
>
> **Phạm vi:** phần đã có trong code: xem kênh đã kết nối, kết nối **Facebook Page thật** qua OAuth, ngắt kết nối kênh, đăng ngay/lên lịch bài đã duyệt lên nhiều Page.
> Mã nguồn: `backend/src/modules/channel/`, `backend/src/modules/schedule/`, `utils/encryption.ts`, `config/redis.ts`, `workers/`.
>
> **Không có trong code:** Instagram/TikTok/Zalo (kể cả giả lập), calendar kéo-thả, sửa giờ sau khi tạo, video, làm mới token tự động. Các mục này ở Roadmap cuối file.

---

## 4.1. Mô hình dữ liệu

`ChannelConnection`:

| Trường | Ghi chú |
| :--- | :--- |
| `workspaceId` | Chủ sở hữu kênh |
| `platform` | Enum `FACEBOOK` / `INSTAGRAM` / `TIKTOK` / `ZALO`; code hiện chỉ tạo `FACEBOOK` |
| `type` | `REAL` khi tạo qua OAuth Facebook; `SIMULATED` chỉ là default của schema, chưa có luồng nào tạo |
| `name`, `avatar` | Tên/ảnh Page lấy từ Graph API |
| `externalAccountId` | Page ID trên Facebook |
| `accessToken` | Page token **đã mã hoá AES-256-GCM**; không bao giờ trả ra API |
| `status` | `ACTIVE` / `EXPIRED` |
| unique | `(workspaceId, platform, externalAccountId)` — kết nối lại cùng Page sẽ upsert, không tạo trùng |

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

## 4.3. Kết nối Facebook Page (UC29)

Luồng gồm 4 bước, trong đó bước 2 do Facebook gọi về server.

### Bước 1 — Lấy URL đăng nhập Facebook

`GET /channels/facebook/oauth/url?workspaceId=<uuid>`

- Yêu cầu `requireAuth` + `OWNER` của workspace trong query.
- `workspaceId` phải là UUID, nếu không → `422`.
- Nếu thiếu `FACEBOOK_APP_ID`, `FACEBOOK_APP_SECRET` hoặc `FACEBOOK_REDIRECT_URI` → `400` `"Chưa cấu hình Facebook App. Vui lòng liên hệ quản trị viên."`.
- Sinh `state` = 32 byte ngẫu nhiên (hex 64 ký tự), lưu Redis `fb:oauth:state:<state>` với `{ userId, workspaceId }`, **TTL 600 giây**.
- Response `200`:

```json
{
  "status": "success",
  "message": "Tạo URL đăng nhập Facebook thành công",
  "data": { "url": "https://www.facebook.com/v21.0/dialog/oauth?..." }
}
```

URL xin các scope: `pages_show_list`, `pages_read_engagement`, `pages_manage_posts`.

### Bước 2 — Callback từ Facebook

`GET /channels/facebook/oauth/callback?code=...&state=...`

- Công khai (không `requireAuth`); đây là URL đăng ký với Facebook (`FACEBOOK_REDIRECT_URI`).
- **Luôn redirect** về `CLIENT_URL/channels` kèm query, không trả JSON:

| Tình huống | Redirect |
| :--- | :--- |
| Người dùng từ chối (`error=access_denied`) | `?fb=error&reason=access_denied` |
| Lỗi OAuth khác | `?fb=error&reason=token_exchange_failed` |
| Thiếu `state`/`code`, state không tồn tại hoặc đã dùng | `?fb=error&reason=invalid_state` |
| Không lấy được Page nào | `?fb=error&reason=no_pages` |
| Đổi token/lấy Page thất bại | `?fb=error&reason=token_exchange_failed` |
| Thành công | `?fb=select&session=<sessionId>` |

- `state` được **dùng một lần** (`GETDEL`): request thứ hai với cùng state sẽ nhận `invalid_state`.
- Xử lý khi thành công:
  1. Đổi `code` → token ngắn hạn → token dài hạn (`fb_exchange_token`).
  2. Gọi `/me/accounts` (kèm `appsecret_proof`) lấy Page mà user quản lý; bỏ Page không có `access_token`.
  3. Mã hoá từng Page token, lưu session Redis `fb:oauth:session:<sessionId>` (`{ userId, workspaceId, pages }`), **TTL 600 giây**; `sessionId` = 24 byte ngẫu nhiên (hex 48 ký tự).
- Gọi Graph API có timeout 10 giây; lỗi mạng/Graph đều dẫn tới `token_exchange_failed`.

### Bước 3 — Lấy danh sách Page trong phiên

`GET /channels/facebook/oauth/session/:sessionId`

- Yêu cầu `requireAuth` + `OWNER`.
- `workspaceId` không nằm trong path — phải gửi qua header `x-workspace-id` (hoặc query `workspaceId`).
- `sessionId` phải khớp regex 48 ký tự hex, nếu không → `422`.
- Session không tồn tại/hết hạn/không thuộc đúng `userId` + `workspaceId` → `404` `"Phiên kết nối không tồn tại hoặc đã hết hạn"`.
- Response `200` `"Lấy danh sách Page thành công"`:

```json
{
  "status": "success",
  "message": "Lấy danh sách Page thành công",
  "data": {
    "pages": [ { "id": "1234567890", "name": "Marka Demo Page", "avatar": "https://..." } ]
  }
}
```

Không trả token.

### Bước 4 — Lưu các Page đã chọn

`POST /channels/facebook/oauth/session/:sessionId/connect`

- Yêu cầu `requireAuth` + `OWNER`; `workspaceId` qua header `x-workspace-id` (hoặc query).
- Body:

| Field | Ràng buộc |
| :--- | :--- |
| `pageIds` | mảng string, 1–50 phần tử, mỗi phần tử không rỗng |

- Page id không có trong session → `400` `"Page không hợp lệ trong phiên kết nối"`.
- Không giải mã được token đã lưu → `400` `"Không đọc được token của Page. Vui lòng kết nối lại."`.
- Upsert theo `(workspaceId, FACEBOOK, externalAccountId)` trong một transaction:
  - Tạo mới với `type = REAL`, `status = ACTIVE`.
  - Nếu Page đã từng kết nối: cập nhật `name`, `avatar`, token mới, `status = ACTIVE` (kết nối lại kênh đang `EXPIRED` sẽ kích hoạt lại).
- Ghi audit `CHANNEL_CONNECTED` cho từng kênh (`metadata { pageId, name }`).
- Xoá session sau khi lưu thành công.
- Response `201` `"Kết nối Facebook thành công"`, `data = { channels: [...] }` (các kênh vừa upsert).

> Token không được gửi lên Facebook để thu hồi khi ngắt kết nối; hệ thống chỉ xoá bản ghi cục bộ.

---

## 4.4. Ngắt kết nối kênh (UC30)

`DELETE /channels/:channelId`

- Yêu cầu `requireAuth` + `OWNER`; `workspaceId` qua header `x-workspace-id` (hoặc query/body vì path chỉ có `channelId`).
- `channelId` phải là UUID → nếu không `422`.
- Kênh không tồn tại hoặc thuộc workspace khác → `404` `"Kênh không tồn tại"`.
- Trong một transaction:
  1. Chuyển các `ScheduledPost` của kênh đang `SCHEDULED` sang `CANCELLED`.
  2. Xoá cứng bản ghi `ChannelConnection`.
- Ghi audit `CHANNEL_DISCONNECTED` (`metadata { pageId, name }`).
- Response `200`: `{ "success": true }`.
- Nếu kênh đã có lịch đang chờ, bước 1 chuyển chúng sang `CANCELLED` trước khi xoá kênh; trạng thái tổng của Post được tính lại.

---

## 4.5. Cấu hình & bảo mật

| Biến môi trường | Dùng cho |
| :--- | :--- |
| `FACEBOOK_APP_ID` | `client_id` của OAuth |
| `FACEBOOK_APP_SECRET` | đổi token + `appsecret_proof` |
| `FACEBOOK_REDIRECT_URI` | callback; mặc định `http://localhost:5000/api/v1/channels/facebook/oauth/callback` |
| `AES_SECRET_KEY` | mã hoá Page token (≥ 32 ký tự) |
| `CLIENT_URL` | đích redirect sau callback |
| `REDIS_URL` | lưu state/session OAuth |

- Graph API dùng phiên bản `v21.0`.
- Page token chỉ tồn tại dạng mã hoá trong Redis (session, 10 phút) và trong DB.
- API danh sách kênh không trả `accessToken`.

---

## 4.6. Bảng tổng hợp endpoint

| Method | Path | Xác thực | Vai trò | Ghi chú |
| :--- | :--- | :--- | :--- | :--- |
| GET | `/workspaces/:workspaceId/channels` | Bearer | Thành viên | Danh sách kênh |
| GET | `/channels/facebook/oauth/url?workspaceId=` | Bearer | OWNER | Trả URL Facebook |
| GET | `/channels/facebook/oauth/callback` | — | — | Facebook gọi về, redirect client |
| GET | `/channels/facebook/oauth/session/:sessionId` | Bearer | OWNER | Danh sách Page trong phiên |
| POST | `/channels/facebook/oauth/session/:sessionId/connect` | Bearer | OWNER | Lưu Page đã chọn |
| DELETE | `/channels/:channelId` | Bearer | OWNER | Ngắt kết nối |

---

## 4.7. Lỗi thường gặp

| Mã | Message | Trường hợp |
| :--- | :--- | :--- |
| `400` | `Chưa cấu hình Facebook App. Vui lòng liên hệ quản trị viên.` | Thiếu env Facebook |
| `400` | `Page không hợp lệ trong phiên kết nối` | `pageIds` không thuộc session |
| `400` | `Không đọc được token của Page. Vui lòng kết nối lại.` | Giải mã token thất bại |
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
- Chọn 1–10 Page thuộc workspace, `FACEBOOK`, `REAL`, `ACTIVE`.
- `scheduledAt` ≥ hiện tại + 1 phút, ≤ hiện tại + 1 năm.
- Nội dung text không rỗng, ≤ 63.206 ký tự; tối đa 10 ảnh; chưa hỗ trợ video.
- Mỗi bài/Page chỉ có một `ScheduledPost` (unique `postId, channelId`).

**Worker (`schedule-queue`):**

- `scheduleWorker` đăng ký job scheduler `schedule-due` chạy mỗi 60 giây.
- Mỗi lượt: recovery `PROCESSING` quá 10 phút → `FAILED`; claim các lịch `SCHEDULED` đến hạn; upload từng ảnh với `published=false`; gọi `/{page-id}/feed` với `message` + `attached_media`; lưu `externalPostId`, `publishedAt`.
- Lỗi token 190 → Page `EXPIRED`, lịch `FAILED`, không retry.
- Lỗi mạng/5xx/rate limit trước khi gửi feed → retry tối đa 3 lần (30s → 2 phút → 10 phút). Thời điểm thử lại lưu ở `retryAt`, giữ nguyên `scheduledAt` gốc.
- Timeout sau khi đã gửi feed → `FAILED`, không tự retry để tránh đăng trùng.
- Bài `FAILED`/`PUBLISHED` được đăng lại hoặc lên lịch trên Page chưa có lịch `SCHEDULED/PROCESSING/PUBLISHED` (thử lại Page lỗi, đăng thêm Page mới); chọn Page đã đăng/đang chờ → `409`.

**Trạng thái Post:**

- Còn lịch `SCHEDULED`/`PROCESSING` → `SCHEDULED`.
- Tất cả kết thúc, có ít nhất một `PUBLISHED` → `PUBLISHED`.
- Tất cả kết thúc, không có `PUBLISHED`, có `FAILED` → `FAILED`.
- Tất cả `CANCELLED` → `APPROVED`.

**Vận hành:** `ENABLE_WORKERS=true` để chạy worker chung API (dev), hoặc `npm run worker` ở service riêng (production). Backend phải always-on để scheduler chạy đúng giờ.

---

## 4.9. Chưa triển khai (Roadmap)

1. **Kênh khác:** Instagram, TikTok, Zalo — kể cả chế độ giả lập (`ChannelType.SIMULATED`). Hiện không có endpoint nào tạo kênh ngoài Facebook.
2. **Calendar nâng cao (UC14, UC37):** calendar tháng/tuần, kéo-thả đổi giờ, sửa lịch sau khi tạo.
3. **Vòng đời token:** kiểm tra hạn token định kỳ, thông báo Owner, làm mới token tự động.
4. **Uỷ quyền đăng bài:** dùng `WorkspaceMember.allowDirectPublish` nếu sau này muốn giới hạn Creator.
5. **Bài đã đăng:** sửa/nhân bản/xoá bài `PUBLISHED`.
6. **Video & Analytics:** đăng video, đồng bộ `PostMetric` từ Facebook.
