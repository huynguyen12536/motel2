# Workspace — Next.js frontend starter

Chạy Docker cùng PostgreSQL và Redis: xem [docs/docker.md](docs/docker.md). Env local tạo bằng `pnpm env:init`, sau đó `docker compose up -d --build --wait`.

Starter admin/dashboard/CMS theo **Feature-first + Shared Core**. Next.js chỉ làm frontend; mọi dữ liệu đi qua HTTP REST API đến backend riêng. Không database, ORM, repository backend, Server Actions hay route handler CRUD.

## Chạy nhanh

Yêu cầu Node.js **22+**, pnpm **11.22.0** (phiên bản được ghi trong `packageManager`).

```bash
pnpm install
pnpm dev
```

Mở http://localhost:3000. Mặc định starter chạy demo độc lập, không cần backend. Đăng nhập tại **/auth/sign-in**:

- Email: `admin@example.com`
- Mật khẩu: `Password123!`

Demo dùng bộ nhớ tab, không lưu auth/token vào localStorage. Reload làm mất phiên và đặt lại dữ liệu. Checkbox Remember chỉ được gửi cho backend thật; demo không mô phỏng phiên bền vững. Sign-up và forgot-password demo báo rõ không tạo tài khoản/gửi email.

## Tech stack và phiên bản

