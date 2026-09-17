/**
 * The Timeline  --  the routine itself, edited.
 *
 * This page assembles its own view rather than calling `loadDay`, and the difference is the whole
 * reason it does: Today *judges* a day, so it wants the enabled blocks, the marks and the
 * advisories. The Timeline *edits* the routine, so it wants every block  --  the switched-off ones and
 * the ones today's weekday mask excludes included  --  and no marks at all. Reusing `loadDay` would
 * mean either a list that hides half its rows or a second, differently-shaped argument on a
 * function four other surfaces already depend on.
 *
 * The preset catalogue is read here and handed down as three scalars each. Importing
 * `data/routines.ts` into the picker would pull four complete timetables into the client bundle in
 * order to render four names.
 */

import {
  type PresetOption,
  type RoutineOption,
  RoutinePicker,
} from "@/components/timeline/routine-picker";
import { TimelineEditor } from "@/components/timeline/timeline-editor";
import { ROUTINE_PRESETS } from "@/data/routines";
import { ensureRoutine, listRoutines } from "@/lib/blocks";
import { buildDayPlan } from "@/lib/day";
import { dayInputFromSettings, renderSettings } from "@/lib/settings";
import { formatLongDate, todayInZone } from "@/lib/time";

export const metadata = {
  title: "Timeline",
  description: "The routine itself: anchors, offsets, and what they come to today.",
};

export default async function TimelinePage() {
  const settings = await renderSettings();
  const date = todayInZone(settings.timeZone);
  const plan = buildDayPlan(date, dayInputFromSettings(settings));

  // Sequential rather than a `Promise.all`: `ensureRoutine` installs the default preset on a
  // database that has never had one, and the list has to be read *after* that row exists or the
  // picker would offer to install the routine the page is already showing.
  const installed = await ensureRoutine();
  const rows = await listRoutines();

  const routines: RoutineOption[] = rows.map((row) => ({
    id: row.id,
    slug: row.slug,
    name: row.name,
    description: row.description,
    isPreset: row.isPreset,
  }));

  const held = new Set(rows.map((row) => row.slug));
  const uninstalled: PresetOption[] = ROUTINE_PRESETS.filter((preset) => !held.has(preset.id)).map(
    (preset) => ({
      id: preset.id,
      name: preset.name,
      tagline: preset.tagline,
      blockCount: preset.blocks.length,
      wakeOffsetMinutes: preset.wakeOffsetMinutes,
      sleepTargetMinutes: preset.sleepTargetMinutes,
    }),
  );

  return (
    <div className="space-y-4">
      <header>
        <h1 className="text-xl font-semibold tracking-tight text-text-1">Timeline</h1>
        <p className="mt-1 text-sm leading-relaxed text-text-3">
          A block holds an offset from an anchor, never a clock time  --  so one edit re-times it
          correctly for every latitude and every season. The times beside each row are what today,{" "}
          {formatLongDate(date)} in {plan.place.city}, comes to.
        </p>
      </header>

      <TimelineEditor
        plan={plan}
        blocks={installed.blocks}
        clock24h={settings.clock24h}
        routineName={installed.routine.name}
      />

      <RoutinePicker
        routines={routines}
        uninstalled={uninstalled}
        activeId={installed.routine.id}
        activeIsPreset={installed.routine.isPreset}
        activeSlug={installed.routine.slug}
      />
    </div>
  );
}
