"use client";

/**
 * The Timeline: the routine itself, editable, with today's resolved times beside it.
 *
 * The list is ordered by **resolved start**, not by `sortOrder`, because the resolved start is
 * what a day actually is. That makes drag-to-reorder the wrong gesture  --  dragging a block
 * downwards would not move it later, since its time comes from its anchor  --  so the arrows appear
 * only between two blocks that start on the same minute, which is the one case `sortOrder`
 * decides. A control that visibly does nothing is worse than no control at all.
 *
 * Every block on the routine is shown, including the disabled ones and the ones today's weekday
 * mask excludes, each labelled as such. That is why the day is resolved twice: once with
 * `includeDisabled` for the list, and once without for the conflict scan, since a block that is
 * switched off cannot collide with anything.
 *
 * Writes follow the same idiom as Today. Each endpoint answers with the whole refreshed list, so
 * state is replaced wholesale rather than spliced  --  a splice would drift the moment a create and
 * a reorder raced  --  and `router.refresh()` follows, because Today is reading this same routine.
 */

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

import { BlockIcon } from "@/components/blocks/block-icon";
import { BlockForm, formStateOf, NEW_BLOCK } from "@/components/timeline/block-form";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import type { ApiResponse } from "@/lib/api";
import type { DayPlan } from "@/lib/day";
import {
  CATEGORY_META,
  describeMask,
  describeOffset,
  EVERY_DAY,
  FUEL_META,
  type ResolvedBlock,
  type ResolvedDay,
  resolveDay,
  type ScheduleBlock,
} from "@/lib/schedule";
import { formatClock, formatDuration } from "@/lib/time";
import type { BlockFields, FieldErrors } from "@/lib/validators";

/** Which form is open: an existing block's id, the new-block form, or neither. */
type Editing = number | "new" | null;

type Status = { kind: "idle" } | { kind: "failed"; message: string };

const UNREACHABLE = "Could not reach the app's own server. Is `npm run dev` still running?";

