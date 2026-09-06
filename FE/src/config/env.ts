import { z } from "zod";
const parsed = z
  .object({
    appName: z.string().min(1).default("Workspace"),
    apiUrl: z.url().default("http://localhost:8080/api/v1"),
    demoMode: z.enum(["true", "false"]).default("true"),
    credentials: z.enum(["true", "false"]).default("true"),
  })
  .parse({
    appName: process.env.NEXT_PUBLIC_APP_NAME,
    apiUrl: process.env.NEXT_PUBLIC_API_URL,
    demoMode: process.env.NEXT_PUBLIC_DEMO_MODE,
    credentials: process.env.NEXT_PUBLIC_API_CREDENTIALS,
  });
export const env = {
  ...parsed,
  demoMode: parsed.demoMode === "true",
  credentials: parsed.credentials === "true",
};
