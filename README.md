# Marka — AI Omnichannel Marketing Platform

Nền tảng AI Content đa kênh & quản lý chiến dịch tiếp thị cho marketer Việt Nam.
Đồ án capstone (DATN). Monorepo gồm `backend` (Express + Prisma + BullMQ) và `frontend` (React + Vite).

> Tài liệu đầy đủ nằm trong [`docs/`](./docs). **Không dùng Docker** — chạy trực tiếp trên PostgreSQL + Redis local hoặc cloud free tier.

---

## 1. Yêu cầu môi trường

| Thành phần | Phiên bản | Ghi chú |
| :--- | :--- | :--- |
| Node.js | 20 trở lên | bắt buộc |
| PostgreSQL | 14+ | local hoặc Neon (cloud) |
| Redis | 6+ | local hoặc Upstash (cloud, TLS) |
| Git | — | — |

> Máy RAM ít: có thể dùng **Neon** (Postgres) + **Upstash** (Redis) cloud, không cần cài local.

---

## 2. Backend

```bash
cd backend
npm ci

# 1. Cấu hình biến môi trường
copy .env.example .env    # Windows
#   -> điền DATABASE_URL, REDIS_URL, JWT secrets, AES_SECRET_KEY

# 2. Tạo schema database
npx prisma generate
npx prisma migrate dev        # dev: tạo bảng theo schema
# npx prisma migrate deploy   # production/CI: chỉ áp dụng migration có sẵn

# 3. Chạy API (có kèm worker khi ENABLE_WORKERS=true)
npm run dev

# 4. (Tuỳ chọn) Chạy worker ở tiến trình RIÊNG — khuyến nghị khi production
npm run worker
```

- API: <http://localhost:5000/api/v1>
- Swagger: <http://localhost:5000/api-docs>
- Health: <http://localhost:5000/api/v1/health>

### Biến môi trường quan trọng

| Biến | Ý nghĩa |
| :--- | :--- |
| `DATABASE_URL` | Chuỗi kết nối PostgreSQL (kèm `connection_limit`) |
| `REDIS_URL` | Redis (BullMQ + cache). Upstash dùng `rediss://` (TLS) |
| `JWT_ACCESS_SECRET` / `JWT_REFRESH_SECRET` | Tối thiểu 32 ký tự |
| `AES_SECRET_KEY` | Khoá mã hoá token 3rd party, tối thiểu 32 ký tự |
| `ENABLE_WORKERS` | `true` (dev, chạy kèm API) / `false` (production, worker chạy riêng) |
| `APP_BASE_URL` | URL frontend, dùng khi tạo link trong email |
| `CLIENT_URL` | Origin được phép CORS |

Các key 3rd party (`OPENAI_API_KEY`, `CLOUDINARY_*`, `PAYOS_*`, `FACEBOOK_*`, `SMTP_*`) là **tuỳ chọn** — để trống cũng chạy được phần lõi.

---

## 3. Frontend

```bash
cd frontend
npm ci
copy .env.example .env       # điền VITE_API_URL
npm run dev
```

- Web: <http://localhost:5173>

---

## 4. Kiểm thử & chất lượng

```bash
cd backend
npm run typecheck     # tsc --noEmit
npm run lint          # oxlint
npm test              # vitest
npm run test:connection  # kiểm tra kết nối PostgreSQL + Redis
```

---

## 5. CI/CD

- CI: `.github/workflows/ci.yml` (frontend build + backend prisma/connection test).
- CD: xem [`docs/cicd.md`](./docs/cicd.md) — Vercel (frontend) + Render (backend API + **Background Worker**) + Neon + Upstash. Không dùng Docker.

---

## 6. Cấu trúc & tài liệu

```
backend/   Express + Prisma + BullMQ (Clean Architecture: controller → service → repository)
frontend/  React + Vite
docs/      Kiến trúc, đặc tả, DB, API, CI/CD, test case, class diagram
```

Tài liệu chính:

- [Kiến trúc hệ thống](./docs/architecture.md)
- [Đặc tả CSDL](./docs/database_spec.md) · [DBML ERD](./docs/schema.dbml)
- [Đặc tả API](./docs/api_documentation.md)
- [Sơ đồ lớp + biểu đồ](./docs/class-diagram.md)
- [Luồng nghiệp vụ / sequence](./docs/function_layer_mapping.md)
- [CI/CD](./docs/cicd.md) · [Test cases](./docs/test_cases.md)
- [Đặc tả theo phân hệ](./docs/specs/README.md)
