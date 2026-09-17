/**
 * The four shipped routines.
 *
 * Data, not code: each preset is a list of anchored intentions, and the engine in
 * `lib/schedule.ts` turns them into today's clock times. Onboarding installs one of these;
 * the Timeline can install any of them, and everything after that is the user's own edit.
 *
 * The four are two axes crossed once. **Traditional** and **Sandhya** are day *shapes*  -- 
 * how early the day starts and how much of it is practice  --  with no training split.
 * **Gentle** and **Hardcore** are the two researched tracks, each carried on a Sandhya-like
 * shape, so choosing a track in onboarding also chooses a whole day.
 *
 * Timings were laid out against Hyderabad on the March equinox  --  2026-03-20, where the app
 * computes sunrise 06:20, solar noon 12:24 and sunset 18:27  --  and then swept over a full year
 * at four latitudes to find where they break. `tests/schedule.test.ts` asserts both.
 *
 * **Why the offsets are grouped the way they are.** Of the five moving anchors, only three
 * move *independently*: `sunrise`, `solarNoon` and `sunset`. `wake` and `bedtime` are both
 * derived from sunrise  --  bedtime from tomorrow's  --  so `sunrise → bedtime` is fixed at
 * `1440 + wakeOffset − sleepTarget`, within a minute, at every latitude and in every season.
 * That makes sunrise, wake and bedtime one rigid family, and it is why nearly every block
 * here hangs off one of those three: blocks inside the family cannot drift into each other,
 * ever. Only two junctions per day cross into the drifting anchors, and each is given the
 * whole seasonal swing as slack:
 *
 *  - **Morning into midday**  --  `settle` ends on a sunrise offset, `deepWork` starts on a
 *    solarNoon offset. Hyderabad's sunrise→noon span runs 332–395 minutes over the year and
 *    Guwahati's 315–414, so the junction is given the larger of the two as slack and shows up as
 *    a longer or shorter pause before the hard thing. The most harmless place in the day to
 *    spend it.
 *  - **Afternoon into evening**  --  the last solarNoon block ends by noon + 180, the first
 *    bedtime block starts at bedtime − 300.
 *
 * Nothing else crosses. In particular there is **no sunset-anchored block**, though the obvious
 * candidate exists: Sayam Sandhya, the evening junction. Sunset→bedtime swings 110–235 minutes
 * at Hyderabad and 73–270 at Guwahati, so a block pinned there collides with the evening on 41%
 * to 75% of days depending on the preset  --  measured over 2026, not guessed. The junction is
 * instead left as what `lib/muhurta.ts` already computes: a window marked on the dial, exactly
 * as the morning one is. See `eveningSit` below.
 *
 * The result is that all four presets are collision-free across the whole year from Trivandrum
 * (8.5°N) to Guwahati (26.1°N), which is where India mostly lives. Further north the seasonal
 * swing outgrows the slack  --  Srinagar at 34°N overlaps by up to a quarter of an hour at the
 * morning junction in midwinter  --  and `resolveDay` reports that in the Timeline rather than
 * pretending otherwise.
 *
 * Two rules the numbers obey, because the rules engine will otherwise flag the app's own
 * presets:
 *
 *  - Daylight starts within 30 minutes of sunrise, or within an hour of waking, whichever of
 *    those two moments is later. Stated that way because the strict presets wake before there
 *    is any daylight to get: Traditional is up 75 minutes before sunrise, so its outdoor block
 *    lands 80 minutes after waking and no arrangement of the morning would improve on that.
 *    `lib/rules.ts` uses the same disjunction, which is why none of the four trips it.
 *  - The last meal ends 185 minutes before lights out  --  three hours plus a little, and true by
 *    construction rather than by season, since dinner and lights out are in the same family.
 *    In winter that also puts dinner before sunset, which is what the tradition asks; in
 *    summer it cannot, and the tradition loses that one to the sleep.
 *
 * Pure data. No DB, no React.
 */

