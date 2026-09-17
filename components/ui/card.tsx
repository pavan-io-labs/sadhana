import type { ReactNode } from "react";

/**
 * The card, and the two things that always sit inside one.
 *
 * `card` is a Tailwind utility declared in `app/globals.css`, so the surface, border,
 * radius and shadow come from the token layer and stay consistent when the theme flips.
 */

export function Card({
  children,
  className = "",
  padded = true,
}: {
  children: ReactNode;
  className?: string;
  padded?: boolean;
}) {
  return (
    <section className={`card ${padded ? "p-4 sm:p-5" : ""} ${className}`}>{children}</section>
  );
}

export function CardHeader({
  title,
  subtitle,
  aside,
  /** Renders the title as an h2 by default; pass 1 when the card is the page's headline. */
  level = 2,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  aside?: ReactNode;
  level?: 1 | 2 | 3;
}) {
  const Heading = `h${level}` as "h1" | "h2" | "h3";
  return (
    <header className="mb-3 flex items-start justify-between gap-3">
      <div className="min-w-0">
        <Heading className="text-sm font-semibold tracking-wide text-text-1 uppercase">
          {title}
        </Heading>
        {subtitle ? <p className="mt-1 text-sm text-text-3">{subtitle}</p> : null}
      </div>
      {aside ? <div className="shrink-0">{aside}</div> : null}
    </header>
  );
}

/**
 * A labelled number. `nums` switches on tabular figures, which matters because these are
 * read in columns and compared against each other.
 */
export function Stat({
  label,
  value,
  hint,
  tone = "default",
}: {
  label: ReactNode;
  value: ReactNode;
  hint?: ReactNode;
  tone?: "default" | "accent" | "muted";
}) {
  const valueTone =
    tone === "accent" ? "text-accent" : tone === "muted" ? "text-text-3" : "text-text-1";
  return (
    <div className="min-w-0">
      <dt className="text-[0.6875rem] font-medium tracking-wider text-text-3 uppercase">
        {label}
      </dt>
      <dd className={`nums mt-0.5 text-lg font-semibold ${valueTone}`}>{value}</dd>
      {hint ? <p className="mt-0.5 text-xs leading-snug text-text-3">{hint}</p> : null}
    </div>
  );
}

/** A responsive row of `Stat`s. */
export function StatGrid({ children, cols = 3 }: { children: ReactNode; cols?: 2 | 3 | 4 }) {
  const template =
    cols === 2
      ? "grid-cols-2"
      : cols === 3
        ? "grid-cols-2 sm:grid-cols-3"
        : "grid-cols-2 sm:grid-cols-4";
  return <dl className={`grid gap-4 ${template}`}>{children}</dl>;
}
