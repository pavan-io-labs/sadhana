"use client";

/**
 * The advisories, and the one tap that corrects them.
 *
 * `lib/rules.ts` produces each finding already shaped as the request that would fix it, so this
 * component is deliberately thin: it picks the endpoint from `fix.kind` and posts the payload the
 * rule handed it. Nothing here decides what a good day looks like  --  that argument lives in the
 * engine, where it is unit-tested.
 *
 * The reason is behind a `<details>` rather than always open. A panel that explains itself three
 * times over is one users stop reading, and `<details>` is keyboard- and screen-reader-operable
 * without a line of state.
 */

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { Badge, type BadgeTone } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import type { ApiResponse } from "@/lib/api";
import { type Advisory, RULE_IDS, type Severity, severityCounts } from "@/lib/rules";

const TONES: Record<Severity, BadgeTone> = {
  critical: "danger",
  warning: "warn",
  advisory: "info",
};

const LABELS: Record<Severity, string> = {
  critical: "Critical",
  warning: "Warning",
  advisory: "Note",
};

const UNREACHABLE = "Could not reach the app's own server. Is `npm run dev` still running?";

type Status = { kind: "idle" } | { kind: "failed"; message: string };

/** Where each mechanical fix goes. `navigate` is a link, so it never reaches this table. */
function requestFor(fix: Exclude<Advisory["fix"], undefined>) {
  switch (fix.kind) {
    case "settings":
      return { url: "/api/settings", method: "PATCH", body: fix.patch };
    case "block":
      return { url: `/api/blocks/${fix.blockId}`, method: "PATCH", body: fix.patch };
    case "addBlock":
      return { url: "/api/blocks", method: "POST", body: fix.block };
    case "navigate":
      return null;
  }
}

export function AdvisoryPanel({ advisories }: { advisories: readonly Advisory[] }) {
  const router = useRouter();
  const [applying, setApplying] = useState<string | null>(null);
  const [status, setStatus] = useState<Status>({ kind: "idle" });
  const counts = severityCounts(advisories);

  const apply = async (advisory: Advisory) => {
    const request = advisory.fix ? requestFor(advisory.fix) : null;
    if (!request) return;

    setApplying(advisory.id);
    setStatus({ kind: "idle" });
    try {
      const response = await fetch(request.url, {
        method: request.method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(request.body),
      });
      const payload = (await response.json()) as ApiResponse<unknown>;
      if (!payload.ok) {
        setStatus({ kind: "failed", message: payload.error });
        return;
      }
      // The whole day is recomputed on the server, so the advisory disappears because the
      // condition behind it is gone  --  not because this component removed it from a list.
      router.refresh();
    } catch {
      setStatus({ kind: "failed", message: UNREACHABLE });
    } finally {
      setApplying(null);
    }
  };

  return (
    <Card>
      <CardHeader
        title="What the day says"
        subtitle={
          advisories.length === 0
            ? `${RULE_IDS.length} checks, all quiet.`
            : "Ordered by how much each one costs you. Every one is checkable."
        }
        aside={
          advisories.length === 0 ? (
            <Badge tone="ok">Clear</Badge>
          ) : (
            <span className="flex gap-1.5">
              {(["critical", "warning", "advisory"] as const)
                .filter((severity) => counts[severity] > 0)
                .map((severity) => (
                  <Badge key={severity} tone={TONES[severity]}>
                    {counts[severity]} {LABELS[severity].toLowerCase()}
                    {counts[severity] > 1 ? "s" : ""}
                  </Badge>
                ))}
            </span>
          )
        }
      />

      {advisories.length === 0 ? (
        <p className="text-sm leading-relaxed text-text-2">
          Nothing conflicts today: daylight is scheduled after waking, the last meal clears
          bedtime, and no session is set to be done on the wrong stomach.
        </p>
      ) : (
        <ul className="space-y-3">
          {advisories.map((advisory) => (
            <li key={advisory.id} className="flex items-start gap-3">
              <Badge tone={TONES[advisory.severity]} className="mt-0.5 shrink-0">
                {LABELS[advisory.severity]}
              </Badge>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-text-1">{advisory.message}</p>
                <details className="mt-1">
                  <summary className="w-fit cursor-pointer text-xs text-text-3 hover:text-text-2">
                    Why this matters
                  </summary>
                  <p className="mt-1 text-xs leading-relaxed text-text-2">{advisory.why}</p>
                </details>
                {advisory.fix ? (
                  <div className="mt-2">
                    {advisory.fix.kind === "navigate" ? (
                      <Link
                        href={advisory.fix.href}
                        className="text-xs text-accent underline underline-offset-2"
                      >
                        {advisory.fix.label}
                      </Link>
                    ) : (
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => void apply(advisory)}
                        disabled={applying !== null}
                      >
                        {applying === advisory.id ? "Applying…" : advisory.fix.label}
                      </Button>
                    )}
                  </div>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      )}

      <p aria-live="polite" className="mt-3 min-h-[1.25rem] text-xs text-danger">
        {status.kind === "failed" ? status.message : ""}
      </p>
    </Card>
  );
}
