# Phân hệ 6 — Credit & Nạp PayOS (Đã triển khai)

> [Quay lại Mục lục](README.md)
>
> **Trạng thái: ĐÃ TRIỂN KHAI** cho UC31, UC40, UC41.
> Phạm vi chốt: **chỉ bán gói nạp credit một lần**. Credit không hết hạn, không reset, dùng đến khi hết.
> Không có gói tháng, không có cron billing, không dùng queue/worker cho billing.
> UC38 (API đọc notification) đã bỏ khỏi phạm vi hệ thống.

---

## 6.1. Mục tiêu

| UC | Chức năng | Tác nhân |
| :--- | :--- | :--- |
| **UC31** | Nạp credit qua PayOS | Mọi thành viên workspace |
| **UC40** | Xem danh sách gói nạp | Mọi thành viên workspace |
| **UC41** | Xem số dư & lịch sử giao dịch credit | Mọi thành viên workspace |

Ngoài ra: trừ credit khi gọi AI, hoàn credit khi job thất bại.

---

## 6.2. Gói nạp mặc định

Seed bằng migration `20261024130000_billing_credit_packages`.

| Gói | Giá | Credit |
| :--- | ---: | ---: |
| Nạp 500 | 25.000đ | 500 |
| Nạp 1.500 | 69.000đ | 1.500 |
| Nạp 5.000 | 199.000đ | 5.000 |
| Nạp 10.000 | 349.000đ | 10.000 |

- Credit **không hết hạn**, **không reset**.
- Mua gói = cộng thẳng vào `Workspace.remainingCredit`.
- Mọi thành viên được mua; chỉ người tạo đơn được huỷ đơn của mình.

---

## 6.3. Dữ liệu

### `CreditPackage` (dùng)

`id`, `name`, `description`, `creditAmount`, `price`, `sortOrder`, `isActive`, `deletedAt`, `createdAt`, `updatedAt`.

- Chỉ trả các gói `isActive = true` và chưa xoá mềm.
- Giá/credit luôn đọc từ DB, không nhận từ client.

### `Order` (dùng)

| Trường | Ghi chú |
| :--- | :--- |
| `orderCode` | Mã đơn duy nhất gửi PayOS |
| `packageId` | Gói nạp được mua |
| `amount` | Snapshot giá lúc tạo đơn |
| `creditAmount` | Snapshot credit lúc tạo đơn |
| `paymentLinkId`, `checkoutUrl`, `expiresAt` | Thông tin link PayOS |
| `payosTransId`, `paidAt` | Đối chiếu giao dịch |
| `status` | `PENDING` / `PAID` / `CANCELLED` |

`Order.targetPlan` vẫn còn trong schema nhưng **không dùng** (legacy).

### `Workspace`

- `remainingCredit`: số dư credit hiện tại.
- `plan`, `monthlyQuota`, `billingCycleStart`, `nextResetAt`: **legacy, không dùng** trong mô hình nạp credit.

### `CreditTransaction`

- `TOP_UP` khi nạp credit thành công.
- `GEN_TEXT` / `GEN_IMAGE` / `REFUND` giữ nguyên cho AI.
- `RESET` chỉ còn trong dữ liệu cũ, không phát sinh mới.

---

## 6.4. API

| Method | Endpoint | Quyền | Mục đích |
| :--- | :--- | :--- | :--- |
| `GET` | `/workspaces/:workspaceId/billing` | Thành viên | Số dư + danh sách gói nạp |
| `GET` | `/workspaces/:workspaceId/billing/transactions` | Thành viên | Lịch sử credit, phân trang |
| `POST` | `/workspaces/:workspaceId/billing/orders` | Thành viên | Tạo đơn + link PayOS |
| `GET` | `/workspaces/:workspaceId/billing/orders/:orderId` | Thành viên | Trạng thái đơn + đối soát PayOS |
| `POST` | `/workspaces/:workspaceId/billing/orders/:orderId/cancel` | Người tạo đơn | Huỷ đơn `PENDING` |
| `POST` | `/webhooks/payos` | Public | Webhook PayOS, verify chữ ký |

`GET /billing` trả:

```json
{
  "remainingCredit": 100,
  "packages": [
    {
      "id": "uuid",
      "name": "Nạp 500",
      "description": "Dùng cho trợ lý AI và sinh ảnh",
      "creditAmount": 500,
      "price": 25000,
      "sortOrder": 1
    }
  ]
}
```

`POST /orders` body:

```json
{ "packageId": "uuid" }
```

Response tạo đơn:

```json
{
  "order": {
    "id": "uuid",
    "orderCode": "1760000000123",
    "amount": 25000,
    "creditAmount": 500,
    "packageId": "uuid",
    "status": "PENDING",
    "checkoutUrl": "https://pay.payos.vn/...",
    "expiresAt": "2026-10-24T13:30:00.000Z",
    "createdAt": "2026-10-24T13:00:00.000Z"
  }
}
```

`GET /billing/transactions?page=1&limit=10` trả `transactions` trong `data`, phân trang trong `meta`.

