# Kế Hoạch CI/CD — Marka Capstone

> **Stack triển khai:** GitHub Actions (CI) · Vercel (Frontend) · Render (Backend API + Background Worker) · Neon (PostgreSQL) · Upstash (Redis)

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
        │ merge vào main
        ▼
┌─────────────────────────────┐
│   GitHub Actions — CD       │  Chỉ chạy khi merge vào main
│                             │
│  ┌──────────────────────┐   │
│  │  Deploy Frontend     │───┼──► Vercel (vercel.com)
│  └──────────────────────┘   │
│  ┌──────────────────────┐   │
│  │  Deploy Backend      │───┼──► Render (render.com)
│  └──────────────────────┘   │      │
└─────────────────────────────┘      │
                                     ▼
                              ┌─────────────────┐
                              │  Neon PostgreSQL │  (neon.tech — free tier)
                              │  Upstash Redis   │  (upstash.com — free tier)
                              └─────────────────┘
```

---

## 2. Thời điểm triển khai — Nên làm ngay hay đợi?

| | **CI (Kiểm tra code tự động)** | **CD (Deploy tự động)** |
|---|---|---|
| **Làm khi nào?** | **Ngay bây giờ** | Sau khi xong module Auth |
| **Tốn bao lâu?** | ~20 phút | ~1–2 giờ |
| **Cần secrets?** | ❌ Không (dùng DB tạm thời) | ✅ Có (keys của Vercel, Render, Neon, Upstash) |
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
| **Render** | Host Backend API | [render.com](https://render.com) | ✅ 750 giờ/tháng |
| **Neon** | PostgreSQL Cloud | [neon.tech](https://neon.tech) | ✅ 512MB DB |
| **Upstash** | Redis Cloud | [upstash.com](https://upstash.com) | ✅ 10K cmd/ngày |

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

#### Bước 3: Render — Backend API

1. Đăng ký tại [render.com](https://render.com) bằng GitHub.
2. **New → Web Service** → Chọn repo `marka-capstone`.
   - Root Directory: `backend`
   - Build Command: `npm ci --include=dev && npx prisma generate`
   - Start Command: `npm start`  *(chạy bằng `tsx` — `tsx` là devDependency nên Build phải có `--include=dev`)*
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
   ENABLE_WORKERS=false
   ... (các key 3rd party khác)
   ```
   > `ENABLE_WORKERS=false` để API **không** chạy queue tại đây; worker chạy ở service riêng (Bước 3b) → API và worker scale độc lập.
4. Deploy lần đầu thủ công → Test `/api/v1/health` trả về `connected`.
5. Copy **Service URL** của Render (dạng `https://marka-api.onrender.com`).

#### Bước 3b: Render — Background Worker (BullMQ)

Tách worker ra khỏi API để job AI/đăng bài/gửi email không chiếm CPU của web server. Không cần Docker.

1. **New → Background Worker** → cùng repo `marka-capstone`.
   - Root Directory: `backend`
   - Build Command: `npm ci --include=dev && npx prisma generate`
   - Start Command: `npm run worker`
   - Environment: `Node 20`
2. Thêm cùng nhóm biến môi trường như Bước 3 (đặc biệt `DATABASE_URL`, `REDIS_URL`, `OPENAI_API_KEY`), **không** cần `PORT`.
3. Deploy → log sẽ hiện `[Workers] Đang lắng nghe job...`.

> **Không dùng Docker ở local:** chỉ cần PostgreSQL + Redis chạy trực tiếp (hoặc dùng Neon + Upstash cloud). Trên Render, service được cấu hình bằng Root Directory + Build/Start Command, không cần Dockerfile.

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
   ```
4. Deploy → Nhận URL live dạng `https://marka-capstone.vercel.app`.

### 4.3. Cấu hình GitHub Secrets cho CD

Vào **GitHub repo → Settings → Secrets and variables → Actions** → Thêm:

| Secret Name | Lấy từ đâu |
|---|---|
| `RENDER_DEPLOY_HOOK_URL` | Render → Service → Settings → Deploy Hooks → Copy URL |
| `VERCEL_TOKEN` | vercel.com → Account Settings → Tokens |
| `VERCEL_ORG_ID` | `vercel whoami --json` hoặc Project Settings |
| `VERCEL_PROJECT_ID` | Vercel → Project → Settings → General |

### 4.4. Tạo file `.github/workflows/deploy.yml`

```yaml
name: CD — Deploy to Production

on:
  push:
    branches: [main]

jobs:
  # ──────────────────────────────────────────────
  # JOB 1: Deploy Frontend lên Vercel
  # ──────────────────────────────────────────────
  deploy-frontend:
    name: Deploy Frontend → Vercel
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

      - name: Build
        run: npm run build

      - name: Deploy to Vercel
        uses: amondnet/vercel-action@v25
        with:
          vercel-token: ${{ secrets.VERCEL_TOKEN }}
          vercel-org-id: ${{ secrets.VERCEL_ORG_ID }}
          vercel-project-id: ${{ secrets.VERCEL_PROJECT_ID }}
          working-directory: ./frontend
          vercel-args: '--prod'

  # ──────────────────────────────────────────────
  # JOB 2: Trigger Render Deploy Backend
  # ──────────────────────────────────────────────
  deploy-backend:
    name: Deploy Backend → Render
    runs-on: ubuntu-latest
    needs: deploy-frontend  # Đợi frontend deploy xong mới deploy backend

    steps:
      - name: Trigger Render Deploy Hook
        run: |
          curl -s -o /dev/null -w "%{http_code}" \
            -X POST "${{ secrets.RENDER_DEPLOY_HOOK_URL }}"

      - name: Wait for Render to be healthy
        run: |
          echo "Waiting 60s for Render to restart..."
          sleep 60
          STATUS=$(curl -s -o /dev/null -w "%{http_code}" https://marka-api.onrender.com/api/v1/health)
          echo "Health check status: $STATUS"
          if [ "$STATUS" != "200" ]; then
            echo "❌ Health check failed!"
            exit 1
          fi
          echo "✅ Backend deployed successfully!"
```

---

## 5. Tóm tắt lộ trình

```
Hôm nay — Giai đoạn Scaffold hoàn thành
  └── [NGAY BÂY GIỜ] Tạo .github/workflows/ci.yml
       └── CI bảo vệ code từ mọi PR module Auth trở đi ✅

Sau khi xong module Auth (1-2 tuần tới)
  └── [LÀM SAU] Cấu hình CD
       ├── 1. Tạo Neon project + chạy prisma migrate deploy
       ├── 2. Tạo Upstash Redis (Singapore, TLS)
       ├── 3. Tạo Render Web Service + set env vars
       ├── 4. Tạo Vercel project + set VITE_API_URL
       ├── 5. Thêm 4 GitHub Secrets
       └── 6. Tạo .github/workflows/deploy.yml
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
        │ CI tự chạy lần nữa
        │ ✅ pass → Merge vào main
        ▼
  GitHub Actions CD tự kích hoạt
        │ Deploy Frontend → Vercel
        │ Deploy Backend → Render
        ▼
  https://marka-capstone.vercel.app ✅ live
```