import {
  type BlockAnchor,
  type BlockCategory,
  type BlockFuel,
  EVERY_DAY,
  maskOf,
  type ScheduleBlock,
  WEEKDAYS_ONLY,
} from "@/lib/schedule";
import type { TrackId } from "@/lib/validators";

/** One block before it has an id or a routine. Defaults match the database column defaults. */
export type BlockSeed = {
  title: string;
  detail?: string;
  category: BlockCategory;
  /** Defaults to `sunrise`, which is the anchor most blocks actually want. */
  anchor?: BlockAnchor;
  offsetMinutes: number;
  durationMinutes: number;
  fuel?: BlockFuel;
  weekdayMask?: number;
  notify?: boolean;
  notifyLeadMinutes?: number;
  icon?: string;
  scienceIds?: readonly string[];
  href?: string;
};

export const PRESET_IDS = ["traditional", "sandhya", "gentle", "hardcore"] as const;

export type PresetId = (typeof PRESET_IDS)[number];

export type RoutinePreset = {
  id: PresetId;
  name: string;
  /** One line, shown next to the choice. */
  tagline: string;
  /** A paragraph: what the shape assumes, and who it is wrong for. */
  description: string;
  /** Applied to settings along with the blocks, because the shape assumes them. */
  wakeOffsetMinutes: number;
  sleepTargetMinutes: number;
  /** The track whose sessions these blocks are, if any. */
  track: TrackId | null;
  blocks: readonly BlockSeed[];
};

/* ------------------------------------------------------- the shared day, in pieces */

/*
 * The blocks whose wording is the same in every preset, written once. Each maker takes only
 * the numbers that differ, so a preset below reads as a timetable rather than as prose
 * repeated four times  --  and a change to how the app talks about, say, abhyanga happens in
 * one place.
 */

const wakeUp = (): BlockSeed => ({
  title: "Up, and no phone",
  detail:
    "Feet on the floor before the mind negotiates. The first screen of the day sets the next four hours, so it waits.",
  category: "sleep",
  anchor: "wake",
  offsetMinutes: 0,
  durationMinutes: 5,
  notify: true,
  notifyLeadMinutes: 0,
  icon: "sun",
  scienceIds: ["sleep-regularity"],
});

const water = (): BlockSeed => ({
  title: "Warm water, tongue, teeth",
  detail:
    "Two glasses of warm water, scrape the tongue, then brush. Ushapan and jihva nirlekhana  --  the cheapest habits in the whole routine.",
  category: "hygiene",
  anchor: "wake",
  offsetMinutes: 5,
  durationMinutes: 13,
  icon: "droplet",
  scienceIds: ["oral-hygiene", "hydration-morning"],
});

const pvt = (): BlockSeed => ({
  title: "PVT  --  sixty seconds",
  detail:
    "Tap as soon as the dot appears. Run at the same point every morning it becomes the one objective number in the app: your own reaction time against your own sleep.",
  category: "mindgym",
  anchor: "wake",
  offsetMinutes: 18,
  durationMinutes: 2,
  icon: "brain",
  scienceIds: ["pvt-sleep-debt"],
  href: "/mindgym/pvt",
});

const bath = (offsetMinutes: number): BlockSeed => ({
  title: "Bath",
  detail: "After the movement, not before. Cool to lukewarm; hot water on the scalp is a habit worth losing.",
  category: "hygiene",
  offsetMinutes,
  durationMinutes: 18,
  icon: "droplet",
});

const standAndLookFar = (offsetMinutes: number): BlockSeed => ({
  title: "Stand, water, look far away",
  detail:
    "Twelve minutes off the chair before the meal. Twenty seconds of looking at something distant is the part that helps the eyes.",
  category: "admin",
  anchor: "solarNoon",
  offsetMinutes,
  durationMinutes: 12,
  weekdayMask: WEEKDAYS_ONLY,
  icon: "walk",
});

