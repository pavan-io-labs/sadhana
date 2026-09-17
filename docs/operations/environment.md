# Environment Variables

All environment variables are documented in `.env.example`. Copy it to `.env.local` (gitignored) for your values.

## Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `SADHANA_PASSCODE` | Non-localhost only | none | Auth passcode for remote access. Without it, non-localhost requests are rejected. |
| `NEXT_PUBLIC_VAPID_PUBLIC_KEY` | For push | none | VAPID public key for web push. |
| `VAPID_PRIVATE_KEY` | For push | none | VAPID private key. Server-only. |
| `VAPID_SUBJECT` | For push | `mailto:sadhana@localhost` | VAPID subject (mailto: or URL). |
| `YOUTUBE_API_KEY` | Optional | none | YouTube Data API key for live video search. |
| `DATABASE_URL` | Optional | `file:.data/sadhana.db` | libSQL connection URL. For Turso: `libsql://...` |
| `DATABASE_AUTH_TOKEN` | For Turso | none | Turso auth token. |

## Security Rules

- **Never use `NEXT_PUBLIC_` prefix** for secrets. Only `NEXT_PUBLIC_VAPID_PUBLIC_KEY` is client-exposed (it is a public key by design).
- **Never commit `.env.local`**. It is gitignored.
- **Fail-closed**: if `SADHANA_PASSCODE` is not set and the request comes from a non-localhost origin, the proxy gate returns 403.

## Generating VAPID Keys

```bash
npx web-push generate-vapid-keys
```

This outputs both the public and private key. Copy them into `.env.local`.
