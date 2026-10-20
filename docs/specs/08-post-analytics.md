# Phân hệ 8 — Post Analytics (Roadmap)

> [Quay lại Mục lục](README.md)
>
> **Trạng thái: CHƯA TRIỂN KHAI.** Không có module analytics, không có endpoint, không có đồng bộ số liệu, không tích hợp n8n.
> Tài liệu này giữ lại mục tiêu, phần schema đã có và các việc cần làm.

---

## 8.1. Mục tiêu

| UC | Chức năng | Tác nhân |
| :--- | :--- | :--- |
| **UC42** | Xem chỉ số tương tác của một bài đã đăng | Creator, Owner |
| **UC43** | Xem tổng quan hiệu quả của workspace | Creator, Owner |

Chỉ số dự kiến: **reactions, comments, shares** cho bài đăng trên Facebook Page thật. `reach`/`impressions` chỉ hiển thị khi Facebook trả về (phụ thuộc Page Insights).

---

## 8.2. Hiện trạng trong code

- **Không có endpoint** `/posts/:id/metrics`, `/workspaces/:id/analytics/*`, `/internal/metrics/*`.
- Không có service/repository analytics; không gọi Facebook Graph API để đọc chỉ số.
- Không có n8n trong repo/backend.
- **Chưa có dữ liệu để phân tích:** luồng publish chưa tồn tại (xem [04](./04-social-publishing.md)), nên `ScheduledPost` chưa được tạo và `externalPostId` luôn `null`.
- Schema `PostMetric` đã có sẵn nhưng chưa được ghi/đọc ở đâu.

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

- `externalPostId` — ID bài trên Facebook sau khi đăng (hiện chưa có luồng ghi).
- `status` — `PublishStatus`: `SCHEDULED`/`PUBLISHED`/`FAILED`/`CANCELLED` (hiện chưa có luồng tạo).
- `channelId` → `ChannelConnection` (biết kênh thật/giả lập).

---

## 8.4. Chưa có endpoint/service

Không có hàm/service nào cho:

- Đồng bộ chỉ số từ Graph API (thủ công hoặc định kỳ).
- Upsert `PostMetric` theo `scheduledPostId`.
- Tổng hợp chỉ số theo workspace, top bài, biểu đồ theo thời gian.
- Xử lý token hết hạn/rate limit khi đồng bộ.
- Endpoint nội bộ cho n8n/cron.

---

## 8.5. Roadmap

1. **Phụ thuộc bắt buộc:** hoàn thành publish bài thật (Phân hệ 4) và lưu `externalPostId` + `status = PUBLISHED`.
2. **Đồng bộ:** gọi các edge `/{post-id}?fields=shares,permalink_url`, `/{post-id}/comments?summary=true`, `/{post-id}/reactions?summary=true` bằng Page token đã giải mã; upsert `PostMetric` (idempotent theo `scheduledPostId`), ghi `fetchedAt`/`syncError`.
3. **Làm mới thủ công:** endpoint refresh cho 1 bài, có rate limit.
4. **API xem (UC42, UC43):** chỉ số theo bài và tổng hợp workspace (tổng/trung bình/top bài), lọc theo khoảng thời gian/kênh.
5. **Tuỳ chọn:** reach/impressions qua Insights (chỉ hiển thị khi có dữ liệu); snapshot theo thời gian nếu cần biểu đồ xu hướng.
6. **n8n (nếu dùng):** chỉ dùng để kích hoạt đồng bộ metrics qua endpoint nội bộ có API key; **không** dùng n8n để đăng bài.
