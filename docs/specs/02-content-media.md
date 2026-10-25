# Phân hệ 2 — Nội dung, Media & Duyệt bài

> [Quay lại Mục lục](README.md)
>
> **Phạm vi:** phần đã có trong code: CRUD bài viết, upload/xoá ảnh gắn với bài, luồng gửi duyệt – duyệt/từ chối, notification in-app và audit log phát sinh.
> Mã nguồn: `backend/src/modules/post`, `middlewares/upload.ts`, `utils/cloudinary.client.ts`, `modules/workspace/workspace.repository.ts` (notification), `modules/audit`.
>
> **Không có trong code:** thư viện media độc lập cấp workspace, calendar nâng cao. Các mục này nằm ở Roadmap cuối file.

---

## 2.1. Mô hình bài viết & trạng thái

Bảng `posts` (`Post`):

| Trường | Ghi chú |
| :--- | :--- |
| `id`, `workspaceId` | UUID; mọi truy vấn scope theo `workspaceId` |
| `title` | 1–255 ký tự |
| `content` | JSON tuỳ ý (`{ type: 'doc', content: [] }` là ví dụ), **không** lưu HTML thô ở tầng API |
| `status` | `DRAFT` mặc định |
| `campaignTag` | Có trong schema nhưng **chưa có API nào ghi/đọc**; luôn `null` |
| `rejectReason` | Lý do từ chối, tối đa 255 ký tự |
| `submittedById`, `submittedAt` | Ghi khi gửi duyệt |
| `reviewedById`, `reviewedAt` | Ghi khi duyệt/từ chối |
| `createdById` | Người tạo; dùng để phân quyền cho `CONTENT_CREATOR` |
| `deletedAt` | Xoá mềm |

### State machine thực tế

`PostStatus` trong schema có 8 giá trị, nhưng code **chỉ dùng 4**:

```
DRAFT ──submit──▶ PENDING ──approve──▶ APPROVED
  ▲                 │
  │                 └──reject──▶ REJECTED
  │                                 │
  └────────── (không có) ◀──────────┘
                    REJECTED ──submit──▶ PENDING
```

| Từ | Sang | Thao tác |
| :--- | :--- | :--- |
| `DRAFT` | `PENDING` | `POST .../submit` |
| `REJECTED` | `PENDING` | `POST .../submit` (gửi duyệt lại, xoá `rejectReason`) |
| `PENDING` | `APPROVED` / `REJECTED` | `PATCH .../review` |
| khác | — | Không có transition; trả `409` `"Không thể chuyển trạng thái bài viết này"` |

- `SCHEDULED`, `PUBLISHED`, `FAILED`, `ARCHIVED` tồn tại trong enum nhưng **không có code nào set** và không có API riêng.
- Không có API đổi trạng thái trực tiếp; mọi thay đổi đi qua submit/review.
- Transition dùng `updateMany({ where: { id, workspaceId, status: from } })`; nếu bản ghi đã đổi trạng thái bởi request khác thì trả `409` (chống race).

---

## 2.2. Tạo, xem, tìm kiếm bài viết (UC06, UC09, UC10)

### `POST /workspaces/:workspaceId/posts` (UC06)

Yêu cầu `requireAuth` + là thành viên workspace (mọi vai trò).

| Field | Ràng buộc |
| :--- | :--- |
| `title` | string, `trim`, 1–255 ký tự |
| `content` | JSON object (`z.record(z.unknown())`), bắt buộc |

- Tạo bản ghi với `status = DRAFT`, `createdById = req.user.id`.
- **Không** ghi audit, **không** gửi notification.
- Response `201` `"Tạo bản nháp thành công"`, `data` là bản ghi `Post` đầy đủ (gồm `id`, `workspaceId`, `title`, `content`, `status`, `createdById`, `createdAt`, `updatedAt`...).

### `GET /workspaces/:workspaceId/posts` (UC10)

Yêu cầu `requireAuth` + là thành viên. Trả bài viết **chưa xoá mềm** của workspace, sắp xếp `updatedAt` giảm dần.

Query (Zod coerce):

