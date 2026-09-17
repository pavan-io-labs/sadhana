# Security Policy

## Reporting a Vulnerability

If you discover a security vulnerability, please report it privately:

- **Email**: pavansakireddy@gmail.com
- **Do not** open a public GitHub issue for security vulnerabilities.

You should receive a response within 48 hours.

## Threat Model

Sadhana stores personal health data (sleep, training, cognitive scores, meal timing). The threat model accounts for:

1. **Unauthorized remote access** -- mitigated by the passcode proxy gate.
2. **Data leakage via client bundle** -- VAPID private key and API keys are server-only (`.env.local`, never `NEXT_PUBLIC_*`).
3. **Injection attacks** -- mitigated by Zod validation on every API input and parameterized queries via Drizzle.
4. **Third-party data exfiltration** -- YouTube embeds use `youtube-nocookie.com` and load only on click. Literature search is proxied server-side.

## Auth Architecture

- **Localhost**: No authentication required. The app trusts `localhost` as a single-user environment.
- **Non-localhost**: Requires `SADHANA_PASSCODE` environment variable. The proxy gate (`proxy.ts`) checks a signed, `httpOnly`, `SameSite=Strict` cookie on every request.
- **Fail-closed**: If a non-localhost host is detected without a configured passcode, the app refuses to serve rather than silently exposing data.

## Sensitive Data Handling

| Data | Storage | Access |
|------|---------|--------|
| VAPID private key | `.env.local` (gitignored) | Server-only |
| YouTube API key | `.env.local` (gitignored) | Server-only |
| Passcode | `.env.local` (gitignored) | Server-only |
| User health data | SQLite in `.data/` (gitignored) | Local only |
| Push subscriptions | SQLite | Server-only |

## Dependencies

- Dependencies are pinned via `package-lock.json`.
- No native compilation required (`@libsql/client` uses prebuilt binaries).
- `npm audit` should be run periodically.

## Supported Versions

| Version | Supported |
|---------|-----------|
| 0.1.x   | Yes       |
