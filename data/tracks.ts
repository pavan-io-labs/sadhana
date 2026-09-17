/**
 * The two training tracks, as the picker and the Train view describe them.
 *
 * Data, not prose in a component, because three views need the same words: onboarding
 * (choosing), Settings (changing), and Train (the session list). The week shapes here are
 * summaries  --  the actual sessions become blocks in the routine presets.
 */

import type { TrackId } from "@/lib/validators";

export type { TrackId };

export type Track = {
  id: TrackId;
  label: string;
  /** One line, shown next to the radio. */
  tagline: string;
  /** Who it is the right answer for. */
  forWhom: string;
  /** Typical week, one line per training day. */
  weekShape: readonly string[];
  /** Minutes of movement on a normal day, used for expectation-setting. */
  dailyMinutes: string;
  /** Stated plainly at the point of choosing, not buried in the Train view. */
  cautions: readonly string[];
};

export const TRACKS: readonly Track[] = [
  {
    id: "gentle",
    label: "Gentle  --  Track A",
    tagline: "Consistency first. Enough load to change something, little enough to keep every day.",
    forWhom:
      "Starting out, coming back from a break, sleeping under seven hours, or already spending most of your energy on work.",
    weekShape: [
      "Every morning · joint mobility, then 6–8 rounds of Surya Namaskar at a breathing pace",
      "Twice a week · full-body strength, 3 exercises, 3 sets each, stopping 2 reps short of failure",
      "Most days · a 20–30 minute walk, outdoors and within an hour of waking",
      "Once a week · a longer easy walk or swim, nothing measured",
    ],
    dailyMinutes: "30–45 min",
    cautions: [
      "Surya Namaskar is done on an empty stomach; if you have eaten, wait two hours.",
      "Strength work is the one thing here that should not be done fasted  --  see the fuel note on the session.",
    ],
  },
  {
    id: "hardcore",
    label: "Hardcore  --  Track B",
    tagline: "A real training block, with the recovery cost that implies and a deload every fourth week.",
    forWhom:
      "Already training consistently, sleeping seven and a half hours or more, and able to protect an early bedtime.",
    weekShape: [
      "Every morning · mobility, then 12 rounds of Surya Namaskar as a warm-up rather than the session",
      "Four days · upper/lower split, main lift progressed by 2.5 kg once every set hit its reps",
      "Two days · conditioning  --  intervals or a loaded carry, kept away from the strength days' muscles",
      "One day · complete rest. Not optional; it is where the adaptation happens",
      "Every fourth week · deload  --  same sessions, roughly 60% of the volume",
    ],
    dailyMinutes: "60–90 min",
    cautions: [
      "This only works if sleep holds. Three days of rising resting heart rate is the signal to deload early, and the app will say so.",
      "Heavy strength sessions are fed, not fasted. Training hard on an empty stomach costs more than it saves.",
      "Do not start here and fix sleep later. If lights-out is not yet reliable, Track A for four weeks is the faster route.",
    ],
  },
];

const BY_ID = new Map(TRACKS.map((t) => [t.id, t]));

export function findTrack(id: TrackId): Track {
  const track = BY_ID.get(id);
  if (!track) throw new Error(`Unknown track: ${id}`);
  return track;
}
