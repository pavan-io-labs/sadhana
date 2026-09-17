/**
 * The navigation model.
 *
 * One list, used by the sidebar, the mobile tab bar, and the document title. Entries are
 * added as each build phase lands a view, so the shell never links to a route that does
 * not exist yet  --  a dead nav item is worse than a missing one.
 */

export type NavItem = {
  href: string;
  label: string;
  /** Shown under the label in the sidebar, and as the page's meta description. */
  blurb: string;
  /** Inline SVG path data, 24x24 viewBox. Icons are drawn, not imported, to keep the bundle small. */
  icon: string;
};

/** A ring-and-hand mark for Today, matching the Day Ring. */
const ICON_TODAY = "M12 3a9 9 0 1 0 0 18 9 9 0 1 0 0-18Z M12 7.5V12l3.5 2";
/** A day's axis with three blocks hung off it, at three different lengths. */
const ICON_TIMELINE = "M4 4v16 M7 7.5h10 M7 12h13 M7 16.5h6";
/** A dumbbell, for Train. */
const ICON_TRAIN = "M6.5 6.5V17.5 M17.5 6.5V17.5 M6.5 12H17.5 M2 9v6 M22 9v6";
/** A lotus-like shape, for Practice. */
const ICON_PRACTICE = "M12 21c-4-4-8-7.5-8-11a4 4 0 0 1 8-2 4 4 0 0 1 8 2c0 3.5-4 7-8 11Z";
/** A bowl or leaf, for Nourish. */
const ICON_NOURISH = "M3 12c0-4.97 4.03-9 9-9s9 4.03 9 9 M5 12h14 M12 3v9 M7 12c0 2.76 2.24 5 5 5s5-2.24 5-5";
const ICON_SETTINGS =
  "M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z M19.4 15a1.7 1.7 0 0 0 .34 1.87l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.7 1.7 0 0 0-2.87 1.2V21a2 2 0 1 1-4 0v-.11a1.7 1.7 0 0 0-2.87-1.2l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.7 1.7 0 0 0 3.11 14H3a2 2 0 1 1 0-4h.11a1.7 1.7 0 0 0 1.2-2.87l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.7 1.7 0 0 0 10 3.11V3a2 2 0 1 1 4 0v.11a1.7 1.7 0 0 0 2.87 1.2l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.7 1.7 0 0 0 20.89 10H21a2 2 0 1 1 0 4h-.11a1.7 1.7 0 0 0-1.49 1Z";

export const NAV_ITEMS: readonly NavItem[] = [
  {
    href: "/",
    label: "Today",
    blurb: "Where you are in the day",
    icon: ICON_TODAY,
  },
  {
    href: "/timeline",
    label: "Timeline",
    blurb: "The routine, and what it comes to",
    icon: ICON_TIMELINE,
  },
  {
    href: "/train",
    label: "Train",
    blurb: "Today's session, logged",
    icon: ICON_TRAIN,
  },
  {
    href: "/practice",
    label: "Practice",
    blurb: "Meditation, pranayama, nidra",
    icon: ICON_PRACTICE,
  },
  {
    href: "/nourish",
    label: "Nourish",
    blurb: "Meals, caffeine, hydration",
    icon: ICON_NOURISH,
  },
  {
    href: "/mindgym",
    label: "Mind Gym",
    blurb: "Cognitive games and tracking",
    icon: "M12 2a7 7 0 0 0-7 7c0 2.38 1.19 4.47 3 5.74V17a2 2 0 0 0 2 2h4a2 2 0 0 0 2-2v-2.26c1.81-1.27 3-3.36 3-5.74a7 7 0 0 0-7-7Z M9 21h6",
  },
  {
    href: "/science",
    label: "Science",
    blurb: "Evidence cards and literature",
    icon: "M4 19.5A2.5 2.5 0 0 1 6.5 17H20 M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2Z",
  },
  {
    href: "/insights",
    label: "Insights",
    blurb: "Charts, trends, correlations",
    icon: "M3 3v18h18 M7 16l4-8 4 5 5-9",
  },
  {
    href: "/settings",
    label: "Settings",
    blurb: "Location, muhurta mode, sleep",
    icon: ICON_SETTINGS,
  },
];

/** The nav entry a pathname belongs to, longest match first so nested routes resolve. */
export function activeNavItem(pathname: string): NavItem | undefined {
  const candidates = NAV_ITEMS.filter(
    (item) => pathname === item.href || (item.href !== "/" && pathname.startsWith(`${item.href}/`)),
  );
  return candidates.sort((a, b) => b.href.length - a.href.length)[0];
}

/**
 * The routes that exist right now, nav or not.
 *
 * Blocks carry their own `href`  --  the shipped presets point at `/practice`, `/train`,
 * `/nourish`, `/mindgym/pvt` and `/briefing`  --  and those views arrive in later phases. Until
 * they do the link is simply not drawn, for the same reason `NAV_ITEMS` is short. Add the
 * prefix here in the same change that lands the page.
 */
const LIVE_ROUTES: readonly string[] = ["/", "/settings", "/timeline", "/train", "/practice", "/nourish", "/mindgym", "/science", "/insights", "/briefing", "/selftest"];

export function isLiveRoute(href: string): boolean {
  return LIVE_ROUTES.some(
    (route) => href === route || (route !== "/" && href.startsWith(`${route}/`)),
  );
}
