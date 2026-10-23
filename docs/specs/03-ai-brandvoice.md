# Phân hệ 3 — Brand Voice & AI

> [Quay lại Mục lục](README.md)
>
> **Phạm vi:** Brand Voice (UC25, UC26, UC27) và trợ lý AI trong editor bài viết:
> sinh nội dung bằng Gemini, sinh ảnh bằng Cloudflare Workers AI, trừ/hoàn credit,
> chạy bất đồng bộ qua BullMQ và frontend poll trạng thái.
>
> **Chưa triển khai:** Viral Score, “1-Click Fix”, sinh lại theo góp ý, chọn số lượng/tỉ lệ ảnh,
> lịch sử AI có UI, nạp/reset credit, sweeper cho job mất khỏi Redis.
>
> Mã nguồn: `backend/src/modules/brandvoice/`, `backend/src/modules/ai/`,
> `backend/src/modules/credit/`, `backend/src/workers/`, `frontend/src/components/features/post/PostAIAssistant.tsx`.

---

## 3.1. Lưu trữ Brand Voice

Brand Voice được lưu **trực tiếp trong cột JSON `brandVoice` của bảng `workspaces`**
(`Workspace.brandVoice Json?`). Mỗi workspace có tối đa một cấu hình; không có bảng riêng,
không có lịch sử phiên bản.

Cấu trúc JSON:

```json
{
  "industry": "Thời trang nữ",
  "targetAudience": "Nữ 22-30 tuổi tại Hà Nội",
  "writingStyle": "Thân thiện, gần gũi, hạn chế thuật ngữ chuyên ngành",
  "keywordsShouldUse": ["thanh lịch", "tối giản"],
  "keywordsAvoid": ["giảm giá sốc"],
  "fewShotExamples": [
    { "title": "Sơ mi trắng", "content": "Chỉ một chiếc sơ mi trắng cũng đủ cho cả tuần đi làm của bạn." }
  ]
}
```

Module AI đọc `brandVoice` để đưa vào prompt sinh nội dung và prompt sinh ảnh.

---

## 3.2. Validation khi ghi Brand Voice (PUT)

Body schema `brandVoiceBodySchema` (`brandvoice.validation.ts`):

| Field | Kiểu | Ràng buộc | Mặc định |
| :--- | :--- | :--- | :--- |
| `industry` | string | `trim`, 1–100 ký tự | bắt buộc |
| `targetAudience` | string | `trim`, 1–300 ký tự | bắt buộc |
| `writingStyle` | string | `trim`, ≤ 300 ký tự | `""` |
| `keywordsShouldUse` | string[] | mỗi từ khoá `trim`, 1–50 ký tự; tối đa 30 phần tử | `[]` |
| `keywordsAvoid` | string[] | như trên | `[]` |
| `fewShotExamples` | object[] | tối đa 3 phần tử | `[]` |
| `fewShotExamples[].title` | string | `trim`, ≤ 100 ký tự, tuỳ chọn | — |
| `fewShotExamples[].content` | string | `trim`, 10–5000 ký tự, bắt buộc | — |

- Đây là **ghi đè toàn bộ** (PUT), không phải PATCH: field không gửi sẽ nhận giá trị mặc định.
- Từ khoá trùng trong mỗi mảng được **loại bỏ** (giữ thứ tự xuất hiện đầu tiên) trước khi lưu.
- Không kiểm tra trùng giữa `keywordsShouldUse` và `keywordsAvoid`.

---

## 3.3. Xem Brand Voice (UC27)

`GET /workspaces/:workspaceId/brand-voice`

- Yêu cầu `requireAuth` + là thành viên workspace (mọi vai trò).
- Workspace không tồn tại/đã xoá mềm → `404` `"Workspace không tồn tại"`.
- Response `200`:

```json
{
  "status": "success",
  "message": "Lấy Brand Voice thành công",
  "data": {
    "brandVoice": null,
    "isConfigured": false
  }
}
```

- Chưa cấu hình: `brandVoice = null`, `isConfigured = false`.
- Đã cấu hình: `brandVoice` là JSON đã lưu, `isConfigured = true`.

---

## 3.4. Tạo / cập nhật Brand Voice (UC25, UC26)

`PUT /workspaces/:workspaceId/brand-voice`

- Yêu cầu `requireAuth` + `OWNER`.
- Không có endpoint tạo riêng: lần đầu và các lần sau đều dùng PUT (upsert “ghi đè toàn bộ”).
- Workspace không tồn tại/đã xoá → `404` `"Workspace không tồn tại"`.
- Response `200` trả `{ brandVoice, isConfigured: true }`.
- Ghi audit `BRAND_VOICE_UPDATED` (`targetType = Workspace`, `targetId = workspaceId`);
  không lưu nội dung cấu hình vào audit.
- Không gửi notification, không ảnh hưởng credit.

### Lỗi