export function TimelineEditor({
  plan,
  blocks: fromServer,
  clock24h,
  routineName,
}: {
  plan: DayPlan;
  /** Every block on the active routine, in `sortOrder`, disabled ones included. */
  blocks: readonly ScheduleBlock[];
  clock24h: boolean;
  routineName: string;
}) {
  const router = useRouter();
  const [blocks, setBlocks] = useState<readonly ScheduleBlock[]>(fromServer);
  const [editing, setEditing] = useState<Editing>(null);
  const [confirming, setConfirming] = useState<number | null>(null);
  const [pending, setPending] = useState<string | null>(null);
  const [status, setStatus] = useState<Status>({ kind: "idle" });
  const [fields, setFields] = useState<FieldErrors>({});

  // The server's list is the truth. Adjusting state during a render is React's own answer to a
  // prop that has changed, and this costs nothing because `router.refresh()` is the only thing
  // that changes the identity. `editing` is deliberately left alone: a form the user is typing
  // into should not close because a refresh landed, and one bound to a block that has since gone
  // simply has no row to render in.
  const [seen, setSeen] = useState(fromServer);
  if (seen !== fromServer) {
    setSeen(fromServer);
    setBlocks(fromServer);
  }

  const busy = pending !== null;
  const clock = (minute: number) => formatClock(minute, { hour24: clock24h });

  // Two resolutions of the same day, for two different questions. The list asks "what is on this
  // routine and where would it land"; the conflict scan asks "what does today actually look
  // like", which a disabled block takes no part in.
  const shown = useMemo(() => resolveDay(plan, blocks, { includeDisabled: true }), [plan, blocks]);
  const live = useMemo(() => resolveDay(plan, blocks), [plan, blocks]);

  const rows = useMemo(
    () =>
      [...shown.entries, ...shown.offToday].sort(
        (a, b) => a.start - b.start || a.block.sortOrder - b.block.sortOrder,
      ),
    [shown],
  );

  const disabledIds = blocks.filter((block) => !block.enabled).map((block) => block.id);

  const send = async (
    key: string,
    url: string,
    method: "POST" | "PATCH" | "DELETE",
    body?: unknown,
  ): Promise<boolean> => {
    setPending(key);
    setStatus({ kind: "idle" });
    setFields({});
    try {
      const response = await fetch(url, {
        method,
        ...(body === undefined
          ? {}
          : { headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }),
      });
      const payload = (await response.json()) as ApiResponse<{ blocks: ScheduleBlock[] }>;
      if (!payload.ok) {
        setStatus({ kind: "failed", message: payload.error });
        setFields(payload.fields ?? {});
        return false;
      }
      setBlocks(payload.data.blocks);
      // Today is reading this same routine, so its marks and its advisories have to be recomputed
      // against the timetable that now exists rather than the one that did.
      router.refresh();
      return true;
    } catch {
      setStatus({ kind: "failed", message: UNREACHABLE });
      return false;
    } finally {
      setPending(null);
    }
  };

  const save = async (values: BlockFields) => {
    if (editing === null) return;
    const saved =
      editing === "new"
        ? await send("form", "/api/blocks", "POST", values)
        : await send("form", `/api/blocks/${editing}`, "PATCH", values);
    if (saved) setEditing(null);
  };

  const remove = async (id: number) => {
    if (await send(`row-${id}`, `/api/blocks/${id}`, "DELETE")) {
      setConfirming(null);
      if (editing === id) setEditing(null);
    }
  };

  /**
   * Swaps two blocks that start on the same minute.
   *
   * The whole list goes to the server rather than the moved pair, so `sortOrder` is rewritten to
   * match the order on screen  --  which also quietly normalises a routine whose `sortOrder` no
   * longer reflects its resolved times after an offset was edited.
   */
  const swap = async (index: number, delta: number) => {
    const next = [...rows];
    const here = next[index];
    const there = next[index + delta];
    if (!here || !there) return;
    next[index] = there;
    next[index + delta] = here;
    await send("reorder", "/api/blocks/reorder", "POST", {
      ids: next.map((row) => row.block.id),
    });
  };

  const tiedWith = (index: number, delta: number): boolean => {
    const here = rows[index];
    const there = rows[index + delta];
    return here !== undefined && there !== undefined && here.start === there.start;
  };

  const onToday = shown.entries.filter((entry) => entry.block.enabled).length;

  return (
    <div className="space-y-4">
      <FitCard live={live} clock24h={clock24h} />

      <Card>
        <CardHeader
          title="The routine"
          subtitle={`${routineName} · ${blocks.length} blocks, ${onToday} on today, ${formatDuration(
            live.scheduledMinutes,
          )} scheduled`}
          aside={
            editing === "new" ? null : (
              <Button size="sm" onClick={() => setEditing("new")} disabled={busy}>
                Add a block
              </Button>
            )
          }
        />

        {editing === "new" ? (
          <div className="mb-4">
            <BlockForm
              plan={plan}
              clock24h={clock24h}
              initial={NEW_BLOCK}
              submitLabel="Add it"
              busy={pending === "form"}
              serverErrors={fields}
              onSubmit={(values) => void save(values)}
              onCancel={() => setEditing(null)}
            />
          </div>
        ) : null}

        {rows.length === 0 ? (
          <p className="text-sm leading-relaxed text-text-2">
            This routine has no blocks. Add one, or install a shipped preset below.
          </p>
        ) : (
          <ol className="-mx-1 divide-y divide-line">
            {rows.map((entry, index) => (
              <li key={entry.block.id} className="px-1 py-2.5">
                {editing === entry.block.id ? (
                  <BlockForm
                    plan={plan}
                    clock24h={clock24h}
                    initial={formStateOf(entry.block)}
                    submitLabel="Save changes"
                    busy={pending === "form"}
                    serverErrors={fields}
                    onSubmit={(values) => void save(values)}
                    onCancel={() => setEditing(null)}
                  />
                ) : (
                  <TimelineRow
                    entry={entry}
                    clock={clock}
                    busy={busy}
                    confirming={confirming === entry.block.id}
                    canRaise={tiedWith(index, -1)}
                    canLower={tiedWith(index, 1)}
                    onEdit={() => setEditing(entry.block.id)}
                    onToggle={() =>
                      void send(`row-${entry.block.id}`, `/api/blocks/${entry.block.id}`, "PATCH", {
                        enabled: !entry.block.enabled,
                      })
                    }
                    onConfirmDelete={() => setConfirming(entry.block.id)}
                    onCancelDelete={() => setConfirming(null)}
                    onDelete={() => void remove(entry.block.id)}
                    onRaise={() => void swap(index, -1)}
                    onLower={() => void swap(index, 1)}
                  />
                )}
              </li>
            ))}
          </ol>
        )}

        {disabledIds.length > 0 ? (
          <div className="mt-3 border-t border-line pt-3">
            <Button
              variant="ghost"
              size="sm"
              disabled={busy}
              onClick={() =>
                void send("enable-all", "/api/blocks/enabled", "POST", {
                  ids: disabledIds,
                  enabled: true,
                })
              }
            >
              {pending === "enable-all"
                ? "Turning them on…"
                : `Turn all ${disabledIds.length} switched-off blocks back on`}
            </Button>
          </div>
        ) : null}

        <p aria-live="polite" className="mt-3 min-h-[1.25rem] text-xs text-danger">
          {status.kind === "failed" ? status.message : ""}
        </p>
      </Card>
    </div>
  );
}

