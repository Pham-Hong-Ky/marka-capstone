---
name: designing-marka-ui
description: Dùng khi viết hoặc sửa UI trong `frontend/` của Marka (React 19 + Vite + Tailwind v4) — trang mới, component, form, modal, dropdown, bảng, empty/loading/error state, dashboard, settings, workspace. Nạp trước khi bắt tay code giao diện.
license: MIT
compatibility: opencode
metadata:
  audience: frontend
  scope: marka-capstone
---

# designing-marka-ui

## Nguyên tắc cốt lõi

UI Marka đẹp khi **bám design token + quy ước có sẵn** và **không lặp lại các "dấu hiệu AI slop"**. Code cũ có slop **không** phải là chuẩn để bắt chước.

## Khi nào dùng

Trước và trong khi viết/sửa bất kỳ file UI nào dưới `frontend/src/` (`.tsx`, mở rộng `.css`). Áp dụng cả cho component nhỏ.

## Luật Marka (bắt buộc)

1. **Màu:** chỉ dùng token `bg-background/surface/surface-2/sidebar`, `text-foreground/muted/subtle`, `border-border`. Accent là **indigo**; màu ngữ nghĩa: đỏ cho lỗi, xanh lá cho thành công. Không hardcode hex, không bịa hue mới (tím, hồng, cyan…) tùy hứng.
2. **Dark mode:** mọi component phải đúng ở cả sáng và tối; thêm `dark:` cho màu accent/chữ khi cần.
3. **Tái sử dụng:** dùng `components/ui/` (`Button`, `TextField`, `Modal`…) thay vì dựng lại primitive hoặc copy-paste style.
4. **Kiến trúc:** UI **không** gọi API trực tiếp — qua hook React Query → `services/*.api.ts`; state toàn cục qua Zustand.
5. **Gộp class bằng `cn`** (`@/utils/cn`); không nối chuỗi class thủ công.
6. **Copy tiếng Việt**, nhất quán; mọi màn có dữ liệu phải đủ trạng thái **loading / rỗng / lỗi**.
7. **A11y:** input có `<label>`; nút chỉ có icon phải có `aria-label`; dropdown/menu có `aria-expanded`; focus thấy rõ; touch target ≥ 44px.
8. **Bố cục:** giữ nhất quán radius (`rounded-lg/xl/2xl`) và khoảng cách theo pattern hiện có; nội dung trang bọc `mx-auto max-w-*`.

## Dấu hiệu AI slop — cần tránh

**Chung:**
- Font mặc định hệ điều hành / Inter cho mọi thứ → chọn font hỗ trợ tiếng Việt tốt.
- Gradient tím→xanh, indigo→purple làm điểm nhấn.
- Card lồng card; bọc cả tiêu đề trang trong card.
- Ô icon bo góc lặp lại trên mỗi heading / mỗi dòng.
- Emoji rải rác trong tiêu đề, nút.
- Chữ xám trên nền màu (khó đọc) → dùng token tương phản.
- Đen/xám tuyệt đối (`#000`, `gray` thô) thay vì màu đã tint.
- Easing `bounce`/`elastic`; glow/neon tối; shadow màu quá đà.
- Viền "side-tab" màu bên trái card.
- Dòng quá dài (> ~75 ký tự), padding chật, touch target < 44px.
- Nhảy cấp heading (`h1` → `h3`).

**Đang có thật trong Marka — đừng nhân bản, chỉnh nếu đụng tới:**
- `index.css`: font stack mặc định của hệ điều hành.
- `AppLayout.tsx` / `AuthLayout.tsx`: gradient `from-indigo-600 to-purple-500` trên ô logo.
- `DashboardPage.tsx`: emoji `👋` trong heading.
- `indigo-*` hardcode rải rác (khi có dịp thì gom thành token `--accent`).

## Ví dụ đúng / sai

| Tình huống | ✅ Đúng | ❌ Slop |
| :--- | :--- | :--- |
| Card | `rounded-2xl border border-border bg-surface p-6` | `bg-gradient-to-br from-purple-500 to-indigo-600` |
| Ô logo/icon | nền phẳng `bg-indigo-600` hoặc token | gradient indigo→purple |
| Màu chữ phụ | `text-muted` | `text-gray-400` cứng |
| Nút | dùng `<Button variant="primary">` | tự dựng lại `<button>` với style mới |

## Checklist trước khi xong

- [ ] Không hardcode màu/hex; dùng token.
- [ ] Có dark mode.
- [ ] Tái sử dụng component UI sẵn có.
- [ ] Đủ loading / empty / error; copy tiếng Việt.
- [ ] Nút icon có `aria-label`; focus rõ; target ≥ 44px.
- [ ] Không còn tell nào ở mục "Dấu hiệu AI slop".

## Red flags — dừng lại và sửa

| Suy nghĩ | Thực tế |
| :--- | :--- |
| "AppLayout cũng dùng gradient nên tôi dùng theo." | Code cũ đang có slop — không phải chuẩn để bắt chước. |
| "Thêm chút tím/hồng cho đẹp." | Chỉ indigo + màu ngữ nghĩa. |
| "Để sau thêm dark mode." | Phải có ngay trong component. |
| "Tự viết lại nút cho nhanh." | Dùng `Button` có sẵn. |
| "Màn này chắc không cần trạng thái rỗng." | Có dữ liệu thì phải có empty state. |