const feetAfterLunch = (offsetMinutes: number): BlockSeed => ({
  title: "Ten minutes on your feet",
  detail:
    "A slow walk after the main meal  --  shatapavali. It blunts the glucose rise and it is the reason the afternoon is not a write-off.",
  category: "light",
  anchor: "solarNoon",
  offsetMinutes,
  durationMinutes: 10,
  icon: "walk",
  scienceIds: ["post-meal-walk"],
});

/**
 * The evening sit  --  the counterpart to the morning one, and deliberately *not* sunset-anchored.
 *
 * The tradition asks for a sit at both junctions, and the morning one gets that for free: wake
 * is derived from sunrise, so whatever the preset puts first stays parked on Pratah Sandhya all
 * year without being anchored to it. In three presets that is `morningSit`; in Sandhya, which
 * wakes only half an hour early, it is the daylight block and the glass of water. Which block
 * holds the junction differs  --  that the junction is held does not.
 *
 * The evening has no such luck. Sunset drifts 110–235 minutes
 * from lights out over a Hyderabad year  --  73–270 at Guwahati  --  so a sunset-anchored evening
 * block floats straight through dinner and the hour after it. Measured over 2026, that is a
 * collision on 41–75% of days, and a warning that fires two days in three is a warning the user
 * learns to dismiss.
 *
 * So the sit is counted back from lights out, where it holds all year, and the junction itself
 * stays what `lib/muhurta.ts` already makes it: a computed window  --  `sayamSandhya(sunset, …)`,
 * the first muhurta after sunset  --  marked on the dial next to Brahma Muhurta and Abhijit. The
 * same treatment the *morning* junction gets. Nothing is lost except the false precision of
 * pinning a 12-minute block to it.
 */
const eveningSit = (offsetMinutes: number, durationMinutes: number): BlockSeed => ({
  title: "Sit again  --  the evening quiet",
  detail:
    "Twenty minutes, and the second-hardest habit in the day to keep. The dial marks Sayam Sandhya, the junction after sunset  --  if it happens to fall near this, sit then instead.",
  category: "practice",
  anchor: "bedtime",
  offsetMinutes,
  durationMinutes,
  icon: "lotus",
  scienceIds: ["evening-stillness"],
  href: "/practice",
});

const family = (offsetMinutes: number, durationMinutes: number): BlockSeed => ({
  title: "People, unhurried",
  detail: "Scheduled because it is the first thing an optimised day quietly deletes.",
  category: "social",
  anchor: "bedtime",
  offsetMinutes,
  durationMinutes,
  icon: "people",
});

const screensDown = (offsetMinutes: number): BlockSeed => ({
  title: "Screens down, lights down",
  detail:
    "Overhead lights off, lamps only, devices away. This is the block that decides whether the wake target is realistic tomorrow.",
  category: "winddown",
  anchor: "bedtime",
  offsetMinutes,
  durationMinutes: 20,
  notify: true,
  notifyLeadMinutes: 10,
  icon: "moon",
  scienceIds: ["evening-light", "sleep-onset"],
});

const nidra = (offsetMinutes: number, durationMinutes: number): BlockSeed => ({
  title: "Yoga Nidra, or something on paper",
  detail: "Either works. What does not work is deciding at the time.",
  category: "winddown",
  anchor: "bedtime",
  offsetMinutes,
  durationMinutes,
  icon: "book",
  scienceIds: ["nsdr"],
  href: "/practice",
});

const abhyanga = (offsetMinutes: number): BlockSeed => ({
  title: "Abhyanga  --  feet and scalp",
  detail:
    "Warm sesame oil, ten minutes, feet last. Skip it with a fever, an infection, indigestion, or during menstruation.",
  category: "hygiene",
  anchor: "bedtime",
  offsetMinutes,
  durationMinutes: 12,
  icon: "oil",
  scienceIds: ["abhyanga"],
  href: "/practice",
});

const lightsOut = (): BlockSeed => ({
  title: "Lights out",
  detail:
    "Not “in bed”  --  asleep. Everything upstream of this block exists so that this one is possible.",
  category: "sleep",
  anchor: "bedtime",
  offsetMinutes: 0,
  durationMinutes: 5,
  notify: true,
  notifyLeadMinutes: 15,
  icon: "moon",
  scienceIds: ["sleep-duration", "sleep-regularity"],
});

