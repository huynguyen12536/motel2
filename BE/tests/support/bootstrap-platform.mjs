import { randomBytes, randomUUID } from "node:crypto";
export async function bootstrapTestPlatform(db) {
  const { seedAuthorization } = await import("../../dist/src/modules/authorization/seed.js");
  const { env } = await import("../../dist/src/config/env.js");
  const email = "bootstrap-" + randomUUID() + "@test.invalid",
    password = randomBytes(32).toString("base64url");
  const result = await seedAuthorization(db, "platform", { enabled: true, email, password });
  env.PLATFORM_LEGACY_ADMIN_USER_ID = result.bootstrapAccountId;
  env.PLATFORM_JWT_SECRET = randomBytes(48).toString("base64url");
  return { email, password, userId: result.bootstrapAccountId };
}
