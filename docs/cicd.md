# Kế Hoạch CI/CD — Marka Capstone

> **Stack triển khai:** GitHub Actions (CI) · Vercel (Frontend) · Render **1 Web Service gộp worker** (Backend API + BullMQ) · Neon (PostgreSQL) · Upstash (Redis)
>
> **CD không dùng GitHub Actions**: Render và Vercel tự deploy khi push `main` (Auto-Deploy), còn CI được dùng làm **cổng chặn** qua *branch protection*. Nhờ vậy không cần secret hay deploy hook. Cấu hình hạ tầng Render nằm ở [`render.yaml`](../render.yaml).

---

## 1. Tổng quan kiến trúc CI/CD

```
Developer push / PR
        │
        ▼
┌─────────────────────────────┐
│   GitHub Actions — CI       │  Chạy trên mọi push vào dev/main
│                             │
│  ┌──────────────────────┐   │
│  │  Job: frontend-ci    │   │  Lint (oxlint) + TypeScript + Vite Build
│  └──────────────────────┘   │
│  ┌──────────────────────┐   │
│  │  Job: backend-ci     │   │  Prisma Validate + DB Push + test:connection
│  └──────────────────────┘   │  (PostgreSQL 16 + Redis 7 container tạm thời)
└─────────────────────────────┘
        │
        │ merge vào main (đã qua branch protection + CI)
        ▼
┌───────────────────────────────────────────────┐
│   CD — Auto-deploy nền tảng (không cần hook)   │
│                                               │
│   Render  ──► tự build & deploy Backend API   │
│               (gộp worker, ENABLE_WORKERS)    │
│   Vercel  ──► tự build & deploy Frontend      │
└───────────────────────────────────────────────┘
        │
        ▼
   ┌────────────────────┐
   │  Neon PostgreSQL   │  (neon.tech — free tier)
   │  Upstash Redis     │  (upstash.com — free tier)
   └────────────────────┘
```

---

## 2. Thời điểm triển khai — Nên làm ngay hay đợi?

| | **CI (Kiểm tra code tự động)** | **CD (Deploy tự động)** |
|---|---|---|
| **Làm khi nào?** | **Ngay bây giờ** | Sau khi xong module Auth |
| **Tốn bao lâu?** | ~20 phút | ~1–2 giờ |
| **Cần secrets GitHub?** | ❌ Không (dùng DB tạm thời) | ❌ Không (dùng Auto-Deploy + branch protection, không cần deploy hook) |
| **Lợi ích** | Chặn code lỗi trước khi merge | Có URL live demo tự động |
| **Rủi ro nếu bỏ qua** | Code vỡ build mà không ai biết | Cần config lại khi env thay đổi |

> **Lý do CD chưa làm ngay:** Env variables (OAuth keys, SMTP, Cloudinary...) của module Auth và các module tiếp theo còn thay đổi liên tục. Dựng CD quá sớm thì mỗi lần thêm biến lại phải vào Render/Neon cấu hình lại. Tốt hơn là đợi đến khi env ổn định sau khi xong Auth + 1-2 module.

---

## 3. Giai đoạn 1: CI — Triển khai NGAY

### 3.1. Tạo file `.github/workflows/ci.yml`