| Param | Ràng buộc | Ý nghĩa |
| :--- | :--- | :--- |
| `page` | int ≥ 1, mặc định 1 | Trang |
| `limit` | int 1–50, mặc định 10 | Số bản ghi/trang |
| `search` | string, `trim` | Tìm gần đúng theo **`title`** (không phân biệt hoa thường) |
| `status` | một giá trị `PostStatus` | Lọc theo trạng thái (nhận cả 8 giá trị enum) |
| `createdById` | UUID | Lọc theo người tạo |
| `dateFrom`, `dateTo` | ngày | Lọc theo `createdAt`; `dateTo < dateFrom` → `422` `"Khoảng ngày không hợp lệ"` |

Response:

```json
{
  "status": "success",
  "message": "Lấy danh sách bài viết thành công",
  "data": {
    "posts": [
      { "id": "uuid", "title": "...", "status": "DRAFT", "createdById": "uuid", "createdAt": "2026-10-20T12:00:00.000Z", "updatedAt": "2026-10-20T12:00:00.000Z" }
    ]
  },
  "meta": { "page": 1, "limit": 10, "total": 1, "totalPages": 1 }
}
```

- Danh sách chỉ trả các cột tóm tắt ở trên (không có `content`, không có media).
- Không hỗ trợ lọc theo `campaignTag` hay theo người duyệt.

### `GET /workspaces/:workspaceId/posts/:postId` (UC09)

Yêu cầu `requireAuth` + là thành viên.

- Tìm theo `id` + `workspaceId`, chưa xoá mềm; không thấy → `404` `"Bài viết không tồn tại"`.
- `data` là bản ghi `Post` đầy đủ kèm `mediaAssets`: mảng media **chưa xoá**, sắp xếp `createdAt` tăng dần.

```json
{
  "status": "success",
  "message": "Lấy chi tiết bài viết thành công",
  "data": {
    "id": "uuid",
    "workspaceId": "uuid",
    "title": "...",
    "content": { "type": "doc", "content": [] },
    "status": "DRAFT",
    "rejectReason": null,
    "createdById": "uuid",
    "submittedById": null,
    "submittedAt": null,
    "reviewedById": null,
    "reviewedAt": null,
    "mediaAssets": [
      { "id": "uuid", "url": "https://res.cloudinary.com/...", "type": "IMAGE", "mimeType": "image/png", "size": 12345 }
    ]
  }
}
```

---

## 2.3. Sửa & xoá bài viết (UC08, UC11)

Quyền chung cho cả sửa và xoá (`assertCanModify` + `assertEditable`):

- `OWNER`: được thao tác **mọi bài** trong workspace.
- `CONTENT_CREATOR`: chỉ bài có `createdById` trùng user hiện tại; bài người khác → `403` `"Bạn không có quyền thay đổi bài viết này"`.
- Chỉ bài `DRAFT` hoặc `REJECTED` mới được sửa/xoá; trạng thái khác → `409` `"Chỉ có thể thay đổi bản nháp hoặc bài bị từ chối"`.

### `PATCH /workspaces/:workspaceId/posts/:postId` (UC08)

| Field | Ràng buộc |
| :--- | :--- |
| `title` | tuỳ chọn, `trim`, 1–255 |
| `content` | tuỳ chọn, JSON object |

- Phải có ít nhất một field → nếu không `422` `"Cần cung cấp ít nhất một trường để cập nhật"`.
- Không đổi được `status`, `campaignTag`, người duyệt.
- Không ghi audit, không notification.
- Response `200` `"Cập nhật bản nháp thành công"`, `data` là bản ghi sau cập nhật.

### `DELETE /workspaces/:workspaceId/posts/:postId` (UC11)

- Chỉ xoá được `DRAFT`/`REJECTED`; bài `PENDING`/`APPROVED` (và các trạng thái khác) trả `409`.
- **Xoá mềm**: set `deletedAt = now`; không xoá media, không xoá asset trên Cloudinary.
- Không ghi audit.
- Response `200`: `{ "success": true }`.
- Hệ quả: bài đã xoá không còn trong list/detail và không thể khôi phục qua API. Đây là lý do UC11 được xếp **Một phần** (chưa có luồng thu hồi bài `PENDING`/`APPROVED` rồi xoá, chưa có xoá cứng).

---

## 2.4. Media gắn bài viết (thuộc UC06/UC08)

