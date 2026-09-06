import type { z } from "zod";
import type { settingsSchema } from "@/features/settings/schemas/settings.schema";
export type WorkspaceSettings = z.infer<typeof settingsSchema>;
