# Quy ước & phong cách code — Marka Capstone

Áp dụng cho toàn repo (`backend/`, `frontend/`). Đọc trước khi viết/sửa code.

## 1. Giao tiếp khi làm việc

- Trả lời bằng tiếng Việt.
- **Không chắc sửa ở đâu → hỏi lại trước, không đoán.** Nêu rõ đang nghi ngờ gì và cần xác nhận gì.
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

## 3. Kiến trúc Frontend

- Cấu trúc: `components/`, `pages/` (hoặc `features/`), `hooks/`, `services/`, `store/`, `types/`, `config/`.
- Gọi API **chỉ** qua `services/httpClient` (axios đã cấu hình interceptor/refresh token). Không gọi axios thẳng trong component.
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
