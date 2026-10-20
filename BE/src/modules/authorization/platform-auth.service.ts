import {
  Inject,
  Injectable,
  UnauthorizedException,
  ServiceUnavailableException,
} from "@nestjs/common";
import { ModuleRef } from "@nestjs/core";
import { createHmac, randomBytes, randomUUID, timingSafeEqual } from "node:crypto";
import { z } from "zod";
import { MasterPrismaService } from "../../infrastructure/database/master/master-prisma.service.js";
import { env } from "../../config/env.js";
import { digest, verifyPassword } from "../../saas/security.js";
import { LoginLimiter } from "../../saas/auth.service.js";
export interface AuthorizationPrincipal {
  scope: "platform" | "tenant";
  userId: string;
  tenantId?: string;
  sessionId?: string;
  email: string;
}
const claimsSchema = z.object({
  sub: z.uuid(),
  sid: z.uuid(),
  sv: z.number().int().positive(),
  scope: z.literal("platform"),
  iss: z.literal("motel-platform-auth"),
  aud: z.literal("motel-platform"),
  exp: z.number().int(),
  iat: z.number().int(),
  jti: z.uuid(),
});
function key() {
  if (!env.PLATFORM_JWT_SECRET)
    throw new ServiceUnavailableException("Platform authentication is not configured");
  return env.PLATFORM_JWT_SECRET;
}
export function signPlatformAccess(sub: string, sid: string, sv: number) {
  const now = Math.floor(Date.now() / 1000),
    head = Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString("base64url"),
    body = Buffer.from(
      JSON.stringify({
        sub,
        sid,
        sv,
        scope: "platform",
        iss: "motel-platform-auth",
        aud: "motel-platform",
        iat: now,
        exp: now + 900,
        jti: randomUUID(),
      }),
    ).toString("base64url");
  return (
    head +
    "." +
    body +
    "." +
    createHmac("sha256", key())
      .update(head + "." + body)
      .digest("base64url")
  );
}
export function verifyPlatformAccess(token: string) {
  const secret = key();
  try {
    const parts = token.split(".");
    if (parts.length !== 3 || token.length > 3000) throw Error();
    const [h, b, s] = parts,
      head = JSON.parse(Buffer.from(h, "base64url").toString());
    const expected = createHmac("sha256", secret)
        .update(h + "." + b)
        .digest(),
      signature = Buffer.from(s, "base64url");
    if (
      head.alg !== "HS256" ||
      head.typ !== "JWT" ||
      signature.length !== expected.length ||
      !timingSafeEqual(signature, expected)
    )
      throw Error();
    const claims = claimsSchema.parse(JSON.parse(Buffer.from(b, "base64url").toString()));
    const now = Math.floor(Date.now() / 1000);
    if (claims.exp <= now || claims.iat > now + 30 || claims.exp - claims.iat !== 900)
      throw Error();
    return claims;
  } catch {
    throw new UnauthorizedException("Invalid platform session");
  }
}
@Injectable()
export class PlatformAuthService {
  constructor(
    @Inject(MasterPrismaService) private readonly master: MasterPrismaService,
    @Inject(ModuleRef) private readonly modules: ModuleRef,
  ) {}
  private pair(userId: string, sessionId: string, version: number, secret: string) {
    return {
      accessToken: signPlatformAccess(userId, sessionId, version),
      refreshToken: sessionId + "." + secret,
      tokenType: "Bearer",
      expiresIn: 900,
    };
  }
  private limiter() {
    return this.modules.get(LoginLimiter, { strict: false });
  }
  async login(email: string, password: string, ip: string) {
    key();
    await this.limiter().check("platform", email, ip);
    const db = await this.master.client(),
      user = await db.platformUser.findUnique({ where: { email } });
    const valid = await verifyPassword(password, user?.passwordHash ?? "");
    if (!user || !valid || user.status !== "ACTIVE")
      throw new UnauthorizedException("Invalid platform credentials");
    const secret = randomBytes(32).toString("base64url"),
      session = await db.platformSession.create({
        data: {
          userId: user.id,
          refreshHash: digest(secret),
          expiresAt: new Date(Date.now() + 7 * 86400000),
        },
      });
    return this.pair(user.id, session.id, session.version, secret);
  }
  async authenticate(token: string): Promise<AuthorizationPrincipal> {
    const c = verifyPlatformAccess(token),
      db = await this.master.client();
    const session = await db.platformSession.findFirst({
      where: {
        id: c.sid,
        userId: c.sub,
        version: c.sv,
        revokedAt: null,
        expiresAt: { gt: new Date() },
      },
      include: { user: true },
    });
    if (!session || session.user.status !== "ACTIVE")
      throw new UnauthorizedException("Invalid platform session");
    return { scope: "platform", userId: c.sub, sessionId: c.sid, email: session.user.email };
  }
  async legacy(id: string): Promise<AuthorizationPrincipal> {
    const user = await (await this.master.client()).platformUser.findUnique({ where: { id } });
    if (!user || user.status !== "ACTIVE")
      throw new UnauthorizedException("Legacy platform identity unavailable");
    return { scope: "platform", userId: user.id, email: user.email };
  }
  async refresh(value: string, ip: string) {
    key();
    await this.limiter().check("platform", "refresh", ip);
    const [id, secret, ...extra] = value.split(".");
    if (
      !z.uuid().safeParse(id).success ||
      !/^[A-Za-z0-9_-]{43}$/.test(secret ?? "") ||
      extra.length
    )
      throw new UnauthorizedException("Invalid refresh token");
    const db = await this.master.client(),
      old = await db.platformSession.findUnique({ where: { id }, include: { user: true } });
    if (!old || old.revokedAt || old.expiresAt <= new Date() || old.user.status !== "ACTIVE")
      throw new UnauthorizedException("Invalid refresh token");
    if (old.refreshHash !== digest(secret)) {
      await db.platformSession.update({ where: { id }, data: { revokedAt: new Date() } });
      throw new UnauthorizedException("Invalid refresh token");
    }
    const next = randomBytes(32).toString("base64url");
    const r = await db.platformSession.updateMany({
      where: {
        id,
        refreshHash: old.refreshHash,
        version: old.version,
        revokedAt: null,
        expiresAt: { gt: new Date() },
      },
      data: { refreshHash: digest(next), version: { increment: 1 } },
    });
    if (r.count !== 1) throw new UnauthorizedException("Refresh token already used");
    return this.pair(old.userId, id, old.version + 1, next);
  }
  async logout(p: AuthorizationPrincipal) {
    await (
      await this.master.client()
    ).platformSession.updateMany({
      where: { id: p.sessionId, userId: p.userId },
      data: { revokedAt: new Date() },
    });
    return { revoked: true };
  }
}
