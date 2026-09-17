/**
 * The block glyphs.
 *
 * `blocks.icon` is free text in the database rather than a constrained column, so that adding
 * a name is a data change and never a migration. The cost of that choice is paid here: this
 * component has to cope with a name it does not know, and it does  --  anything unrecognised
 * draws the dot. The lookup goes through `Object.hasOwn` rather than a bare index, because a
 * block whose icon was somehow stored as `toString` would otherwise reach up the prototype
 * chain and render a function.
 *
 * One shared `<svg>` frame, one 24×24 grid, `currentColor` throughout, `aria-hidden` always:
 * every glyph sits beside its own text label, so none of them carries meaning by itself.
 */

import type { ReactNode } from "react";

import type { BlockIcon as BlockIconName } from "@/lib/schedule";

const GLYPHS: Record<BlockIconName, ReactNode> = {
  dot: <circle cx="12" cy="12" r="3.25" fill="currentColor" stroke="none" />,

  sun: (
    <>
      <circle cx="12" cy="12" r="3.75" />
      <path d="M12 2.75v2M12 19.25v2M2.75 12h2M19.25 12h2M5.4 5.4l1.4 1.4M17.2 17.2l1.4 1.4M18.6 5.4l-1.4 1.4M6.8 17.2l-1.4 1.4" />
    </>
  ),

  moon: <path d="M20.5 14.3A8.5 8.5 0 0 1 9.7 3.5a8.5 8.5 0 1 0 10.8 10.8Z" />,

  droplet: <path d="M12 3.2c3.2 3.4 5.3 6.1 5.3 8.9a5.3 5.3 0 0 1-10.6 0c0-2.8 2.1-5.5 5.3-8.9Z" />,

  lotus: (
    <>
      <path d="M12 5c1.7 2 2.6 3.9 2.6 5.8 0 1.6-.9 2.9-2.6 3.9-1.7-1-2.6-2.3-2.6-3.9C9.4 8.9 10.3 7 12 5Z" />
      <path d="M9.4 14.7C7 15 5.1 14 3.8 11.8c2.4-.7 4.3-.3 5.6 1.2M14.6 14.7c2.4.3 4.3-.7 5.6-2.9-2.4-.7-4.3-.3-5.6 1.2" />
      <path d="M4.5 16.4c2 2.1 4.5 3.1 7.5 3.1s5.5-1 7.5-3.1" />
    </>
  ),

  wind: <path d="M3 8.5h9a3 3 0 1 0-3-3M3 15.5h13a3 3 0 1 1-3 3M3 12h7" />,

  walk: (
    <>
      <circle cx="12.5" cy="4.6" r="1.9" />
      <path d="M12.5 8.2v4.6M12.5 12.8l3 3.2.8 4M12.5 12.8l-2.6 3.4-.4 4M12.5 9.8 15.8 11M12.5 9.8 9.4 11.4" />
    </>
  ),

  dumbbell: <path d="M4 9.5v5M7 7.5v9M17 7.5v9M20 9.5v5M7 12h10" />,

  bowl: (
    <>
      <path d="M3.5 11.2h17c0 4.7-3.8 8.3-8.5 8.3s-8.5-3.6-8.5-8.3Z" />
      <path d="M9 8c0-1.3 1.2-1.7 1.2-3M14 8c0-1.3 1.2-1.7 1.2-3" />
    </>
  ),

  cup: (
    <>
      <path d="M5 8h11v6.5A4.5 4.5 0 0 1 11.5 19h-2A4.5 4.5 0 0 1 5 14.5V8Z" />
      <path d="M16 9.5h1.8a2.2 2.2 0 1 1 0 4.4H16" />
      <path d="M8 5.4c0-.9.8-1.2.8-2.2M12.5 5.4c0-.9.8-1.2.8-2.2" />
    </>
  ),

  monitor: (
    <>
      <rect x="3" y="4.5" width="18" height="12" rx="2" />
      <path d="M9 20h6M12 16.5V20" />
    </>
  ),

  people: (
    <>
      <circle cx="9" cy="8" r="3" />
      <path d="M3.5 19.5a5.5 5.5 0 0 1 11 0" />
      <circle cx="16.8" cy="8.6" r="2.3" />
      <path d="M16.8 13.4a5.2 5.2 0 0 1 4.5 4.5" />
    </>
  ),

  brain: (
    <>
      <path d="M12 5.8v12.4" />
      <path d="M12 7a2.6 2.6 0 0 0-4.7-1.5A2.5 2.5 0 0 0 5 8.7a2.7 2.7 0 0 0-.6 3.7A2.8 2.8 0 0 0 6 16.6a2.7 2.7 0 0 0 3.4 2.3A2.6 2.6 0 0 0 12 17" />
      <path d="M12 7a2.6 2.6 0 0 1 4.7-1.5A2.5 2.5 0 0 1 19 8.7a2.7 2.7 0 0 1 .6 3.7A2.8 2.8 0 0 1 18 16.6a2.7 2.7 0 0 1-3.4 2.3A2.6 2.6 0 0 1 12 17" />
    </>
  ),

  book: (
    <>
      <path d="M12 6.5C10.3 5.2 8 4.5 4.5 4.5v13c3.5 0 5.8.7 7.5 2 1.7-1.3 4-2 7.5-2v-13c-3.5 0-5.8.7-7.5 2Z" />
      <path d="M12 6.5v13" />
    </>
  ),

  oil: (
    <>
      <path d="M10 3.5h4v2.6c0 .8.3 1.3.9 1.9l1.3 1.3c.8.8 1.3 1.7 1.3 2.9v6.3a2 2 0 0 1-2 2H8.5a2 2 0 0 1-2-2v-6.3c0-1.2.5-2.1 1.3-2.9L9.1 8c.6-.6.9-1.1.9-1.9V3.5Z" />
      <path d="M12 12.8c1.2 1.3 1.9 2.3 1.9 3.2a1.9 1.9 0 0 1-3.8 0c0-.9.7-1.9 1.9-3.2Z" />
    </>
  ),

  bell: (
    <>
      <path d="M18 16.5H6l1.2-2.1V11a4.8 4.8 0 0 1 9.6 0v3.4L18 16.5Z" />
      <path d="M10.4 19.5a1.8 1.8 0 0 0 3.2 0" />
      <path d="M12 6.2V4.5" />
    </>
  ),
};

/** Whether a stored name has a glyph of its own  --  the editor's icon picker uses it to warn. */
export function isBlockIcon(name: string): name is BlockIconName {
  return Object.hasOwn(GLYPHS, name);
}

export function BlockIcon({
  name,
  className = "size-4",
}: {
  /** Whatever the row holds. Unknown names fall back to the dot rather than rendering nothing. */
  name: string;
  className?: string;
}) {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {isBlockIcon(name) ? GLYPHS[name] : GLYPHS.dot}
    </svg>
  );
}
