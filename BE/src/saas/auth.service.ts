import {
  ConflictException,
  HttpException,
  Inject,
  Injectable,
  ServiceUnavailableException,
  UnauthorizedException,
} from "@nestjs/common";
import { randomBytes, randomUUID } from "node:crypto";
import { TenantResolver, TenantPrismaManager } from "./tenant-routing.js";
import { MasterPrismaService } from "../infrastructure/database/master/master-prisma.service.js";
import { RedisService } from "../infrastructure/cache/redis.service.js";
import { SAAS_POLICY } from "./contracts.js";
import type { SaasPolicy } from "./contracts.js";
import {
  authConfigured,
  digest,
  hashPassword,
  verifyPassword,
  signAccess,
  verifyAccess,
} from "./security.js";
import type { AccessClaims } from "./security.js";
import type { User, AuthSession } from "../generated/tenant-authorized/client.js";
export interface TenantPrincipal {
  tenantId: string;
  userId: string;
  sessionId: string;
  role: "TENANT_ADMIN" | "TENANT_USER";
  email: string;
}
@Injectable()
export class LoginLimiter {
  constructor(
    @Inject(MasterPrismaService) private readonly master: MasterPrismaService,
    @Inject(RedisService) private readonly redis: RedisService,
  ) {}
  async check(company: string, email: string, ip: string) {
    // Hash identity keys; no email/IP/password is written to cache or audit logs.
    for (const bucket of [
      { key: digest("ip\0" + ip), limit: 60 },
      { key: digest(company + "\0" + email + "\0" + ip), limit: 10 },
    ]) {
      const cached = await this.redis.rateLimit("auth:rate:" + bucket.key, 60);
      if (cached !== undefined && cached > bucket.limit)
        throw new HttpException("Too many authentication attempts", 429);
      // Keep Master counts authoritative across Redis outages/recovery and API replicas.
      const db = await this.master.client();
      const rows = await db.$queryRaw<
        Array<{ count: number }>
      >`INSERT INTO "LoginRateBucket" (key,count,"windowStart") VALUES (${bucket.key},1,now())
        ON CONFLICT (key) DO UPDATE SET count=CASE WHEN "LoginRateBucket"."windowStart"<now()-interval '60 seconds' THEN 1 ELSE "LoginRateBucket".count+1 END,
        "windowStart"=CASE WHEN "LoginRateBucket"."windowStart"<now()-interval '60 seconds' THEN now() ELSE "LoginRateBucket"."windowStart" END RETURNING count`;
      if ((rows[0]?.count ?? Number.MAX_SAFE_INTEGER) > bucket.limit)
        throw new HttpException("Too many authentication attempts", 429);
    }
  }
}
@Injectable()
export class TenantAuthService {
  constructor(
    @Inject(TenantResolver) private readonly resolver: TenantResolver,
    @Inject(TenantPrismaManager) private readonly manager: TenantPrismaManager,
    @Inject(LoginLimiter) private readonly limiter: LoginLimiter,
    @Inject(MasterPrismaService) private readonly master: MasterPrismaService,
    @Inject(SAAS_POLICY) private readonly policy: SaasPolicy,
  ) {}
  private tokens(
    tenantId: string,
    user: Pick<User, "id">,
    session: Pick<AuthSession, "id" | "version">,
    secret: string,
  ) {
    return {
      accessToken: signAccess({
        sub: user.id,
        tid: tenantId,
        sid: session.id,
        sv: session.version,
        jti: randomUUID(),
      }),
      tokenType: "Bearer",
      expiresIn: 900,
      refreshToken: session.id + "." + secret,
    };
  }
  async login(input: { companyCode: string; email: string; password: string }, ip: string) {
    authConfigured();
    await this.limiter.check(input.companyCode, input.email, ip);
    let tenant;
    try {
      tenant = await this.resolver.resolve({ code: input.companyCode });
    } catch (error) {
      await verifyPassword(input.password, "");
      if (error instanceof UnauthorizedException)
        throw new UnauthorizedException("Invalid company or credentials");
      throw error;
    }
    return this.manager.withClient(tenant, async (client) => {
      const user = await client.user.findUnique({ where: { email: input.email } });
      const valid = await verifyPassword(input.password, user?.passwordHash ?? "");
      if (!user || !valid || user.status !== "ACTIVE")
        throw new UnauthorizedException("Invalid company or credentials");
      const secret = randomBytes(32).toString("base64url");
      const session = await client.authSession.create({
        data: {
          userId: user.id,
          refreshHash: digest(secret),
          expiresAt: new Date(Date.now() + 7 * 86400000),
        },
      });
      return this.tokens(tenant.id, user, session, secret);
    });
  }
  async refresh(input: { companyCode: string; refreshToken: string }, ip: string) {
    authConfigured();
    await this.limiter.check(input.companyCode, "refresh", ip);
    const parts = input.refreshToken.split(".");
    if (
      parts.length !== 2 ||
      !/^[0-9a-f-]{36}$/.test(parts[0]) ||
      !/^[A-Za-z0-9_-]{43}$/.test(parts[1])
    )
      throw new UnauthorizedException("Invalid refresh token");
    const [id, secret] = parts as [string, string];
    const tenant = await this.resolver.resolve({ code: input.companyCode });
    return this.manager.withClient(tenant, async (client) => {
      const old = await client.authSession.findUnique({ where: { id }, include: { user: true } });
      if (!old || old.revokedAt || old.expiresAt <= new Date() || old.user.status !== "ACTIVE")
        throw new UnauthorizedException("Invalid refresh token");
      if (old.refreshHash !== digest(secret)) {
        await client.authSession.update({ where: { id }, data: { revokedAt: new Date() } });
        throw new UnauthorizedException("Invalid refresh token");
      }
      const next = randomBytes(32).toString("base64url");
      const changed = await client.authSession.updateMany({
        where: {
          id,
          refreshHash: old.refreshHash,
          version: old.version,
          revokedAt: null,
          expiresAt: { gt: new Date() },
        },
        data: { refreshHash: digest(next), version: { increment: 1 } },
      });
      if (changed.count !== 1) throw new UnauthorizedException("Refresh token was already used");
      return this.tokens(tenant.id, old.user, { id, version: old.version + 1 }, next);
    });
  }
  async authenticate(token: string): Promise<TenantPrincipal> {
    const claims: AccessClaims = verifyAccess(token);
    const tenant = await this.resolver.resolve({ id: claims.tid });
    return this.manager.withClient(tenant, async (client) => {
      const session = await client.authSession.findFirst({
        where: {
          id: claims.sid,
          userId: claims.sub,
          version: claims.sv,
          revokedAt: null,
          expiresAt: { gt: new Date() },
        },
        include: { user: true },
      });
      if (!session || session.user.status !== "ACTIVE")
        throw new UnauthorizedException("Session is unavailable");
      return {
        tenantId: tenant.id,
        userId: session.userId,
        sessionId: session.id,
        role: session.user.role,
        email: session.user.email,
      };
    });
  }
  async logout(principal: TenantPrincipal) {
    const tenant = await this.resolver.resolve({ id: principal.tenantId });
    await this.manager.withClient(tenant, (c) =>
      c.authSession.updateMany({
        where: { id: principal.sessionId, userId: principal.userId },
        data: { revokedAt: new Date() },
      }),
    );
    return { revoked: true };
  }
  async bootstrap(tenantId: string, email: string, password: string) {
    if (!this.policy.bootstrapEnabled)
      throw new ServiceUnavailableException("Tenant admin bootstrap is disabled");
    authConfigured();
    const tenant = await this.resolver.resolve({ id: tenantId });
    const passwordHash = await hashPassword(password),
      correlationId = randomUUID();
    const master = await this.master.client();
    // Record intent before touching the tenant database; audit unavailability fails closed.
    await master.securityAuditEvent.create({
      data: {
        tenantId,
        action: "ADMIN_BOOTSTRAP_REQUEST",
        actorId: "platform-admin",
        correlationId,
      },
    });
    const user = await this.manager.withClient(tenant, (c) =>
      c.$transaction(async (tx) => {
        const claim = await tx.tenantBootstrap.updateMany({
          where: { id: 1, tenantId, adminBootstrappedAt: null },
          data: { adminBootstrappedAt: new Date() },
        });
        if (claim.count !== 1)
          throw new ConflictException("Tenant administrator is already bootstrapped");
        await tx.$queryRaw`SELECT id FROM "AuthzState" WHERE id=1 FOR UPDATE`;
        const state = await tx.authzState.findUnique({ where: { id: 1 } });
        const role = await tx.authzRole.findUnique({ where: { code: "TENANT_ADMIN" } });
        if (state?.domain !== "tenant:" + tenantId || !role?.systemManaged)
          throw new ServiceUnavailableException("Tenant authorization initialization required");
        const created = await tx.user.create({
          data: { email, passwordHash, role: "TENANT_ADMIN" },
          select: { id: true, email: true, role: true },
        });
        await tx.authzUserRole.create({
          data: { userId: created.id, roleId: role.id, assignedBy: "controlled-tenant-bootstrap" },
        });
        const updated = await tx.authzState.update({
          where: { id: 1 },
          data: { revision: { increment: 1 } },
        });
        await tx.authzAudit.create({
          data: {
            actorId: "controlled-tenant-bootstrap",
            action: "TENANT_ADMIN_BOOTSTRAPPED",
            targetId: created.id,
            revision: updated.revision,
          },
        });
        return created;
      }),
    );
    await master.securityAuditEvent.create({
      data: {
        tenantId,
        action: "ADMIN_BOOTSTRAPPED",
        actorId: "platform-admin",
        targetId: user.id,
        correlationId,
      },
    });
    return user;
  }
}
