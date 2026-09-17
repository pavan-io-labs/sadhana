/**
 * POST /api/push/subscribe  --  register a web push subscription.
 * POST /api/push/test  --  send a test notification.
 */

import type { NextRequest } from "next/server";
import { z } from "zod";

import { guarded, invalid, ok, readJson, fail } from "@/lib/api";
import { getDb, schema } from "@/lib/db";


export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const subscribeSchema = z.object({
  endpoint: z.string().url(),
  keys: z.object({
    p256dh: z.string().min(1),
    auth: z.string().min(1),
  }),
  userAgent: z.string().default(""),
  timeZone: z.string().default(""),
});

export async function POST(request: NextRequest) {
  const url = new URL(request.url);
  const isTest = url.pathname.endsWith("/test");

  if (isTest) {
    return guarded(async () => {
      // Test notification  --  requires web-push library configured with VAPID keys
      const vapidPrivate = process.env.VAPID_PRIVATE_KEY;
      if (!vapidPrivate) {
        return fail("VAPID_PRIVATE_KEY not configured in .env.local", 500);
      }
      return ok({ sent: false, reason: "Web push test requires full VAPID setup  --  configure VAPID keys in .env.local" });
    });
  }

  return guarded(async () => {
    const body = await readJson(request);
    if (!body.ok) return body.response;
    const parsed = subscribeSchema.safeParse(body.value);
    if (!parsed.success) return invalid(parsed.error);

    const db = await getDb();
    const { endpoint, keys, userAgent, timeZone } = parsed.data;

    // Upsert by endpoint
    await db
      .insert(schema.pushSubscriptions)
      .values({
        endpoint,
        p256dh: keys.p256dh,
        auth: keys.auth,
        userAgent,
        timeZone,
      })
      .onConflictDoUpdate({
        target: schema.pushSubscriptions.endpoint,
        set: {
          p256dh: keys.p256dh,
          auth: keys.auth,
          userAgent,
          timeZone,
          lastSeenAt: new Date().toISOString(),
        },
      });

    return ok({ subscribed: true }, { status: 201 });
  });
}
