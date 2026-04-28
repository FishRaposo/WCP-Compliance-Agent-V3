# Security Policy

## Scope

This is a **portfolio/demonstration project** — not a production service processing real federal payroll data. The architecture demonstrates production-grade patterns (immutable audit trails, JWT auth, deterministic validation), but it is not deployed in a regulated environment.

## Reporting a Vulnerability

If you discover a security issue, please report it via [GitHub private vulnerability reporting](https://docs.github.com/en/code-security/security-advisories/guidance-on-reporting-and-writing-information-about-vulnerabilities/privately-reporting-a-security-vulnerability).

Do **not** open a public issue for security vulnerabilities.

## Sensitive Configuration

The following values must never be committed to the repository:

| Variable | Service | Risk |
|---|---|---|
| `OPENAI_API_KEY` | Agent | API billing abuse |
| `ANTHROPIC_API_KEY` | Agent | API billing abuse |
| `JWT_SECRET` | Agent | Auth bypass |
| `DATABASE_URL` | Backend | Data access |
| `LANGFUSE_SECRET_KEY` | Agent | Observability data leak |
| `SAM_GOV_API_KEY` | Agent | API abuse |

All `.env` files are gitignored. Only `.env.example` files (with placeholder values) are tracked.

## Supported Versions

| Version | Supported |
|---|---|
| V3.1 (current) | Yes |
| V3.0 | Best effort |
| V2 (archived) | No |
