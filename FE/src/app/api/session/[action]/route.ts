import { NextRequest, NextResponse } from "next/server";
import { env } from "@/config/env";
export const runtime = "nodejs";
const names = {
  refresh: "motel-refresh",
  scope: "motel-scope",
  company: "motel-company",
};
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ action: string }> },
) {
  const { action } = await params;
  if (!["login", "refresh", "logout"].includes(action))
    return NextResponse.json({ message: "Not found" }, { status: 404 });
  // Next may normalize its internal URL host. Use the configured public origin (preferred)
  // or the browser-facing Host, never an arbitrary forwarded-origin header.
  let expectedOrigin: string;
  try {
    expectedOrigin = process.env.AUTH_PUBLIC_ORIGIN
      ? new URL(process.env.AUTH_PUBLIC_ORIGIN).origin
      : new URL(
          request.nextUrl.protocol +
            "//" +
            (request.headers.get("host") ?? request.nextUrl.host),
        ).origin;
  } catch {
    return NextResponse.json(
      { message: "Authentication origin is not configured" },
      { status: 503 },
    );
  }
  if (
    request.headers.get("origin") !== expectedOrigin ||
    ![null, "same-origin", "none"].includes(
      request.headers.get("sec-fetch-site"),
    )
  )
    return NextResponse.json(
      { message: "Same-origin request required" },
      { status: 403 },
    );
  const response = (body: unknown, status = 200) =>
    NextResponse.json(body, {
      status,
      headers: { "Cache-Control": "no-store", Pragma: "no-cache" },
    });
  let scope = request.cookies.get(names.scope)?.value,
    company = request.cookies.get(names.company)?.value;
  let body: Record<string, unknown> = {};
  try {
    if (action === "login") {
      if (Number(request.headers.get("content-length") ?? 0) > 8000)
        return response({ message: "Request too large" }, 413);
      const raw = await request.text();
      if (raw.length > 8000)
        return response({ message: "Request too large" }, 413);
      const input = JSON.parse(raw);
      scope = input.scope;
      if (!["platform", "tenant"].includes(scope ?? ""))
        return response({ message: "Select a valid account scope" }, 400);
      company =
        typeof input.companyCode === "string"
          ? input.companyCode.trim().toUpperCase()
          : "";
      body = {
        email: input.email,
        password: input.password,
        ...(scope === "tenant" ? { companyCode: company } : {}),
      };
    } else {
      if (!["platform", "tenant"].includes(scope ?? ""))
        return response({ message: "Session required" }, 401);
      if (action === "refresh")
        body = {
          refreshToken: request.cookies.get(names.refresh)?.value ?? "",
          ...(scope === "tenant" ? { companyCode: company } : {}),
        };
    }
    const route =
      (scope === "platform" ? "/platform/auth/" : "/auth/") + action;
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      Accept: "application/json",
    };
    // Login limiting is conservative behind this BFF; no user-controlled forwarded IP is trusted.
    if (action === "logout")
      headers.Authorization = request.headers.get("authorization") ?? "";
    const upstream = await fetch(env.apiUrl.replace(/\/$/, "") + route, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
      cache: "no-store",
      redirect: "error",
      signal: AbortSignal.timeout(15000),
    });
    const data = await upstream
      .json()
      .catch(() => ({ message: "Authentication service unavailable" }));
    const out = response(
      upstream.ok
        ? action === "logout"
          ? { revoked: true }
          : { accessToken: data.accessToken }
        : {
            message:
              typeof data.message === "string"
                ? data.message
                : "Authentication failed",
          },
      upstream.status,
    );
    const publicUrl = new URL(expectedOrigin);
    const secure =
      publicUrl.protocol === "https:" ||
      (!["localhost", "127.0.0.1", "[::1]"].includes(publicUrl.hostname) &&
        process.env.NODE_ENV === "production");
    const options = {
      httpOnly: true,
      secure,
      sameSite: "strict" as const,
      path: "/api/session",
      maxAge: 7 * 86400,
    };
    if (
      action === "logout" ||
      (action === "refresh" && [401, 403].includes(upstream.status))
    )
      for (const name of Object.values(names))
        out.cookies.set(name, "", { ...options, maxAge: 0 });
    if (upstream.ok && action !== "logout") {
      if (
        typeof data.refreshToken !== "string" ||
        typeof data.accessToken !== "string"
      )
        return response({ message: "Invalid authentication response" }, 503);
      out.cookies.set(names.refresh, data.refreshToken, options);
      out.cookies.set(names.scope, scope!, options);
      out.cookies.set(names.company, company ?? "", options);
    }
    return out;
  } catch {
    return response({ message: "Authentication service unavailable" }, 503);
  }
}