Media hiện chỉ tồn tại **trong ngữ cảnh một bài viết**; không có thư viện dùng chung, không có quota, tag, video hay tìm kiếm media.

### `POST /workspaces/:workspaceId/posts/:postId/media`

Yêu cầu `requireAuth` + là thành viên + quyền sửa bài (Owner hoặc người tạo) + bài `DRAFT`/`REJECTED`.
`multipart/form-data`, field **`file`**.

| Ràng buộc | Giá trị |
| :--- | :--- |
| Định dạng | `image/jpeg`, `image/png`, `image/webp` |
| Kích thước | ≤ **10MB** |
| Số file | 1 file/request |

- Thứ tự kiểm tra: thiếu file → `400` `"Vui lòng chọn ảnh để tải lên"`; sau đó mới kiểm tra bài và quyền.
- Upload Cloudinary vào folder `marka/workspaces/:workspaceId/posts/:postId`.
- Tạo `MediaAsset`: `type = IMAGE`, `source = UPLOADED`, `url` (secure URL), `mimeType`, `size`, `createdById`.
- Response `201` `"Tải ảnh lên thành công"`, `data` là bản ghi `MediaAsset`.
- Lỗi upload: `400` `"Ảnh vượt quá 10MB"`, `"Chỉ chấp nhận ảnh JPG, PNG hoặc WEBP"`, `"Tải ảnh lên không hợp lệ"`, `"Chưa cấu hình Cloudinary để tải ảnh lên"`, `"Tải ảnh lên thất bại, vui lòng thử lại"`.

### `DELETE /workspaces/:workspaceId/posts/:postId/media/:mediaId`

- Cùng điều kiện quyền/trạng thái như upload.
- Media phải thuộc đúng bài; không thấy → `404` `"Ảnh không tồn tại trong bài viết"`.
- **Xoá mềm** `MediaAsset` (`deletedAt = now`); **không** xoá file trên Cloudinary.
- Response `200`: `{ "success": true }`.

> Vì `postId` là bắt buộc khi tạo media, `MediaAsset.postId` trên thực tế luôn khác `null`, dù schema cho phép `null`.
>
> Ảnh do AI tạo cũng là `MediaAsset` với `source = AI_GENERATED`, được gắn vào bài qua
> `POST /workspaces/:workspaceId/ai/images` (xem [03 §3.5.2](./03-ai-brandvoice.md)).
> Ảnh AI hiển thị chung mục “Ảnh đính kèm” và xoá được như ảnh upload.

---

## 2.5. Gửi duyệt & duyệt bài (UC12, UC15)

### `POST /workspaces/:workspaceId/posts/:postId/submit` (UC12)

- Quyền: Owner hoặc người tạo bài.
- Chỉ từ `DRAFT` hoặc `REJECTED`; nếu không → `409` `"Không thể chuyển trạng thái bài viết này"`.
- Cập nhật: `status = PENDING`, `submittedById`, `submittedAt = now`, `rejectReason = null`.
- Sau khi đổi trạng thái (không cùng transaction):
  1. Gửi notification in-app `POST_SUBMITTED` cho **các Owner khác** (trừ chính người gửi), payload `{ postId, postTitle, submittedById }`.
  2. Gửi email `buildPostSubmittedEmail` cho từng Owner đó.
  3. Ghi audit `POST_SUBMITTED` (`targetType = Post`, `metadata { title }`).
- Nếu workspace chỉ có một Owner và chính Owner đó gửi duyệt → danh sách người nhận rỗng, **không** có notification/email.
- Response `200` `"Gửi duyệt bài viết thành công"`, `data` là bản ghi sau cập nhật.

### `PATCH /workspaces/:workspaceId/posts/:postId/review` (UC15)

Yêu cầu `requireAuth` + `OWNER`.

| Field | Ràng buộc |
| :--- | :--- |
| `decision` | `APPROVED` hoặc `REJECTED` |
| `rejectReason` | Bắt buộc khi `REJECTED`; `trim`, 3–255 ký tự; bị bỏ qua khi `APPROVED` |

