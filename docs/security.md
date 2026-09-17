# Security

## Threat Model

Sadhana stores personal health data. The threat model prioritizes:

1. **Unauthorized remote access** to health data
2. **Data leakage** via client bundles or third-party requests
3. **Injection attacks** via API inputs
4. **Secret exposure** in version control

## Defenses

### Auth Gate (Proxy)

`proxy.ts` (Next.js 16 convention) runs on every request:

- **Localhost**: no auth required
- **Non-localhost**: requires a `SADHANA_PASSCODE` environment variable
- **Fail-closed**: if no passcode is configured on a non-localhost host, every request returns 403
- Cookie: signed, `httpOnly`, `SameSite=Strict`

### Input Validation

Every API route handler validates input with Zod before processing. No raw `request.body` is ever used directly.

### SQL Injection Prevention

All database queries use Drizzle ORM's parameterized query builder. No string interpolation of user input into SQL.

### Secret Management

| Secret | Storage | Scope |
|--------|---------|-------|
| `VAPID_PRIVATE_KEY` | `.env.local` | Server-only |
| `YOUTUBE_API_KEY` | `.env.local` | Server-only |
| `SADHANA_PASSCODE` | `.env.local` | Server-only |
| `DATABASE_AUTH_TOKEN` | `.env.local` | Server-only |

None of these use the `NEXT_PUBLIC_` prefix (except `NEXT_PUBLIC_VAPID_PUBLIC_KEY`, which is a public key by design).

### Third-Party Isolation

- YouTube embeds use `youtube-nocookie.com` and load only on user click
- Literature search is proxied server-side (no direct browser-to-EuropePMC requests)
- No analytics, tracking, or ad scripts

## Not Medical Advice

A disclaimer ships with the app. Contraindications for practices (Kapalabhati, Bhastrika, Abhyanga, fasted training) are surfaced in-context, not buried.

## Reporting Vulnerabilities

See [SECURITY.md](../SECURITY.md).
