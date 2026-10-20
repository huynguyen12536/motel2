import {
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from "@nestjs/common";
import { ModuleRef } from "@nestjs/core";
import type { Enforcer } from "casbin";
import type { Prisma, PrismaClient } from "../../generated/master-authorized/client.js";
import type { PrismaClient as TenantClient } from "../../generated/tenant-authorized/client.js";
import { MasterPrismaService } from "../../infrastructure/database/master/master-prisma.service.js";
import { TenantPrismaManager, TenantResolver } from "../../saas/tenant-routing.js";
import { hashPassword } from "../../saas/security.js";
import { catalogVersion, scopeCatalog } from "./catalog.js";
import type { Permission, Scope } from "./catalog.js";
import type { AuthorizationPrincipal } from "./platform-auth.service.js";
import { createEnforcer } from "./casbin.factory.js";
type Tx = Prisma.TransactionClient;
type Snapshot = {
  enforcer: Enforcer;
  revision: number;
  roles: { id: string; code: string; users: { userId: string }[] }[];
};
export const trustedDomain = (p: AuthorizationPrincipal) =>
  p.scope === "platform" ? "platform" : "tenant:" + p.tenantId;
@Injectable()
export class AuthorizationService {
  private readonly snapshots = new Map<string, Promise<Snapshot>>();
  constructor(
    @Inject(MasterPrismaService) private readonly master: MasterPrismaService,
    @Inject(ModuleRef) private readonly modules: ModuleRef,
  ) {}
  async withDatabase<T>(
    p: AuthorizationPrincipal,
    work: (db: PrismaClient) => Promise<T>,
  ): Promise<T> {
    if (p.scope === "platform") return work(await this.master.client());
    if (!p.tenantId) throw new ForbiddenException("Verified tenant required");
    const tenant = await this.modules
      .get(TenantResolver, { strict: false })
      .resolve({ id: p.tenantId });
    return this.modules
      .get(TenantPrismaManager, { strict: false })
      .withClient(tenant, (c) => work(c as unknown as PrismaClient));
  }
  async snapshot(tx: Tx, p: AuthorizationPrincipal): Promise<Snapshot> {
    const state = await tx.authzState.findUnique({ where: { id: 1 } }),
      domain = trustedDomain(p);
    if (!state || state.domain !== domain || state.catalogVersion !== catalogVersion(p.scope))
      throw new ServiceUnavailableException("Authorization initialization is required");
    const key = domain + ":" + state.revision;
    let pending = this.snapshots.get(key);
    if (!pending) {
      pending = (async () => {
        const roles = await tx.authzRole.findMany({ include: { permissions: true, users: true } });
        if (
          roles.length > 1000 ||
          roles.reduce((n, r) => n + r.users.length + r.permissions.length, 0) > 50000
        )
          throw new ServiceUnavailableException("Authorization capacity exceeded");
        const assignments = roles.flatMap((r) =>
          r.users.map((u) => ({ userId: u.userId, roleId: r.id })),
        );
        return {
          enforcer: await createEnforcer({ domain, roles, assignments }),
          revision: state.revision,
          roles,
        };
      })();
      this.snapshots.set(key, pending);
      // One version per domain; bounded cache. Every request still checks the authoritative DB revision.
      for (const old of this.snapshots.keys())
        if (old !== key && old.startsWith(domain + ":")) this.snapshots.delete(old);
      while (this.snapshots.size > 100) this.snapshots.delete(this.snapshots.keys().next().value!);
      pending.catch(() => {
        if (this.snapshots.get(key) === pending) this.snapshots.delete(key);
      });
    }
    return pending;
  }
  async grants(s: Snapshot, p: AuthorizationPrincipal) {
    const permissions: string[] = [];
    for (const [permission] of scopeCatalog(p.scope)) {
      const [resource, action] = permission.split(":");
      if (await s.enforcer.enforce("user:" + p.userId, trustedDomain(p), resource, action))
        permissions.push(permission);
    }
    return permissions;
  }
  async effective(p: AuthorizationPrincipal) {
    return this.withDatabase(p, (db) =>
      db.$transaction(
        async (tx) => {
          const s = await this.snapshot(tx, p);
          return {
            userId: p.userId,
            email: p.email,
            scope: p.scope,
            tenantId: p.tenantId ?? null,
            roles: s.roles
              .filter((r) => r.users.some((u) => u.userId === p.userId))
              .map((r) => r.code),
            permissions: await this.grants(s, p),
            policyVersion: s.revision,
          };
        },
        { isolationLevel: "RepeatableRead" },
      ),
    );
  }
  async require(p: AuthorizationPrincipal, permissions: readonly Permission[]) {
    const effective = await this.effective(p);
    if (!permissions.every((code) => effective.permissions.includes(code)))
      throw new ForbiddenException("Permission required");
    return effective;
  }
  async mutate<T>(
    p: AuthorizationPrincipal,
    permission: Permission,
    action: string,
    targetId: string,
    work: (tx: Tx, grants: string[]) => Promise<T>,
  ) {
    try {
      return await this.withDatabase(p, (db) =>
        db.$transaction(
          async (tx) => {
            await tx.$queryRaw`SELECT id FROM "AuthzState" WHERE id=1 FOR UPDATE`;
            const s = await this.snapshot(tx, p),
              grants = await this.grants(s, p);
            if (!grants.includes(permission)) throw new ForbiddenException("Permission required");
            const result = await work(tx, grants);
            if (p.scope === "platform") {
              const eligible = await tx.$queryRaw<
                { count: bigint }[]
              >`SELECT count(*) AS count FROM "AuthzUserRole" a JOIN "AuthzRole" r ON r.id=a."roleId" JOIN "PlatformUser" u ON u.id=a."userId" WHERE r.code='PLATFORM_SUPER_ADMIN' AND r."systemManaged" AND u.status='ACTIVE'`;
              if (Number(eligible[0].count) < 1)
                throw new ConflictException(
                  "The last active platform super administrator must remain",
                );
            }
            const state = await tx.authzState.update({
              where: { id: 1 },
              data: { revision: { increment: 1 } },
            });
            await tx.authzAudit.create({
              data: { actorId: p.userId, action, targetId, revision: state.revision },
            });
            return result;
          },
          { timeout: 15000 },
        ),
      );
    } catch (e) {
      if (e && typeof e === "object" && "code" in e && e.code === "P2002")
        throw new ConflictException("Duplicate role code or account");
      throw e;
    }
  }
  async catalog(p: AuthorizationPrincipal) {
    return this.withDatabase(p, (db) =>
      db.authzPermission.findMany({ orderBy: [{ resource: "asc" }, { action: "asc" }] }),
    );
  }
  private rolePermission(scope: Scope): Permission {
    return scope === "platform" ? "platform.roles:manage" : "tenant.roles:manage";
  }
  async roles(p: AuthorizationPrincipal, q: { page: number; limit: number; search?: string }) {
    return this.withDatabase(p, async (db) => {
      const where = q.search
        ? {
            OR: [
              { name: { contains: q.search, mode: "insensitive" as const } },
              { code: { contains: q.search, mode: "insensitive" as const } },
            ],
          }
        : {};
      const [items, total] = await db.$transaction([
        db.authzRole.findMany({
          where,
          orderBy: [{ systemManaged: "desc" }, { code: "asc" }],
          skip: (q.page - 1) * q.limit,
          take: q.limit,
          include: { permissions: true, _count: { select: { users: true } } },
        }),
        db.authzRole.count({ where }),
      ]);
      return {
        items: items.map((r) => ({
          ...r,
          scope: p.scope,
          permissionCodes: r.permissions.map((x) => x.permissionCode),
          assignedUserCount: r._count.users,
        })),
        total,
        page: q.page,
        limit: q.limit,
      };
    });
  }
  async role(p: AuthorizationPrincipal, id: string) {
    return this.withDatabase(p, async (db) => {
      const r = await db.authzRole.findUnique({
        where: { id },
        include: { permissions: true, _count: { select: { users: true } } },
      });
      if (!r) throw new NotFoundException("Role not found");
      return {
        ...r,
        scope: p.scope,
        permissionCodes: r.permissions.map((x) => x.permissionCode),
        assignedUserCount: r._count.users,
      };
    });
  }
  async createRole(
    p: AuthorizationPrincipal,
    data: { code: string; name: string; description?: string },
  ) {
    if (["PLATFORM_SUPER_ADMIN", "TENANT_ADMIN", "TENANT_USER"].includes(data.code))
      throw new ForbiddenException("Reserved system role");
    return this.mutate(p, this.rolePermission(p.scope), "ROLE_CREATED", data.code, (tx) =>
      tx.authzRole.create({ data: { ...data, createdBy: p.userId } }),
    );
  }
  async updateRole(
    p: AuthorizationPrincipal,
    id: string,
    data: { name: string; description?: string },
  ) {
    return this.mutate(p, this.rolePermission(p.scope), "ROLE_UPDATED", id, async (tx, grants) => {
      const r = await tx.authzRole.findUnique({ where: { id }, include: { permissions: true } });
      if (!r) throw new NotFoundException("Role not found");
      if (r.systemManaged) throw new ForbiddenException("System role is protected");
      if (r.permissions.some((x) => !grants.includes(x.permissionCode)))
        throw new ForbiddenException("Role exceeds delegation authority");
      return tx.authzRole.update({ where: { id }, data });
    });
  }
  async deleteRole(p: AuthorizationPrincipal, id: string) {
    return this.mutate(p, this.rolePermission(p.scope), "ROLE_DELETED", id, async (tx, grants) => {
      const r = await tx.authzRole.findUnique({
        where: { id },
        include: { _count: { select: { users: true } }, permissions: true },
      });
      if (!r) throw new NotFoundException("Role not found");
      if (r.systemManaged) throw new ForbiddenException("System role is protected");
      if (r.permissions.some((x) => !grants.includes(x.permissionCode)))
        throw new ForbiddenException("Role exceeds delegation authority");
      if (r._count.users)
        throw new ConflictException("Remove role assignments before deleting role");
      await tx.authzRolePermission.deleteMany({ where: { roleId: id } });
      await tx.authzRole.delete({ where: { id } });
      return { deleted: true };
    });
  }
  async replacePermissions(p: AuthorizationPrincipal, id: string, codes: string[]) {
    const needed =
      p.scope === "platform" ? "platform.permissions:manage" : "tenant.permissions:assign";
    return this.mutate(p, needed, "ROLE_PERMISSIONS_REPLACED", id, async (tx, grants) => {
      const r = await tx.authzRole.findUnique({ where: { id } });
      if (!r) throw new NotFoundException("Role not found");
      if (r.systemManaged)
        throw new ForbiddenException("System grants are initialized by the approved seed");
      const allowed = new Set(scopeCatalog(p.scope).map(([code]) => code as string));
      if (
        new Set(codes).size !== codes.length ||
        codes.some((c) => !allowed.has(c) || !grants.includes(c))
      )
        throw new ForbiddenException("Permission is outside delegation authority");
      // Cannot take control of an existing higher-privilege role by replacing its grants.
      const existing = await tx.authzRolePermission.findMany({ where: { roleId: id } });
      if (existing.some((x) => !grants.includes(x.permissionCode)))
        throw new ForbiddenException("Role exceeds delegation authority");
      await tx.authzRolePermission.deleteMany({ where: { roleId: id } });
      await tx.authzRolePermission.createMany({
        data: codes.map((permissionCode) => ({ roleId: id, permissionCode })),
      });
      return { updated: true };
    });
  }
  private async findUser(tx: Tx, p: AuthorizationPrincipal, id: string) {
    const user =
      p.scope === "platform"
        ? await tx.platformUser.findUnique({
            where: { id },
            select: { id: true, email: true, name: true, status: true },
          })
        : await (
            tx as unknown as import("../../generated/tenant-authorized/client.js").Prisma.TransactionClient
          ).user.findUnique({ where: { id }, select: { id: true, email: true, status: true } });
    if (!user) throw new NotFoundException("User not found in this scope");
    return user;
  }
  async users(p: AuthorizationPrincipal, q: { page: number; limit: number; search?: string }) {
    return this.withDatabase(p, async (db) => {
      const where = q.search ? { email: { contains: q.search, mode: "insensitive" as const } } : {};
      const skip = (q.page - 1) * q.limit,
        take = q.limit;
      const [items, total] =
        p.scope === "platform"
          ? await db.$transaction([
              db.platformUser.findMany({
                where,
                skip,
                take,
                orderBy: { email: "asc" },
                select: { id: true, email: true, name: true, status: true },
              }),
              db.platformUser.count({ where }),
            ])
          : await (db as unknown as TenantClient).$transaction([
              (db as unknown as TenantClient).user.findMany({
                where,
                skip,
                take,
                orderBy: { email: "asc" },
                select: { id: true, email: true, status: true },
              }),
              (db as unknown as TenantClient).user.count({ where }),
            ]);
      const assignments = await db.authzUserRole.findMany({
        where: { userId: { in: items.map((x) => x.id) } },
        include: { role: { select: { id: true, code: true, name: true } } },
      });
      return {
        items: items.map((x) => ({
          ...x,
          roles: assignments.filter((a) => a.userId === x.id).map((a) => a.role),
        })),
        total,
        page: q.page,
        limit: q.limit,
      };
    });
  }
  async userRoles(p: AuthorizationPrincipal, id: string) {
    return this.withDatabase(p, (db) =>
      db.$transaction(async (tx) => {
        await this.findUser(tx, p, id);
        return tx.authzUserRole.findMany({ where: { userId: id }, include: { role: true } });
      }),
    );
  }
  async assignRoles(p: AuthorizationPrincipal, id: string, ids: string[]) {
    return this.mutate(
      p,
      p.scope === "platform" ? "platform.users:manage" : "tenant.users:assign",
      "USER_ROLES_REPLACED",
      id,
      async (tx, grants) => {
        const u = await this.findUser(tx, p, id);
        if (u.status !== "ACTIVE")
          throw new ConflictException("Disabled users cannot receive roles");
        const roles = await tx.authzRole.findMany({
          where: { id: { in: ids } },
          include: { permissions: true },
        });
        const old = await tx.authzUserRole.findMany({
          where: { userId: id },
          include: { role: { include: { permissions: true } } },
        });
        if (roles.length !== new Set(ids).size || ids.length !== new Set(ids).size)
          throw new NotFoundException("Role not found in this scope");
        if (
          [...roles, ...old.map((a) => a.role)].some((r) =>
            r.permissions.some((x) => !grants.includes(x.permissionCode)),
          )
        )
          throw new ForbiddenException("Role exceeds delegation authority");
        await tx.authzUserRole.deleteMany({ where: { userId: id } });
        await tx.authzUserRole.createMany({
          data: ids.map((roleId) => ({ roleId, userId: id, assignedBy: p.userId })),
        });
        return { updated: true };
      },
    );
  }
  async createUser(
    p: AuthorizationPrincipal,
    data: { email: string; password: string; name?: string },
  ) {
    const passwordHash = await hashPassword(data.password);
    return this.mutate(
      p,
      p.scope === "platform" ? "platform.users:manage" : "tenant.users:create",
      "USER_CREATED",
      data.email,
      async (tx) =>
        p.scope === "platform"
          ? tx.platformUser.create({
              data: { email: data.email, name: data.name ?? data.email, passwordHash },
              select: { id: true, email: true, status: true },
            })
          : (
              tx as unknown as import("../../generated/tenant-authorized/client.js").Prisma.TransactionClient
            ).user.create({
              data: { email: data.email, passwordHash, role: "TENANT_USER" },
              select: { id: true, email: true, status: true },
            }),
    );
  }
  async status(p: AuthorizationPrincipal, id: string, status: "ACTIVE" | "DISABLED") {
    return this.mutate(
      p,
      p.scope === "platform" ? "platform.users:manage" : "tenant.users:update",
      "USER_STATUS_UPDATED",
      id,
      async (tx, grants) => {
        await this.findUser(tx, p, id);
        const roles = await tx.authzUserRole.findMany({
          where: { userId: id },
          include: { role: { include: { permissions: true } } },
        });
        if (roles.some((r) => r.role.permissions.some((x) => !grants.includes(x.permissionCode))))
          throw new ForbiddenException("Account exceeds delegation authority");
        return p.scope === "platform"
          ? tx.platformUser.update({
              where: { id },
              data: { status },
              select: { id: true, email: true, status: true },
            })
          : (
              tx as unknown as import("../../generated/tenant-authorized/client.js").Prisma.TransactionClient
            ).user.update({
              where: { id },
              data: { status },
              select: { id: true, email: true, status: true },
            });
      },
    );
  }
}