| Mã | Trường hợp |
| :--- | :--- |
| `403` | Không phải thành viên / không phải OWNER |
| `404` | Workspace không tồn tại hoặc đã xoá mềm |
| `422` | Thiếu `industry`/`targetAudience`, từ khoá quá dài, > 30 từ khoá, > 3 few-shot, nội dung mẫu < 10 ký tự... |

---

## 3.5. Trợ lý AI trong editor bài viết

### Kiến trúc

```
Frontend PostAIAssistant
  → POST /workspaces/:workspaceId/ai/text | /ai/images
  → ai.service: kiểm tra quyền, provider, credit; transaction tạo AiGeneration (+ Post nháp nếu cần)
  → enqueue content-generation-queue
  → ai.processor (ContentWorker): gọi Gemini/Cloudflare, upload Cloudinary, cập nhật AiGeneration
  → Frontend poll GET /workspaces/:workspaceId/ai/generations/:generationId
```

- Queue: `content-generation-queue`, job name `ai:text` / `ai:image`.
- Trạng thái: `PENDING → PROCESSING → SUCCESS | FAILED`.
- Worker thất bại hẳn → set `FAILED`, `creditCost = 0`, hoàn credit trong cùng transaction.
- Nếu worker production bị tắt (`ENABLE_WORKERS=false`), job nằm `PENDING` và credit bị giữ.
  Repo đã bật `ENABLE_WORKERS=true` trong `render.yaml`.

### 3.5.1. Sinh nội dung

`POST /workspaces/:workspaceId/ai/text` — `202 Accepted`

Body (`generateTextBodySchema`):

| Field | Kiểu | Ràng buộc |
| :--- | :--- | :--- |
| `topic` | string | `trim`, 5–1000 ký tự |
| `instructions` | string | `trim`, ≤ 500 ký tự, tuỳ chọn |
| `postId` | UUID | Tuỳ chọn; nếu có phải thuộc workspace và bài đang `DRAFT`/`REJECTED`, user có quyền sửa |

Response:

```json
{
  "status": "success",
  "message": "Đã đưa yêu cầu tạo nội dung vào hàng đợi",
  "data": {
    "generationId": "uuid",
    "status": "PENDING",
    "postId": null,
    "creditCost": 10,
    "remainingCredit": 90
  }
}
```

- Prompt gồm Brand Voice + chủ đề + yêu cầu thêm; system prompt yêu cầu tiếng Việt,
  không bịa số liệu, có mở bài/thân bài/CTA.
- Gemini trả JSON `{ title, blocks }`; server validate bằng Zod rồi chuyển sang Tiptap:
  `paragraph`, `heading` (level 2), `bulletList`.
- Không tự tạo/sửa `Post`; frontend điền kết quả vào editor và người dùng bấm Lưu.
- Trong lúc chờ, frontend khoá editor để tránh ghi đè nội dung đang sửa.

### 3.5.2. Sinh ảnh

`POST /workspaces/:workspaceId/ai/images` — `202 Accepted`

Body là union:

```json
{ "postId": "uuid", "prompt": "phong cách tối giản" }
```

hoặc (bài mới, tự tạo nháp):

```json
{
  "title": "Tiêu đề bài viết",
  "content": { "type": "doc", "content": [] },
  "prompt": "phong cách tối giản"
}
```

- `prompt` tuỳ chọn, ≤ 500 ký tự.
- Nếu có `postId`: bài phải thuộc workspace, đúng quyền sửa, `DRAFT`/`REJECTED`.
- Nếu chưa có: tạo `Post` nháp trong **cùng transaction** với trừ credit + tạo generation;
  không đủ credit thì rollback, không còn bài nháp mồ côi.
- Prompt ảnh gồm tiêu đề, nội dung (cắt ~1200 ký tự), ngành/khách hàng/phong cách Brand Voice,
  ghi chú và yêu cầu không chèn chữ/watermark; tối đa 2048 ký tự.
- Cloudflare trả JPEG base64 → upload Cloudinary folder
  `marka/workspaces/:workspaceId/posts/:postId/ai` → tạo `MediaAsset`
  (`type = IMAGE`, `source = AI_GENERATED`, `mimeType = image/jpeg`, `size = buffer.length`).
- Bài đã chuyển khỏi `DRAFT`/`REJECTED` trong lúc job chạy → fail + hoàn credit, không gắn ảnh.

### 3.5.3. Poll trạng thái

`GET /workspaces/:workspaceId/ai/generations/:generationId`

- `requireAuth` + thành viên workspace; **không** dùng `aiLimiter` (poll 2 giây/lần).
- Chỉ tìm `{ id, workspaceId }`; khác workspace → `404`.

```json
{
  "status": "success",
  "message": "Lấy trạng thái tạo nội dung AI thành công",
  "data": {
    "id": "uuid",
    "type": "TEXT",
    "status": "SUCCESS",
    "provider": "gemini",
    "model": "gemini-flash-lite-latest",
    "postId": null,
    "creditCost": 10,
    "result": {
      "title": "Tiêu đề",
      "content": { "type": "doc", "content": [] }
    },
    "errorMessage": null,
    "createdAt": "2026-10-23T12:00:00.000Z",
    "updatedAt": "2026-10-23T12:00:12.000Z"
  }
}
```

