import { config } from "dotenv";
import { defineConfig } from "prisma/config";
config({ quiet: true });
export default defineConfig({
  schema: "prisma/tenant/schema.prisma",
  migrations: { path: "prisma/tenant/migrations" },
  datasource: {
    url: process.env.TENANT_DIRECT_URL || "postgresql://offline:offline@localhost:5432/offline",
  },
});
