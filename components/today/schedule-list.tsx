"use client";

/**
 * Today's timetable, and the tap that marks a block done.
 *
 * This is the only writing surface on Today, so it carries the app's optimistic-update idiom. A
 * tap changes the row immediately and posts in the background, and the request it sends is a
 * `set` or a `clear` rather than a `toggle`  --  the client has already decided which way the mark
 * is going, and an idempotent write cannot end up disagreeing with the row the user is looking
 * at. On success the server's own map arrives with the next render and replaces the guess; on
 * failure the row snaps back and says why.
 *
 * Plain `fetch` and `router.refresh()`, matching the settings form. TanStack Query is
 * provisioned in `components/providers.tsx` but nothing here needs its cache, and one mutation
 * pattern in the codebase is worth more than the better of two.
 */

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { BlockIcon } from "@/components/blocks/block-icon";
import { useLiveDate } from "@/components/hooks";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import type { ApiResponse } from "@/lib/api";
import type { CompletionMap, CompletionStatus } from "@/lib/blocks";
import { isLiveRoute } from "@/lib/nav";
import { CATEGORY_META, FUEL_META, type ResolvedBlock } from "@/lib/schedule";
import { formatClock, formatDuration, minuteOfDayInZone } from "@/lib/time";

/** Where a block sits relative to now. Drives the dimming and the one "Now"/"Next" badge. */
type Phase = "past" | "now" | "next" | "later";

/** `null` is a deliberate "no mark", which is why this is not a `CompletionMap`. */
type Overrides = Record<number, CompletionStatus | null>;

type Status = { kind: "idle" } | { kind: "failed"; message: string };

const UNREACHABLE = "Could not reach the app's own server. Is `npm run dev` still running?";

export function ScheduleList({
  date,
  entries,
  completions,
  clock24h,
  nowIso,
  timeZone,
  routineName,
}: {
  date: string;
  entries: readonly ResolvedBlock[];
  completions: CompletionMap;
  clock24h: boolean;
  nowIso: string;
  timeZone: string;
  routineName: string;
}) {
  const router = useRouter();
  const now = useLiveDate(nowIso);
  const [overrides, setOverrides] = useState<Overrides>({});
  const [pending, setPending] = useState<readonly number[]>([]);
  const [status, setStatus] = useState<Status>({ kind: "idle" });

  // The server's map is the truth; the guesses are dropped the moment a fresher one arrives.
  // Comparing the prop against the last one seen is React's own way of adjusting state during a
  // render, and it costs nothing here because `router.refresh()` is the only thing that changes
  // the identity.
  const [seen, setSeen] = useState(completions);
  if (seen !== completions) {
    setSeen(completions);
    setOverrides({});
  }

  const statusOf = (blockId: number): CompletionStatus | null =>
    Object.hasOwn(overrides, blockId)
      ? (overrides[blockId] ?? null)
      : (completions[blockId] ?? null);

  /** Forget one guess and fall back to the server's map for that block alone. */
  const rollBack = (blockId: number) =>
    setOverrides((current) => {
      const next = { ...current };
      delete next[blockId];
      return next;
    });

  const mark = async (blockId: number, wanted: CompletionStatus) => {
    const next = statusOf(blockId) === wanted ? null : wanted;

    setOverrides((current) => ({ ...current, [blockId]: next }));
    setPending((current) => [...current, blockId]);
    setStatus({ kind: "idle" });

    try {
      const response = await fetch("/api/blocks/complete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          date,
          blockId,
          status: next ?? wanted,
          mode: next === null ? "clear" : "set",
        }),
      });
      const payload = (await response.json()) as ApiResponse<unknown>;
      if (!payload.ok) {
        rollBack(blockId);
        setStatus({ kind: "failed", message: payload.error });
        return;
      }
      // Leaves the guess standing until the refreshed map lands, so the row never flickers back
      // to its old state on the way.
      router.refresh();
    } catch {
      rollBack(blockId);
      setStatus({ kind: "failed", message: UNREACHABLE });
    } finally {
      setPending((current) => current.filter((id) => id !== blockId));
    }
  };

  // Minutes are the engine's continuous line  --  a bedtime-anchored block can land past 1440 and a
  // pre-midnight one below zero  --  so "now" is placed on that same line rather than wrapped. A
  // block at 1500 on today's list is 1 AM tomorrow, and reads as still ahead, which is true.
  const nowMinute = minuteOfDayInZone(now, timeZone);
  const nextId = entries.find((entry) => entry.start > nowMinute)?.block.id;

  const phaseOf = (entry: ResolvedBlock): Phase => {
    if (nowMinute >= entry.start && nowMinute < entry.end) return "now";
    if (entry.block.id === nextId) return "next";
    return entry.end <= nowMinute ? "past" : "later";
  };

  const clock = (minute: number) => formatClock(minute, { hour24: clock24h });
  const done = entries.filter((entry) => statusOf(entry.block.id) === "done").length;

  return (
    <Card>
      <CardHeader
        title="Today's blocks"
        subtitle={`${routineName} · ${entries.length} on today, ${formatDuration(
          entries.reduce((total, entry) => total + entry.block.durationMinutes, 0),
        )} scheduled`}
        aside={
          entries.length > 0 ? (
            <Badge tone={done === entries.length ? "ok" : "neutral"}>
              {done}/{entries.length} done
            </Badge>
          ) : null
        }
      />

      {entries.length === 0 ? (
        <p className="text-sm leading-relaxed text-text-2">
          Nothing is scheduled for today.{" "}
          <Link href="/timeline" className="text-accent underline underline-offset-2">
            Open the timeline
          </Link>{" "}
          to add a block or switch routine.
        </p>
      ) : (
        <ol className="-mx-1 divide-y divide-line">
          {entries.map((entry) => (
            <ScheduleRow
              key={entry.block.id}
              entry={entry}
              phase={phaseOf(entry)}
              mark={statusOf(entry.block.id)}
              busy={pending.includes(entry.block.id)}
              clock={clock}
              onMark={mark}
            />
          ))}
        </ol>
      )}

      <p aria-live="polite" className="mt-3 min-h-[1.25rem] text-xs text-danger">
        {status.kind === "failed" ? status.message : ""}
      </p>
    </Card>
  );
}