- Chỉ từ `PENDING`; nếu không → `409` `"Không thể chuyển trạng thái bài viết này"`.
- Cập nhật `status`, `reviewedById`, `reviewedAt = now`, `rejectReason` (`null` nếu approve).
- Không chặn Owner tự duyệt bài do chính mình tạo.
- Sau khi đổi trạng thái:
  1. Notification in-app `POST_APPROVED` hoặc `POST_REJECTED` cho **tác giả** (`post.createdById`), payload `{ postId, postTitle, approved, reason }`. Nếu bài không còn `createdById` (user đã bị xoá) → không gửi.
  2. Email `buildPostReviewedEmail` cho tác giả (nếu tìm thấy user).
  3. Audit `POST_APPROVED` / `POST_REJECTED`, kèm `reason = rejectReason`, `metadata { title }`.
- Response `200`: `"Duyệt bài viết thành công"` hoặc `"Từ chối bài viết thành công"`, `data` là bản ghi sau cập nhật.

Chi tiết email & notification: xem [05](./05-notifications-email.md).

---

## 2.6. Notification & audit phát sinh

### Notification in-app

| Type | Người nhận | Khi nào | Payload |
| :--- | :--- | :--- | :--- |
| `POST_SUBMITTED` | Các Owner **trừ** người gửi duyệt | Submit thành công | `{ postId, postTitle, submittedById }` |
| `POST_APPROVED` | Tác giả bài (`createdById`) | Duyệt thành công | `{ postId, postTitle, approved: true, reason: null }` |
| `POST_REJECTED` | Tác giả bài | Từ chối | `{ postId, postTitle, approved: false, reason }` |

- Bản ghi `Notification` có `isRead = false`; **chưa có API đọc danh sách**.
- Notification/email chạy **sau** khi trạng thái đã đổi và **không** nằm trong cùng transaction; lỗi gửi email không làm fail request (xem 05), lỗi ghi notification có thể làm request trả lỗi dù trạng thái đã đổi.

### Audit

| Action | Khi nào | `reason` |
| :--- | :--- | :--- |
| `POST_SUBMITTED` | Gửi duyệt | — |
| `POST_APPROVED` | Duyệt | — |
| `POST_REJECTED` | Từ chối | Lý do từ chối |

Tạo/sửa/xoá bài và thao tác media **không** ghi audit. Chưa có API đọc audit (xem [07](./07-admin-analytics.md)).

---

## 2.7. Phân quyền tóm tắt

| Thao tác | OWNER | CONTENT_CREATOR |
| :--- | :--- | :--- |
| Tạo bài | ✅ | ✅ |
| Xem danh sách/chi tiết | ✅ | ✅ |
| Sửa/xoá bài | ✅ mọi bài, chỉ `DRAFT`/`REJECTED` | ✅ bài của mình, chỉ `DRAFT`/`REJECTED` |
| Upload/xoá media | ✅ mọi bài đang sửa được | ✅ bài của mình đang sửa được |
| Gửi duyệt | ✅ mọi bài | ✅ bài của mình |
| Duyệt/từ chối | ✅ | ❌ `403` |
| Xem notification | Chưa có API | Chưa có API |

---

## 2.8. Bảng tổng hợp endpoint

| Method | Path | Quyền | Response |
| :--- | :--- | :--- | :--- |
| POST | `/workspaces/:workspaceId/posts` | Thành viên | `201` + Post |
| GET | `/workspaces/:workspaceId/posts` | Thành viên | `200` + `{ posts }` + `meta` |
| GET | `/workspaces/:workspaceId/posts/:postId` | Thành viên | `200` + Post kèm `mediaAssets` |
| PATCH | `/workspaces/:workspaceId/posts/:postId` | Chủ bài / OWNER | `200` + Post |
| DELETE | `/workspaces/:workspaceId/posts/:postId` | Chủ bài / OWNER | `200` + `{ success: true }` |
| POST | `/workspaces/:workspaceId/posts/:postId/media` | Chủ bài / OWNER | `201` + MediaAsset |
| DELETE | `/workspaces/:workspaceId/posts/:postId/media/:mediaId` | Chủ bài / OWNER | `200` + `{ success: true }` |
| POST | `/workspaces/:workspaceId/posts/:postId/submit` | Chủ bài / OWNER | `200` + Post |
| PATCH | `/workspaces/:workspaceId/posts/:postId/review` | OWNER | `200` + Post |

