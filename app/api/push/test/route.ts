/**
 * POST /api/push/test  --  send a test push notification to all registered subscriptions.
 *
 * Used during setup to verify VAPID keys and subscription are working.
 */

import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import * as schema from "@/lib/db/schema";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST() {
  const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY;
  const vapidSubject = process.env.VAPID_SUBJECT ?? "mailto:sadhana@localhost";

  if (!vapidPublicKey || !vapidPrivateKey) {
    return NextResponse.json(
      { ok: false, error: "VAPID keys not configured. Set NEXT_PUBLIC_VAPID_PUBLIC_KEY and VAPID_PRIVATE_KEY in .env.local." },
      { status: 503 },
    );
  }

  try {
    // Dynamic import  --  web-push may not be installed in all environments
    const webpush = await import("web-push");
    webpush.setVapidDetails(vapidSubject, vapidPublicKey, vapidPrivateKey);

    const db = await getDb();
    const subs = await db.select().from(schema.pushSubscriptions);

    if (subs.length === 0) {
      return NextResponse.json(
        { ok: false, error: "No push subscriptions registered. Enable notifications in the app first." },
        { status: 404 },
      );
    }

    const payload = JSON.stringify({
      title: "Sadhana  --  Test",
      body: "Push notifications are working! 🎉",
    });

    const results = await Promise.allSettled(
      subs.map((sub) =>
        webpush.sendNotification(
          {
            endpoint: sub.endpoint,
            keys: { p256dh: sub.p256dh, auth: sub.auth },
          },
          payload,
        ),
      ),
    );

    const sent = results.filter((r) => r.status === "fulfilled").length;
    const failed = results.filter((r) => r.status === "rejected").length;

    return NextResponse.json({ ok: true, sent, failed, total: subs.length });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: String(err) },
      { status: 500 },
    );
  }
}
