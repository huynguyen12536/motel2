import { z } from "zod";
export const signInSchema = z.object({
  email: z.string().trim().min(1, "identifierRequired"),
  password: z.string().min(1, "passwordRequired"),
  remember: z.boolean(),
});
export type SignInValues = z.infer<typeof signInSchema>;
export const signUpSchema = z.object({
  name: z.string().trim().min(2, "nameMin"),
  email: z.email("emailInvalid"),
  password: z.string().min(8, "passwordMin"),
});
export const forgotPasswordSchema = z.object({
  email: z.email("emailInvalid"),
});
