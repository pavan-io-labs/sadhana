# Deployment

## Local Development (Default)

```bash
npm run dev
```

This is the primary use case. The app runs at `http://localhost:3000` with no authentication required.

## Production Deployment

### Prerequisites

1. A server with Node.js 24+ (VPS, container, etc.)
2. A domain name (optional but recommended for HTTPS)
3. Environment variables configured

### Steps

1. **Clone and install**:
   ```bash
   git clone <repo-url>
   cd Sadhana
   npm ci --production
   ```

2. **Configure environment**:
   ```bash
   cp .env.example .env.local
   # Edit .env.local with production values
   ```

   **Required for non-localhost**:
   ```
   SADHANA_PASSCODE=your-strong-random-passcode
   ```

3. **Run migrations**:
   ```bash
   npm run db:migrate
   ```

4. **Build and start**:
   ```bash
   npm run build
   npm start
   ```

### Turso (Hosted Database)

To use Turso instead of local SQLite:

1. Create a Turso database: `turso db create sadhana`
2. Get the URL: `turso db show sadhana --url`
3. Create a token: `turso db tokens create sadhana`
4. Set in `.env.local`:
   ```
   DATABASE_URL=libsql://sadhana-yourusername.turso.io
   DATABASE_AUTH_TOKEN=your-turso-token
   ```

### VAPID Setup (Push Notifications)

```bash
npx web-push generate-vapid-keys
```

Add to `.env.local`:
```
NEXT_PUBLIC_VAPID_PUBLIC_KEY=BExample...
VAPID_PRIVATE_KEY=abc123...
VAPID_SUBJECT=mailto:you@example.com
```

Test with `POST /api/push/test`.

### Reverse Proxy (nginx)

```nginx
server {
    listen 443 ssl;
    server_name sadhana.example.com;

    ssl_certificate /path/to/cert.pem;
    ssl_certificate_key /path/to/key.pem;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

### Security Checklist

- [ ] `SADHANA_PASSCODE` is set and strong
- [ ] HTTPS is configured (required for service worker and push)
- [ ] `.env.local` is not committed or exposed
- [ ] Database file is backed up regularly
- [ ] `npm audit` shows no critical vulnerabilities
