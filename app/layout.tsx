import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";

import { Providers } from "@/components/providers";
import { DoshaAccent } from "@/components/shell/dosha-accent";
import { doshaAt } from "@/lib/dosha";
import { renderSettings, uiPreferencesOf } from "@/lib/settings";
import { minuteOfDayInZone } from "@/lib/time";

import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: { default: "Sadhana", template: "%s · Sadhana" },
  description:
    "A sunrise-anchored dinacharya: today's muhurta windows computed for where you are, the routine built on them, and the evidence behind each part of it.",
  applicationName: "Sadhana",
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, title: "Sadhana", statusBarStyle: "black-translucent" },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  // Hex rather than oklch: `theme-color` is read by the OS chrome, which does not parse
  // the newer colour functions everywhere. These match --surface-0 in both themes.
  themeColor: [
    { media: "(prefers-color-scheme: dark)", color: "#14161c" },
    { media: "(prefers-color-scheme: light)", color: "#fafafb" },
  ],
};

// The shell reads the settings row, so it cannot be prerendered at build time.
export const dynamic = "force-dynamic";

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const settings = await renderSettings();
  const ui = uiPreferencesOf(settings);

  // Rendered server-side so the first paint is already the right hue; `DoshaAccent` only
  // takes over the updates. `suppressHydrationWarning` covers the one-in-240 case where
  // the clock crosses a dosha boundary between this render and hydration.
  const dosha = doshaAt(minuteOfDayInZone(new Date(), ui.timeZone)).dosha;

  return (
    <html
      lang="en"
      data-theme={ui.theme}
      data-dosha={ui.doshaAccent ? dosha : undefined}
      data-dosha-accent={ui.doshaAccent ? undefined : "off"}
      data-reduce-motion={ui.reduceMotion ? "true" : undefined}
      data-scroll-behavior="smooth"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <body className="flex min-h-full flex-col">
        <Providers>
          <DoshaAccent timeZone={ui.timeZone} enabled={ui.doshaAccent} />
          {children}
        </Providers>
      </body>
    </html>
  );
}
