"use client";

/**
 * Which timetable the day is built from.
 *
 * Two requests with very different consequences share this card, and the difference is the whole
 * reason it is written out rather than reduced to a dropdown. **Switching** moves a pointer: the
 * settings row changes, both routines keep their blocks, and switching back restores exactly what
 * was there. **Resetting** rebuilds a preset from `data/routines.ts`, discarding the user's edits
 * to it and  --  because `blockCompletions.blockId` cascades  --  every mark ever made against those
 * blocks. So the reset asks first, in those words, and the wire itself refuses to carry it
 * without an explicit `replace: true`.
 *
 * Installing a preset that has no row yet takes the same destructive endpoint but destroys
 * nothing, so it does not ask. That is a real distinction, not a shortcut: there is no history
 * behind a routine the database has never held.
 */

import { useRouter } from "next/navigation";
import { useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import type { ApiResponse } from "@/lib/api";
import { formatDuration } from "@/lib/time";

/**
 * Declared here rather than imported from the route handler: a client component that reaches
 * into `app/api/` for a type reads as though it depends on the server module, and the timestamps
 * on the row itself are of no use to a picker.
 */
export type RoutineOption = {
  id: number;
  slug: string;
  name: string;
  description: string;
  isPreset: boolean;
};

/** A shipped preset the database has no row for yet. */
export type PresetOption = {
  id: string;
  name: string;
  tagline: string;
  blockCount: number;
  /**
   * The night the preset's offsets were authored against, which installing it adopts.
   *
   * Shown rather than merely applied. A preset mixes `wake`-anchored blocks with
   * `sunrise`-anchored ones, so its timetable only holds its shape at its own wake offset  -- 
   * `lib/blocks.ts` explains why installing has to move the night, and this is where the user
   * finds out that it will.
   */
  wakeOffsetMinutes: number;
  sleepTargetMinutes: number;
};

const UNREACHABLE = "Could not reach the app's own server. Is `npm run dev` still running?";

/**
 * The night a preset assumes, in one line, because installing it will adopt that night.
 *
 * Written out rather than left to be discovered on the Settings page: this is the one
 * consequence of "Install" that is not visible in the list of blocks it draws.
 */
function describeNight(preset: PresetOption): string {
  const offset = preset.wakeOffsetMinutes;
  const wake =
    offset === 0
      ? "Wakes at sunrise"
      : `Wakes ${formatDuration(Math.abs(offset))} ${offset < 0 ? "before" : "after"} sunrise`;
  return `${wake} on ${formatDuration(preset.sleepTargetMinutes)} of sleep  --  installing moves your night to match.`;
}

type Status = { kind: "idle" } | { kind: "busy" } | { kind: "failed"; message: string };

export function RoutinePicker({
  routines,
  uninstalled,
  activeId,
  activeIsPreset,
  activeSlug,
}: {
  routines: readonly RoutineOption[];
  uninstalled: readonly PresetOption[];
  activeId: number;
  activeIsPreset: boolean;
  /** Needed for the reset, which names the preset rather than the routine row. */
  activeSlug: string;
}) {
  const router = useRouter();
  const [status, setStatus] = useState<Status>({ kind: "idle" });
  const [confirming, setConfirming] = useState(false);

  const busy = status.kind === "busy";

  const post = async (body: unknown) => {
    setStatus({ kind: "busy" });
    try {
      const response = await fetch("/api/routines", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const payload = (await response.json()) as ApiResponse<unknown>;
      if (!payload.ok) {
        setStatus({ kind: "failed", message: payload.error });
        return;
      }
      setStatus({ kind: "idle" });
      setConfirming(false);
      // The page reads the routine, its blocks and the resolved day on the server, so a refresh
      // is what redraws all three consistently rather than three cache updates that could disagree.
      router.refresh();
    } catch {
      setStatus({ kind: "failed", message: UNREACHABLE });
    }
  };

  return (
    <Card>
      <CardHeader
        title="Routine"
        subtitle="Four shapes ship with the app. Switching keeps every routine's blocks; only a reset replaces them."
      />

      <ul className="divide-y divide-line">
        {routines.map((routine) => {
          const active = routine.id === activeId;
          return (
            <li key={routine.id} className="flex items-start gap-3 py-2.5">
              <div className="min-w-0 flex-1">
                <p className="flex flex-wrap items-center gap-2 text-sm font-medium text-text-1">
                  {routine.name}
                  {active ? <Badge tone="accent">Active</Badge> : null}
                  {routine.isPreset ? null : <Badge tone="neutral">Yours</Badge>}
                </p>
                {routine.description ? (
                  <p className="mt-0.5 text-xs leading-snug text-text-3">{routine.description}</p>
                ) : null}
              </div>
              {active ? null : (
                <Button
                  variant="secondary"
                  size="sm"
                  disabled={busy}
                  onClick={() => void post({ routineId: routine.id })}
                  className="mt-0.5 shrink-0"
                >
                  Switch
                </Button>
              )}
            </li>
          );
        })}

        {uninstalled.map((preset) => (
          <li key={preset.id} className="flex items-start gap-3 py-2.5">
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-text-2">{preset.name}</p>
              <p className="mt-0.5 text-xs leading-snug text-text-3">
                {preset.tagline} · {preset.blockCount} blocks
              </p>
              <p className="mt-0.5 text-xs leading-snug text-text-3">{describeNight(preset)}</p>
            </div>
            <Button
              variant="secondary"
              size="sm"
              disabled={busy}
              onClick={() => void post({ preset: preset.id, replace: true })}
              className="mt-0.5 shrink-0"
            >
              Install
            </Button>
          </li>
        ))}
      </ul>

      {activeIsPreset ? (
        <div className="mt-3 border-t border-line pt-3">
          {confirming ? (
            <div className="rounded-lg border border-danger/40 bg-danger/5 p-3">
              <p className="text-sm text-text-1">
                Reset this routine to the shipped version?
              </p>
              <p className="mt-1 text-xs leading-relaxed text-text-2">
                Every edit you have made to its blocks is replaced, and every completion ever
                recorded against them is deleted with them. Marks on other routines are untouched.
                Your wake time and sleep target go back to the ones this preset assumes. There is no
                undo.
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <Button
                  variant="danger"
                  size="sm"
                  disabled={busy}
                  onClick={() => void post({ preset: activeSlug, replace: true })}
                >
                  {busy ? "Resetting…" : "Reset it"}
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={busy}
                  onClick={() => setConfirming(false)}
                >
                  Keep my edits
                </Button>
              </div>
            </div>
          ) : (
            <Button variant="ghost" size="sm" onClick={() => setConfirming(true)} disabled={busy}>
              Reset to the shipped version…
            </Button>
          )}
        </div>
      ) : null}

      <p aria-live="polite" className="mt-3 min-h-[1.25rem] text-xs text-danger">
        {status.kind === "failed" ? status.message : ""}
      </p>
    </Card>
  );
}
