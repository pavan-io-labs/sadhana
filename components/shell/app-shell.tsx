import type { ReactNode } from "react";

/**
 * The application frame.
 *
 * Two layouts from one tree: a sidebar beside the content from `lg` up, and a top bar plus
 * bottom tab bar below it. Nothing is duplicated  --  the same nav data renders in both
 * places, and the only branch is which of the two is visible.
 *
 * A server component: it reads the clock once for the first paint of `DoshaStrip`, which
 * then keeps itself current on the client.
 */

import { DoshaStrip } from "@/components/shell/dosha-strip";
import { CurrentViewLabel, SidebarNav, TabBarNav } from "@/components/shell/nav";

/** A sunrise: the thing the whole app is anchored to. */
function BrandMark() {
  return (
    <span
      aria-hidden
      className="grid size-8 shrink-0 place-items-center rounded-lg bg-accent/12 text-accent"
    >
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        className="size-5"
      >
        <path d="M4 18h16" />
        <path d="M7.5 18a4.5 4.5 0 0 1 9 0" />
        <path d="M12 4.5v2M5.6 7.4l1.4 1.4M18.4 7.4 17 8.8" />
      </svg>
    </span>
  );
}

export function AppShell({
  city,
  timeZone,
  clock24h,
  children,
}: {
  city: string;
  timeZone: string;
  clock24h: boolean;
  children: ReactNode;
}) {
  const nowIso = new Date().toISOString();

  return (
    <div className="flex min-h-full flex-1 flex-col">
      <a
        href="#main"
        className="sr-only rounded-lg bg-surface-2 px-3 py-2 text-sm font-medium text-text-1 focus:not-sr-only focus:absolute focus:left-3 focus:top-3 focus:z-50"
      >
        Skip to content
      </a>

      <header className="sticky top-0 z-20 flex items-center justify-between gap-3 border-b border-line bg-surface-1/95 px-4 py-2.5 backdrop-blur lg:hidden">
        <div className="flex min-w-0 items-center gap-2.5">
          <BrandMark />
          <span className="min-w-0">
            <span className="block truncate text-sm font-semibold text-text-1">
              <CurrentViewLabel />
            </span>
            <span className="block text-[0.6875rem] uppercase tracking-wide text-text-3">
              Sadhana
            </span>
          </span>
        </div>
        <DoshaStrip timeZone={timeZone} clock24h={clock24h} nowIso={nowIso} compact />
      </header>

      <div className="flex flex-1">
        <aside className="hidden shrink-0 border-r border-line bg-surface-1 lg:sticky lg:top-0 lg:flex lg:h-screen lg:w-68 lg:flex-col">
          <div className="flex items-center gap-2.5 px-4 py-4">
            <BrandMark />
            <span className="min-w-0">
              <span className="block text-sm font-semibold tracking-tight text-text-1">
                Sadhana
              </span>
              <span className="block truncate text-xs text-text-3">Dinacharya, by the sun</span>
            </span>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto px-2 py-1">
            <SidebarNav />
          </div>

          <div className="border-t border-line px-4 py-3.5">
            <DoshaStrip timeZone={timeZone} clock24h={clock24h} nowIso={nowIso} />
            <p className="mt-3 flex items-center gap-1.5 text-xs text-text-3">
              <svg
                aria-hidden
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="size-3.5 shrink-0"
              >
                <path d="M12 21s7-6.3 7-11a7 7 0 1 0-14 0c0 4.7 7 11 7 11Z" />
                <circle cx="12" cy="10" r="2.5" />
              </svg>
              <span className="truncate">{city}</span>
            </p>
          </div>
        </aside>

        <main id="main" className="min-w-0 flex-1 px-4 pb-6 pt-5 sm:px-6 lg:px-8 lg:py-8">
          <div className="mx-auto w-full max-w-4xl">{children}</div>
        </main>
      </div>

      <div className="sticky bottom-0 z-20 lg:hidden">
        <TabBarNav />
      </div>
    </div>
  );
}