```yaml
name: CI — Marka Capstone

on:
  push:
    branches: [dev, main]
  pull_request:
    branches: [dev, main]

jobs:
  # ──────────────────────────────────────────────
  # JOB 1: Kiểm tra Frontend (Lint + Build)
  # ──────────────────────────────────────────────
  frontend-ci:
    name: Frontend — Lint & Build
    runs-on: ubuntu-latest
    defaults:
      run:
        working-directory: ./frontend

    steps:
      - uses: actions/checkout@v4

      - name: Setup Node.js 20
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
          cache-dependency-path: frontend/package-lock.json

      - name: Install dependencies
        run: npm ci

      - name: Lint (oxlint)
        run: npm run lint

      - name: TypeScript check + Vite Build
        run: npm run build

  # ──────────────────────────────────────────────
  # JOB 2: Kiểm tra Backend (Schema + Connection)
  # ──────────────────────────────────────────────
  backend-ci:
    name: Backend — Prisma Schema & Connection Test
    runs-on: ubuntu-latest
    defaults:
      run:
        working-directory: ./backend

    # GitHub tự tạo container PostgreSQL 16 và Redis 7 tạm thời
    # chỉ dùng trong lần chạy CI này, xóa sau khi job kết thúc
    services:
      postgres:
        image: postgres:16-alpine
        env:
          POSTGRES_USER: postgres
          POSTGRES_PASSWORD: postgres
          POSTGRES_DB: marka_test
        ports:
          - 5432:5432
        options: >-
          --health-cmd pg_isready
          --health-interval 5s
          --health-timeout 5s
          --health-retries 5

      redis:
        image: redis:7-alpine
        ports:
          - 6379:6379
        options: >-
          --health-cmd "redis-cli ping"
          --health-interval 5s
          --health-timeout 5s
          --health-retries 5

    # Biến môi trường test — dùng giá trị cố định vì đây là môi trường CI
    env:
      DATABASE_URL: postgresql://postgres:postgres@localhost:5432/marka_test?schema=public&connection_limit=10
      REDIS_URL: redis://127.0.0.1:6379
      NODE_ENV: test
      PORT: 5000
      JWT_ACCESS_SECRET: ci_test_jwt_access_secret_minimum_32_characters
      JWT_REFRESH_SECRET: ci_test_jwt_refresh_secret_minimum_32_characters
      JWT_ACCESS_EXPIRES_IN: 15m
      JWT_REFRESH_EXPIRES_IN: 7d
      AES_SECRET_KEY: ci_test_aes_secret_key_32_bytes!!

    steps:
      - uses: actions/checkout@v4

      - name: Setup Node.js 20
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
          cache-dependency-path: backend/package-lock.json

      - name: Install dependencies
        run: npm ci

      - name: Validate Prisma Schema
        run: npx prisma validate

      - name: Push Schema to Test DB
        run: npx prisma db push --skip-generate

      - name: Test connections (PostgreSQL + Redis)
        run: npm run test:connection
```

### 3.2. Commit và push

```bash
git add .github/
git commit -m "ci: add GitHub Actions CI workflow"
git push origin dev
```

Sau khi push, vào tab **Actions** trên GitHub để xem CI chạy trong khoảng 2–3 phút.

---

## 4. Giai đoạn 2: CD — Triển khai sau khi xong Auth

### 4.1. Chuẩn bị tài khoản và dịch vụ cloud