const settle = (offsetMinutes: number, durationMinutes: number): BlockSeed => ({
  title: "Settle  --  pick the one thing",
  detail:
    "Inbox triage and one decision: what is the single task that would make today count. Written down, not remembered.",
  category: "admin",
  offsetMinutes,
  durationMinutes,
  weekdayMask: WEEKDAYS_ONLY,
  icon: "monitor",
});

const deepWork = (offsetMinutes: number, durationMinutes: number): BlockSeed => ({
  title: "Deep work  --  the hard thing first",
  detail:
    "The morning Kapha–Pitta handover is the steadiest attention you will get. Spend it on the task you would rather avoid, not on mail.",
  category: "work",
  anchor: "solarNoon",
  offsetMinutes,
  durationMinutes,
  weekdayMask: WEEKDAYS_ONLY,
  icon: "monitor",
  scienceIds: ["circadian-cognition", "hard-task-timing"],
});

const lunch = (offsetMinutes: number, durationMinutes: number): BlockSeed => ({
  title: "Lunch  --  the main meal of the day",
  detail:
    "The largest meal, eaten at the Pitta peak when digestion is strongest. Getting this one right is most of what makes an early, light dinner easy.",
  category: "food",
  anchor: "solarNoon",
  offsetMinutes,
  durationMinutes,
  fuel: "any",
  icon: "bowl",
  scienceIds: ["meal-timing", "circadian-metabolism"],
  href: "/nourish",
});

const meetings = (offsetMinutes: number, durationMinutes: number): BlockSeed => ({
  title: "Meetings and correspondence",
  detail:
    "The post-lunch dip is real. Put the work that tolerates a duller mind here, and stop apologising for it.",
  category: "admin",
  anchor: "solarNoon",
  offsetMinutes,
  durationMinutes,
  weekdayMask: WEEKDAYS_ONLY,
  icon: "monitor",
});

const secondFocus = (offsetMinutes: number, durationMinutes: number): BlockSeed => ({
  title: "Second focus block",
  detail: "The late-afternoon Vata window: good for connecting things, poor for grinding through them.",
  category: "work",
  anchor: "solarNoon",
  offsetMinutes,
  durationMinutes,
  weekdayMask: WEEKDAYS_ONLY,
  icon: "monitor",
});

const daylight = (offsetMinutes: number, durationMinutes: number): BlockSeed => ({
  title: `Outside  --  ${durationMinutes} minutes of daylight`,
  detail:
    "The single highest-return thing in this routine, and the one most often skipped. Outdoors, no sunglasses, no window in between.",
  category: "light",
  anchor: "sunrise",
  offsetMinutes,
  durationMinutes,
  notify: true,
  notifyLeadMinutes: 5,
  icon: "walk",
  scienceIds: ["morning-light", "circadian-entrainment"],
});

const morningSit = (offsetMinutes: number, durationMinutes: number): BlockSeed => ({
  title: "Pratah Sandhya  --  the morning sit",
  detail:
    "The reason the early wake is worth anything. Sit before the day has an opinion about you: spine up, eyes closed, nothing to achieve.",
  category: "practice",
  anchor: "wake",
  offsetMinutes,
  durationMinutes,
  fuel: "empty",
  notify: true,
  notifyLeadMinutes: 5,
  icon: "lotus",
  scienceIds: ["meditation-attention", "morning-stillness"],
  href: "/practice",
});

const pranayama = (offsetMinutes: number, durationMinutes: number): BlockSeed => ({
  title: "Pranayama  --  Nadi Shodhana, then Bhramari",
  detail:
    "Empty stomach, always. Kapalabhati and Bhastrika belong in this slot and nowhere else  --  never within three hours of a meal.",
  category: "practice",
  anchor: "wake",
  offsetMinutes,
  durationMinutes,
  fuel: "empty",
  icon: "wind",
  scienceIds: ["slow-breathing-hrv", "bhramari"],
  href: "/practice",
});

