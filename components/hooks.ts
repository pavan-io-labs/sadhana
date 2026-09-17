"use client";

/**
 * The client hooks the shell and the Today view share.
 *
 * `useNow` is the app's only ticking clock  --  the Day Ring's hand, the countdowns and the
 * dosha accent all read from it, so nothing drifts out of step with anything else. There is
 * literally one `setInterval` behind it no matter how many components read it.
 *
 * It is built on `useSyncExternalStore` rather than `setState` inside an effect. The passage
 * of time is an external system and subscribing to one is what that hook is for; the effect
 * version re-renders once on mount before React can read the value, which is the cascading
 * render the lint rule is named after.
 */

import { useMemo, useSyncExternalStore } from "react";

/** Half a minute: fine enough for a minute-resolution dial, cheap enough to ignore. */
const TICK_MS = 30_000;

type Clock = {
  subscribe: (onChange: () => void) => () => void;
  /** `null` until the first tick, which lands on subscribe  --  that is, after mount. */
  read: () => number | null;
};

function createClock(intervalMs: number): Clock {
  const listeners = new Set<() => void>();
  let stamp: number | null = null;
  let timer: ReturnType<typeof setInterval> | undefined;

  const tick = () => {
    stamp = Date.now();
    for (const listener of listeners) listener();
  };

  return {
    subscribe(onChange) {
      listeners.add(onChange);
      // The first subscriber starts the timer and takes a reading immediately; later ones
      // just join. React re-reads the snapshot after subscribing, so that first reading is
      // picked up rather than lost.
      if (listeners.size === 1) {
        tick();
        timer = setInterval(tick, intervalMs);
      }
      return () => {
        listeners.delete(onChange);
        if (listeners.size === 0) {
          clearInterval(timer);
          timer = undefined;
        }
      };
    },
    read: () => stamp,
  };
}

const clock = createClock(TICK_MS);

/** There is no clock to subscribe to during a server render, and no mount to wait for. */
const readServer = () => null;

/**
 * The current time, updated every {@link TICK_MS}.
 *
 * `null` until after mount, deliberately: server and client would otherwise render different
 * times and React would report a hydration mismatch. Callers render a static, server-safe
 * state while it is null  --  see {@link useLiveDate} for the usual way to do that.
 */
export function useNow(): Date | null {
  const stamp = useSyncExternalStore(clock.subscribe, clock.read, readServer);
  return useMemo(() => (stamp === null ? null : new Date(stamp)), [stamp]);
}

const subscribeNever = () => () => {};
const onClient = () => true;
const onServer = () => false;

/** True once the component has mounted on the client, and never false again. */
export function useMounted(): boolean {
  return useSyncExternalStore(subscribeNever, onClient, onServer);
}

/**
 * The live clock, with the server's reading standing in until the client takes over.
 *
 * Every component that shows a time takes a `nowIso` prop captured on the server and passes
 * it here, so the first client render produces byte-identical markup and hydration is
 * silent  --  then the interval starts and the display goes live.
 */
export function useLiveDate(nowIso: string): Date {
  const now = useNow();
  return useMemo(() => now ?? new Date(nowIso), [now, nowIso]);
}