/** Tailwind cannot see a computed class name, so every variant is spelled out. */
const ROW_TONES: Record<Phase, string> = {
  past: "opacity-55",
  now: "bg-accent/5",
  next: "",
  later: "",
};

const PHASE_BADGES: Partial<Record<Phase, string>> = { now: "Now", next: "Next" };

function ScheduleRow({
  entry,
  phase,
  mark,
  busy,
  clock,
  onMark,
}: {
  entry: ResolvedBlock;
  phase: Phase;
  mark: CompletionStatus | null;
  busy: boolean;
  clock: (minute: number) => string;
  onMark: (blockId: number, wanted: CompletionStatus) => Promise<void>;
}) {
  const { block } = entry;
  const done = mark === "done";
  const badge = PHASE_BADGES[phase];
  const href = block.href !== null && isLiveRoute(block.href) ? block.href : null;

  return (
    <li className={`flex items-start gap-3 px-1 py-2.5 ${ROW_TONES[phase]}`}>
      <button
        type="button"
        onClick={() => void onMark(block.id, "done")}
        disabled={busy}
        aria-pressed={done}
        aria-label={done ? `Undo ${block.title}` : `Mark ${block.title} done`}
        className={`mt-0.5 grid size-7 shrink-0 place-items-center rounded-md border transition-colors disabled:opacity-50 ${
          done
            ? "border-ok/50 bg-ok/15 text-ok"
            : "border-line-strong text-text-3 hover:border-accent/50 hover:text-accent"
        }`}
      >
        <svg viewBox="0 0 24 24" aria-hidden className="size-4" fill="none" stroke="currentColor">
          <path d="M5 12.5 10 17.5 19 7" strokeWidth={2.2} strokeLinecap="round" />
        </svg>
      </button>

      <div className="min-w-0 flex-1">
        <p className="nums text-[0.6875rem] tracking-wide text-text-3">
          {clock(entry.start)}
          {block.durationMinutes > 0 ? ` – ${clock(entry.end)}` : ""}
          {block.durationMinutes > 0 ? ` · ${formatDuration(block.durationMinutes)}` : ""}
        </p>

        <p className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1">
          <span className="flex min-w-0 items-center gap-1.5 text-sm font-medium text-text-1">
            <BlockIcon name={block.icon} className="size-4 shrink-0 text-text-3" />
            <span className={done ? "text-text-3 line-through" : ""}>{block.title}</span>
          </span>
          {badge ? <Badge tone="accent">{badge}</Badge> : null}
          {mark === "skipped" ? <Badge tone="warn">Skipped</Badge> : null}
        </p>

        {block.detail ? (
          <p className="mt-1 text-xs leading-snug text-text-3">{block.detail}</p>
        ) : null}

        <p className="mt-1 flex flex-wrap items-center gap-x-2 text-[0.6875rem] text-text-3">
          <span>{CATEGORY_META[block.category].label}</span>
          {block.fuel !== "any" ? <span>· {FUEL_META[block.fuel].label}</span> : null}
          {href ? (
            <Link href={href} className="text-accent underline underline-offset-2">
              Open
            </Link>
          ) : null}
        </p>
      </div>

      <Button
        variant={mark === "skipped" ? "secondary" : "ghost"}
        size="sm"
        onClick={() => void onMark(block.id, "skipped")}
        disabled={busy}
        aria-pressed={mark === "skipped"}
        aria-label={mark === "skipped" ? `Un-skip ${block.title}` : `Skip ${block.title}`}
        className="mt-0.5 shrink-0"
      >
        Skip
      </Button>
    </li>
  );
}