const suryaNamaskar = (
  offsetMinutes: number,
  durationMinutes: number,
  rounds: number,
): BlockSeed => ({
  title: `Mobility, then ${rounds} Surya Namaskar`,
  detail:
    "Joints first, then the rounds, at whatever pace lets you keep breathing through the nose. Count rounds, not minutes.",
  category: "movement",
  anchor: "sunrise",
  offsetMinutes,
  durationMinutes,
  fuel: "empty",
  icon: "sun",
  scienceIds: ["surya-namaskar", "morning-movement"],
  href: "/train",
});

const breakfast = (offsetMinutes: number, durationMinutes: number): BlockSeed => ({
  title: "Breakfast, and the day's only coffee",
  detail:
    "Caffeine here and nowhere later. The app computes your cutoff at eight and a half hours before lights out, and an afternoon cup is the most common reason an early wake stops working.",
  category: "food",
  anchor: "sunrise",
  offsetMinutes,
  durationMinutes,
  fuel: "any",
  icon: "cup",
  scienceIds: ["caffeine-half-life", "protein-morning"],
  href: "/nourish",
});

/**
 * The afternoon walk, and the slot a training session shares with it.
 *
 * Anchored to lights out, not to sunset, even though the point of it is daylight. At
 * bedtime − 300 it lands around 17:25 in a Hyderabad December and 16:25 in June, both
 * comfortably before sunset  --  and being in the bedtime family means it cannot drift into
 * dinner, which anchoring it to sunset would let it do by an hour and a half.
 */
const walk = (offsetMinutes: number, durationMinutes: number): BlockSeed => ({
  title: "Walk  --  no headphones",
  detail:
    "Afternoon daylight is a second, weaker dose for the clock, and the walking does the rest. Try it once without anything in your ears.",
  category: "light",
  anchor: "bedtime",
  offsetMinutes,
  durationMinutes,
  icon: "walk",
  scienceIds: ["afternoon-light", "walking-cognition"],
});

/**
 * Dinner, always counted back from lights out.
 *
 * The three-hour gap before sleep is the one number in the evening with real evidence behind
 * it, and anchoring the meal to bedtime is what makes that gap a constant instead of something
 * that happens to hold in March. Every preset uses −215 with a 30-minute meal, so the meal ends
 * 185 minutes before lights out at every latitude and in every season.
 */
const dinner = (offsetMinutes: number, durationMinutes: number): BlockSeed => ({
  title: "Dinner  --  early, light, warm",
  detail:
    "Soup, khichdi, cooked vegetables. Small enough that you could go for a walk afterwards, and finished at least three hours before lights out.",
  category: "food",
  anchor: "bedtime",
  offsetMinutes,
  durationMinutes,
  fuel: "any",
  notify: true,
  notifyLeadMinutes: 15,
  icon: "bowl",
  scienceIds: ["late-eating", "dinner-sleep-gap"],
  href: "/nourish",
});

const eveningReview = (offsetMinutes: number, durationMinutes: number): BlockSeed => ({
  title: "Close the day  --  three numbers and one intention",
  detail:
    "What got done, how the body felt, and the single thing tomorrow is for. Two minutes of writing beats an hour of turning it over in bed.",
  category: "admin",
  anchor: "bedtime",
  offsetMinutes,
  durationMinutes,
  icon: "book",
  href: "/briefing",
});

/**
 * One day of a training split.
 *
 * Anchored to lights out rather than to sunrise, because what actually constrains an evening
 * session is how long before bed it finishes  --  not how long after dawn it starts. `weekdays`
 * is a list rather than a mask so a split reads as Mon/Thu at the call site; the four variants
 * of a track carry disjoint lists, which is what lets them share one slot without colliding.
 */
