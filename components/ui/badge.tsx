import type { ReactNode } from "react";

import type { Dosha } from "@/lib/dosha";

/**
 * Small labels.
 *
 * Every badge carries text, never colour alone  --  a user with any form of colour vision
 * deficiency, or reading in bright sun, gets the same information as everyone else.
 */

export type BadgeTone =
  | "neutral"
  | "accent"
  | "ok"
  | "warn"
  | "danger"
  | "info"
  | Dosha;

const TONES: Record<BadgeTone, string> = {
  neutral: "border-line bg-surface-2 text-text-2",
  accent: "border-accent/40 bg-accent/10 text-accent",
  ok: "border-ok/40 bg-ok/10 text-ok",
  warn: "border-warn/40 bg-warn/10 text-warn",
  danger: "border-danger/40 bg-danger/10 text-danger",
  info: "border-info/40 bg-info/10 text-info",
  vata: "border-vata/40 bg-vata/10 text-vata",
  kapha: "border-kapha/40 bg-kapha/10 text-kapha",
  pitta: "border-pitta/40 bg-pitta/10 text-pitta",
};

export function Badge({
  children,
  tone = "neutral",
  className = "",
}: {
  children: ReactNode;
  tone?: BadgeTone;
  className?: string;
}) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[0.6875rem] font-medium tracking-wide whitespace-nowrap ${TONES[tone]} ${className}`}
    >
      {children}
    </span>
  );
}

/** A filled dot, for legends where the badge would be too heavy. Always paired with text. */
export function Dot({ tone = "accent" }: { tone?: BadgeTone }) {
  const fill: Record<BadgeTone, string> = {
    neutral: "bg-text-3",
    accent: "bg-accent",
    ok: "bg-ok",
    warn: "bg-warn",
    danger: "bg-danger",
    info: "bg-info",
    vata: "bg-vata",
    kapha: "bg-kapha",
    pitta: "bg-pitta",
  };
  return <span aria-hidden className={`inline-block size-2 rounded-full ${fill[tone]}`} />;
}
