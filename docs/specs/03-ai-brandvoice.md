# Phân hệ 3 — Brand Voice & AI

> [Quay lại Mục lục](README.md)
>
> **Phạm vi:** phần đã có trong code là **Brand Voice** (UC24, UC25, UC26). Chưa có bất kỳ tính năng AI nào (sinh nội dung, sinh ảnh, Viral Score), chưa gọi OpenAI, chưa trừ credit.
> Mã nguồn: `backend/src/modules/brandvoice/`.
>
> Phần AI chỉ được liệt kê ngắn ở cuối file dưới dạng Roadmap.

---

## 3.1. Lưu trữ

Brand Voice được lưu **trực tiếp trong cột JSON `brandVoice` của bảng `workspaces`** (`Workspace.brandVoice Json?`). Mỗi workspace có tối đa một cấu hình; không có bảng riêng, không có lịch sử phiên bản.

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

Chưa có code nào đọc `brandVoice` để đưa vào prompt AI — vì module AI chưa tồn tại.

---

## 3.2. Validation khi ghi (PUT)

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

- Đây là **ghi đè toàn bộ** (PUT), không phải PATCH: field không gửi sẽ nhận giá trị mặc định như bảng trên.
- Từ khoá trùng trong mỗi mảng được **loại bỏ** (giữ thứ tự xuất hiện đầu tiên) trước khi lưu. Trùng giữa `keywordsShouldUse` và `keywordsAvoid` **không** bị chặn.
- Không kiểm tra `content` của few-shot có trùng nhau hay không.

---

## 3.3. Xem Brand Voice (UC26)

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

## 3.4. Tạo / cập nhật Brand Voice (UC24, UC25)

`PUT /workspaces/:workspaceId/brand-voice`

- Yêu cầu `requireAuth` + `OWNER`.
- Không có endpoint tạo riêng: lần đầu và các lần sau đều dùng PUT (upsert ngữ nghĩa "ghi đè toàn bộ").
- Workspace không tồn tại/đã xoá → `404` `"Workspace không tồn tại"`.
- Response `200`:

```json
{
  "status": "success",
  "message": "Cập nhật Brand Voice thành công",
  "data": {
    "brandVoice": {
      "industry": "Thời trang nữ",
      "targetAudience": "Nữ 22-30 tuổi tại Hà Nội",
      "writingStyle": "Thân thiện, gần gũi",
      "keywordsShouldUse": ["thanh lịch"],
      "keywordsAvoid": [],
      "fewShotExamples": []
    },
    "isConfigured": true
  }
}
```

- Ghi audit `BRAND_VOICE_UPDATED` (`targetType = Workspace`, `targetId = workspaceId`); không lưu nội dung cấu hình vào audit.
- Không gửi notification, không ảnh hưởng credit.

### Lỗi

| Mã | Trường hợp |
| :--- | :--- |
| `403` | Không phải thành viên / không phải OWNER |
| `404` | Workspace không tồn tại hoặc đã xoá mềm |
| `422` | Thiếu `industry`/`targetAudience`, từ khoá quá dài, > 30 từ khoá, > 3 few-shot, nội dung mẫu < 10 ký tự... |

---

## 3.5. Bảng tổng hợp endpoint

| Method | Path | Quyền | Ghi chú |
| :--- | :--- | :--- | :--- |
| GET | `/workspaces/:workspaceId/brand-voice` | Thành viên | Trả `brandVoice` + `isConfigured` |
| PUT | `/workspaces/:workspaceId/brand-voice` | OWNER | Ghi đè toàn bộ, dedupe từ khoá, audit |

---

## 3.6. Chưa triển khai (Roadmap)

Các mục sau **không có trong code** (không có route/service, không gọi provider AI):

1. **UC06 — sinh nội dung bằng AI:** gọi LLM với prompt = Brand Voice + chủ đề; lưu `AiGeneration`; trả kết quả để tạo bài `DRAFT`.
2. **Sinh ảnh AI:** tạo `MediaAsset` với `source = AI_GENERATED`, lưu file lâu dài (Cloudinary) thay vì URL tạm của provider.
3. **Viral Score / 1-Click Fix:** chấm điểm và sinh lại nội dung; `AiGenType.VIRAL_SCORE`, `REGENERATE`.
4. **Credit & rate limit:** trừ/hoàn credit theo `CreditActionType` (`GEN_TEXT`, `GEN_IMAGE`, `REGEN`, `SCORE`), dùng `aiLimiter` (20 request/phút/workspace — đã khai báo nhưng chưa gắn route).
5. **Queue:** `content-generation-queue` đã có khung worker nhưng **chưa ai enqueue**; chưa có `OPENAI_API_KEY` được dùng ở đâu.

Schema đã sẵn sàng cho các mục trên: `AiGeneration`, `AiGenType`, `AiGenStatus`, `CreditTransaction`. Xem thêm [06](./06-billing-payos.md).
