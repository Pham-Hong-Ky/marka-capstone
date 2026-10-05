# Phân hệ 6: Credit & Thanh toán PayOS

> [Quay lại Mục lục chính](file:///f:/DATN/marka-capstone/docs/specs/README.md)

---

## 6.1. Nạp credit / nâng cấp gói (Purchase Credits - UC30)

**Mô tả**: Cho phép Workspace Owner thực hiện nạp credit hoặc nâng cấp gói cước thông qua cổng thanh toán trực tuyến PayOS.

**Tác nhân (Actors)**:
- **UC30 (Purchase Credits)**: Workspace Owner

**Luồng hoạt động**:

1. User chọn gói (FREE/PRO/ENTERPRISE) hoặc gói credit lẻ → bấm "Thanh toán".
2. Server tạo `Order(orderCode duy nhất, amount, status=PENDING)` → gọi API PayOS tạo link/QR thanh toán → trả về cho client hiển thị QR. `OrderStatus = { PENDING, PAID, CANCELLED }` — **không có `FAILED`**; đơn hỏng/hủy dùng `CANCELLED` (D4).
3. Client polling API `GET /orders/{orderCode}/status` mỗi 5 giây để cập nhật UI (phòng khi webhook chậm).
4. PayOS gửi Webhook về server khi giao dịch thành công → **Service verify chữ ký webhook** (HMAC theo secret key PayOS cấp) → nếu hợp lệ và `orderCode` chưa được xử lý trước đó → `updateMany({ where: { orderCode, status: 'PENDING' } })` **trong transaction**; chỉ cộng credit/nâng gói khi update thành công (idempotent theo `orderCode` — D12).
5. Nếu webhook đến trễ nhưng client polling phát hiện `status = PAID` trước → UI vẫn cập nhật đúng vì cùng đọc từ 1 nguồn `Order.status`.

**Lưu ý khi làm**:

- **Không bao giờ** cộng credit chỉ dựa vào response redirect phía client (có thể bị giả mạo) — chỉ cộng credit khi webhook đã verify chữ ký hợp lệ.
- Idempotency: dùng **`orderCode`** làm khóa duy nhất; nếu webhook gọi lại (PayOS có thể retry) mà `Order` đã `PAID` rồi thì bỏ qua, không cộng credit 2 lần (D12).
- Nên có endpoint nội bộ để Admin xác nhận thủ công một giao dịch nếu webhook lỗi (dự phòng, vì không có hoàn tiền tự động).

---

## 6.2. Trừ/hoàn Credit

**Nguyên tắc**: **Trừ sau khi thành công, hoàn khi thất bại hoàn toàn sau retry**, luôn dùng transaction DB, log mọi thay đổi vào `CreditTransaction` (loại giao dịch, số lượng, số dư trước/sau, lý do) để phục vụ audit và tránh tranh chấp.

**Xóa mềm**: `MediaAsset` (cùng `Workspace`, `Post`, `CreditPackage`) dùng **xóa mềm** qua `deletedAt` (D18, cưỡng chế bằng Prisma Client Extension) — không xóa cứng; dữ liệu vẫn được giữ để phục vụ audit/khôi phục và việc giải phóng dung lượng lưu trữ cần theo chính sách riêng.

**Cấu hình Credit Cost & Bảng giá hệ thống**:

Bảng giá credit cho từng hành động được quản lý tập trung thông qua biến môi trường để thuận tiện thay đổi mà không phải code lại logic trừ credit:

```javascript
// config/credit-cost.js hoặc qua process.env — khóa khớp enum CreditActionType (D14)
export const CREDIT_COST = {
  GEN_TEXT: parseInt(process.env.COST_GEN_TEXT) || 5, // Sinh bài viết mới (GEN_TEXT)
  REGEN: parseInt(process.env.COST_REGEN) || 3, // Yêu cầu sinh lại bài viết (REGEN)
  GEN_IMAGE: parseInt(process.env.COST_GEN_IMAGE) || 10, // Sinh ảnh minh họa bằng AI (GEN_IMAGE)
  SCORE: parseInt(process.env.COST_SCORE) || 2, // Chấm điểm chất lượng bài viết (SCORE)
};
```

| Hành động                      | Số Credit tiêu thụ | Khóa / Biến môi trường    |
| :----------------------------- | :----------------: | :------------------------ |
| Sinh 1 bài viết text           |         5          | `GEN_TEXT` / `COST_GEN_TEXT`   |
| Sinh lại (Regenerate)          |         3          | `REGEN` / `COST_REGEN`         |
| Sinh 1 ảnh (DALL-E 3)          |         10         | `GEN_IMAGE` / `COST_GEN_IMAGE` |
| Chấm Viral Score / 1-Click Fix |         2          | `SCORE` / `COST_SCORE`         |

**Hạn mức credit theo gói & mốc chu kỳ (D6)**:

| Gói (WorkspacePlan) | Hạn mức credit mặc định / tháng |
| :------------------ | :-----------------------------: |
| `FREE`              | 100                             |
| `PRO`               | 1000                            |
| `ENTERPRISE`        | 5000                            |

`Workspace` lưu **`billingCycleStart`** và **`nextResetAt`** làm mốc neo cho cron reset credit hằng tháng và hạ gói; `monthlyQuota` giữ giá trị hạn mức tương ứng gói hiện tại.

---

## 6.3. Reset credit hàng tháng & hạ gói

**Mô tả**: Tác vụ định kỳ quản lý hạn mức sử dụng theo chu kỳ thanh toán.

**Tác nhân (Actors)**: Hệ thống (Background Cron Job)

**Luồng hoạt động**: 

Cron job chạy đầu mỗi chu kỳ billing của từng workspace (mốc neo `billingCycleStart`/`nextResetAt` — D6) → reset `remainingCredit = monthlyQuota` theo gói hiện tại cho **cả ba gói `FREE`/`PRO`/`ENTERPRISE`** (không cộng dồn credit cũ) và ghi `CreditTransaction(action = RESET)` → nếu gói đã hết hạn mà không gia hạn, tự động chuyển `plan = FREE`.
