import { NextResponse, type NextRequest } from "next/server";
// Locale selection only. Backend session validation is handled by the auth API.
// With src/app, Next.js discovers proxy at src/proxy.ts, not at repository root.
export function proxy(request: NextRequest) {
  const response = NextResponse.next();
  if (!request.cookies.has("locale"))
    response.cookies.set("locale", "en", {
      path: "/",
      sameSite: "lax",
      maxAge: 31536000,
    });
  return response;
}
export const config = { matcher: ["/((?!api|_next|.*\\..*).*)"] };