`workspaceId` có thể truyền qua header `x-workspace-id` thay cho path; nếu truyền cả hai và khác nhau → `403`.

---

## 2.9. Lỗi thường gặp

| Mã | Message | Trường hợp |
| :--- | :--- | :--- |
| `400` | `Vui lòng chọn ảnh để tải lên` | Upload thiếu file |
| `400` | `Ảnh vượt quá 10MB` | File quá lớn |
| `400` | `Chỉ chấp nhận ảnh JPG, PNG hoặc WEBP` | Sai MIME |
| `400` | `Người nhận việc không phải là thành viên của workspace` | Giao việc cho người ngoài workspace |
| `403` | `Bạn không có quyền thay đổi bài viết này` | Creator sửa bài người khác |
| `403` | `Chỉ người nhận việc hoặc chủ workspace được cập nhật trạng thái công việc` | Creator khác đổi trạng thái việc |
| `404` | `Bài viết không tồn tại` | Sai id / khác workspace / đã xoá mềm |
| `404` | `Ảnh không tồn tại trong bài viết` | Media không thuộc bài |
| `409` | `Chỉ có thể thay đổi bản nháp hoặc bài bị từ chối` | Sửa/xoá/upload media ở trạng thái khác |
| `409` | `Không thể chuyển trạng thái bài viết này` | Submit/review sai trạng thái hoặc race |
| `409` | `Bài viết chưa được giao việc` | Đổi `taskStatus` khi chưa có người nhận |
| `422` | `Cần cung cấp ít nhất một trường để cập nhật` | PATCH body rỗng |
| `422` | `Cần nhập lý do khi từ chối bài viết` | Reject thiếu `rejectReason` |

**Lưu ý về workspace đã xoá mềm:** `requireWorkspaceRole` kiểm tra `Workspace.deletedAt` và trả `404 "Workspace không tồn tại hoặc đã bị xoá"`, nên mọi route bài viết đều bị chặn sau khi workspace bị xoá mềm.

---

## 2.10. Giao việc & trạng thái công việc (UC42, UC43)

- **Giao việc** — `PATCH /workspaces/:workspaceId/posts/:postId/assign`, chỉ `OWNER`.
  - Body: `assigneeId` (uuid hoặc `null`) và `dueAt` (ISO-8601 tuỳ chọn).
  - Người nhận phải là thành viên workspace, nếu không → `400`.
  - Ghi `assigneeId`, `assignedById`, `assignedAt`, `dueAt`; notification `TASK_ASSIGNED` cho người nhận (trừ khi tự giao) và audit `POST_ASSIGNED`.
  - `assigneeId = null` để bỏ giao việc: xoá người nhận/hạn chót và đưa `taskStatus` về `TODO`.
- **Cập nhật trạng thái** — `PATCH /workspaces/:workspaceId/posts/:postId/task-status`, người nhận việc hoặc `OWNER`.
  - `status`: `TODO` | `IN_PROGRESS` | `DONE` | `CANCELLED`; độc lập với `Post.status`.
  - Bài chưa giao việc → `409`; không phải người nhận/Owner → `403`.
  - Notification `TASK_STATUS_CHANGED` cho Owner và tác giả bài (trừ người thao tác), audit `TASK_STATUS_CHANGED`.
- **Lọc danh sách**: `GET .../posts?assigneeId=me` (việc của tôi) hoặc uuid, kết hợp `taskStatus`.

---

## 2.11. Chưa triển khai (Roadmap)

- **Thư viện media cấp workspace**: `MediaAsset.postId` nullable, upload độc lập, tag, quota, lọc/tìm kiếm, video/thumbnail. Hiện chỉ có ảnh gắn bài.
- **Calendar nâng cao**: kéo-thả đổi giờ, sửa lịch sau khi tạo — đăng ngay/lên lịch/huỷ lịch cơ bản đã có trong [04](./04-social-publishing.md).
- Nâng cấp giao việc: board Kanban, độ ưu tiên, nhắc hạn qua email.
- Lịch sử phiên bản bài viết, bình luận/góp ý theo bài, xuất CSV/Excel, lọc theo `campaignTag`, khôi phục bài đã xoá mềm.
- Xoá cứng / xoá asset Cloudinary khi xoá media hoặc bài.