type TrainingSeed = {
  title: string;
  detail: string;
  weekdays: readonly number[];
  offsetMinutes: number;
  durationMinutes: number;
  fuel: BlockFuel;
  category?: BlockCategory;
  icon?: string;
  scienceIds?: readonly string[];
};

const training = (seed: TrainingSeed): BlockSeed => ({
  title: seed.title,
  detail: seed.detail,
  category: seed.category ?? "training",
  anchor: "bedtime",
  offsetMinutes: seed.offsetMinutes,
  durationMinutes: seed.durationMinutes,
  fuel: seed.fuel,
  weekdayMask: maskOf(seed.weekdays),
  notify: true,
  notifyLeadMinutes: 15,
  icon: seed.icon ?? "dumbbell",
  scienceIds: seed.scienceIds ?? ["strength-training", "training-timing"],
  href: "/train",
});

/* ---------------------------------------------------------------- the four presets */

/*
 * The timetables. Three numbers hold every preset together, and `tests/schedule.test.ts` checks
 * each of them  --  so if you move a block, keep them:
 *
 *  - `settle` ends no more than 315 minutes before `deepWork`'s solarNoon offset. That is
 *    Guwahati's shortest sunrise→noon span, and it is what keeps the morning junction from
 *    closing up in December.
 *  - The last solarNoon-anchored block ends by solarNoon + 180, and the first bedtime-anchored
 *    block starts at bedtime − 300. Same reasoning, other end of the day.
 *  - `dinner` is bedtime − 215 for 30 minutes, everywhere.
 */

