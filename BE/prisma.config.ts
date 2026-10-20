import { config } from "dotenv";
import { defineConfig } from "prisma/config";
config({ quiet: true });
export default defineConfig({
  schema: "prisma/master/schema.prisma",
  migrations: { path: "prisma/master/migrations" },
  datasource: {
    url: process.env.MASTER_DIRECT_URL || "postgresql://offline:offline@localhost:5432/offline",
  },
});
