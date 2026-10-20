import { randomUUID } from "node:crypto";
import type { PrismaClient as MasterClient } from "../../generated/master-authorized/client.js";
import type { PrismaClient as TenantClient } from "../../generated/tenant-authorized/client.js";
import { catalogVersion, scopeCatalog, systemRole } from "./catalog.js";
import type { Scope } from "./catalog.js";
import { hashPassword } from "../../saas/security.js";

export async function seedAuthorization(
  client: MasterClient | TenantClient,
  domain: string,
  bootstrap?: { enabled: boolean; email?: string; password?: string },
) {
  const scope: Scope = domain === "platform" ? "platform" : "tenant";
  if (scope === "tenant" && !/^tenant:[0-9a-f-]{36}$/.test(domain))
    throw Error("INVALID_AUTHORIZATION_DOMAIN");
  if (
    bootstrap?.enabled &&
    (scope !== "platform" ||
      !bootstrap.email ||
      !bootstrap.password ||
      bootstrap.password.length < 12 ||
      bootstrap.password.length > 256)
  )
    throw Error("PLATFORM_BOOTSTRAP_EMAIL_AND_STRONG_PASSWORD_REQUIRED");
  const email = bootstrap?.email?.trim().toLowerCase();
  if (bootstrap?.enabled && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email!))
    throw Error("INVALID_BOOTSTRAP_EMAIL");
  const db = client as unknown as MasterClient;
  // Only common authorization models are used in tenant databases; platform identities stay Master-only.
  return db.$transaction(
    async (tx) => {
      await tx.$queryRaw`SELECT pg_advisory_xact_lock(71273102)::text`;
      // Match management lock order before touching role/grant rows; avoid seed-vs-mutation deadlocks.
      await tx.$queryRaw`SELECT id FROM "AuthzState" WHERE id=1 FOR UPDATE`;
      const existing = await tx.authzState.findUnique({ where: { id: 1 } });
      if (existing && existing.domain !== domain) throw Error("AUTHORIZATION_DOMAIN_MISMATCH");
      if (scope === "tenant") {
        const proof = await (
          tx as unknown as import("../../generated/tenant-authorized/client.js").Prisma.TransactionClient
        ).tenantBootstrap.findUnique({ where: { id: 1 } });
        if (proof?.tenantId !== domain.slice(7)) throw Error("TENANT_BOOTSTRAP_IDENTITY_MISMATCH");
      }
      for (const [code, description] of scopeCatalog(scope)) {
        const [resource, action] = code.split(":");
        await tx.authzPermission.upsert({
          where: { code },
          create: { code, resource, action, description },
          update: { description },
        });
      }
      const code = systemRole(scope),
        prior = await tx.authzRole.findUnique({ where: { code } });
      if (prior && !prior.systemManaged) throw Error("SYSTEM_ROLE_OWNERSHIP_MISMATCH");
      const role = await tx.authzRole.upsert({
        where: { code },
        create: { code, name: code, systemManaged: true, createdBy: "authorization-init" },
        update: {},
      });
      for (const [permissionCode] of scopeCatalog(scope))
        await tx.authzRolePermission.upsert({
          where: { roleId_permissionCode: { roleId: role.id, permissionCode } },
          create: { roleId: role.id, permissionCode },
          update: {},
        });
      if (scope === "tenant") {
        const userRole = await tx.authzRole.upsert({
          where: { code: "TENANT_USER" },
          create: {
            code: "TENANT_USER",
            name: "Tenant user",
            systemManaged: true,
            createdBy: "authorization-init",
          },
          update: {},
        });
        if (!userRole.systemManaged) throw Error("SYSTEM_ROLE_OWNERSHIP_MISMATCH");
        for (const permissionCode of ["tenant.info:read", "tenant.settings:read"])
          await tx.authzRolePermission.upsert({
            where: { roleId_permissionCode: { roleId: userRole.id, permissionCode } },
            create: { roleId: userRole.id, permissionCode },
            update: {},
          });
        // One-time conversion of trusted persisted legacy enum roles. Never recreate revoked assignments on later seeds.
        if (!existing) {
          const users = await (
            tx as unknown as import("../../generated/tenant-authorized/client.js").Prisma.TransactionClient
          ).user.findMany({ select: { id: true, role: true } });
          for (const u of users)
            await tx.authzUserRole.create({
              data: {
                userId: u.id,
                roleId: u.role === "TENANT_ADMIN" ? role.id : userRole.id,
                assignedBy: "legacy-role-migration",
              },
            });
        }
      }
      let accountId: string | null = null;
      if (scope === "platform" && bootstrap?.enabled) {
        const owner = await tx.platformUser.findUnique({
          where: { bootstrapOwner: "designated-platform-admin-v1" },
        });
        if (owner) {
          if (owner.email !== email || owner.status !== "ACTIVE")
            throw Error("BOOTSTRAP_IDENTITY_REQUIRES_OPERATOR_REVIEW");
          accountId = owner.id;
        } else {
          if (await tx.platformUser.findUnique({ where: { email } }))
            throw Error("BOOTSTRAP_EMAIL_ALREADY_OWNED");
          const user = await tx.platformUser.create({
            data: {
              id: randomUUID(),
              email: email!,
              name: "Platform administrator",
              passwordHash: await hashPassword(bootstrap.password!),
              bootstrapOwner: "designated-platform-admin-v1",
            },
          });
          accountId = user.id;
        }
        await tx.authzUserRole.upsert({
          where: { userId_roleId: { userId: accountId, roleId: role.id } },
          create: { userId: accountId, roleId: role.id, assignedBy: "designated-bootstrap" },
          update: {},
        });
      }
      const state = await tx.authzState.upsert({
        where: { id: 1 },
        create: { id: 1, domain, revision: 1, catalogVersion: catalogVersion(scope) },
        update: { revision: { increment: 1 }, catalogVersion: catalogVersion(scope) },
      });
      await tx.authzAudit.create({
        data: {
          actorId: "authorization-init",
          action: "SYSTEM_CATALOG_RECONCILED",
          targetId: domain,
          revision: state.revision,
        },
      });
      return { domain, policyVersion: state.revision, bootstrapAccountId: accountId };
    },
    { timeout: 30000 },
  );
}
