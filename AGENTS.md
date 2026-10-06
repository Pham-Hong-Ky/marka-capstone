# Quy ước & phong cách code — Marka Capstone

Áp dụng cho toàn repo (`backend/`, `frontend/`). Đọc trước khi viết/sửa code.

## 1. Giao tiếp khi làm việc

- Trả lời bằng tiếng Việt.
- **Không chắc sửa ở đâu → hỏi lại trước, không đoán.** Nêu rõ đang nghi ngờ gì và cần xác nhận gì.
- **Trước khi commit và push → hỏi lại người dùng trước, chờ xác nhận rồi mới làm.**
- **Sửa lỗi phải giải thích:** (1) nguyên nhân gốc, (2) cách khắc phục, (3) ảnh hưởng.
- Báo tiến độ ngắn gọn: đổi file nào, vì sao.

## 2. Kiến trúc Backend (bắt buộc tuân theo)

Mỗi feature là một module: `backend/src/modules/<tên>/`

```
<tên>/
  <tên>.validation.ts   # Zod schema + object { body, params, query }
  <tên>.controller.ts   # mỏng: nhận req/res, gọi service, trả ApiResponse
  <tên>.service.ts      # business logic, ném lỗi nghiệp vụ
  <tên>.repository.ts   # chỉ truy cập dữ liệu (Prisma)
  index.ts              # export gọn
```

Luồng: `route → validate(Zod) → controller → service → repository → Prisma`.

- **Controller**: chỉ orchestrate; bọc `catchAsync`, trả `ApiResponse`. Không business logic, không gọi Prisma.
- **Service**: business logic, điều phối repository, ném `NotFoundError/ConflictError/...` từ `utils/errors`. Không đụng `res`.
- **Repository**: chỉ Prisma; hàm nhỏ, đặt tên theo hành động (`findUserById`, `createUser`); export named + `default`.
- **Validation**: schema Zod tách riêng; dùng `.openapi({ example })`; export schema gốc + object `{ body, params, query }`.
- Xử lý lỗi qua error classes + middleware `error`, không tự `res.status().json()` thủ công.
- **Định dạng response**: luôn trả qua `ApiResponse.success` / `ApiResponse.error`. Envelope chuẩn `{ status, message, data?, meta? }`, trong đó `4xx → "fail"`, `5xx → "error"`. Danh sách phân trang: dữ liệu trong `data`, thông tin phân trang trong `meta`.
- **Bảo vệ route**: dùng `requireAuth` trước, rồi `requireRoles` / `requireWorkspaceRole` khi cần. App **đa tenant** — mọi truy vấn theo workspace phải scope bằng `workspaceId` (lấy từ header `x-workspace-id` hoặc params), không đọc chéo workspace khác.

## 3. Kiến trúc Frontend

- Cấu trúc: `components/`, `pages/` (hoặc `features/`), `hooks/`, `services/`, `store/`, `types/`, `config/`.
- **Tách lớp gọi API ra khỏi component.** Mỗi feature có file API riêng (vd `services/<feature>.api.ts`), chứa hàm gọi endpoint và trả về data.
- Component/hook **không** chứa URL hay gọi axios trực tiếp; chỉ gọi hook React Query (`useQuery`/`useMutation`) trỏ tới hàm trong lớp API.
- `services/httpClient.ts` là instance axios dùng chung (đã có interceptor/refresh token); lớp API dùng nó, không tạo axios mới.
- Data server dùng **React Query**; state toàn cục dùng **Zustand**; form dùng **react-hook-form + Zod**.
- Styling Tailwind; gộp class bằng `clsx`/`tailwind-merge`.
- Env qua `config/env.ts` (Zod), truy cập qua `env`; không đọc `import.meta.env` rải rác.

## 4. Phong cách code

