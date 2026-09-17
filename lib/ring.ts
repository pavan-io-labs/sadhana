/**
 * Dial geometry for the Day Ring.
 *
 * A 24-hour clock: midnight at the top, the day running clockwise, so 06:00 is at 3
 * o'clock and noon at the bottom. That is the same orientation as a printed dinacharya
 * chart, and it puts the waking day  --  roughly 05:00 to 21:00  --  around the right side and
 * bottom, where labels have room.
 *
 * Pure arithmetic on a fixed 320-unit viewBox; the SVG scales, the numbers do not. Bands
 * are drawn as *stroked arcs* rather than filled annular sectors: one path command instead
 * of four, and `stroke-linecap` then gives rounded ends for the windows and square ends
 * for the dosha bands that have to tile exactly.
 */

import { MINUTES_PER_DAY } from "./time";

export const RING_SIZE = 320;
export const RING_CENTER = RING_SIZE / 2;

const TAU = Math.PI * 2;

/** Two decimals is below one screen pixel at any size the ring is drawn, and keeps the DOM small. */
function round(n: number): number {
  return Math.round(n * 100) / 100;
}

export type RingPoint = { x: number; y: number };

/** Where a time of day sits on a circle of the given radius. */
export function ringPoint(minute: number, radius: number): RingPoint {
  const radians = (minute / MINUTES_PER_DAY) * TAU - Math.PI / 2;
  return {
    x: round(RING_CENTER + radius * Math.cos(radians)),
    y: round(RING_CENTER + radius * Math.sin(radians)),
  };
}

/**
 * Length of the span from `from` to `to`, going clockwise, in minutes.
 *
 * Always 0 < span <= 1440, so a window that crosses midnight measures correctly and an
 * exactly-equal pair is read as the whole day rather than as nothing.
 */
export function ringSpan(from: number, to: number): number {
  const span = (((to - from) % MINUTES_PER_DAY) + MINUTES_PER_DAY) % MINUTES_PER_DAY;
  return span === 0 ? MINUTES_PER_DAY : span;
}

/** An `M`/`A` path for the clockwise arc between two times. */
export function ringArc(from: number, to: number, radius: number): string {
  const span = ringSpan(from, to);
  const start = ringPoint(from, radius);

  // A single elliptical arc cannot close a full circle  --  its endpoints would coincide and
  // the renderer draws nothing. Two half-turns do.
  if (span >= MINUTES_PER_DAY) {
    const half = ringPoint(from + MINUTES_PER_DAY / 2, radius);
    return `M${start.x} ${start.y} A${radius} ${radius} 0 1 1 ${half.x} ${half.y} A${radius} ${radius} 0 1 1 ${start.x} ${start.y}`;
  }

  const end = ringPoint(from + span, radius);
  const large = span > MINUTES_PER_DAY / 2 ? 1 : 0;
  return `M${start.x} ${start.y} A${radius} ${radius} 0 ${large} 1 ${end.x} ${end.y}`;
}

/** A radial line at one time, between two radii  --  a tick, or the now-hand. */
export function ringRadial(minute: number, innerRadius: number, outerRadius: number): string {
  const a = ringPoint(minute, innerRadius);
  const b = ringPoint(minute, outerRadius);
  return `M${a.x} ${a.y} L${b.x} ${b.y}`;
}

/**
 * Text anchoring for a label placed at a time on the dial.
 *
 * Labels on the left half must be right-aligned and vice versa, or they overlap the ring.
 * The top and bottom get `middle`, where a horizontal nudge would look crooked.
 */
export function ringAnchor(minute: number): "start" | "middle" | "end" {
  const m = fraction(minute);
  if (m < EDGE || m > 1 - EDGE || Math.abs(m - 0.5) < EDGE) return "middle";
  return m < 0.5 ? "start" : "end";
}

/**
 * Vertical alignment for the same label.
 *
 * At the top of the dial the text should hang below its point and at the bottom it should
 * sit above, so that in both cases it falls *inside* the ring instead of over the band.
 */
export function ringBaseline(minute: number): "hanging" | "middle" | "auto" {
  const m = fraction(minute);
  if (m < EDGE || m > 1 - EDGE) return "hanging";
  if (Math.abs(m - 0.5) < EDGE) return "auto";
  return "middle";
}

const EDGE = 0.02;

function fraction(minute: number): number {
  return (((minute % MINUTES_PER_DAY) + MINUTES_PER_DAY) % MINUTES_PER_DAY) / MINUTES_PER_DAY;
}
