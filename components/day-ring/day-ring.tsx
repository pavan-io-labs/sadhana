"use client";

/**
 * The Day Ring  --  a 24-hour dial of the day the app has computed.
 *
 * Midnight at the top, clockwise, so the waking day wraps around the right and bottom.
 * Four layers, outside in:
 *
 *   1. the six dosha periods, the current one brightened;
 *   2. hour ticks, plus a tick for every landmark in the plan;
 *   3. the traditional windows  --  Brahma Muhurta, the two sandhyas, Abhijit  --  each tinted
 *      to the dosha period it belongs to, which is also the truth of where they fall;
 *   4. the sleep span, and inside it a band splitting daylight from night.
 *
 * The hand is the only thing that moves. It reads the shared `useNow` clock, so it cannot
 * drift out of step with the countdowns elsewhere on the page. `nowIso` is the server's
 * reading, used for the first render so hydration has identical markup.
 *
 * Nothing here is colour-only: every arc carries a `<title>`, the centre states the period
 * in words, and the Today view lists all of it as text.
 */

import { useLiveDate } from "@/components/hooks";
import type { DayPlan } from "@/lib/day";
import { DOSHA_BANDS, doshaAt, nextDoshaChange } from "@/lib/dosha";
import type { Window } from "@/lib/muhurta";
import {
  RING_CENTER,
  RING_SIZE,
  ringAnchor,
  ringArc,
  ringBaseline,
  ringPoint,
  ringRadial,
} from "@/lib/ring";
import { formatClock, formatDuration, minuteOfDayInZone } from "@/lib/time";

/* Radii on the 320-unit viewBox. Every band is a stroked arc, so a band's extent is its
 * radius plus or minus half its width; they are spaced to leave the hour labels a lane. */
const DOSHA_R = 147;
const DOSHA_W = 13;
const HOUR_TICK = { inner: 136, outer: 140 } as const;
const LANDMARK_TICK = { inner: 131, outer: 141 } as const;
const HOUR_LABEL_R = 126;
const WINDOW_R = 112;
const WINDOW_W = 11;
const SLEEP_R = 96;
const SLEEP_W = 6;
const DAYNIGHT_R = 84;
const DAYNIGHT_W = 8;
const HAND = { inner: 24, outer: 154 } as const;

/** The four labelled hours, and the ticks between them. */
const HOUR_LABELS = [0, 360, 720, 1080];
const HOUR_TICKS = Array.from({ length: 12 }, (_, i) => i * 120);

type WindowArc = {
  id: string;
  label: string;
  window: Window;
  /** The dosha period the window belongs to  --  tint and fact are the same thing here. */
  color: string;
  opacity: number;
};

/**
 * In fixed mode Brahma Muhurta and Pratah Sandhya are adjacent, sharing the sunrise−48
 * boundary, so the second is drawn fainter  --  otherwise they read as one long arc.
 */
function windowArcs(plan: DayPlan): WindowArc[] {
  const out: WindowArc[] = [];
  const add = (id: string, label: string, w: Window | null, color: string, opacity: number) => {
    if (w) out.push({ id, label, window: w, color, opacity });
  };
  add("brahma", "Brahma Muhurta", plan.muhurta.brahma, "var(--vata)", 0.95);
  add("pratah", "Pratah Sandhya", plan.muhurta.pratahSandhya, "var(--vata)", 0.45);
  add("abhijit", "Abhijit Muhurta", plan.muhurta.abhijit, "var(--pitta)", 0.9);
  add("sayam", "Sayam Sandhya", plan.muhurta.sayamSandhya, "var(--kapha)", 0.75);
  return out;
}

/** The dial read out in words, for anyone who is not looking at it. */
function ringLabel(plan: DayPlan, clock24h: boolean): string {
  const parts = plan.landmarks.map(
    (l) => `${l.label} ${formatClock(l.minute, { hour24: clock24h })}`,
  );
  return `Twenty-four hour dial for ${plan.date}. ${parts.join(", ")}.`;
}

