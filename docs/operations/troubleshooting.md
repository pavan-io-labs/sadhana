# Troubleshooting

## Common Issues

### `npm run dev` fails with "port in use"

Another process is using port 3000. Either stop it or use a different port:

```bash
npm run dev -- --port 3001
```

### Database errors on first run

The `.data/` directory or database file may not exist. Run:

```bash
npm run db:migrate
```

### "SADHANA_PASSCODE required" error in production

The proxy gate detected a non-localhost origin without a configured passcode. Set `SADHANA_PASSCODE` in `.env.local`:

```
SADHANA_PASSCODE=your-strong-random-passcode
```

### Push notifications not working

1. Check that VAPID keys are set in `.env.local`
2. Test with `POST /api/push/test`
3. Ensure the app is served over HTTPS (required for service workers in production)
4. Check browser notification permissions

### Sunrise times seem wrong

1. Verify lat/lng in Settings (the NOAA equations are sensitive to location)
2. Check timezone setting matches your actual timezone
3. Compare with a known source (timeanddate.com) -- accuracy is +/- 2 minutes

### TypeScript errors after pulling changes

```bash
rm -rf .next
npm install
npx tsc --noEmit
```

### Tests fail after schema changes

Run migrations first:

```bash
npm run db:migrate
npm run test
```

### OneDrive syncing `node_modules/`

If OneDrive is syncing `node_modules/` (very slow):
1. Right-click `node_modules/` in File Explorer
2. Select "Free up space"
3. Or add to OneDrive's exclusion list

### Build fails with "middleware deprecated"

Next.js 16 deprecated `middleware.ts` in favor of `proxy.ts`. The project already uses `proxy.ts`. If you see this warning, it is safe to ignore -- no `middleware.ts` file exists.
