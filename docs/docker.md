# Docker: PostgreSQL + Redis (shared infrastructure)

Development mặc định chỉ chạy PostgreSQL và Redis. Frontend và backend chạy trên host (`pnpm dev` trong `FE/` / `BE/`), không chạy trong Docker.

## Chạy infrastructure

Docker Desktop phải chạy Linux containers.

```bash
cd FE
pnpm env:init
cd ..
docker compose --env-file FE/.env up -d postgres redis --wait
docker compose ps
```

Compose đọc `FE/.env` cho interpolation; biến thiếu hoặc trống dùng default trong `compose.yaml`. `FE/.env` optional (`required: false`).

Không start container frontend/backend. Frontend local: `cd FE && pnpm dev` (http://localhost:3000). Backend chưa có runtime; khi có sẽ chạy trên host, không qua Compose mặc định.

## Optional full stack

Chỉ khi cần image frontend:

```bash
docker compose --env-file FE/.env --profile full up -d --build --wait
```

PostgreSQL và Redis có named volumes và healthchecks; Redis bật AOF.

## Kết nối

| Service | Từ host | Từ backend trong cùng Compose network |
| --- | --- | --- |
| PostgreSQL | localhost:5432 | postgres:5432 |
| Redis | localhost:6379 | redis:6379 |
| Frontend | localhost:3000 | frontend:3000 |

User/database/password đọc từ `FE/.env`. Redis cần REDIS_PASSWORD. Không đưa DB/Redis password vào NEXT_PUBLIC_*.
Các port chỉ bind 127.0.0.1 để dùng local. Backend riêng chưa được cung cấp nên không có backend container, migrations hoặc DB client trong Next.js.

NEXT_PUBLIC_API_URL phải là địa chỉ mà **trình duyệt người dùng** truy cập được, không dùng hostname Docker như backend:8080.
Để kết nối backend thật: đặt NEXT_PUBLIC_DEMO_MODE=false, API URL thích hợp rồi chạy lại up --build. NEXT_PUBLIC_* được đóng gói lúc build; đổi runtime env không thay browser bundle.

PostgreSQL 18 mount volume tại /var/lib/postgresql theo [official image](https://hub.docker.com/_/postgres). Redis dùng [official image](https://hub.docker.com/_/redis). Image ghim major để nhận bản vá; môi trường release có thể ghim digest sau khi kiểm chứng.

## Quản lý

```bash
docker compose logs -f postgres redis
docker compose stop
docker compose start
docker compose down
```

down giữ named volumes. Không dùng down -v nếu cần giữ dữ liệu.
POSTGRES_PASSWORD chỉ dùng khi khởi tạo volume mới; sửa .env không tự đổi mật khẩu trong database đã tồn tại.
Production cần domain/TLS, secret management và backup phù hợp; file Compose này mặc định dành cho chạy local.

## Files

FE/Dockerfile: multi-stage dependencies/build/runtime.
DOCKER_BUILD=true chỉ đặt trong builder để xuất standalone; pnpm build/start ngoài Docker giữ hành vi thông thường.
FE/.dockerignore: loại .env thật, dependencies host và artifacts khỏi build context.
compose.yaml (repository root): postgres + redis by default; frontend is behind profile `full`.
FE/.env.example: template không chứa mật khẩu thật; FE/.env được gitignore.

Chạy E2E trên container đang chạy (PowerShell):

```powershell
$env:E2E_BASE_URL = 'http://127.0.0.1:3002'
Set-Location FE
pnpm test tests/e2e/starter.spec.ts
Remove-Item Env:E2E_BASE_URL
```