/**
 * Whether today's timetable actually fits.
 *
 * The engine *finds* overlaps rather than preventing them, and that is deliberate: with five
 * independent anchors no fixed set of offsets is collision-free at every latitude and season, so a
 * preset that reads cleanly in Hyderabad in March can have dinner meet the evening junction in
 * Guwahati in December. What the app owes the user is therefore an honest report, not a promise.
 *
 * Gaps share the card but sit under their own heading in a quieter tone, because unscheduled time
 * is information rather than a fault  --  an empty afternoon is usually a choice.
 */
function FitCard({ live, clock24h }: { live: ResolvedDay; clock24h: boolean }) {
  const clock = (minute: number) => formatClock(minute, { hour24: clock24h });
  const waking = Math.max(0, live.anchors.bedtime - live.anchors.wake);
  const free = Math.max(0, waking - live.scheduledMinutes);
  const clashes = live.overlaps.length;

  return (
    <Card>
      <CardHeader
        title="How today fits"
        subtitle={`Awake ${clock(live.anchors.wake)} – ${clock(live.anchors.bedtime)} · ${formatDuration(
          waking,
        )} of day, ${formatDuration(free)} unscheduled`}
        aside={
          <Badge tone={clashes > 0 ? "warn" : "ok"}>
            {clashes > 0 ? `${clashes} overlap${clashes === 1 ? "" : "s"}` : "Nothing collides"}
          </Badge>
        }
      />

      {clashes > 0 ? (
        <ul className="space-y-1">
          {live.overlaps.map((clash) => (
            <li
              key={`${clash.blockIds[0]}-${clash.blockIds[1]}`}
              className="text-sm leading-relaxed text-text-2"
            >
              {clash.message}
            </li>
          ))}
        </ul>
      ) : null}

      {live.gaps.length > 0 ? (
        <div className={clashes > 0 ? "mt-3 border-t border-line pt-3" : ""}>
          <p className="text-xs font-medium text-text-2">Unscheduled stretches</p>
          <ul className="mt-1 space-y-1">
            {live.gaps.map((gap) => (
              <li
                key={`${gap.blockIds[0]}-${gap.blockIds[1]}`}
                className="text-xs leading-relaxed text-text-3"
              >
                {gap.message}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </Card>
  );
}

/** A chevron, rotated by the caller. Two paths would be the same path twice. */
function Chevron({ up }: { up: boolean }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden className="size-3.5" fill="none" stroke="currentColor">
      <path
        d={up ? "M6 15l6-6 6 6" : "M6 9l6 6 6-6"}
        strokeWidth={2.2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/**
 * One block on the routine: the rule that was authored, and what it comes to today.
 *
 * Both belong on screen because they answer different questions. `Sunrise + 30m` is the intention,
 * and it survives the year; `6:36 – 6:51 AM` is only what that means this morning. The clock time
 * alone would hide the thing the user actually edits.
 *
 * A block today's mask excludes still shows its resolved time, dimmed and labelled  --  the arithmetic
 * is real, it simply does not apply today, and blanking it would make the row look broken.
 */
function TimelineRow({
  entry,
  clock,
  busy,
  confirming,
  canRaise,
  canLower,
  onEdit,
  onToggle,
  onConfirmDelete,
  onCancelDelete,
  onDelete,
  onRaise,
  onLower,
}: {
  entry: ResolvedBlock;
  clock: (minute: number) => string;
  busy: boolean;
  confirming: boolean;
  canRaise: boolean;
  canLower: boolean;
  onEdit: () => void;
  onToggle: () => void;
  onConfirmDelete: () => void;
  onCancelDelete: () => void;
  onDelete: () => void;
  onRaise: () => void;
  onLower: () => void;
}) {
  const { block } = entry;
  const off = !block.enabled;
  const spans = block.durationMinutes > 0;

  return (
    <div>
      <div
        className={`flex flex-col gap-2 sm:flex-row sm:items-start sm:gap-3 ${
          off || !entry.today ? "opacity-60" : ""
        }`}
      >
        <div className="min-w-0 flex-1">
          <p className="nums text-[0.6875rem] tracking-wide text-text-3">
            {clock(entry.start)}
            {spans ? ` – ${clock(entry.end)}` : ""}
            {spans ? ` · ${formatDuration(block.durationMinutes)}` : " · a moment"}
          </p>

          <p className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className="flex min-w-0 items-center gap-1.5 text-sm font-medium text-text-1">
              <BlockIcon name={block.icon} className="size-4 shrink-0 text-text-3" />
              {block.title}
            </span>
            {off ? <Badge tone="warn">Off</Badge> : null}
            {!off && !entry.today ? <Badge tone="neutral">Not today</Badge> : null}
          </p>

          {block.detail ? (
            <p className="mt-1 text-xs leading-snug text-text-3">{block.detail}</p>
          ) : null}

          <p className="mt-1 flex flex-wrap items-center gap-x-2 text-[0.6875rem] text-text-3">
            <span className="text-text-2">
              {describeOffset(block.anchor, block.offsetMinutes, clock)}
            </span>
            <span>· {CATEGORY_META[block.category].label}</span>
            {block.fuel !== "any" ? <span>· {FUEL_META[block.fuel].label}</span> : null}
            {block.weekdayMask !== EVERY_DAY ? <span>· {describeMask(block.weekdayMask)}</span> : null}
            {block.notify ? <span>· Reminder {block.notifyLeadMinutes}m before</span> : null}
          </p>
        </div>

        {/*
          One wrapping row at every width: below the text on a phone, at the right-hand end of it
          from `sm` up. A fixed side column would cost every row a third of its width on the
          narrowest screens, which is exactly where the titles need it.
        */}
        <div className="flex flex-wrap items-center justify-end gap-1 sm:shrink-0">
          {canRaise || canLower ? (
            <span className="mr-0.5 flex items-center">
              <button
                type="button"
                onClick={onRaise}
                disabled={busy || !canRaise}
                aria-label={`Order ${block.title} before the block it shares a time with`}
                className="grid size-6 place-items-center rounded text-text-3 transition-colors hover:text-accent disabled:opacity-30"
              >
                <Chevron up />
              </button>
              <button
                type="button"
                onClick={onLower}
                disabled={busy || !canLower}
                aria-label={`Order ${block.title} after the block it shares a time with`}
                className="grid size-6 place-items-center rounded text-text-3 transition-colors hover:text-accent disabled:opacity-30"
              >
                <Chevron up={false} />
              </button>
            </span>
          ) : null}

          <Button variant="ghost" size="sm" onClick={onEdit} disabled={busy}>
            Edit
          </Button>

          <Button variant="ghost" size="sm" onClick={onToggle} disabled={busy} aria-pressed={!off}>
            {off ? "Turn on" : "Turn off"}
          </Button>

          {confirming ? null : (
            <Button variant="ghost" size="sm" onClick={onConfirmDelete} disabled={busy}>
              Delete
            </Button>
          )}
        </div>
      </div>
      {confirming ? (
        <div className="mt-2 rounded-lg border border-danger/40 bg-danger/5 p-3">
          <p className="text-sm text-text-1">Delete “{block.title}”?</p>
          <p className="mt-1 text-xs leading-relaxed text-text-2">
            Every completion ever recorded against this block goes with it, and the history cannot be
            recovered. Turning it off instead keeps the row and its marks, and leaves it out of the
            day.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button variant="danger" size="sm" onClick={onDelete} disabled={busy}>
              {busy ? "Deleting…" : "Delete it"}
            </Button>
            <Button variant="ghost" size="sm" onClick={onCancelDelete} disabled={busy}>
              Keep it
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