Next.js 16.3.4 stable, React 19.2.8, TypeScript strict, App Router, React Compiler, Tailwind CSS 4.
Next.js xác nhận [React Compiler hỗ trợ stable](https://nextjs.org/blog/next-16); cấu hình tại `next.config.ts`.
Danh sách toàn bộ package và phiên bản được resolve: [docs/packages.md](docs/packages.md). Lockfile được commit để install tái lập.

- UI: shadcn/ui source components, Radix UI, lucide-react, clsx, tailwind-merge, class-variance-authority.
- Forms: react-hook-form, Zod, @hookform/resolvers.
- Server state: TanStack Query, Axios.
- Client state: Zustand.
- Tables: TanStack Table v8; component DataTable opt-out React Compiler vì mutable table API.
- Feedback/date/i18n: Sonner, Day.js, next-intl.
- Theme: next-themes, chỉ lưu preference giao diện.
- Quality: ESLint, TypeScript, Knip; Playwright cho E2E và HTTP integration.

ESLint ghim major 9: plugin React/import/jsx-a11y trong eslint-config-next hiện không tương thích ESLint 10 (đã xác minh bằng lint thực tế). Nâng đồng bộ khi upstream hỗ trợ; không tắt rule để né incompatibility. TypeScript 5.9 và Table 8 là các major tương thích đã được kiểm chứng trong starter, không tuyên bố chúng là phiên bản mới nhất.

## Environment

Copy `.env.example` thành `.env.local` nếu cần thay cấu hình; file env thật được gitignore.

| Biến | Mặc định | Vai trò |
| --- | --- | --- |
| NEXT_PUBLIC_APP_NAME | Workspace | Tên UI / metadata |
| NEXT_PUBLIC_API_URL | http://localhost:8080/api/v1 | REST backend base URL |
| NEXT_PUBLIC_DEMO_MODE | true | Bật adapter demo |
| NEXT_PUBLIC_API_CREDENTIALS | true | Gửi credentials/cookie với Axios |

`src/config/env.ts` là nơi duy nhất đọc biến cấu hình ứng dụng và validate với Zod. Biến NEXT_PUBLIC được đóng gói lúc **build**, không chứa secret. Để kết nối backend và triển khai thật, đặt `NEXT_PUBLIC_DEMO_MODE=false`, URL HTTPS phù hợp, rồi build lại.

## Folder architecture

[Cây thư mục đầy đủ](docs/folder-tree.txt) liệt kê mọi file project, bỏ node_modules, .next, .git và artifacts tạm.

| Folder | Trách nhiệm |
| --- | --- |
| src/app | Routing, composition, metadata, layouts, error/loading/not-found |
| src/features | Auth, dashboard, users, settings; mỗi feature sở hữu API, hooks, forms, schemas, types riêng |
| src/components/ui | Primitive source từ shadcn/ui |
| src/components/shared | AppShell, sidebar/header, DataTable, PageHeader, Can, ConfirmDialog, loading/empty |
| src/lib | Axios, normalized errors, QueryClient, token/session/permission và utility nhỏ |
| src/hooks | Hook dùng chung: debounce, media query, permission |
| src/stores | Zustand cho UI/cross-component state; không cache API data |
| src/providers | AppProvider gom Query, theme, i18n và toast |
| src/config | Env, site, permission constants, navigation typed |
| src/constants / src/types | Hằng số và kiểu thực sự dùng chung |
| src/i18n / messages | next-intl request config và EN/FR/DE/VI đầy đủ |
| src/mocks | Adapter demo biệt lập; không chạy HTTP server backend |
| public | Vị trí tài nguyên fonts/icons/images/gif |
| tests | Browser E2E và HTTP auth integration |
| docs | Cây thư mục, package inventory, kiểm chứng, ảnh desktop/mobile |

Có thêm feature dashboard để `page.tsx` luôn mỏng. `src/proxy.ts` nằm cùng cấp `src/app` theo quy ước discovery của Next.js; chỉ đặt cookie locale mặc định. Favicon dùng `src/app/icon.svg` (file-based metadata), không cần file ICO nhị phân.

Các route chính: `/auth/sign-in`, `/auth/sign-up`, `/auth/forgot-password`, `/dashboard`, `/users`, `/settings`. Route `/sign-in`, `/sign-up`, `/forgot-password` chuyển hướng đến URL /auth tương ứng.

## Quy tắc đặt code

- Page chỉ compose feature UI; không đặt API CRUD hay form logic lớn trong page.
- API data/current user nằm trong React Query. Zustand chỉ dùng cho sidebar, UI density, workspace selection hay auth UI status tạm.
- Business-specific type/schema/component nằm trong feature. Không có types/index.ts hoặc services/api.ts toàn hệ thống.
- Lib dành cho infrastructure; createUser/updateUser nằm trong features/users/api.
- File kebab-case, component PascalCase, biến/hàm camelCase; import qua `@/*`.
- Dùng Zod inference cho form payload; không dùng any để né lỗi.
- Màu và spacing qua tokens/Tailwind; text sản phẩm qua translation keys.
- Primitive APIs và một vài building blocks theo yêu cầu (get-user, app store, currency utility, common/API types) được khai báo entry rõ ràng trong knip.json. Đây là public starter surface có chủ ý; Knip vẫn quét phần còn lại và dependencies.

## Kết nối backend thật

1. Đặt env demo false và API_URL đúng; build lại.
2. Điều chỉnh contract tại feature API/types nếu backend trả envelope khác.
3. Cấu hình backend CORS cho đúng frontend origin, credentials và các header Content-Type, Authorization, X-Auth-Retry. Backend quản lý CSRF/Origin validation cho endpoint dùng cookie và chính sách cookie Secure, HttpOnly, SameSite phù hợp domain.
4. Backend phải thực thi authorization; `Can` và route guard chỉ điều khiển UX, không phải security boundary.
5. Khi bỏ demo, xóa các nhánh `if (env.demoMode)` ở feature API rồi xóa `src/mocks` và nội dung demo UI. Không cần đổi hooks/components/data table.

Contract mẫu hiện dùng **JSON trực tiếp** (không tự bọc trong `data`):

| Endpoint | Request / response |
| --- | --- |
| POST /auth/login | { email, password, remember } → { accessToken, user } |
| POST /auth/refresh | Refresh cookie do browser gửi → { accessToken } |
| GET /auth/me | → { id, name, email, role, permissions: string[] } |
| POST /auth/logout | Backend thu hồi phiên và xóa refresh cookie |
| POST /auth/register | { name, email, password } → 2xx |
| POST /auth/forgot-password | { email } → 2xx, phản hồi không tiết lộ tài khoản |
| GET /users | Query page (1-based), pageSize, search → { data: User[], total, page, pageSize } |
| GET /users/:id | → User |
| POST /users | { name, email, role } → User |
| PATCH /users/:id | { name, email, role } → User |
| DELETE /users/:id | → 204 hoặc 2xx |
| GET /settings | → { workspaceName } |
| PATCH /settings | { workspaceName } → { workspaceName } |

User gồm id, name, email, role (admin/editor/viewer), status (active/invited), createdAt ISO string. Lỗi backend: `{ message, code?, errors?: Record<string, string[]> }`; HTTP status được giữ trong `ApiError`. Components không parse AxiosError.

### Session / refresh flow

- Access token chỉ ở module memory; refresh token chỉ do backend giữ trong HttpOnly cookie.
- Reload ở chế độ thật: Query auth/me gọi refresh khi không có access token, rồi lấy current user.
- Các 401 song song dùng một refresh promise. Request đến muộn dùng token vừa refresh; mỗi request retry tối đa một lần.
- Login lỗi không trigger refresh. Refresh bị 401/403 làm mất phiên và chuyển về sign-in; lỗi mạng có UI retry.
- Token generation ngăn refresh đang chạy ghi lại token sau logout/đổi phiên.
- Logout thành công cancel queries, clear Query cache và xóa access token. Nếu backend logout thất bại, UI hiển thị lỗi để thử lại.
- Không forward refresh cookie hoặc token từ Next server sang backend; fetch protected data hiện thực hiện client-side.
- Mọi permission dựa trên `/auth/me`. Không suy luận token từ localStorage/cookie presence ở proxy.

Dashboard dùng số liệu minh họa được ghi nhãn trong demo; chế độ thật hiển thị dấu chờ kết nối reporting API, không giả làm số liệu thực.

## Thêm feature projects

```text
features/projects/
├── api/
│   ├── get-projects.ts
│   ├── create-project.ts
│   └── update-project.ts
├── components/
│   ├── project-table.tsx
│   └── project-form.tsx
├── hooks/
│   ├── use-projects.ts
│   └── use-create-project.ts
├── schemas/
│   └── project.schema.ts
├── types/
│   └── project.type.ts
└── constants.ts
```

Schema trong feature, infer payload:

```ts
import { z } from "zod";
export const projectSchema = z.object({ name: z.string().trim().min(2) });
export type ProjectValues = z.infer<typeof projectSchema>;
```

API function nhỏ tại `features/projects/api/get-projects.ts`:

```ts
import { apiClient } from "@/lib/api/client";
import type { Project } from "@/features/projects/types/project.type";

export async function getProjects(signal?: AbortSignal): Promise<Project[]> {
  return (await apiClient.get<Project[]>("/projects", { signal })).data;
}
```

Query hook tại `features/projects/hooks/use-projects.ts`:

```ts
"use client";
import { useQuery } from "@tanstack/react-query";
import { getProjects } from "@/features/projects/api/get-projects";

export function useProjects() {
  return useQuery({
    queryKey: ["projects"],
    queryFn: ({ signal }) => getProjects(signal),
  });
}
```

Mutation hook dùng `useMutation`, gọi API trong feature rồi `invalidateQueries({ queryKey: ["projects"] })` khi thành công. Không tự giữ loading state cho CRUD thông thường.

Routing tại `app/(dashboard)/projects/page.tsx`:

```tsx
import { ProjectTable } from "@/features/projects/components/project-table";

export default function ProjectsPage() {
  return <ProjectTable />;
}
```

## Thêm shadcn component

```bash
pnpm dlx shadcn@latest add tabs
```

`components.json` cấu hình aliases, Tailwind và style new-york. Sau khi generate, kiểm tra utility import trỏ về `@/lib/utils/cn` (registry mới có thể chèn package cn; starter dùng clsx + tailwind-merge theo brief). Chỉ giữ primitives thực sự cần hoặc public starter APIs có chủ ý. Không thêm thư viện chart/map/editor trước khi module cần.

## Permission và navigation

Thêm permission trong `src/config/permissions.ts`, mở rộng union Permission theo nhóm mới, và cập nhật backend quyền tương ứng.

```tsx
<Can permission={PERMISSIONS.USER.CREATE}>
  <Button>Create user</Button>
</Can>
```

Thêm item vào `src/config/navigation.ts`: `title` (translation key), `href`, `icon`, `permission?`, `children?`. Mở rộng title union và thêm key vào cả 4 JSON. Sidebar lọc permission và render đệ quy; không hard-code menu trong component.

## Internationalization và theme

Cookie `locale` chọn en/fr/de/vi; mặc định English, URL không có locale prefix. Settings ghi cookie rồi router.refresh để lấy messages mới. next-intl timezone được cố định UTC để SSR/client nhất quán; đổi theo yêu cầu sản phẩm. Date utility dùng Day.js; có thể bổ sung locale/timezone riêng cho business cần nó. Metadata cơ bản và global-error fallback dùng English để vẫn hiển thị khi provider lỗi.

Theme qua next-themes, class `dark`, CSS variables. Locale/theme là preferences không nhạy cảm. Demo session và table density không persist.

## Commands và kiểm chứng

```bash
pnpm lint
pnpm typecheck
pnpm knip
pnpm build
pnpm exec playwright install chromium
pnpm test
pnpm start
```

`pnpm test` chạy production server từ build có sẵn, nên chạy `pnpm build` trước. Browser tests yêu cầu demo mode. HTTP integration tests dùng server fixture cục bộ trên cổng 18881 để kiểm tra interceptor; fixture không thuộc application/backend sản phẩm. Giữ cổng 3000 và 18881 trống khi chạy tests.

Chi tiết kiểm chứng và giới hạn ở [docs/verification.md](docs/verification.md). Có ảnh Users desktop/mobile và dashboard trong docs/screenshots.
