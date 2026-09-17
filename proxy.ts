/**
 * Next.js proxy  --  auth gate for non-localhost deployments.
 *
 * On localhost, everything is open. When deployed, a passcode cookie must be set
 * via /api/auth or the request is rejected. This FAILS CLOSED: if the app detects
 * a non-localhost host without SADHANA_PASSCODE set, it refuses to serve rather
 * than silently exposing health data.
 */

import { NextResponse, type NextRequest } from "next/server";

const PUBLIC_PATHS = ["/_next", "/favicon.ico", "/icons", "/manifest.webmanifest", "/api/auth"];

function isPublicPath(pathname: string): boolean {
  return PUBLIC_PATHS.some((p) => pathname.startsWith(p));
}

function isLocalhost(host: string): boolean {
  const hostname = host.split(":")[0];
  return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "[::1]";
}

export function proxy(request: NextRequest) {
  const host = request.headers.get("host") ?? "";

  // Localhost  --  no auth required.
  if (isLocalhost(host)) {
    return NextResponse.next();
  }

  // Non-localhost  --  auth required.
  if (isPublicPath(request.nextUrl.pathname)) {
    return NextResponse.next();
  }

  const passcode = process.env.SADHANA_PASSCODE;

  // FAIL CLOSED: if no passcode is configured on a non-localhost host, refuse to serve.
  if (!passcode) {
    return new NextResponse(
      JSON.stringify({
        error: "Sadhana is not configured for remote access. Set SADHANA_PASSCODE in .env.local.",
      }),
      { status: 503, headers: { "Content-Type": "application/json" } },
    );
  }

  // Check the signed cookie.
  const cookie = request.cookies.get("sadhana-auth");
  if (cookie?.value === passcode) {
    return NextResponse.next();
  }

  // Not authenticated  --  redirect to a simple auth page or return 401.
  return new NextResponse(
    JSON.stringify({ error: "Authentication required" }),
    { status: 401, headers: { "Content-Type": "application/json" } },
  );
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization)
     * - favicon.ico
     */
    "/((?!_next/static|_next/image|favicon.ico).*)",
  ],
};
