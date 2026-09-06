import { z } from "zod";
export const settingsSchema = z.object({
  workspaceName: z.string().trim().min(2, "nameMin").max(100, "nameMax"),
});
