# Phân hệ 8 — Post Analytics

> [Quay lại Mục lục](README.md)
>
> **Trạng thái: ĐÃ TRIỂN KHAI (backend + frontend).** Có module `analytics` với endpoint xem thống kê/gợi ý và đồng bộ `PostMetric` qua queue; Dashboard `/` hiển thị KPI, biểu đồ, độ phủ số liệu và gợi ý. n8n và snapshot xu hướng vẫn ngoài phạm vi.

---

## 8.1. Mục tiêu

| UC | Chức năng | Tác nhân |
| :--- | :--- | :--- |
| **UC39** | Xem tổng quan hiệu quả của workspace | Creator, Owner |

Chỉ số dự kiến: **reactions, comments, shares** cho bài đăng trên Facebook Page/Threads thật. `reach`/`impressions` chỉ hiển thị khi nền tảng trả về (phụ thuộc Insights).

---

## 8.2. Hiện trạng trong code

- Module `backend/src/modules/analytics` (service, repository, aggregate, suggestion, processor), route đều `requireAuth` + `requireWorkspaceRole()`.
- `GET /workspaces/:workspaceId/analytics/overview` — query `range` (`7d`/`30d`/`mtd`/`lastMonth`/`custom`), `from`/`to` (bắt buộc khi `custom`, tối đa 366 ngày), `channelId`, `tag`; trả:
  - `summary`: `likes` (reactions), `comments`, `shares`, `impressions` (`null` khi chưa có), `engagementRate`, `deltas` so với kỳ trước dài bằng kỳ hiện tại.
  - `series`: điểm theo ngày (múi giờ Việt Nam) gồm `posts`, `reach`, `impressions`.
  - `coverage`: `publishedPosts`, `syncedPosts`, `missingImpressions`, `lastSyncedAt`.
  - `tags`: nhãn chiến dịch (`Post.campaignTag`) để lọc.
- `GET /workspaces/:workspaceId/analytics/suggestions` — `channelId` tuỳ chọn; trả `bestTimes` (khung giờ tốt nhất 90 ngày, `usedFallback` khi không đủ mẫu), `sampleSize`, `windowDays`, `contentTips` (bài nháp: thiếu media, caption quá ngắn/dài, thiếu CTA, quá nhiều hashtag, ngoài khung giờ tốt, có link ngoài).
- `POST /workspaces/:workspaceId/analytics/sync` — trả `202` `{ queued: true }`, đẩy job `analytics-sync` vào `analytics-queue` cho workspace hiện tại.
- **Đồng bộ:** `analyticsWorker` gọi `facebookClient.fetchPostMetrics` cho bài `PUBLISHED` có `externalPostId`, kênh `FACEBOOK`/`ACTIVE`, trong 30 ngày, tối đa 50 bài/lần, bỏ qua bài đã đồng bộ trong 6 giờ; upsert `PostMetric` theo `scheduledPostId`, ghi `fetchedAt`/`syncError`. Lỗi đọc token ghi `syncError`; token hết hạn đánh dấu kênh `EXPIRED`.
- Job lặp mỗi 6 giờ (`registerAnalyticsScheduler`) chạy toàn hệ thống; endpoint chỉ đồng bộ trong workspace gọi.
- **Frontend Dashboard `/`:** lọc khoảng thời gian/kênh/nhãn (đồng bộ query string), 5 KPI (tương tác, bình luận, chia sẻ, tỷ lệ tương tác, hiển thị — chỉ hiện khi có dữ liệu) kèm delta, biểu đồ xu hướng, cảnh báo độ phủ, thẻ khung giờ tốt + gợi ý nội dung; nút "Đồng bộ số liệu" gọi `POST .../sync` rồi poll `overview` mỗi 5 giây, tối đa 60 giây.
- `reach`/`impressions` lấy thêm từ Insights; chỉ hiển thị khi nền tảng trả về.

---

## 8.3. Schema đã có

### `PostMetric`

| Trường | Kiểu | Ghi chú |
| :--- | :--- | :--- |
| `id` | UUID | PK |
| `scheduledPostId` | String(36), **unique** | 1-1 với `ScheduledPost` |
| `reactions` | Int = 0 | Tổng reaction |
| `reactionsDetail` | JSON? | Chi tiết theo loại (tuỳ chọn) |
| `comments` | Int = 0 | Tổng bình luận |
| `shares` | Int = 0 | Tổng chia sẻ |
| `reach` | Int? | Chỉ khi Page đủ điều kiện |
| `impressions` | Int? | Chỉ khi Page đủ điều kiện |
| `permalinkUrl` | String?(255) | Link bài thật |
| `syncError` | String?(255) | Lỗi đồng bộ gần nhất |
| `fetchedAt` | DateTime? | Lần đồng bộ thành công gần nhất |
| `createdAt`, `updatedAt` | DateTime | — |

Quan hệ: `PostMetric.scheduledPost → ScheduledPost` (Cascade); `ScheduledPost.metric PostMetric?`.

### Các trường liên quan trên `ScheduledPost`

- `externalPostId` — ID bài trên Facebook/Threads sau khi đăng (worker đã ghi khi đăng thành công).
- `status` — `PublishStatus`: `SCHEDULED`/`PROCESSING`/`PUBLISHED`/`FAILED`/`CANCELLED`.
- `channelId` → `ChannelConnection` (biết kênh thật/giả lập).

---

## 8.4. Giới hạn hiện tại

Đã có endpoint/service cho đồng bộ, upsert `PostMetric` và tổng hợp theo workspace. Chưa có:

- Endpoint làm mới **một bài** riêng lẻ (chỉ có đồng bộ theo workspace, tối đa 50 bài/lần).
- Xử lý rate limit chi tiết: gặp lỗi Graph API chỉ ghi `syncError` và thử lại ở lần đồng bộ sau, không backoff riêng.
- Snapshot chỉ số theo thời gian (hiện chỉ giữ số liệu mới nhất trong `PostMetric`).
- Endpoint nội bộ cho n8n/cron; lịch đồng bộ chạy bằng job lặp BullMQ.
- Danh sách top bài và trang chi tiết từng bài (UI hiện chỉ có số liệu tổng hợp, biểu đồ và bộ lọc kênh/nhãn).

---

## 8.5. Roadmap

1. **Làm mới thủ công từng bài:** endpoint refresh cho 1 bài, có rate limit riêng.
2. **Top bài & chi tiết bài:** danh sách bài hiệu quả nhất, trang chi tiết chỉ số một bài.
3. **Snapshot theo thời gian:** bảng snapshot để vẽ xu hướng dài hạn (hiện chỉ có số liệu mới nhất).
4. **Xử lý lỗi nâng cao:** backoff/retry riêng khi gặp rate limit Graph API.
5. **n8n (nếu dùng):** chỉ dùng để kích hoạt đồng bộ metrics qua endpoint nội bộ có API key; **không** dùng n8n để đăng bài.
