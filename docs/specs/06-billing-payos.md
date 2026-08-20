# Phân hệ 6: Credit & Thanh toán PayOS

> [Quay lại Mục lục chính](file:///f:/DATN/marka-capstone/docs/specs/README.md)

---

## 6.1. Nạp credit / nâng cấp gói (Purchase Credits - UC30)

**Mô tả**: Cho phép Workspace Owner thực hiện nạp credit hoặc nâng cấp gói cước thông qua cổng thanh toán trực tuyến PayOS.

**Tác nhân (Actors)**:
- **UC30 (Purchase Credits)**: Workspace Owner

**Luồng hoạt động**:

1. User chọn gói (FREE/PRO/ENTERPRISE) hoặc gói credit lẻ → bấm "Thanh toán".
2. Server tạo `Order(orderId duy nhất, amount, status=PENDING)` → gọi API PayOS tạo link/QR thanh toán → trả về cho client hiển thị QR.
3. Client polling API `GET /orders/{orderId}/status` mỗi 5 giây để cập nhật UI (phòng khi webhook chậm).
4. PayOS gửi Webhook về server khi giao dịch thành công → server **verify chữ ký webhook** (HMAC theo secret key PayOS cấp) → nếu hợp lệ và `orderId` chưa được xử lý trước đó (kiểm tra idempotency) → cập nhật `Order.status = PAID`, cộng credit/nâng gói cho workspace.
5. Nếu webhook đến trễ nhưng client polling phát hiện `status = PAID` trước → UI vẫn cập nhật đúng vì cùng đọc từ 1 nguồn `Order.status`.

**Lưu ý khi làm**:

- **Không bao giờ** cộng credit chỉ dựa vào response redirect phía client (có thể bị giả mạo) — chỉ cộng credit khi webhook đã verify chữ ký hợp lệ.
- Idempotency: dùng `orderId` làm khóa duy nhất, nếu webhook gọi lại (PayOS có thể retry) mà `Order` đã `PAID` rồi thì bỏ qua, không cộng credit 2 lần.
- Nên có endpoint nội bộ để Admin xác nhận thủ công một giao dịch nếu webhook lỗi (dự phòng, vì không có hoàn tiền tự động).

---

## 6.2. Trừ/hoàn Credit

**Nguyên tắc**: **Trừ sau khi thành công, hoàn khi thất bại hoàn toàn sau retry**, luôn dùng transaction DB, log mọi thay đổi vào `CreditTransaction` (loại giao dịch, số lượng, số dư trước/sau, lý do) để phục vụ audit và tránh tranh chấp.

**Cấu hình Credit Cost & Bảng giá hệ thống**:

Bảng giá credit cho từng hành động được quản lý tập trung thông qua biến môi trường để thuận tiện thay đổi mà không phải code lại logic trừ credit:

```javascript
// config/credit-cost.js hoặc qua process.env
export const CREDIT_COST = {
  GENERATE_TEXT: parseInt(process.env.COST_GENERATE_TEXT) || 5, // Sinh bài viết mới
  REGENERATE: parseInt(process.env.COST_REGENERATE) || 3, // Yêu cầu sinh lại bài viết
  GENERATE_IMAGE: parseInt(process.env.COST_GENERATE_IMAGE) || 10, // Sinh ảnh minh họa bằng AI
  VIRAL_SCORE: parseInt(process.env.COST_VIRAL_SCORE) || 2, // Chấm điểm chất lượng bài viết
};
```

| Hành động                      | Số Credit tiêu thụ | Biến môi trường tương ứng |
| :----------------------------- | :----------------: | :------------------------ |
| Sinh 1 bài viết text           |         5          | `COST_GENERATE_TEXT`      |
| Sinh lại (Regenerate)          |         3          | `COST_REGENERATE`         |
| Sinh 1 ảnh (DALL-E 3)          |         10         | `COST_GENERATE_IMAGE`     |
| Chấm Viral Score / 1-Click Fix |         2          | `COST_VIRAL_SCORE`        |

---

## 6.3. Reset credit hàng tháng & hạ gói

**Mô tả**: Tác vụ định kỳ quản lý hạn mức sử dụng theo chu kỳ thanh toán.

**Tác nhân (Actors)**: Hệ thống (Background Cron Job)

**Luồng hoạt động**: 

Cron job chạy đầu mỗi chu kỳ billing của từng workspace → reset `remainingCredit = monthlyQuota` theo gói hiện tại (không cộng dồn credit cũ) → nếu gói đã hết hạn mà không gia hạn, tự động chuyển `plan = FREE`.
