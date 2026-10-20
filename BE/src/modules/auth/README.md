# Platform admin authentication

Phase 2 includes PlatformAdminGuard for Tenant Administration only.
It reads X-Platform-Admin-Key and compares fixed-size SHA-256 digests with timingSafeEqual.
PLATFORM_ADMIN_SECRET must be explicitly configured with 32+ cryptographically random bytes,
encoded as base64url or hex. There is no default. Missing configuration returns 503;
missing or incorrect credentials return 401. Do not place keys in URLs or request bodies.

Format validation cannot prove entropy: use a cryptographic random generator.
Phase 2 does not edit the existing .env. This is temporary platform administration,
not tenant authentication. Replace this guard with platform-admin JWT/OIDC later
without changing registry business logic. No login or JWT issuance is implemented.