export function DayRing({
  plan,
  clock24h,
  nowIso,
  className = "",
}: {
  plan: DayPlan;
  clock24h: boolean;
  /** The server's clock reading, so the first client render matches it exactly. */
  nowIso: string;
  className?: string;
}) {
  const minute = minuteOfDayInZone(useLiveDate(nowIso), plan.timeZone);

  const period = doshaAt(minute);
  const change = nextDoshaChange(minute);
  const windows = windowArcs(plan);
  const clock = (m: number) => formatClock(m, { hour24: clock24h });
  const hand = ringPoint(minute, HAND.outer);

  // "6am" rather than "6:00 AM": the dial has room for an orientation mark, not a time.
  const hourLabel = (m: number) => {
    const h24 = Math.floor(m / 60);
    if (clock24h) return String(h24).padStart(2, "0");
    return `${h24 % 12 === 0 ? 12 : h24 % 12}${h24 < 12 ? "am" : "pm"}`;
  };

  // The arc runs to tomorrow's wake, which is a minute or two off today's, so the label is
  // taken from what is actually drawn rather than from `personal.wake`.
  const sleepEnd = plan.personal.bedtime + plan.personal.sleepTargetMinutes;

  const { sunrise, sunset } = plan.sun;
  const daylight = sunrise !== null && sunset !== null ? { from: sunrise, to: sunset } : null;

  return (
    <div className={`relative mx-auto aspect-square w-full max-w-[22rem] ${className}`}>
      <svg
        viewBox={`0 0 ${RING_SIZE} ${RING_SIZE}`}
        className="size-full overflow-visible"
        role="img"
        aria-label={ringLabel(plan, clock24h)}
      >
        {/* Daylight against night, innermost, so the shape of the season is visible at a glance. */}
        <g fill="none" strokeWidth={DAYNIGHT_W} strokeLinecap="butt">
          <circle
            cx={RING_CENTER}
            cy={RING_CENTER}
            r={DAYNIGHT_R}
            stroke="var(--text-3)"
            strokeOpacity="0.16"
          />
          {daylight ? (
            <path
              d={ringArc(daylight.from, daylight.to, DAYNIGHT_R)}
              stroke="var(--pitta)"
              strokeOpacity="0.4"
            >
              <title>{`Daylight · ${clock(daylight.from)}–${clock(daylight.to)}`}</title>
            </path>
          ) : null}
        </g>

        {/* Asleep. */}
        <path
          d={ringArc(plan.personal.bedtime, sleepEnd, SLEEP_R)}
          fill="none"
          stroke="var(--text-3)"
          strokeOpacity="0.5"
          strokeWidth={SLEEP_W}
          strokeLinecap="round"
        >
          <title>{`Asleep · ${clock(plan.personal.bedtime)}–${clock(sleepEnd)}`}</title>
        </path>

        {/* The traditional windows. */}
        <g fill="none" strokeWidth={WINDOW_W} strokeLinecap="round">
          {windows.map((arc) => (
            <path
              key={arc.id}
              d={ringArc(arc.window.start, arc.window.end, WINDOW_R)}
              stroke={arc.color}
              strokeOpacity={arc.opacity}
            >
              <title>{`${arc.label} · ${clock(arc.window.start)}–${clock(arc.window.end)}`}</title>
            </path>
          ))}
        </g>

        {/* The six dosha periods. Butt caps so the seven drawn arcs tile without a seam. */}
        <g fill="none" strokeWidth={DOSHA_W} strokeLinecap="butt">
          {DOSHA_BANDS.map((band, i) => (
            <path
              key={`${band.period.id}-${i}`}
              d={ringArc(band.start, band.end, DOSHA_R)}
              stroke={`var(--${band.period.dosha})`}
              strokeOpacity={band.period.id === period.id ? 0.92 : 0.24}
            >
              <title>{`${band.period.label} · ${clock(band.start)}–${clock(band.end)}`}</title>
            </path>
          ))}
        </g>

        {/* Two-hourly orientation ticks, and the four labelled hours. */}
        <g stroke="var(--text-3)" strokeOpacity="0.5" strokeWidth="0.75" strokeLinecap="round">
          {HOUR_TICKS.map((m) => (
            <path key={m} d={ringRadial(m, HOUR_TICK.inner, HOUR_TICK.outer)} />
          ))}
        </g>
        <g fill="var(--text-3)" fontSize="9" className="nums">
          {HOUR_LABELS.map((m) => {
            const p = ringPoint(m, HOUR_LABEL_R);
            return (
              <text
                key={m}
                x={p.x}
                y={p.y}
                textAnchor={ringAnchor(m)}
                dominantBaseline={ringBaseline(m)}
              >
                {hourLabel(m)}
              </text>
            );
          })}
        </g>

        {/* One tick per landmark, reaching up to meet the dosha band. */}
        <g stroke="var(--text-1)" strokeWidth="1.75" strokeLinecap="round">
          {plan.landmarks.map((landmark) => (
            <path
              key={landmark.id}
              d={ringRadial(landmark.minute, LANDMARK_TICK.inner, LANDMARK_TICK.outer)}
              strokeOpacity={landmark.kind === "muhurta" ? 0.45 : 0.8}
            >
              <title>{`${landmark.label} · ${clock(landmark.minute)}`}</title>
            </path>
          ))}
        </g>

        {/* Now. The only thing on the dial that moves. */}
        <g>
          <path
            d={ringRadial(minute, HAND.inner, HAND.outer)}
            stroke="var(--accent)"
            strokeWidth="1.75"
            strokeLinecap="round"
          />
          <circle cx={hand.x} cy={hand.y} r="3.5" fill="var(--accent)" />
          <circle cx={RING_CENTER} cy={RING_CENTER} r="2.5" fill="var(--accent)" />
        </g>
      </svg>

      {/*
        The centre readout is HTML, not SVG text: it wants the same type scale and tabular
        figures as the rest of the interface, and `pointer-events-none` keeps the arcs'
        tooltips reachable underneath it.
      */}
      <div className="pointer-events-none absolute inset-0 grid place-items-center">
        <div className="max-w-[9rem] text-center">
          <p className="nums text-2xl font-semibold tracking-tight text-text-1">{clock(minute)}</p>
          <p className="mt-0.5 text-xs font-medium text-accent">{period.label}</p>
          <p className="nums mt-1 text-[0.6875rem] leading-snug text-text-3">
            {formatDuration(change.inMinutes)} left
          </p>
        </div>
      </div>
    </div>
  );
}
