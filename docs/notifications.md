# Notification Architecture

## Push Notifications (VAPID)

### How It Works

1. **Registration**: the service worker (`public/sw.js`) is registered on page load via `components/providers.tsx`
2. **Subscription**: the client calls `pushManager.subscribe()` with the VAPID public key and sends the subscription to `POST /api/push/subscribe`
3. **Storage**: the endpoint, p256dh key, and auth secret are stored in the `pushSubscriptions` table
4. **Sending**: the server uses `web-push` to send notifications to all stored subscriptions

### Service Worker

`public/sw.js` handles:
- **Push events**: displays a notification with the title and body from the payload
- **Notification click**: opens the app or focuses the existing window
- **Offline**: caches the app shell for basic offline support

### Testing

```bash
curl -X POST http://localhost:3000/api/push/test
```

This sends a test notification to all registered subscriptions.

### Requirements

- VAPID keys configured in `.env.local`
- HTTPS in production (service workers require a secure context)
- Browser notification permission granted
- The dev server must be running for notifications to fire with the window closed

## ICS Calendar Export

For fully-offline notifications (no server needed):

```
GET /api/ics?date=2024-09-17
```

Returns a `.ics` file with VALARM reminders for each block. Import into any calendar app (Google Calendar, Apple Calendar, Outlook) for OS-level alarms.

### ICS Details

- One VEVENT per block with start/end times
- VALARM set to `notifyMinutesBefore` from settings
- Proper VTIMEZONE based on user's IANA timezone
- Field escaping for special characters

## Fallback Strategy

| Scenario | Notification Method |
|----------|-------------------|
| App open in browser | In-app advisory panel |
| App closed, server running | Web push notification |
| Server not running | .ics calendar alarms (pre-imported) |
