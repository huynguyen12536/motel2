import { createHash, createHmac, randomBytes, scrypt, timingSafeEqual } from "node:crypto";
import { ServiceUnavailableException, UnauthorizedException } from "@nestjs/common";
import { env } from "../config/env.js";
import { PipelineError } from "./contracts.js";
const derive = (
  password: string,
  salt: string,
  length: number,
  options: { N: number; r: number; p: number; maxmem: number },
) =>
  new Promise<Buffer>((resolve, reject) =>
    scrypt(password, salt, length, options, (error, key) => (error ? reject(error) : resolve(key))),
  );
export const digest = (value: string) => createHash("sha256").update(value).digest("hex");
export function databaseName(tenantId: string, prefix = env.TENANT_DB_NAME_PREFIX): string {
  if (
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(tenantId) ||
    !/^[a-z][a-z0-9_]{0,15}_$/.test(prefix)
  )
    throw new PipelineError("INVALID_RESOURCE_IDENTITY");
  return prefix + tenantId.replaceAll("-", "").toLowerCase();
}
export function identifier(value: string): string {
  if (!/^[a-z][a-z0-9_]{0,62}$/.test(value)) throw new PipelineError("INVALID_RESOURCE_IDENTITY");
  return '"' + value + '"';
}
export function credential(
  tenantId: string,
  project: string,
  branch: string,
  version: string,
): string {
  let key = version === env.TENANT_CREDENTIAL_VERSION ? env.TENANT_CREDENTIAL_KEY : undefined;
  if (env.TENANT_CREDENTIAL_KEYS) {
    try {
      const keys: unknown = JSON.parse(env.TENANT_CREDENTIAL_KEYS);
      if (keys && typeof keys === "object" && !Array.isArray(keys) && Object.hasOwn(keys, version))
        key = (keys as Record<string, string>)[version];
    } catch {
      throw new PipelineError("CREDENTIAL_PROVIDER_UNAVAILABLE");
    }
  }
  if (
    !key ||
    !/^[A-Za-z0-9_-]{43}$/.test(key) ||
    Buffer.from(key, "base64url").length !== 32 ||
    !/^[a-z0-9_]{1,16}$/.test(version)
  )
    throw new PipelineError("CREDENTIAL_PROVIDER_UNAVAILABLE");
  return createHmac("sha256", Buffer.from(key, "base64url"))
    .update(JSON.stringify(["tenant-application-password", version, project, branch, tenantId]))
    .digest("base64url");
}
export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(24).toString("base64url");
  const key = (await derive(password, salt, 64, {
    N: 32768,
    r: 8,
    p: 3,
    maxmem: 64 * 1024 * 1024,
  })) as Buffer;
  return ["scrypt", "v1", salt, key.toString("base64url")].join("$");
}
export async function verifyPassword(password: string, encoded: string): Promise<boolean> {
  const [algorithm, version, salt, hash] = encoded.split("$");
  const valid =
    algorithm === "scrypt" &&
    version === "v1" &&
    /^[A-Za-z0-9_-]{32}$/.test(salt ?? "") &&
    /^[A-Za-z0-9_-]{86}$/.test(hash ?? "");
  const actual = (await derive(password, valid ? salt : "invalid-identity-timing-placeholder", 64, {
    N: 32768,
    r: 8,
    p: 3,
    maxmem: 64 * 1024 * 1024,
  })) as Buffer;
  return valid && timingSafeEqual(actual, Buffer.from(hash, "base64url"));
}
export interface AccessClaims {
  sub: string;
  tid: string;
  sid: string;
  sv: number;
  jti: string;
  iss: string;
  aud: string;
  iat: number;
  exp: number;
}
export function authConfigured(): string {
  if (!env.JWT_ACCESS_SECRET || new Set(env.JWT_ACCESS_SECRET).size < 8)
    throw new ServiceUnavailableException("Tenant authentication is not configured");
  return env.JWT_ACCESS_SECRET;
}
export function signAccess(
  input: Pick<AccessClaims, "sub" | "tid" | "sid" | "sv" | "jti">,
): string {
  const now = Math.floor(Date.now() / 1000);
  const head = Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString("base64url");
  const body = Buffer.from(
    JSON.stringify({
      ...input,
      iss: env.JWT_ISSUER,
      aud: env.JWT_AUDIENCE,
      iat: now,
      exp: now + 900,
    }),
  ).toString("base64url");
  return (
    head +
    "." +
    body +
    "." +
    createHmac("sha256", authConfigured())
      .update(head + "." + body)
      .digest("base64url")
  );
}
export function verifyAccess(token: string): AccessClaims {
  const key = authConfigured();
  try {
    if (token.length > 4096) throw new Error();
    const parts = token.split(".");
    if (parts.length !== 3) throw new Error();
    const [head, body, signature] = parts as [string, string, string];
    const h = JSON.parse(Buffer.from(head, "base64url").toString());
    if (h.alg !== "HS256" || h.typ !== "JWT" || Object.keys(h).length !== 2) throw new Error();
    const expected = createHmac("sha256", key)
      .update(head + "." + body)
      .digest();
    const actual = Buffer.from(signature, "base64url");
    if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) throw new Error();
    const c = JSON.parse(Buffer.from(body, "base64url").toString()) as AccessClaims;
    const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    const now = Math.floor(Date.now() / 1000);
    if (
      ![c.sub, c.tid, c.sid, c.jti].every((x) => typeof x === "string" && uuid.test(x)) ||
      !Number.isSafeInteger(c.sv) ||
      c.sv < 1 ||
      !Number.isSafeInteger(c.iat) ||
      !Number.isSafeInteger(c.exp) ||
      c.iat > now + 30 ||
      c.exp <= now ||
      c.exp - c.iat > 900 ||
      c.exp <= c.iat ||
      c.iss !== env.JWT_ISSUER ||
      c.aud !== env.JWT_AUDIENCE
    )
      throw new Error();
    return c;
  } catch {
    throw new UnauthorizedException("Invalid access token");
  }
}
