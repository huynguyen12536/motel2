export const PERMISSIONS = {
  USER: {
    READ: "user.read",
    CREATE: "user.create",
    UPDATE: "user.update",
    DELETE: "user.delete",
  },
  SETTINGS: { READ: "settings.read", UPDATE: "settings.update" },
} as const;
export type Permission =
  | (typeof PERMISSIONS.USER)[keyof typeof PERMISSIONS.USER]
  | (typeof PERMISSIONS.SETTINGS)[keyof typeof PERMISSIONS.SETTINGS];