| Dịch vụ | Mục đích | URL | Gói miễn phí |
|---|---|---|---|
| **Vercel** | Host Frontend | [vercel.com](https://vercel.com) | ✅ Unlimited |
| **Render** | Host Backend API + worker BullMQ (chạy **gộp** 1 service) | [render.com](https://render.com) | ✅ 750 giờ/tháng |
| **Neon** | PostgreSQL Cloud | [neon.tech](https://neon.tech) | ✅ 512MB DB |
| **Upstash** | Redis Cloud | [upstash.com](https://upstash.com) | ✅ 10K cmd/ngày |

> ⚠️ **Lưu ý về gói free của Render:** *Background Worker* là dịch vụ **trả phí** (không có gói free). Vì vậy kế hoạch này gộp worker vào chính Web Service API bằng `ENABLE_WORKERS=true`. Đổi lại, khi service "ngủ" sau ~15 phút thì job trong queue bị hoãn cho tới khi có request đánh thức — chấp nhận được cho đồ án.
>
> Cấu hình Web Service cũng có thể khai báo sẵn trong [`render.yaml`](../render.yaml) (Render Blueprint) thay vì click tay.

### 4.2. Bước cấu hình từng dịch vụ

#### Bước 1: Neon (PostgreSQL Production)

1. Đăng ký tại [neon.tech](https://neon.tech) bằng tài khoản GitHub.
2. Tạo project: **marka-production** → Region: **Singapore (ap-southeast-1)**.
3. Copy **Connection String** dạng:
   ```
   postgresql://user:password@ep-xxx.ap-southeast-1.aws.neon.tech/narka?sslmode=require&connection_limit=20&pool_timeout=10
   ```
4. Chạy migration lần đầu từ local:
   ```bash
   DATABASE_URL="<neon-connection-string>" npx prisma migrate deploy
   ```

#### Bước 2: Upstash (Redis Production)

1. Đăng ký tại [upstash.com](https://upstash.com).
2. Tạo Redis Database → Region: **Singapore** → Enable **TLS**.
3. Copy URL dạng:
   ```
   rediss://default:password@lucky-hen-12345.upstash.io:6379
   ```
   *(Lưu ý: `rediss://` có 2 chữ s vì dùng TLS)*

#### Bước 3: Render — Backend API (gộp worker)

Chạy **một** service duy nhất cho cả API và worker BullMQ. Không cần Docker, không cần service worker trả phí.

1. Đăng ký tại [render.com](https://render.com) bằng GitHub.
2. **New → Web Service** → Chọn repo `marka-capstone`.
   - Name: `marka-api`
   - Root Directory: `backend`
   - Build Command: `npm ci --include=dev && npx prisma generate && npx prisma migrate deploy`
   - Start Command: `npm start`  *(chạy bằng `tsx` — `tsx` là devDependency nên Build phải có `--include=dev`)*
   - Health Check Path: `/api/v1/health`
   - Environment: `Node 20`
3. Thêm toàn bộ biến môi trường trong tab **Environment**:
   ```
   NODE_ENV=production
   DATABASE_URL=<neon-connection-string>
   REDIS_URL=<upstash-redis-url>
   JWT_ACCESS_SECRET=<strong-random-secret>
   JWT_REFRESH_SECRET=<strong-random-secret>
   AES_SECRET_KEY=<32-char-key>
   CLIENT_URL=https://<your-app>.vercel.app
   APP_BASE_URL=https://<your-app>.vercel.app
   ENABLE_WORKERS=true
   ... (các key 3rd party khác)
   ```
   > `ENABLE_WORKERS=true` để worker BullMQ chạy **chung tiến trình API** (đúng mặc định trong `server.ts`). Job AI/đăng bài/gửi email vẫn xử lý bình thường, không cần service riêng.
4. Deploy lần đầu thủ công → Test `/api/v1/health` trả về `connected`.
5. Copy **Service URL** của Render (dạng `https://marka-api.onrender.com`).

> **Không dùng Docker ở local:** chỉ cần PostgreSQL + Redis chạy trực tiếp (hoặc dùng Neon + Upstash cloud). Trên Render, service được cấu hình bằng Root Directory + Build/Start Command, không cần Dockerfile.
>
> **Nếu sau này cần tách worker:** phải dùng *Render Background Worker* (dịch vụ **trả phí**, Start Command `npm run worker`) và đặt `ENABLE_WORKERS=false` ở service API. Chưa cần cho đồ án.

#### Bước 4: Vercel (Frontend)

1. Đăng ký tại [vercel.com](https://vercel.com) bằng GitHub.
2. **New Project** → Import repo `marka-capstone`.
   - Framework Preset: **Vite**
   - Root Directory: `frontend`
   - Build Command: `npm run build`
   - Output Directory: `dist`
3. Thêm biến môi trường:
   ```
   VITE_API_URL=https://marka-api.onrender.com/api/v1
   VITE_GOOGLE_CLIENT_ID=<nếu dùng Google login>
   ```
4. Deploy → Nhận URL live dạng `https://marka-capstone.vercel.app`.
5. **Nối dây lại (đừng bỏ):** quay sang Render, cập nhật `CLIENT_URL` và `APP_BASE_URL` = đúng domain Vercel vừa nhận. Nếu quên, CORS sẽ chặn toàn bộ request từ frontend. Nếu dùng Google login, thêm domain này vào *Authorized JavaScript origins* trong Google Cloud Console.

### 4.3. Bật Auto-Deploy (CD không cần GitHub Actions)

CD dùng cơ chế **Auto-Deploy của nền tảng** — không cần deploy hook, không cần secret.

- **Render**: service đã bật `autoDeploy: true` (khai báo trong `render.yaml`, hoặc **Settings → Build & Deploy → Auto-Deploy: Yes**). Mỗi lần push vào `main`, Render tự build và deploy.
- **Vercel**: Project → **Settings → Git** → Production Branch = `main`. Mỗi lần push vào `main`, Vercel tự deploy frontend. PR sẽ tạo bản *preview* (xem cảnh báo CORS bên dưới).

> **Vì sao không dùng `.github/workflows/deploy.yml`?** Auto-Deploy bớt được 4 secret, không cần gọi deploy hook bằng `curl`, và tránh bước health-check bị fail oan khi Web Service free đang "ngủ". Cổng kiểm soát chất lượng được đặt ở bước merge (4.4).

### 4.4. Branch protection trên `main` — cổng chặn CI

Bước **bắt buộc** để Auto-Deploy không đẩy code lỗi lên production.

Vào **GitHub repo → Settings → Branches → Add branch protection rule**:

- Branch name pattern: `main`
- ✅ **Require a pull request before merging**
- ✅ **Require status checks to pass before merging** → chọn:
  - `Frontend — Lint & Build`
  - `Backend — Lint, Schema & Automated Tests`
- ✅ (khuyến nghị) **Require branches to be up to date before merging**

Nhờ vậy không thể merge vào `main` khi CI còn đỏ, nên Auto-Deploy luôn deploy code đã qua kiểm tra.

> **Cảnh báo CORS:** `CLIENT_URL` trong `app.ts` chỉ nhận **một** origin, nên domain *preview* của Vercel (mỗi PR một URL) sẽ bị chặn. Chỉ domain production hoạt động.

---

## 5. Tóm tắt lộ trình

```
Hôm nay — Giai đoạn Scaffold hoàn thành
  └── [NGAY BÂY GIỜ] Tạo .github/workflows/ci.yml
       └── CI bảo vệ code từ mọi PR module Auth trở đi ✅

Sau khi xong module Auth (1-2 tuần tới)
  └── [LÀM SAU] Cấu hình CD
       ├── 1. Tạo Neon project (Singapore, pooled connection string)
       ├── 2. Tạo Upstash Redis (Singapore, TLS)
       ├── 3. Tạo Render Web Service từ render.yaml (ENABLE_WORKERS=true, gộp worker)
       ├── 4. Tạo Vercel project + set VITE_API_URL
       ├── 5. Cập nhật CLIENT_URL/APP_BASE_URL trên Render = domain Vercel
       └── 6. Bật branch protection cho main (chọn 2 status check của CI)
```

---

## 6. Sau khi CD hoạt động — Quy trình làm việc hàng ngày

```
Feature branch (feat/auth-login)
        │ git push origin feat/auth-login
        ▼
  Pull Request → dev
        │ CI tự chạy (~3 phút)
        │ ✅ pass → Merge vào dev
        ▼
  PR: dev → main (mỗi sprint/milestone)
        │ CI tự chạy lần nữa + branch protection bắt buộc xanh mới merge được
        │ ✅ pass → Merge vào main
        ▼
  Auto-Deploy tự kích hoạt (KHÔNG cần GitHub Actions CD)
        │ Render → Backend API (gộp worker)
        │ Vercel → Frontend
        ▼
  https://marka-capstone.vercel.app ✅ live
```
