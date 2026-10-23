# Phân hệ 6 — Credit & Thanh toán PayOS (Một phần)

> [Quay lại Mục lục](README.md)
>
> **Trạng thái: MỘT PHẦN.** Đã có `modules/credit` (trừ/hoàn credit cố định cho AI) và
> `CreditTransaction` được ghi khi enqueue/refund. **Chưa có** endpoint nạp credit, gói credit,
> Order hay PayOS.
> Tài liệu này giữ lại mục tiêu, phần schema đã có và các việc cần làm — **không** mô tả
> phần thanh toán như chức năng đang hoạt động.

---

## 6.1. Mục tiêu

| UC | Chức năng | Tác nhân |
| :--- | :--- | :--- |
| **UC31** | Nạp credit / nâng cấp gói qua PayOS | Owner |
| **UC40** | Xem danh sách gói credit | Thành viên |
| **UC41** | Xem số dư & lịch sử giao dịch credit | Thành viên |

Ngoài ra: trừ credit khi gọi AI (đã có), hoàn credit khi thất bại (đã có), reset credit theo chu kỳ tháng (chưa có).

---

## 6.2. Hiện trạng trong code

- **Đã có:** `modules/credit` với `reserve`/`refund` dùng transaction, gọi từ module AI
  (`GEN_TEXT` 10, `GEN_IMAGE` 20, `REFUND` khi job thất bại hẳn).
- **Chưa có endpoint** nào dưới `/credits`, `/packages`, `/orders`, `/payments`, `/webhooks/payos`.
- Không gọi PayOS; không có cron reset credit; `CreditPackage`/`Order` chưa có service.
- `env.ts` có khai báo `PAYOS_CLIENT_ID`, `PAYOS_API_KEY`, `PAYOS_CHECKSUM_KEY` nhưng **không nơi nào đọc**.
- `aiLimiter` (20 request/phút/workspace) đã gắn cho 2 endpoint POST AI; không gắn cho GET poll.
- **UC41 — Một phần:** `remainingCredit` và `monthlyQuota` xuất hiện trong response workspace:
  - `GET /workspaces`
  - `POST /workspaces`
  - `PATCH /workspaces/:workspaceId`
  - `GET /users/me` (trong từng workspace)

  Không có API xem lịch sử `CreditTransaction` hay số dư chi tiết.

---

## 6.3. Schema đã có

### `Workspace` — các trường phục vụ credit/gói

| Trường | Kiểu / default | Ghi chú |
| :--- | :--- | :--- |
| `plan` | `WorkspacePlan` = `FREE` | `FREE` / `PRO` / `ENTERPRISE` |
| `remainingCredit` | Int = 100 | Số dư hiện tại |
| `monthlyQuota` | Int = 100 | Hạn mức tháng |
| `planExpiresAt` | DateTime? | Hạn gói |
| `billingCycleStart` | DateTime? | Mốc neo chu kỳ |
| `nextResetAt` | DateTime? | Mốc reset kế tiếp |
| `planExpiryWarningSentAt` | DateTime? | Cờ chống gửi trùng email nhắc hạn gói |
| `creditWarningSentAt` | DateTime? | Cờ chống gửi trùng email cảnh báo credit |

### `CreditTransaction`

`id`, `workspaceId`, `type` (`CreditFlowType`: `INFLOW`/`OUTFLOW`), `action` (`CreditActionType`: `GEN_TEXT`, `GEN_IMAGE`, `REGEN`, `SCORE`, `TOP_UP`, `RESET`, `REFUND`), `amount`, `balanceBefore`, `balanceAfter`, `reason`, `createdById`, `createdAt`.

### `CreditPackage`

`id`, `name`, `description`, `creditAmount`, `price`, `sortOrder`, `isActive`, `deletedAt` (xoá mềm), `createdAt`, `updatedAt`.

### `Order`

`id`, `orderCode` (unique), `workspaceId`, `packageId?`, `amount`, `creditAmount?`, `targetPlan?`, `payosTransId?` (unique), `paidAt`, `status` (`OrderStatus`: `PENDING`/`PAID`/`CANCELLED` — **không có `FAILED`**), `createdById`, `createdAt`, `updatedAt`.

---

## 6.4. Chưa có endpoint/service

Không có bất kỳ hàm/service nào cho:

- Tạo link/QR PayOS, tạo `Order`, kiểm tra trạng thái đơn.
- Webhook PayOS, xác thực chữ ký, cộng credit idempotent.
- Ghi/đọc `CreditTransaction`, trừ/hoàn credit khi gọi AI.
- Reset credit theo `nextResetAt`, hạ gói khi hết hạn.

---

## 6.5. Roadmap

1. **Gói & đơn:** API list package (UC40).
2. **Thanh toán:** tạo `Order(PENDING)` + link PayOS; endpoint polling trạng thái; webhook verify chữ ký, cập nhật `Order` trong transaction, chỉ cộng credit khi `updateMany({ where: { orderCode, status: 'PENDING' } })` thành công (idempotent).
3. **Sổ credit:** mọi thay đổi ghi `CreditTransaction` với `balanceBefore`/`balanceAfter`; trừ sau khi AI thành công, hoàn khi thất bại sau retry.
4. **Chu kỳ:** cron dùng `billingCycleStart`/`nextResetAt` để reset `remainingCredit = monthlyQuota` và ghi `RESET`; hạ `plan = FREE` khi `planExpiresAt` quá hạn.
5. **UC41:** API số dư + lịch sử giao dịch (phân trang), chỉ thành viên workspace.
6. **Email:** dùng `planExpiryWarningSentAt`, `creditWarningSentAt` để gửi nhắc một lần (xem [05](./05-notifications-email.md)).
