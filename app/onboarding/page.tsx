/**
 * First run.
 *
 * Outside the `(app)` route group on purpose: that group's layout redirects anything
 * un-onboarded here, so a page inside it would redirect to itself forever. It also means no
 * shell  --  no nav, no dosha strip  --  because there is nothing to navigate to yet.
 */

import { redirect } from "next/navigation";

import { OnboardingFlow } from "@/components/onboarding/onboarding-flow";
import { customLocation, type Draft, type LocationDraft } from "@/components/onboarding/draft";
import { INDIAN_CITIES } from "@/data/cities-in";
import { isOnboarded, renderSettings } from "@/lib/settings";

export const metadata = {
  title: "Set up",
  description: "Three answers, and the app can compute your day.",
};

export default async function OnboardingPage() {
  const settings = await renderSettings();
  if (isOnboarded(settings)) redirect("/");

  // The row already exists with defaults, so onboarding starts from those rather than from
  // nothing. A stored location that matches the shipped table is offered as that city, so
  // the picker shows it selected instead of quietly resetting to Hyderabad.
  const listed = INDIAN_CITIES.find(
    (city) => city.name === settings.city && city.region === settings.region,
  );
  const location: LocationDraft = listed
    ? { kind: "city", cityId: listed.id }
    : customLocation(settings.latitude, settings.longitude, settings.timeZone);

  const initial: Draft = {
    location,
    chronotype: settings.chronotype,
    wakeOffsetMinutes: settings.wakeOffsetMinutes,
    sleepTargetMinutes: settings.sleepTargetMinutes,
    activeTrack: settings.activeTrack,
  };

  return (
    <main className="mx-auto w-full max-w-2xl px-4 py-8 sm:px-6 sm:py-12">
      <header className="mb-6">
        <p className="text-xs font-semibold tracking-[0.2em] text-accent uppercase">Sadhana</p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight text-text-1">
          A day measured by the sun, not the clock
        </h1>
        <p className="mt-2 text-sm leading-relaxed text-text-2">
          Brahma Muhurta shifts by more than an hour and a half between Indian cities, and again
          across the year. Three answers and the app can work out yours  --  and keep working it out
          every morning without being asked.
        </p>
      </header>

      <OnboardingFlow initial={initial} />

      <p className="mt-8 text-xs leading-relaxed text-text-3">
        Everything is stored in a file on this machine. Nothing is sent anywhere, there is no
        account, and none of it is medical advice  --  the app shows its reasoning and its sources
        so you can judge each part for yourself.
      </p>
    </main>
  );
}