- `type = IMAGE` → `result = { "media": { "id", "url", "mimeType", "size" } }`.
- `FAILED` → `result = null`, `errorMessage` là thông báo tiếng Việt; credit đã được hoàn.

### 3.5.4. Credit

| Hành động | Credit | Ghi `CreditTransaction` |
| :--- | :--- | :--- |
| Sinh nội dung | 10 | `OUTFLOW` / `GEN_TEXT` khi enqueue |
| Sinh ảnh | 20 | `OUTFLOW` / `GEN_IMAGE` khi enqueue |
| Job thất bại hẳn | hoàn đúng số đã trừ | `INFLOW` / `REFUND` trong cùng transaction với `FAILED` |

- Trừ credit bằng `updateMany({ where: { id, remainingCredit: { gte: cost } } })` để chống race.
- Không đủ credit → `402` `"Không đủ credit để thực hiện. Cần X, còn Y."`.
- Kiểm tra provider key trước khi trừ credit; thiếu key → `503`.

### 3.5.5. Lỗi thường gặp

| Mã | Message / trường hợp |
| :--- | :--- |
| `402` | Không đủ credit |
| `403` | Không phải thành viên; Creator sửa ảnh bài người khác |
| `404` | Bài viết/generation không thuộc workspace hoặc đã xoá mềm |
| `409` | Bài không còn `DRAFT`/`REJECTED` khi tạo ảnh |
| `422` | Chủ đề < 5 ký tự, thiếu title/content, prompt quá dài |
| `503` | Chưa cấu hình Gemini/Cloudflare hoặc không enqueue được job |

### 3.5.6. Provider & env

| Biến | Mặc định | Dùng cho |
| :--- | :--- | :--- |
| `GEMINI_API_KEY` | `""` | Gemini `generateContent` |
| `GEMINI_MODEL` | `gemini-flash-lite-latest` | Model sinh text (đổi được khi cần chất lượng cao hơn) |
| `CLOUDFLARE_ACCOUNT_ID` | `""` | Workers AI |
| `CLOUDFLARE_API_TOKEN` | `""` | Workers AI |
| `CLOUDFLARE_IMAGE_MODEL` | `@cf/black-forest-labs/flux-1-schnell` | Model sinh ảnh |

- Gemini dùng `generateContent` + `responseMimeType: application/json` + `responseSchema`
  (ổn định hơn Interactions API beta).
- Mọi fetch có timeout 60 giây; lỗi mạng/5xx/429 được BullMQ retry 3 lần;
  content policy, thiếu cấu hình, bài không còn sửa được, JSON sai schema sau lần retry đầu
  dùng `UnrecoverableError` để không tốn thêm lượt.

---

## 3.6. Bảng tổng hợp endpoint

| Method | Path | Quyền | Ghi chú |
| :--- | :--- | :--- | :--- |
| GET | `/workspaces/:workspaceId/brand-voice` | Thành viên | Trả `brandVoice` + `isConfigured` |
| PUT | `/workspaces/:workspaceId/brand-voice` | OWNER | Ghi đè toàn bộ, dedupe từ khoá, audit |
| POST | `/workspaces/:workspaceId/ai/text` | Thành viên | Enqueue sinh nội dung, trừ 10 credit |
| POST | `/workspaces/:workspaceId/ai/images` | Thành viên + quyền sửa bài | Enqueue sinh ảnh, trừ 20 credit |
| GET | `/workspaces/:workspaceId/ai/generations/:generationId` | Thành viên | Poll trạng thái, không dùng `aiLimiter` |

`workspaceId` có thể truyền qua header `x-workspace-id`; nếu truyền cả header và path mà khác nhau → `403`.
`aiLimiter` (20 request/phút/workspace) chỉ gắn cho hai endpoint POST, đứng **sau** `requireWorkspaceRole`.

---

## 3.7. Chưa triển khai (Roadmap)

1. **Viral Score / 1-Click Fix:** chấm điểm và sinh lại nội dung; `AiGenType.VIRAL_SCORE`, `REGENERATE`.
2. **Sinh nhiều ảnh/lần, chọn tỉ lệ/style:** hiện 1 ảnh vuông mỗi lần.
3. **Lịch sử AI có UI:** API mới chỉ trả trạng thái từng generation; chưa có danh sách/trang lịch sử.
4. **Nạp/reset credit, PayOS:** chưa có module billing; credit chỉ bị trừ/hoàn.
5. **Sweeper job kẹt:** nếu job mất khỏi Redis, bản ghi có thể kẹt `PENDING` và credit bị giữ;
   chưa có cron quét/recovery cho AI.
6. **Regenerate/continue:** chưa có nút sinh lại hoặc viết tiếp từ nội dung hiện tại.
7. **Rời trang khi đang chờ:** job vẫn chạy nhưng kết quả không tự áp dụng lại vào editor; credit đã trừ (hoàn nếu job fail). Chưa lưu generationId vào sessionStorage để resume.