export const ROUTINE_PRESETS: readonly RoutinePreset[] = [
  {
    id: "traditional",
    name: "Traditional",
    tagline: "Awake inside Brahma Muhurta. The oldest shape of the day.",
    description:
      "The strict version: up an hour and a quarter before sunrise, most of the pre-dawn spent sitting, and lights out shortly after nine. It claims the whole evening, so it only holds if nothing you care about happens after eight  --  and it is the wrong shape if you have small children, a long commute, or work that reliably runs late. Start here only if you already wake early without an alarm.",
    wakeOffsetMinutes: -75,
    sleepTargetMinutes: 450,
    track: null,
    blocks: [
      wakeUp(),
      water(),
      pvt(),
      morningSit(20, 40),
      pranayama(62, 15),
      daylight(5, 25),
      suryaNamaskar(35, 35, 12),
      bath(73),
      breakfast(95, 27),
      settle(126, 16),
      deepWork(-172, 127),
      standAndLookFar(-45),
      lunch(-20, 45),
      feetAfterLunch(30),
      meetings(45, 100),
      secondFocus(150, 30),
      walk(-300, 30),
      dinner(-215, 30),
      eveningSit(-180, 20),
      family(-140, 45),
      eveningReview(-92, 15),
      abhyanga(-74),
      nidra(-58, 25),
      screensDown(-30),
      lightsOut(),
    ],
  },
  {
    id: "sandhya",
    name: "Sandhya",
    tagline: "Up at the last of the dark. The shape that survives a job.",
    description:
      "Wake half an hour before sunrise, which puts the sit inside Pratah Sandhya  --  the junction the tradition actually asks you to keep, rather than the harder window before it. Nearly eight hours of sleep, an evening that still exists, and the same day as Traditional with an hour less of it. This is the default, and the one to start from if you are not sure.",
    wakeOffsetMinutes: -30,
    sleepTargetMinutes: 465,
    track: null,
    blocks: [
      wakeUp(),
      water(),
      pvt(),
      // Light before the sit, which is the one place Sandhya's order differs from Traditional's.
      // Waking half an hour before sunrise does not leave room for both a 25-minute sit and a
      // daylight block that still starts within 30 minutes of sunrise  --  and of the two, light on
      // the retina is the one with the stronger claim on the first slot.
      daylight(-5, 25),
      morningSit(55, 25),
      pranayama(85, 15),
      suryaNamaskar(74, 25, 8),
      bath(100),
      breakfast(120, 22),
      settle(145, 14),
      deepWork(-155, 110),
      standAndLookFar(-45),
      lunch(-20, 45),
      feetAfterLunch(30),
      meetings(45, 100),
      secondFocus(150, 30),
      walk(-300, 30),
      dinner(-215, 30),
      eveningSit(-180, 20),
      family(-140, 45),
      eveningReview(-92, 15),
      abhyanga(-74),
      nidra(-58, 25),
      screensDown(-30),
      lightsOut(),
    ],
  },
  {
    id: "gentle",
    name: "Gentle  --  Track A",
    tagline: "Enough to change something, little enough to keep.",
    description:
      "The gentle track carried on a Sandhya-shaped day: mobility and eight Surya Namaskar each morning, strength twice a week, a walk on most of the rest, and a full eight hours of sleep. Built to be sustainable rather than impressive  --  so if you already lift three times a week it will read as a step down. Start here anyway after a long gap, or if the last routine you tried lasted nine days.",
    wakeOffsetMinutes: -45,
    sleepTargetMinutes: 480,
    track: "gentle",
    blocks: [
      wakeUp(),
      water(),
      pvt(),
      morningSit(20, 25),
      daylight(2, 25),
      pranayama(75, 15),
      suryaNamaskar(50, 25, 8),
      bath(78),
      breakfast(100, 24),
      settle(128, 15),
      deepWork(-170, 125),
      standAndLookFar(-45),
      lunch(-20, 45),
      feetAfterLunch(30),
      meetings(45, 100),
      secondFocus(150, 30),
      training({
        title: "Strength  --  full body",
        detail:
          "Twice a week, six or seven movements, the last two reps genuinely hard. Eat ninety minutes before; this is the one session that is never done fasted.",
        weekdays: [2, 5],
        offsetMinutes: -300,
        durationMinutes: 45,
        fuel: "fed",
      }),
      training({
        title: "Easy walk",
        detail:
          "Half an hour at a pace you could hold a conversation at. It is not a workout and it is not meant to become one.",
        weekdays: [1, 3, 4, 6],
        offsetMinutes: -300,
        durationMinutes: 30,
        fuel: "any",
        category: "movement",
        icon: "walk",
        scienceIds: ["walking-cognition", "zone-two"],
      }),
      training({
        title: "Long walk  --  an hour and a quarter",
        detail:
          "One slower, longer outing a week, and the only session that asks for a Sunday. Somewhere with trees, if you have the choice.",
        weekdays: [0],
        offsetMinutes: -300,
        durationMinutes: 75,
        fuel: "any",
        category: "movement",
        icon: "walk",
        scienceIds: ["walking-cognition", "nature-exposure"],
      }),
      dinner(-215, 30),
      eveningSit(-180, 20),
      family(-140, 45),
      eveningReview(-92, 15),
      abhyanga(-74),
      nidra(-58, 25),
      screensDown(-30),
      lightsOut(),
    ],
  },
  {
    id: "hardcore",
    name: "Hardcore  --  Track B",
    tagline: "Four lifting days, and a day built around carrying them.",
    description:
      "The hardcore track on the earliest shape that still works: up an hour before sunrise, twelve Surya Namaskar as the morning warm-up, an upper/lower split four days a week, two conditioning days, one genuine rest day, and eight hours of sleep because that is what pays for the load. Every fourth week is a deload and the app will say so. Do not start here  --  it assumes months of consistent training and an afternoon you control.",
    wakeOffsetMinutes: -60,
    sleepTargetMinutes: 480,
    track: "hardcore",
    blocks: [
      wakeUp(),
      water(),
      pvt(),
      morningSit(20, 30),
      pranayama(52, 18),
      daylight(13, 30),
      suryaNamaskar(48, 30, 12),
      bath(81),
      breakfast(103, 24),
      settle(131, 15),
      deepWork(-168, 123),
      standAndLookFar(-45),
      lunch(-20, 45),
      feetAfterLunch(30),
      meetings(45, 95),
      secondFocus(145, 35),
      training({
        title: "Upper body  --  push and pull",
        detail:
          "Add two and a half kilos to a lift only once you have hit every prescribed rep of it. Fed, ninety minutes out.",
        weekdays: [1, 4],
        offsetMinutes: -300,
        durationMinutes: 75,
        fuel: "fed",
      }),
      training({
        title: "Lower body  --  squat, hinge, carry",
        detail:
          "Same progression rule, and the same warning: the last set is where the session is either won or thrown away.",
        weekdays: [3, 6],
        offsetMinutes: -300,
        durationMinutes: 75,
        fuel: "fed",
      }),
      training({
        title: "Conditioning  --  intervals or hill repeats",
        detail:
          "Forty minutes including the warm-up. A banana or three dates twenty minutes before  --  not almonds, because fat slows the stomach down.",
        weekdays: [2, 5],
        offsetMinutes: -300,
        durationMinutes: 40,
        fuel: "light",
        scienceIds: ["hiit-vo2max", "training-timing"],
      }),
      training({
        title: "Rest day  --  walk, stretch, nothing heavy",
        detail:
          "The adaptation happens now, not in the session. Skipping this is how week five turns into an injury.",
        weekdays: [0],
        offsetMinutes: -300,
        durationMinutes: 30,
        fuel: "any",
        category: "movement",
        icon: "walk",
        scienceIds: ["recovery-supercompensation"],
      }),
      dinner(-215, 30),
      eveningSit(-180, 20),
      family(-135, 40),
      eveningReview(-92, 15),
      abhyanga(-74),
      nidra(-58, 25),
      screensDown(-30),
      lightsOut(),
    ],
  },
];