- **Clean code, SOLID, DRY/KISS.** Hàm một nhiệm vụ, ngắn, dễ đọc.
- **Tái sử dụng**: trước khi viết mới, tìm util/component/hàm đã có (`utils/`, `components/`) và tách hàm dùng chung khi bị lặp.
- **Hạn chế `any`.** Dùng type cụ thể, generic, hoặc `unknown` + thu hẹp kiểu. Chỉ dùng `any` khi bất khả kháng và có lý do.
- **Hạn chế comment.** Chỉ comment "tại sao" khi logic khó hiểu; không mô tả điều code đã nói rõ.
- Đặt tên rõ nghĩa: biến/hàm `camelCase`, type/class `PascalCase`, hằng `UPPER_SNAKE`; hàm async đặt theo động từ.
- Không để `console.log` bừa (dùng `logger`); `console.warn/error` được phép.
- **Không để `catch` trống.** Mỗi `catch` phải xử lý lỗi hoặc tối thiểu ghi log; không được nuốt lỗi im lặng.
- Message trả về/lỗi cho người dùng: **tiếng Việt**.
- Import nội bộ dùng đuôi `.js` (ESM NodeNext).

## 5. Formatting & lint (hiện trạng)

- Lint: `oxlint` (`.oxlintrc.json` mỗi bên). Chạy `npm run lint`.
- Chưa có Prettier/`.editorconfig`; giữ nhất quán theo code hiện có: `'` đơn, có `;`, indent 2 space, trailing comma.
- Backend: `npm run typecheck`. Frontend: `npm run build`.
- Không commit khi lint/typecheck/test còn fail.

## 6. Testing

- Backend: **Vitest + Supertest**, test cạnh module `*.test.ts`, chạy trên DB thật.
- Mỗi feature/luồng mới: thêm test (happy path + lỗi chính).
- Chạy `npm test`.

## 7. Git

- **Conventional Commits**: `feat|fix|refactor|test|docs|chore(scope): mô tả`.
- Chia commit theo nhóm logic, mỗi commit một ý.
- Không commit `.env`/secret; cập nhật `.env.example` khi thêm biến.

## 8. Lệnh thường dùng

- Backend (`backend/`): `npm run dev`, `npm run worker`, `npm test`, `npm run typecheck`, `npm run lint`, `npm run prisma:migrate`.
- Frontend (`frontend/`): `npm run dev`, `npm run build`, `npm run lint`.

## 9. Kỷ luật khi viết/sửa code

Bốn nguyên tắc bắt buộc, áp dụng cho mọi thay đổi (bổ sung cho mục 4 và 6):

1. **Suy nghĩ trước khi code.** Không tự giả định rồi lao vào làm. Nếu mơ hồ: nêu rõ đang phân vân, đưa ra các cách hiểu khác nhau và trade-off, rồi hỏi lại. Gặp điều chưa rõ hoặc mâu thuẫn → dừng lại hỏi, không đoán.
2. **Đơn giản trước tiên.** Viết lượng code tối thiểu đủ giải quyết vấn đề, không thêm thứ chưa được yêu cầu. Không abstraction cho code chỉ dùng một lần, không thêm "tính linh hoạt/cấu hình" ngoài yêu cầu, không xử lý lỗi cho tình huống không thể xảy ra. Nếu 200 dòng có thể rút còn 50 → viết lại. Tự hỏi: "một senior có thấy cái này rối không?".
3. **Thay đổi phẫu thuật.** Chỉ chạm đúng phần cần thiết. Không "tiện tay" cải thiện code/comment/format xung quanh, không refactor thứ đang chạy tốt, giữ đúng style hiện có dù mình thích cách khác. Thấy code chết/đoạn không liên quan → **nêu ra, không tự xóa**. Khi thay đổi của mình làm mồ côi (import/biến/hàm): dọn phần **do mình tạo ra**, không xóa code chết có sẵn. Tiêu chí: mọi dòng đã đổi phải truy vết trực tiếp về yêu cầu.
4. **Làm theo mục tiêu kiểm chứng được.** Biến việc mơ hồ thành mục tiêu có tiêu chí pass/fail, rồi lặp tới khi đạt. Ví dụ: "thêm validation" → "viết test cho input sai rồi làm cho pass"; "sửa bug" → "viết test tái hiện bug rồi làm cho pass"; "refactor X" → "đảm bảo test pass trước và sau". Với việc nhiều bước, nêu ngắn gọn kế hoạch dạng `bước → cách kiểm chứng` trước khi bắt tay.

Ngoại lệ: việc tầm thường (sửa typo, đổi một dòng rõ ràng) không cần áp dụng đủ nghi thức; dùng phán đoán để không làm chậm việc đơn giản.
