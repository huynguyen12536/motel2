import { ApiError } from "@/lib/api/api-error";
import { PERMISSIONS } from "@/config/permissions";
import type { AuthResponse, CurrentUser } from "@/features/auth/types/auth.type";

export const MOCK_CREDENTIALS = {
  email: "admin@apa.local",
  password: "Demo@123",
} as const;

export const MOCK_AUTH_USER: CurrentUser = {
  id: "demo-admin",
  name: "Quản trị viên APA Nano",
  email: MOCK_CREDENTIALS.email,
  role: "ADMIN",
  permissions: [
    ...Object.values(PERMISSIONS.USER),
    ...Object.values(PERMISSIONS.SETTINGS),
  ],
};

function delay() {
  const ms = 600 + Math.floor(Math.random() * 301);
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function mockSignIn(
  email: string,
  password: string,
): Promise<AuthResponse> {
  await delay();
  const identifier = email.trim().toLowerCase();
  if (identifier !== MOCK_CREDENTIALS.email || password !== MOCK_CREDENTIALS.password) {
    throw new ApiError(
      401,
      "Tên đăng nhập hoặc mật khẩu không chính xác.",
      "INVALID_CREDENTIALS",
    );
  }
  return { accessToken: "demo-memory-only", user: MOCK_AUTH_USER };
}
