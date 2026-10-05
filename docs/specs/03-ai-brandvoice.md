# Phân hệ 3: Trợ lý AI Content & Brand Voice

> [Quay lại Mục lục chính](file:///f:/DATN/marka-capstone/docs/specs/README.md)

---

## 3.1. Cấu hình & Quản lý Brand Voice (Create, Update & View Brand Voice - UC24, UC25, UC26)

**Mô tả**: Workspace Owner thiết lập (tạo mới/cập nhật) tông giọng thương hiệu và các thành viên có quyền xem cấu hình Brand Voice để làm ngữ cảnh/prompt mỗi khi AI sinh nội dung.

**Tác nhân (Actors)**:
- **UC24 (Create Brand Voice)**: Workspace Owner
- **UC25 (Update Brand Voice)**: Workspace Owner
- **UC26 (View Brand Voice)**: Content Creator, Workspace Owner

**Luồng hoạt động**:

1. **Tạo Brand Voice (UC24)**: Trong lần thiết lập đầu tiên, Workspace Owner vào màn hình cài đặt Brand Voice và điền thông tin: ngành hàng, đối tượng mục tiêu, phong cách viết bài, từ khóa khuyên dùng/cần tránh, kèm theo 1-3 bài viết mẫu tiêu biểu (few-shot learning).
2. **Cập nhật Brand Voice (UC25)**: Workspace Owner có thể chỉnh sửa bất cứ lúc nào thông tin cấu hình Brand Voice để làm mới chiến lược truyền thông hoặc bổ sung từ khóa mới.
3. **Xem Brand Voice (UC26)**: Tất cả thành viên trong Workspace (Owner & Content Creator) có thể xem cấu hình Brand Voice hiện tại thông qua giao diện cài đặt hoặc trực tiếp ngay trong cửa sổ soạn thảo/gọi AI để biết ngữ cảnh giọng thương hiệu đang áp dụng.
4. **Lưu trữ & Áp dụng**: Hệ thống lưu thông tin vào **cột JSON `brandVoice` của bảng `workspaces`** (mỗi workspace 1 cấu hình chính) và tự động nạp làm system prompt / context mỗi khi gọi AI sinh nội dung cho workspace đó. Cấu trúc: `{ industry, targetAudience, writingStyle, keywordsShouldUse, keywordsAvoid, fewShotExamples }`.

**Lưu ý khi làm**: Giới hạn độ dài few-shot examples để không vượt quá context window hợp lý và không đội chi phí token mỗi lần gọi API.

---

## 3.2. Sinh nội dung bằng AI (Generate AI Content - UC06)

**Mô tả**: Từ chủ đề/ý chính, AI sinh bài viết theo Brand Voice, tạo biến thể cho từng kênh.

**Tác nhân (Actors)**:
- **UC06 (Generate AI Content)**: Content Creator, Workspace Owner

**Luồng hoạt động**:

1. Creator nhập chủ đề/ý chính.
2. Server kiểm tra số dư Credit của workspace **trước khi** gọi AI (ví dụ cần 5 credit cho sinh text — `CreditActionType.GEN_TEXT`). Nếu không đủ → trả lỗi, hiển thị modal nạp thêm, **không gọi API AI**.
3. Job được đẩy vào hàng đợi BullMQ (`content-generation` queue) để xử lý bất đồng bộ → trả về `jobId` cho client, client **poll** trạng thái khi hoàn tất (WebSocket/SSE là Phase sau — D20).
4. Worker gọi LLM provider với prompt = Brand Voice + chủ đề + hướng dẫn định dạng theo từng kênh được chọn (Facebook: ngắn gọn + emoji; TikTok: kịch bản phân cảnh...).
5. Gọi thành công → **trừ credit ngay lúc này** (không trừ trước) → lưu kết quả vào `AIGeneration` + tạo/nối vào bản ghi bài viết ở trạng thái `DRAFT`.
6. Gọi thất bại sau 3 lần retry (exponential backoff) → **không trừ credit**, trả lỗi rõ ràng cho Creator.
7. Creator có thể **Regenerate** (sinh lại — `CreditActionType.REGEN`, tốn thêm credit riêng) hoặc chỉnh sửa trực tiếp nội dung AI tạo trước khi lưu/gửi duyệt.

**Lưu ý khi làm**:

- Đây là nơi áp dụng nguyên tắc **Atomic Credit** quan trọng nhất trong hệ thống — viết test riêng cho case: gọi AI fail giữa chừng, mất kết nối worker, timeout provider... đảm bảo credit luôn được hoàn đúng.
- Dùng transaction DB khi trừ/hoàn credit để tránh race condition khi user bấm generate nhiều lần liên tiếp (double-submit).
- Giới hạn độ dài input (chủ đề/ý chính) để kiểm soát chi phí token.
- Rate-limit số lần gọi AI theo user/workspace/phút, tách biệt với kiểm soát bằng credit (chống spam gây quá tải hệ thống dù vẫn đủ credit).

**Edge Cases**:

- **Prompt/Input vượt quá context window (ví dụ >20.000 tokens)**: Hệ thống tự động từ chối và báo lỗi kèm hướng dẫn cụ thể cho user giảm bớt độ dài.
- **AI trả về nội dung rỗng/không đúng định dạng mong đợi (JSON/Format error)**: Tự động retry tối đa 3 lần với prompt hướng dẫn định dạng khắt khe hơn; nếu vẫn lỗi, áp dụng cơ chế fallback (hiển thị thông báo và không trừ credit).

---

## 3.3. Sinh ảnh minh họa bằng AI (Generate AI Image - UC06)

**Mô tả**: Gọi DALL-E 3 sinh ảnh dựa trên nội dung bài viết.

**Tác nhân (Actors)**:
- **UC06 (Generate AI Image)**: Content Creator, Workspace Owner

**Luồng hoạt động**:

1. Creator bấm "Sinh ảnh minh họa" từ trong bài viết → hệ thống tự tạo prompt ảnh từ nội dung bài (hoặc cho phép Creator tự chỉnh prompt).
2. Kiểm tra credit (10 credit/ảnh — `CreditActionType.GEN_IMAGE`) → đẩy job vào queue riêng (`image-generation`) → gọi API DALL-E 3.
3. Ảnh trả về → tải xuống và lưu vào S3/Cloudinary (không dùng trực tiếp URL tạm của OpenAI vì có hạn sử dụng) → tạo `MediaAsset` gắn `source=AI_GENERATED` → trừ credit.
4. Thất bại → hoàn credit, thông báo lỗi.

**Lưu ý khi làm**: URL ảnh do DALL-E trả về thường hết hạn sau ~1 giờ — **bắt buộc** phải tải về lưu trữ lâu dài ngay trong worker, không lưu trực tiếp URL gốc vào DB.

---

## 3.4. Viral Score & 1-Click Fix

**Mô tả**: Chấm điểm chất lượng bài viết theo các tiêu chí (Hook, CTA, độ dễ đọc...) và gợi ý sửa nhanh.

**Tác nhân (Actors)**: Content Creator, Workspace Owner

**Luồng hoạt động**:

1. Creator bấm "Chấm điểm" (`CreditActionType.SCORE`) → gửi nội dung bài cho AI với prompt đánh giá theo rubric cố định (Hook, CTA, Readability, Length phù hợp kênh...).
2. AI trả về JSON có điểm từng tiêu chí + gợi ý cải thiện → hiển thị dạng radar chart.
3. Creator bấm "1-Click Fix" → AI sinh lại bản cải thiện dựa trên gợi ý → Creator xem trước, chọn Apply hoặc Discard.

**Lưu ý khi làm**: Prompt yêu cầu AI trả JSON có schema cố định — nên validate output bằng Zod, có fallback nếu AI trả sai định dạng (retry với prompt nhắc lại format).
