"use client";

/**
 * Client-side providers.
 *
 * Only TanStack Query for now. The `useState` initialiser matters: creating the client at
 * module scope would share one cache across every request in a server process, and
 * creating it in the render body would throw the cache away on every re-render.
 */

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState, useEffect, type ReactNode } from "react";

function useServiceWorker() {
  useEffect(() => {
    if ("serviceWorker" in navigator && process.env.NODE_ENV === "production") {
      navigator.serviceWorker.register("/sw.js").catch(() => {
        // SW registration failed  --  no-op, the app still works.
      });
    }
  }, []);
}

export function Providers({ children }: { children: ReactNode }) {
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            // The day plan changes once a day; logs change when the user acts. Half a
            // minute of staleness is invisible and saves a lot of round trips.
            staleTime: 30_000,
            refetchOnWindowFocus: true,
            retry: 2,
          },
          mutations: {
            // Completions are optimistic; a failed retry would double-toggle.
            retry: 0,
          },
        },
      }),
  );

  return <QueryClientProvider client={client}><SwRegistrar />{children}</QueryClientProvider>;
}

function SwRegistrar() {
  useServiceWorker();
  return null;
}
