#!/usr/bin/env node
/**
 * Generate a VAPID key pair for Web Push, and print it as .env.local lines.
 *
 *   npm run keys:vapid
 *
 * The private key must never reach the browser, so it is deliberately *not* prefixed
 * `NEXT_PUBLIC_`. The public key is safe to expose and is what the service worker
 * subscribes with. Nothing is written to disk: the output is pasted into `.env.local`
 * so this script can never clobber keys that are already in use - replacing a key pair
 * invalidates every existing subscription.
 *
 * Push is optional. The app runs, computes and tracks without any of this; only
 * notifications with the window closed need it.
 */

import webpush from "web-push";

const { publicKey, privateKey } = webpush.generateVAPIDKeys();

process.stdout.write(
  [
    "# Web Push (VAPID). Paste into .env.local - private key server-side only.",
    `NEXT_PUBLIC_VAPID_PUBLIC_KEY=${publicKey}`,
    `VAPID_PRIVATE_KEY=${privateKey}`,
    "# A mailto: or https: URL identifying you to the push service.",
    "VAPID_SUBJECT=mailto:you@example.com",
    "",
  ].join("\n"),
);