/* ---------------------------------------------------------------------- lookups */

export function findPreset(id: string): RoutinePreset | undefined {
  return ROUTINE_PRESETS.find((preset) => preset.id === id);
}

/** Sandhya, which is also onboarding's own default and the one to recommend. */
export function defaultPreset(): RoutinePreset {
  return findPreset("sandhya") ?? ROUTINE_PRESETS[0];
}

/** The preset carrying a track's sessions, for when the track is changed in Settings. */
export function presetForTrack(track: TrackId): RoutinePreset | undefined {
  return ROUTINE_PRESETS.find((preset) => preset.track === track);
}

/* ----------------------------------------------------------------- seed → block */

/**
 * A seed with every default filled in  --  precisely the row `lib/blocks.ts` inserts.
 *
 * Declared as `ScheduleBlock` minus its id so the two cannot drift: add a scheduling field to
 * the engine and this stops compiling until a default for it has been decided here too.
 */
export type PlantedBlock = Omit<ScheduleBlock, "id">;

/** The defaults, applied once. `sortOrder` is the position in the preset's own list. */
export function plantBlocks(seeds: readonly BlockSeed[]): PlantedBlock[] {
  return seeds.map((seed, index) => ({
    title: seed.title,
    detail: seed.detail ?? "",
    category: seed.category,
    anchor: seed.anchor ?? "sunrise",
    offsetMinutes: seed.offsetMinutes,
    durationMinutes: seed.durationMinutes,
    fuel: seed.fuel ?? "any",
    weekdayMask: seed.weekdayMask ?? EVERY_DAY,
    notify: seed.notify ?? false,
    notifyLeadMinutes: seed.notifyLeadMinutes ?? 5,
    sortOrder: index,
    icon: seed.icon ?? "dot",
    scienceIds: [...(seed.scienceIds ?? [])],
    href: seed.href ?? null,
    enabled: true,
  }));
}

/**
 * A preset resolved far enough to hand straight to `resolveDay`.
 *
 * Ids are positional from 1, which is all the engine needs  --  it uses them only to name the two
 * sides of a conflict  --  and it lets the Timeline preview a preset, and a test check one, before
 * anything is written to the database.
 */
export function presetBlocks(preset: RoutinePreset): ScheduleBlock[] {
  return plantBlocks(preset.blocks).map((planted, index) => ({ ...planted, id: index + 1 }));
}
