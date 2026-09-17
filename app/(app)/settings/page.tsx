/**
 * Settings.
 *
 * A thin server wrapper: read the row, hand it to the form as its initial state. Every
 * mutation goes through `PATCH /api/settings` so validation happens in exactly one place,
 * and the form re-derives its preview locally rather than round-tripping to see the effect.
 */

import { SettingsForm, type SettingsFormState } from "@/components/settings/settings-form";
import { customLocation, type LocationDraft } from "@/components/onboarding/draft";
import { INDIAN_CITIES } from "@/data/cities-in";
import { renderSettings } from "@/lib/settings";

export const metadata = {
  title: "Settings",
  description: "Location, muhurta mode, sleep target and track.",
};

export default async function SettingsPage() {
  const settings = await renderSettings();

  const listed = INDIAN_CITIES.find(
    (city) => city.name === settings.city && city.region === settings.region,
  );
  const location: LocationDraft = listed
    ? { kind: "city", cityId: listed.id }
    : customLocation(settings.latitude, settings.longitude, settings.timeZone);

  const initial: SettingsFormState = {
    location,
    chronotype: settings.chronotype,
    wakeOffsetMinutes: settings.wakeOffsetMinutes,
    sleepTargetMinutes: settings.sleepTargetMinutes,
    activeTrack: settings.activeTrack,
    muhurtaMode: settings.muhurtaMode,
    theme: settings.theme,
    clock24h: settings.clock24h,
    doshaAccent: settings.doshaAccent,
    reduceMotion: settings.reduceMotion,
  };

  return (
    <div className="space-y-4">
      <header>
        <h1 className="text-xl font-semibold tracking-tight text-text-1">Settings</h1>
        <p className="mt-1 text-sm text-text-3">
          Stored in a local SQLite file. Changing your location recomputes every time in the app
          for the new latitude  --  nothing is cached against the old one.
        </p>
      </header>

      <SettingsForm initial={initial} />
    </div>
  );
}
