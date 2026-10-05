# Phân hệ 7: Quản trị hệ thống & Báo cáo

> [Quay lại Mục lục chính](file:///f:/DATN/marka-capstone/docs/specs/README.md)

---

## 7.1. Dashboard thống kê (View Dashboard - UC31)

**Mô tả**: Cung cấp trang thống kê tổng quan (Dashboard) dành cho Workspace Owner (về hiệu suất bài đăng, credit sử dụng) và System Admin (về doanh thu, người dùng và hoạt động toàn hệ thống).

**Tác nhân (Actors)**:
- **UC31 (View Dashboard)**: System Admin, Workspace Owner, Content Creator

**Luồng hoạt động**: 

Admin và Owner truy cập Dashboard để xem các biểu đồ thống kê: tổng số user, workspace, credit tiêu thụ, doanh thu — tổng hợp qua query aggregate định kỳ hoặc cache vào Redis (refresh mỗi vài phút) để tránh query nặng trực tiếp trên bảng giao dịch mỗi lần load dashboard.

---

## 7.2. Quản lý user & workspace

**Mô tả**: Dành cho Quản trị viên hệ thống để kiểm soát và điều phối toàn bộ người dùng và workspace.

**Tác nhân (Actors)**: System Admin

**Luồng hoạt động**: 

Admin xem danh sách user → khóa/mở khóa (`isSuspended = true/false`) → khi khóa, tăng `tokenVersion` của user đó để đăng xuất ngay lập tức khỏi mọi phiên đang hoạt động.

---

## 7.3. Audit Log (View Audit Log - UC31)

**Mô tả**: Ghi lại và cho phép xem nhật ký các hành động quan trọng trên hệ thống (đăng nhập, đổi mật khẩu/email, xóa workspace, duyệt/từ chối bài, giao dịch thanh toán thành công) nhằm phục vụ công tác quản trị và bảo mật.

**Tác nhân (Actors)**:
- **UC31 (View Audit Log)**: System Admin, Workspace Owner

**Luồng hoạt động**: 

Mỗi hành động quan trọng, sau khi xử lý thành công ở tầng service, ghi 1 bản ghi `AuditLog(actorId, action, targetType, targetId, metadata, createdAt)` — nên làm qua 1 hàm helper dùng chung (`logAudit(...)`) gọi ở cuối mỗi service method liên quan. **Quyền xem Audit Log chỉ thuộc System Admin và Workspace Owner** (Owner chỉ thấy log trong workspace của mình); **Content Creator KHÔNG có quyền xem audit log** — khớp `test_cases.md`.

**Lưu ý khi làm**: Audit log lưu tối thiểu 90 ngày — cân nhắc archive/xóa bản ghi cũ hơn bằng cron job định kỳ để bảng không phình quá lớn.
