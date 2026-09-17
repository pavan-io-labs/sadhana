# ADR-004: Proxy Auth Gate

## Status

Accepted

## Context

The app stores personal health data. It needs to be safe on localhost (the primary use case) and safe if deployed to a public URL. Options:

1. **No auth** anywhere: simple but dangerous if accidentally deployed
2. **OAuth / social login**: complex, requires external provider, overkill for single-user
3. **Simple passcode**: low-friction, sufficient for single-user, no external dependency
4. **mTLS / client certificate**: very secure, complex to set up

## Decision

Use a **simple passcode gate** in the Next.js proxy (`proxy.ts`):

- **Localhost**: no auth required (trusted single-user environment)
- **Non-localhost**: requires `SADHANA_PASSCODE` env var, checked via signed cookie
- **Fail-closed**: if a non-localhost request arrives and no passcode is configured, return 403

## Rationale

- **Fail-closed by default**: the most dangerous scenario (deploying without configuring auth) is handled by refusing to serve rather than silently exposing data
- **No external dependency**: no OAuth provider, no user database, no token refresh
- **Single-user appropriate**: a passcode is the right level of security for a personal tool
- **Cookie-based**: `httpOnly`, `SameSite=Strict`, signed -- no token in URL or localStorage

## Consequences

- No multi-user support (by design for v1)
- Passcode must be communicated out-of-band (the user sets it in `.env.local`)
- No password reset mechanism (re-set the env var)
- Upgrading to OAuth later is additive (replace the proxy check, keep the same cookie mechanism)
