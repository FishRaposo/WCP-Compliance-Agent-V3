## 2024-05-24 - [CRITICAL] Insecure Default Settings in Production & Missing Endpoint-Specific Rate Limiting
**Vulnerability:**
1. The `JWT_SECRET` environmental variable was using a hardcoded, default value `"change-me-before-launch"` which could inadvertently be deployed to production, exposing the application to JWT forgery attacks.
2. The `/api/auth/login` endpoint relied on a global rate limiter of 60 requests per minute, making it vulnerable to brute-force credential stuffing attacks.
**Learning:** Configurations shouldn't rely solely on comments to prevent defaults from leaking into production; explicit programmatic guards are necessary. Furthermore, global rate limiting is insufficient for sensitive endpoints like login, which require much stricter protections.
**Prevention:**
1. Implement a throw condition when `NODE_ENV` is set to production and critical secrets like `JWT_SECRET` are still set to their default values.
2. Refactor rate-limiting middleware to allow configurable limiters, and apply a very strict limiter (e.g., 5 requests per minute) specifically to authentication endpoints.
