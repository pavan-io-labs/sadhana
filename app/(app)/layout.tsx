import type { ReactNode } from "react";
import { redirect } from "next/navigation";

/**
 * Everything behind first-run onboarding.
 *
 * The gate lives here rather than in the root layout because `/onboarding` needs the same
 * fonts, theme and CSS but must *not* be redirected  --  a redirect that also covers the
 * onboarding route is an infinite loop. Route groups do not appear in the URL, so `/` is
 * still `/`.
 */

import { AppShell } from "@/components/shell/app-shell";
import { isOnboarded, renderSettings, uiPreferencesOf } from "@/lib/settings";

export default async function AppLayout({ children }: { children: ReactNode }) {
  const settings = await renderSettings();
  if (!isOnboarded(settings)) redirect("/onboarding");

  const ui = uiPreferencesOf(settings);
  return (
    <AppShell city={ui.city} timeZone={ui.timeZone} clock24h={ui.clock24h}>
      {children}
    </AppShell>
  );
}
