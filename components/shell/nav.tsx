"use client";

/**
 * Navigation, in the two shapes the layout needs: a sidebar list from `lg` up and a tab
 * bar below it. Both read the same `NAV_ITEMS`, so a view added in a later phase appears
 * in both places at once.
 *
 * `aria-current="page"` is what marks the active item; the accent tint is decoration on
 * top of it.
 */

import Link from "next/link";
import { usePathname } from "next/navigation";

import { activeNavItem, NAV_ITEMS, type NavItem } from "@/lib/nav";

function Icon({ d }: { d: string }) {
  return (
    <svg
      aria-hidden
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="size-5 shrink-0"
    >
      <path d={d} />
    </svg>
  );
}

function useActiveHref(): string | undefined {
  return activeNavItem(usePathname() ?? "/")?.href;
}

export function SidebarNav() {
  const active = useActiveHref();
  return (
    <nav aria-label="Main" className="flex flex-col gap-0.5">
      {NAV_ITEMS.map((item) => (
        <SidebarLink key={item.href} item={item} current={item.href === active} />
      ))}
    </nav>
  );
}

function SidebarLink({ item, current }: { item: NavItem; current: boolean }) {
  return (
    <Link
      href={item.href}
      aria-current={current ? "page" : undefined}
      className={`flex items-start gap-3 rounded-lg px-3 py-2 transition-colors ${
        current ? "bg-accent/10 text-accent" : "text-text-2 hover:bg-surface-2 hover:text-text-1"
      }`}
    >
      <span className="mt-0.5">
        <Icon d={item.icon} />
      </span>
      <span className="min-w-0">
        <span className="block text-sm font-medium">{item.label}</span>
        <span className="block text-xs leading-snug text-text-3">{item.blurb}</span>
      </span>
    </Link>
  );
}

export function TabBarNav() {
  const active = useActiveHref();
  return (
    <nav
      aria-label="Main"
      className="border-t border-line bg-surface-1/95 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden"
    >
      <ul className="mx-auto flex max-w-lg items-stretch">
        {NAV_ITEMS.map((item) => {
          const current = item.href === active;
          return (
            <li key={item.href} className="flex-1">
              <Link
                href={item.href}
                aria-current={current ? "page" : undefined}
                className={`flex flex-col items-center gap-1 px-2 py-2.5 text-[0.6875rem] font-medium transition-colors ${
                  current ? "text-accent" : "text-text-3 hover:text-text-1"
                }`}
              >
                <Icon d={item.icon} />
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

/** The current view's name, for the mobile header. */
export function CurrentViewLabel() {
  const item = activeNavItem(usePathname() ?? "/");
  return <>{item?.label ?? "Sadhana"}</>;
}
