# CI/CD — Marka Capstone

> **Stack triển khai hiện tại:** GitHub Actions (CI) · Vercel (Frontend) · Render Web Service (Backend API + worker BullMQ chạy chung) · Neon (PostgreSQL) · Upstash (Redis).
>
> CD dùng **Auto-Deploy** của Render/Vercel khi push `main`; GitHub Actions chỉ làm cổng chặn chất lượng, không deploy.
> Cấu hình Render: [`render.yaml`](../render.yaml). Workflow CI: [`.github/workflows/ci.yml`](../.github/workflows/ci.yml).

---

## 1. Luồng tổng quan

```text
Developer push / PR
        │
        ▼
GitHub Actions — CI (.github/workflows/ci.yml)
  ├── frontend-ci: npm ci → oxlint → vite build
  └── backend-ci : npm ci → oxlint → prisma generate → tsc --noEmit
                   → prisma validate → prisma migrate deploy → test:connection → npm test
        │
        │ merge vào main (qua PR + branch protection)
        ▼
Auto-Deploy
  ├── Render: build backend + prisma migrate deploy → chạy npm start
  └── Vercel: build frontend → phát hành dist
        │
        ▼
Neon PostgreSQL + Upstash Redis
```

CI chạy trên PostgreSQL 16 và Redis 7 dựng tạm bằng GitHub Actions `services`; không cần GitHub Secrets cho CI.

---

## 2. CI — GitHub Actions

### 2.1. Trigger

- `push` và `pull_request` vào `dev`, `main`.
- `concurrency` huỷ lần chạy cũ khi có commit mới trên cùng branch/PR.

### 2.2. Job frontend

| Bước | Lệnh |
| :--- | :--- |
| Cài dependency | `npm ci` (working dir `frontend`) |
| Lint | `npm run lint` (oxlint) |
| Build | `npm run build` (tsc + vite) |

### 2.3. Job backend

| Bước | Lệnh |
| :--- | :--- |
| Cài dependency | `npm ci` (working dir `backend`) |
| Lint | `npm run lint` (oxlint) |
| Prisma client | `npx prisma generate` |
| Typecheck | `npm run typecheck` |
| Validate schema | `npx prisma validate` |
| Tạo bảng test | `npx prisma migrate deploy` (DB `marka_test`) |
| Kiểm tra kết nối | `npm run test:connection` |
| Test | `npm test` (Vitest + Supertest, DB test riêng) |

Biến môi trường CI dùng giá trị cố định trong workflow: `DATABASE_URL`, `REDIS_URL`, `JWT_*`, `AES_SECRET_KEY`, `NODE_ENV=test`, `CLIENT_URL`. Đây không phải credential production.

### 2.4. Branch protection

Vào **GitHub → Settings → Branches → Add branch protection rule** cho `main`:

- Require a pull request before merging.
- Require status checks to pass, chọn:
  - `Frontend — Lint & Build`
  - `Backend — Lint, Schema & Automated Tests`
- Khuyến nghị: Require branches to be up to date before merging.

Không merge được khi CI đỏ → Auto-Deploy chỉ nhận code đã qua kiểm tra.

---

## 3. CD — Render + Vercel

### 3.1. Render (backend)

Cấu hình trong [`render.yaml`](../render.yaml):

| Thuộc tính | Giá trị |
| :--- | :--- |
| Type | Web Service (`node`) |
| Region | Singapore |
| Root Directory | `backend` |
| Branch | `main` |
| Auto-Deploy | `true` |
| Build Command | `npm ci --include=dev && npx prisma generate && npx prisma migrate deploy` |
| Start Command | `npm start` |
| Health Check | `/api/v1/health` |
| `ENABLE_WORKERS` | `true` (worker chạy chung process API) |

Biến bắt buộc điền khi tạo Blueprint: `DATABASE_URL`, `REDIS_URL`, `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`, `AES_SECRET_KEY`, `CLIENT_URL`, `APP_BASE_URL`, `FACEBOOK_REDIRECT_URI`.

Biến tuỳ chọn (thêm trong Dashboard khi dùng): `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GEMINI_API_KEY`, `GEMINI_MODEL`, `CLOUDFLARE_ACCOUNT_ID`, `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_IMAGE_MODEL`, `CLOUDINARY_*`, `FACEBOOK_APP_ID`, `FACEBOOK_APP_SECRET`, `RESEND_API_KEY`, `MAIL_FROM`, `OPENAI_API_KEY`, `PAYOS_*`, `SMTP_*`.

> **Lưu ý:** `GEMINI_*` và `CLOUDFLARE_*` được module AI sử dụng; `CLOUDINARY_*` dùng cho upload ảnh/AI; `PAYOS_*` dùng cho module billing (nạp credit). `OPENAI_API_KEY`, `SMTP_*` hiện **chưa được module nào sử dụng**. `ENABLE_WORKERS=true` khởi động BullMQ, trong đó `scheduleWorker` xử lý đăng bài thật, `contentWorker` xử lý job `ai:text`/`ai:image`; `email` vẫn là worker khung. Billing không dùng queue.
>
> Gói free của Render không có Background Worker riêng, nên worker chạy chung Web Service. Khi service ngủ, job trong queue và scheduler đăng bài sẽ chờ tới khi có request đánh thức — lịch đăng có thể trễ. Production nên dùng backend always-on hoặc worker service riêng.

### 3.2. Vercel (frontend)

| Thuộc tính | Giá trị |
| :--- | :--- |
| Framework | Vite |
| Root Directory | `frontend` |
| Build Command | `npm run build` |
| Output Directory | `dist` |
| Production Branch | `main` |

Biến môi trường frontend:

```text
VITE_API_URL=https://<render-service>/api/v1
VITE_GOOGLE_CLIENT_ID=<google-client-id>
```

Sau khi có domain Vercel, cập nhật lại `CLIENT_URL` và `APP_BASE_URL` trên Render. Nếu dùng Google login, thêm domain vào *Authorized JavaScript origins*.

### 3.3. Neon & Upstash

- **Neon**: PostgreSQL; lấy connection string có `sslmode=require` và `connection_limit` hợp lý.
- **Upstash**: Redis TLS (`rediss://`), dùng cho BullMQ + OAuth state/session.
- Migration production chạy tự động trong Build Command (`prisma migrate deploy`).

---

## 4. Quy trình làm việc

```text
feat/<ten>  ──PR──►  dev  ──PR──►  main
                       │             │
                       │             ├── CI chạy lại
                       │             └── Auto-Deploy Render + Vercel
                       └── CI chạy
```

- Không commit trực tiếp vào `main`.
- Không merge khi lint/typecheck/test còn fail.
- PR tạo preview Vercel; lưu ý `CLIENT_URL` chỉ nhận một origin nên domain preview có thể bị CORS chặn.

---

## 5. Lệnh kiểm tra tại máy local (chạy trước khi push)

```bash
# Frontend
cd frontend
npm run lint
npm run build

# Backend
cd backend
npm run lint
npm run typecheck
npm test
npm run test:connection   # cần PostgreSQL + Redis đang chạy
```
