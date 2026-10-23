# Phân hệ 7 — Quản trị & Báo cáo (Roadmap)

> [Quay lại Mục lục](README.md)
>
> **Trạng thái: CHƯA TRIỂN KHAI.** Không có module admin/dashboard, không có endpoint quản trị hay endpoint đọc audit log.
> Tài liệu này giữ lại mục tiêu, phần schema/log đã có và các việc cần làm.

---

## 7.1. Mục tiêu

| UC | Chức năng | Tác nhân |
| :--- | :--- | :--- |
| **UC32** | Dashboard tổng quan, quản lý user/workspace, xem audit log | System Admin, Owner |

- **System Admin:** thống kê toàn hệ thống (user, workspace, doanh thu, credit), quản lý user/workspace.
- **Workspace Owner:** thống kê trong workspace của mình và xem audit log của workspace (Content Creator không có quyền xem audit log).

---

## 7.2. Hiện trạng trong code

- **Không có endpoint** `/admin/*`, `/dashboard`, `/audit-logs`.
- `requireRoles(...)` đã có trong `middlewares/auth.ts` nhưng **chưa route nào dùng**.
- `User.systemRole` (`SYSTEM_ADMIN`/`USER`), `User.isSuspended`, `User.tokenVersion` đã có trong schema; chưa có API khoá/mở khoá, đổi role, xem danh sách user.
- `requireWorkspaceRole` coi `SYSTEM_ADMIN` như `OWNER` ở mọi workspace.
- **Audit log được ghi nhưng không đọc được:**
  - Service gọi `auditService.recordAuditLog(...)`; lỗi ghi bị nuốt (chỉ `console.warn`).
  - Không có API list/filter/export audit.
  - Bản ghi `WORKSPACE_DELETE` không có `workspaceId` (workspace đã xoá mềm).

### Các action audit đang được ghi

| Nhóm | Action |
| :--- | :--- |
| User | `USER_REGISTER`, `USER_LOGIN`, `USER_GOOGLE_LOGIN`, `USER_LOGOUT`, `USER_UPDATE_PROFILE`, `USER_CHANGE_PASSWORD` |
| Workspace | `WORKSPACE_CREATE`, `WORKSPACE_UPDATE`, `WORKSPACE_DELETE` |
| Thành viên | `MEMBER_INVITED`, `MEMBER_JOINED`, `MEMBER_LEFT`, `MEMBER_REMOVED`, `MEMBER_ROLE_CHANGED` |
| Brand Voice | `BRAND_VOICE_UPDATED` |
| Kênh | `CHANNEL_CONNECTED`, `CHANNEL_DISCONNECTED` |
| Bài viết | `POST_SUBMITTED`, `POST_APPROVED`, `POST_REJECTED` |

Không có audit cho tạo/sửa/xoá bài, media, đăng nhập thất bại, thanh toán (chưa có thanh toán).

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

Index: `(targetType, targetId, createdAt)`, `(workspaceId, createdAt)`, `(actorId, createdAt)`.

### Các trường phục vụ quản trị

- `User.systemRole`, `User.isSuspended`, `User.tokenVersion`, `User.emailVerified`.
- `Workspace.plan`, `deletedAt`.

---

## 7.4. Chưa có endpoint/service

Không có hàm/service nào cho:

- Tổng hợp số liệu dashboard (đếm user/workspace/bài, doanh thu, credit).
- Danh sách user/workspace, khoá/mở khoá, đổi `systemRole`.
- Đọc audit log (list, filter theo actor/action/target/thời gian, phân trang).
- Xuất báo cáo.

---

## 7.5. Roadmap

1. **Audit API (UC32b):** `GET /workspaces/:workspaceId/audit-logs` cho Owner (chỉ log của workspace) và `GET /admin/audit-logs` cho System Admin; filter + phân trang.
2. **Dashboard workspace:** số bài theo trạng thái, số thành viên, mức dùng credit (dữ liệu đã có sẵn).
3. **Dashboard hệ thống:** số user/workspace, tỉ lệ gói, doanh thu (phụ thuộc Phân hệ 6).
4. **Quản lý user:** list, khoá/mở khoá (`isSuspended` + tăng `tokenVersion` để buộc đăng xuất), đổi `systemRole`; bảo vệ bằng `requireRoles('SYSTEM_ADMIN')`.
5. **Quản lý workspace:** list, xem chi tiết, xoá mềm/khôi phục (hiện chưa có khôi phục).
6. **Chính sách lưu trữ audit:** archive/xoá bản ghi cũ theo thời hạn (chưa có cron).