---

## 6.5. Luồng thanh toán

```
Thành viên chọn gói nạp
  → đọc package từ DB (isActive, chưa xoá mềm)
  → tạo Order(PENDING), snapshot amount + creditAmount
  → gọi PayOS paymentRequests.create
  → lưu paymentLinkId, checkoutUrl, expiresAt
  → trả checkoutUrl
```

- `description`: `MARKA <orderCode>` (≤ 25 ký tự).
- `returnUrl` / `cancelUrl`: `${CLIENT_URL}/billing?orderCode=<orderCode>&orderId=<orderId>`.
- PayOS lỗi khi tạo link → order `CANCELLED`, trả `502`.
- Thiếu `PAYOS_*` → trả `503`, không tạo order.

### Webhook

```
POST /webhooks/payos
  → verify chữ ký (sai: 400)
  → tìm Order theo orderCode (không thấy: log + 200)
  → order không PENDING: 200 (idempotent)
  → amount lệch: huỷ nếu còn PENDING, không cộng credit, 200
  → transaction:
       updateMany({ id, status: PENDING } → PAID, payosTransId, paidAt)
       nếu count = 0: đã xử lý, 200
       remainingCredit += creditAmount
       ghi CreditTransaction TOP_UP + AuditLog
  → 200
```

- `payosTransId` lấy từ `data.reference`, unique.
- `updateMany` theo `status: PENDING` là chốt idempotency.
- Webhook được mount **trước** `apiLimiter`.

### Đối soát khi polling

`GET /orders/:orderId`:

- Nếu `PENDING`, gọi PayOS `paymentRequests.get(orderCode)`.
- PayOS báo `PAID` → chạy cùng hàm finalize như webhook (idempotent).
- PayOS báo `CANCELLED`/`EXPIRED` → order `CANCELLED`.
- PayOS lỗi mạng → giữ trạng thái đang lưu.

### Huỷ đơn

- Chỉ `PENDING`.
- Chỉ `createdById` của order được huỷ.
- Gọi PayOS cancel; nếu PayOS lỗi → `502`, order vẫn `PENDING`.
- Đơn `PAID` → `409`.

---

## 6.6. Credit

### Nạp credit

Trong một transaction:

- `remainingCredit += order.creditAmount`
- Ghi `CreditTransaction` `INFLOW/TOP_UP` với `balanceBefore`/`balanceAfter`
- Ghi audit `BILLING_CREDIT_TOP_UP`

Không cập nhật `plan`, `monthlyQuota`, `planExpiresAt`, `billingCycleStart`, `nextResetAt`.

---

## 6.7. Không dùng queue/worker

- Tạo order, webhook, polling, huỷ đơn đều xử lý đồng bộ trong request.
- Không có `billing-queue`, `billingWorker`, cron reset/hết hạn.
- Order `PENDING` quá hạn không bị cron dọn; PayOS tự hết hạn link. Khi người dùng poll, backend đánh dấu `CANCELLED` nếu PayOS báo vậy.
- Queue/worker hiện chỉ dùng cho AI và lịch đăng Facebook.

---

## 6.8. Frontend

Trang `/billing`:

- Header **“Credit & Nạp”**.
- Card số dư credit còn lại.
- Danh sách gói nạp (4 gói), nút **Nạp credit**.
- Modal thanh toán: mở `checkoutUrl` tab mới; poll 3 giây; thành công thì đóng modal, `syncSessionUser()`, invalidate billing/transactions, toast.
- Đọc `?orderCode=` và `?orderId=` khi PayOS redirect về.
- Bảng lịch sử credit + `Pagination`.
- Loading/empty/error, dark mode, copy tiếng Việt.

`CreditUsageCard` chỉ hiển thị **“Credit còn lại: X”**.

Mã nguồn:

- Backend: `backend/src/modules/billing/`, `backend/src/routes/payosWebhook.routes.ts`.
- Frontend: `frontend/src/pages/BillingPage.tsx`, `frontend/src/components/features/billing/`, `frontend/src/services/billing/`, `frontend/src/hooks/useBilling.ts`.

---

## 6.9. Kiểm thử

`backend/tests/modules/billing/billing.test.ts` (DB thật, mock PayOS):

- Xem số dư + danh sách gói nạp.
- Mọi thành viên tạo order; người ngoài workspace `403`.
- Gói không tồn tại `404`; thiếu PayOS `503`.
- Webhook hợp lệ cộng credit; gửi lặp không cộng trùng.
- Webhook sai chữ ký `400`; lệch amount huỷ order, không cộng credit.
- Polling PayOS `PAID` finalize một lần.
- Người tạo huỷ được; người khác `403`; đơn `PAID` `409`.

---

## 6.10. Ngoài phạm vi

- Gói tháng, reset credit, hạ gói hết hạn.
- Tự động trừ tiền/gia hạn định kỳ.
- Hoàn tiền, chargeback, hoá đơn VAT.
- Admin CRUD gói/giá.
- Email cảnh báo hết credit.
