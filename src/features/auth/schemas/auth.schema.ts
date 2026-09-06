import { z } from "zod";
export const signInSchema = z.object({
  email: z.email("emailInvalid"),
  password: z.string().min(8, "passwordMin"),
  remember: z.boolean(),
});
export type SignInValues = z.infer<typeof signInSchema>;
export const signUpSchema = signInSchema
  .omit({ remember: true })
  .extend({ name: z.string().trim().min(2, "nameMin") });
export const forgotPasswordSchema = signInSchema.pick({ email: true });
