import { ApiError } from "@/lib/api/api-error";
import { MOCK_AUTH_USER, mockSignIn } from "@/features/auth/mocks/mock-auth";
import type {
  CurrentUser,
  AuthResponse,
} from "@/features/auth/types/auth.type";
import type { User } from "@/features/users/types/user.type";
import type { UserValues } from "@/features/users/schemas/user.schema";
import type { PaginationParams, PaginatedResponse } from "@/types/pagination";
let signedIn = false;
const currentUser: CurrentUser = { ...MOCK_AUTH_USER };
let users: User[] = [
  ["1", "Olivia Rhye", "olivia@example.com", "admin", "active"],
  ["2", "Phoenix Baker", "phoenix@example.com", "editor", "active"],
  ["3", "Lana Steiner", "lana@example.com", "viewer", "invited"],
  ["4", "Demi Wilkinson", "demi@example.com", "editor", "active"],
  ["5", "Drew Cano", "drew@example.com", "viewer", "active"],
  ["6", "Natali Craig", "natali@example.com", "editor", "invited"],
  ["7", "Orlando Diggs", "orlando@example.com", "viewer", "active"],
  ["8", "Andi Lane", "andi@example.com", "admin", "active"],
  ["9", "Kate Morrison", "kate@example.com", "viewer", "active"],
].map(([id, name, email, role, status]) => ({
  id,
  name,
  email,
  role: role as User["role"],
  status: status as User["status"],
  createdAt: "2026-08-20T10:00:00Z",
}));
async function delay() {
  await new Promise((resolve) => setTimeout(resolve, 250));
}
function requireSession() {
  if (!signedIn) throw new ApiError(401, "Please sign in.", "UNAUTHENTICATED");
}
export const mockAdapter = {
  async login(email: string, password: string): Promise<AuthResponse> {
    const result = await mockSignIn(email, password);
    signedIn = true;
    Object.assign(currentUser, result.user);
    return result;
  },
  async me() {
    await delay();
    requireSession();
    return currentUser;
  },
  async logout() {
    await delay();
    signedIn = false;
  },
  async listUsers(params: PaginationParams): Promise<PaginatedResponse<User>> {
    await delay();
    requireSession();
    const filtered = users.filter((user) =>
      `${user.name} ${user.email}`
        .toLowerCase()
        .includes((params.search ?? "").toLowerCase()),
    );
    return {
      data: filtered.slice(
        (params.page - 1) * params.pageSize,
        params.page * params.pageSize,
      ),
      total: filtered.length,
      page: params.page,
      pageSize: params.pageSize,
    };
  },
  async getUser(id: string) {
    await delay();
    requireSession();
    const user = users.find((user) => user.id === id);
    if (!user) throw new ApiError(404, "User not found.");
    return user;
  },
  async createUser(values: UserValues) {
    await delay();
    requireSession();
    if (users.some((user) => user.email === values.email))
      throw new ApiError(409, "This email already exists.", "CONFLICT", {
        email: ["This email already exists."],
      });
    const user: User = {
      ...values,
      id: crypto.randomUUID(),
      status: "invited",
      createdAt: new Date().toISOString(),
    };
    users = [user, ...users];
    return user;
  },
  async updateUser(id: string, values: UserValues) {
    await delay();
    requireSession();
    const user = users.find((user) => user.id === id);
    if (!user) throw new ApiError(404, "User not found.");
    if (users.some((user) => user.id !== id && user.email === values.email))
      throw new ApiError(409, "This email already exists.");
    Object.assign(user, values);
    return { ...user };
  },
  async deleteUser(id: string) {
    await delay();
    requireSession();
    users = users.filter((user) => user.id !== id);
  },
  async requestPasswordReset() {
    await delay();
  },
  async register() {
    await delay();
  },
};
