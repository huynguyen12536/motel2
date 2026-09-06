import { z } from "zod";
export const userSchema = z.object({
  name: z.string().trim().min(2, "nameMin").max(100, "nameMax"),
  email: z.email("emailInvalid"),
  role: z.enum(["admin", "editor", "viewer"]),
});
export type UserValues = z.infer<typeof userSchema>;
