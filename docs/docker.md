# Docker: Frontend + PostgreSQL + Redis

Đã kiểm chứng 2026-09-06: Docker build thành công, cả ba container healthy, PostgreSQL SELECT 1 và Redis PING thành công; 5 browser E2E tests chạy trực tiếp trên frontend container đều qua. Lint, typecheck, Knip cũng qua.

## Chạy

Docker Desktop phải chạy Linux containers.

```bash
cd FE
pnpm env:init
cd ..
docker compose --env-file FE/.env up -d --build --wait
docker compose ps
```

Frontend image builds from `FE/`. Compose reads `FE/.env` for interpolation; any missing or empty variable uses the default in `compose.yaml` (same values as `FE/.env.example`). `FE/.env` is optional for Compose (`required: false`).
Mở http://localhost:3000. Env local đã được tạo với mật khẩu ngẫu nhiên; script không ghi đè file có sẵn.
Trên máy hiện tại, .env dùng APP_PORT=3002 do cổng 3000 bị chiếm: mở http://localhost:3002. Template mặc định vẫn là 3000.
Không cần install Node dependencies trên host nếu .env đã tồn tại và chỉ chạy Docker.

Frontend chạy production standalone bằng user node, có healthcheck. PostgreSQL và Redis có named volumes và healthchecks; Redis bật AOF. Frontend không phụ thuộc DB readiness vì vẫn là frontend gọi backend qua HTTP.

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
docker compose logs -f frontend
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
compose.yaml (repository root): frontend build context `./FE`, plus PostgreSQL and Redis volumes.
FE/.env.example: template không chứa mật khẩu thật; FE/.env được gitignore.

Chạy E2E trên container đang chạy (PowerShell):

```powershell
$env:E2E_BASE_URL = 'http://127.0.0.1:3002'
Set-Location FE
pnpm test tests/e2e/starter.spec.ts
Remove-Item Env:E2E_BASE_URL
```
