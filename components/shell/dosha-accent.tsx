"use client";

/**
 * Keeps `<html data-dosha>` in step with the clock.
 *
 * The accent is a CSS custom property re-pointed by that attribute, so one attribute
 * write re-tints the entire interface  --  no React state threading, no re-render. The
 * server sets the initial value so there is no flash of the wrong hue on first paint;
 * this only takes over the updates.
 *
 * Colour is never the only signal: every band and badge also carries its dosha name in
 * text, so the tint is atmosphere rather than information.
 */

import { useEffect } from "react";

import { doshaAt } from "@/lib/dosha";
import { minuteOfDayInZone } from "@/lib/time";

export function DoshaAccent({
  timeZone,
  enabled,
}: {
  timeZone: string;
  enabled: boolean;
}) {
  useEffect(() => {
    const root = document.documentElement;

    if (!enabled) {
      root.dataset.doshaAccent = "off";
      root.removeAttribute("data-dosha");
      return;
    }

    root.removeAttribute("data-dosha-accent");
    const apply = () => {
      root.dataset.dosha = doshaAt(minuteOfDayInZone(new Date(), timeZone)).dosha;
    };
    apply();

    // A period boundary is a four-hour event; a minute of lag is imperceptible and the
    // interval is cheap enough to leave running.
    const id = setInterval(apply, 60_000);
    return () => clearInterval(id);
  }, [timeZone, enabled]);

  return null;
}
