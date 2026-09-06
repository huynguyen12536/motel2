export const ENDPOINTS = {
  auth: {
    login: "/auth/login",
    logout: "/auth/logout",
    refresh: "/auth/refresh",
    me: "/auth/me",
    register: "/auth/register",
    forgotPassword: "/auth/forgot-password",
  },
  users: "/users",
  settings: "/settings",
} as const;
