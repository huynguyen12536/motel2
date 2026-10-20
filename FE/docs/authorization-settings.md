# Settings authorization integration

The real Settings routes use the backend's current Casbin permissions. See [backend architecture and operations](../../BE/docs/casbin-authorization.md) and [verification report](../../BE/docs/casbin-implementation-report.md).

Platform operators sign in at `/auth/platform-sign-in`; tenant users use `/auth/sign-in` with company code. Configure server-side `AUTH_PUBLIC_ORIGIN` and backend CORS for the actual browser origin. Never embed admin keys, bootstrap passwords or JWT signing secrets in NEXT_PUBLIC variables.

The session BFF supports only fixed login/refresh/logout actions. Access tokens stay in memory; the refresh cookie is HttpOnly/SameSite=Strict. Permission state is fetched from the backend, invalidated on context switch/logout/403 and refreshed on focus/every five seconds. Direct unauthorized URLs are denied before privileged queries render.

The connected Playwright suite is launched from BE with `AUTHORIZATION_UI_E2E=true pnpm test:authorization:integration` using the shell's environment syntax. It launches its own Next dev instance and uses owned local databases and mock Neon only. Ordinary frontend tests skip this suite unless its explicit fixture is present.
