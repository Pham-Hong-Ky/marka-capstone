# Phân hệ 7 — Quản trị & Báo cáo

> [Quay lại Mục lục](README.md)
>
> **Trạng thái: ĐÃ TRIỂN KHAI (backend + frontend).** Có module `admin` và API đọc audit log cho System Admin/Owner; frontend `/admin` có trang tổng quan, người dùng (khoá/mở khoá), workspace (chỉ đọc) và audit log hệ thống. Audit log theo workspace mới có API, chưa có UI.

---

## 7.1. Mục tiêu

| UC | Chức năng | Tác nhân |
| :--- | :--- | :--- |
| **UC32** | Dashboard tổng quan, quản lý user/workspace, xem audit log | System Admin, Owner |

- **System Admin:** thống kê toàn hệ thống (user, workspace, doanh thu, credit), quản lý user/workspace.
- **Workspace Owner:** thống kê trong workspace của mình và xem audit log của workspace (Content Creator không có quyền xem audit log).

---

## 7.2. Hiện trạng trong code

- Module `backend/src/modules/admin` với các endpoint (đều `requireRoles('SYSTEM_ADMIN')`):
  - `GET /admin/stats`: user, workspace, bài theo trạng thái, kênh, đơn PAID + doanh thu 30 ngày.
  - `GET /admin/users`: tìm/lọc `systemRole`, `isSuspended`, phân trang; không trả `passwordHash`.
  - `PATCH /admin/users/:userId/suspend`: khoá/mở khoá + tăng `tokenVersion`, chặn tự khoá, ghi audit.
  - `GET /admin/workspaces`: tìm/lọc `plan`, `includeDeleted`, kèm số thành viên/bài.
  - `GET /admin/audit-logs`: lọc actor/action/target/thời gian/workspace, phân trang.
- `requireRoles(...)` đã được route `/admin/*` sử dụng.
- `requireWorkspaceRole` coi `SYSTEM_ADMIN` như `OWNER` ở mọi workspace.
- **Audit log đọc được:** thêm `auditRepository.listAuditLogsAndCount` + `GET /workspaces/:workspaceId/audit-logs` cho Owner (chỉ log workspace, Creator bị `403`).
- Bản ghi `WORKSPACE_DELETE` không có `workspaceId` (workspace đã xoá mềm).

### Frontend `/admin`

- Route `/admin` bọc `AdminRoute` (chặn nếu `systemRole !== 'SYSTEM_ADMIN'`); mục menu quản trị chỉ hiện với System Admin (`SidebarContent`).
- `/admin` — tổng quan: user (tổng/hoạt động/bị khoá/admin/mới 30 ngày), workspace, bài theo trạng thái, kênh, đơn `PAID` + doanh thu 30 ngày từ `GET /admin/stats`.
- `/admin/users` — tìm kiếm, lọc `systemRole`/`isSuspended`, phân trang; khoá/mở khoá qua `PATCH /admin/users/:userId/suspend` (nút tự khoá bị vô hiệu hoá).
- `/admin/workspaces` — tìm kiếm, lọc `plan`, `includeDeleted`, phân trang; **chỉ đọc** (không xoá/khôi phục).
- `/admin/audit-logs` — lọc theo action/target/khoảng ngày, phân trang, xem chi tiết metadata.
- **Chưa có UI audit log theo workspace** (Owner vẫn phải gọi API `GET /workspaces/:workspaceId/audit-logs`).

### Các action audit đang được ghi

| Nhóm | Action |
| :--- | :--- |
| User | `USER_REGISTER`, `USER_LOGIN`, `USER_GOOGLE_LOGIN`, `USER_LOGOUT`, `USER_UPDATE_PROFILE`, `USER_CHANGE_PASSWORD` |
| Workspace | `WORKSPACE_CREATE`, `WORKSPACE_UPDATE`, `WORKSPACE_DELETE` |
| Thành viên | `MEMBER_INVITED`, `MEMBER_JOINED`, `MEMBER_LEFT`, `MEMBER_REMOVED`, `MEMBER_ROLE_CHANGED` |
| Brand Voice | `BRAND_VOICE_UPDATED` |
| Kênh | `CHANNEL_CONNECTED`, `CHANNEL_DISCONNECTED` |
| Bài viết | `POST_SUBMITTED`, `POST_APPROVED`, `POST_REJECTED`, `POST_DELETED`, `POST_ASSIGNED`, `TASK_STATUS_CHANGED` |
| Quản trị | `ADMIN_USER_SUSPENDED`, `ADMIN_USER_REACTIVATED` |
| Thanh toán | `BILLING_ORDER_CREATED`, `BILLING_ORDER_CANCELLED`, `BILLING_CREDIT_TOP_UP` |

Không có audit cho tạo/sửa bài, media, đăng nhập thất bại.

---

## 7.3. Schema đã có

### `AuditLog`

| Trường | Kiểu | Ghi chú |
| :--- | :--- | :--- |
| `id` | UUID | PK |
| `workspaceId` | String? | Null với hành động ngoài workspace (đăng nhập, xoá workspace...) |
| `actorId` | String? | User thực hiện; `SetNull` nếu user bị xoá |
| `action` | String(100) | Ví dụ `POST_APPROVED` |
| `targetType` | String(100) | `User`, `Workspace`, `WorkspaceMember`, `WorkspaceInvite`, `Post`, `ChannelConnection` |
| `targetId` | String?(255) | ID đối tượng |
| `reason` | String?(255) | Lý do (dùng cho `POST_REJECTED`) |
| `metadata` | JSON? | Dữ liệu phụ (`{ title }`, `{ from, to }`...) |
| `createdAt` | DateTime | Thời điểm |

Index: `(targetType, targetId, createdAt)`, `(workspaceId, createdAt)`, `(actorId, createdAt)`, `(action, createdAt)`.

### Các trường phục vụ quản trị

- `User.systemRole`, `User.isSuspended`, `User.tokenVersion`, `User.emailVerified`.
- `Workspace.plan`, `deletedAt`.

---

## 7.4. Phạm vi đã triển khai

- Tổng hợp số liệu dashboard hệ thống (user/workspace/bài/kênh/doanh thu 30 ngày).
- Danh sách user/workspace, khoá/mở khoá user (không đổi `systemRole`, không xoá user).
- Đọc audit log (list, filter theo actor/action/target/thời gian/workspace, phân trang) cho admin và Owner.
- Trang `/admin` (tổng quan, người dùng, workspace, audit log hệ thống) giới hạn cho System Admin.
- Chưa có: UI audit log theo workspace (chỉ có API), xuất báo cáo, xoá/khôi phục workspace, chính sách lưu trữ audit.

---

## 7.5. Roadmap

1. **Dashboard workspace nâng cao:** số thành viên, mức dùng credit (phần số liệu bài đăng đã có ở `/analytics` — UC39).
2. **Quản lý user nâng cao:** đổi `systemRole`, xem chi tiết hoạt động.
3. **Quản lý workspace:** xoá mềm/khôi phục, xem chi tiết.
4. **Audit nâng cao:** xuất CSV, archive/xoá bản ghi cũ theo thời hạn.
5. **UI audit log workspace:** trang cho Owner xem `GET /workspaces/:workspaceId/audit-logs` (hiện chỉ có API).
