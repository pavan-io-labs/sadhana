"use client";

/**
 * Step one  --  where the sun is.
 *
 * The whole app hangs off latitude, so this is the only answer that cannot be defaulted.
 * Three ways in, in descending order of how often they will be right: pick a listed city,
 * use the device's location, or type a coordinate. All three end up as the same draft.
 */

import { useId, useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { Field, inputClass } from "@/components/ui/field";
import { findCity, INDIAN_CITIES, searchCities } from "@/data/cities-in";
import { isValidTimeZone } from "@/lib/time";

import {
  browserTimeZone,
  customLocation,
  type LocationDraft,
  type ResolvedLocation,
  locationOfDraft,
} from "./draft";

type GeoState = { status: "idle" | "asking" } | { status: "failed"; message: string };

export function LocationStep({
  value,
  onChange,
}: {
  value: LocationDraft;
  onChange: (next: LocationDraft) => void;
}) {
  const id = useId();
  const [query, setQuery] = useState("");
  const [geo, setGeo] = useState<GeoState>({ status: "idle" });
  const current = locationOfDraft(value);

  const results = useMemo(() => {
    const matches = searchCities(query, 8);
    if (query.trim()) return matches;
    // With nothing typed the list is just the top of the alphabet, which would show the
    // user's own city unselected  --  or, for anyone past C, not at all. Pin the current choice
    // to the front so the grid always answers "which one am I on?".
    const chosen = value.kind === "city" ? findCity(value.cityId) : undefined;
    if (!chosen) return matches;
    return [chosen, ...matches.filter((city) => city.id !== chosen.id)].slice(0, 8);
  }, [query, value]);

  const useMyLocation = () => {
    if (!("geolocation" in navigator)) {
      setGeo({ status: "failed", message: "This browser does not offer a location." });
      return;
    }
    setGeo({ status: "asking" });
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        onChange(customLocation(latitude, longitude, browserTimeZone()));
        setGeo({ status: "idle" });
      },
      (error) => {
        setGeo({
          status: "failed",
          // Denying the prompt is a choice, not a fault, so it reads differently.
          message:
            error.code === error.PERMISSION_DENIED
              ? "No location shared  --  pick a city instead, or type a coordinate below."
              : "The device could not fix a position. Pick a city instead.",
        });
      },
      { timeout: 10_000, maximumAge: 600_000 },
    );
  };

  return (
    <div className="space-y-4">
      <div>
        <Field
          label="Your city"
          htmlFor={`${id}-city`}
          hint="Sunrise differs by more than an hour across India on the same clock, so this changes every time the app shows you."
        >
          <input
            id={`${id}-city`}
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={(event) => {
              // Enter in a search box means "that one", not "next step"  --  the form would
              // otherwise advance while the typed city was still unselected.
              const first = results[0];
              if (event.key === "Enter" && first) {
                event.preventDefault();
                onChange({ kind: "city", cityId: first.id });
                setQuery(first.name);
              }
            }}
            placeholder={`Search ${INDIAN_CITIES.length} Indian cities`}
            className={inputClass}
            autoComplete="address-level2"
          />
        </Field>

        <ul className="mt-2 grid gap-1.5 sm:grid-cols-2">
          {results.map((city) => {
            const selected = value.kind === "city" && value.cityId === city.id;
            return (
              <li key={city.id}>
                <button
                  type="button"
                  onClick={() => onChange({ kind: "city", cityId: city.id })}
                  aria-pressed={selected}
                  className={`w-full rounded-lg border px-3 py-2 text-left transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent ${
                    selected
                      ? "border-accent bg-accent/10"
                      : "border-line bg-surface-2 hover:border-line-strong"
                  }`}
                >
                  <span className="block text-sm font-medium text-text-1">{city.name}</span>
                  <span className="block text-xs text-text-3">{city.region}</span>
                </button>
              </li>
            );
          })}
          {results.length === 0 ? (
            <li className="text-sm text-text-3">
              No match. Use your device location, or type the coordinate below.
            </li>
          ) : null}
        </ul>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Button
          type="button"
          variant="secondary"
          size="sm"
          onClick={useMyLocation}
          disabled={geo.status === "asking"}
        >
          {geo.status === "asking" ? "Asking the browser…" : "Use my location"}
        </Button>
        <p className="text-xs text-text-3">
          Read once, stored on this machine, never sent anywhere.
        </p>
      </div>
      {geo.status === "failed" ? (
        <p role="status" className="text-xs text-warn">
          {geo.message}
        </p>
      ) : null}

      <details className="rounded-lg border border-line bg-surface-2 px-3 py-2.5">
        <summary className="cursor-pointer text-sm font-medium text-text-2">
          Somewhere else  --  enter a coordinate
        </summary>
        {/*
          Keyed on the resolved coordinate so that picking a city above resets these fields
          rather than leaving a stale one loaded and one click from being re-applied. The
          `<details>` stays out here, so its open state survives that reset.
        */}
        <ManualEntry
          key={`${current.latitude},${current.longitude},${current.timeZone}`}
          current={current}
          onChange={onChange}
        />
      </details>

      <p className="nums text-xs text-text-3">
        Using {current.city}
        {current.region ? `, ${current.region}` : ""} · {current.latitude.toFixed(3)}°,{" "}
        {current.longitude.toFixed(3)}° · {current.timeZone}
      </p>
    </div>
  );
}

/**
 * The coordinate escape hatch.
 *
 * Inside a `<details>` because it is the least likely path and the most intimidating  -- 
 * but it is the only one that works outside the shipped city table, so it is not hidden
 * behind anything harder than one click. The `<details>` itself belongs to the caller;
 * this is only the body, so remounting it to reset the fields does not close the panel.
 */
function ManualEntry({
  current,
  onChange,
}: {
  current: ResolvedLocation;
  onChange: (next: LocationDraft) => void;
}) {
  const id = useId();
  const [latitude, setLatitude] = useState(String(current.latitude));
  const [longitude, setLongitude] = useState(String(current.longitude));
  const [timeZone, setTimeZone] = useState(current.timeZone);
  const [error, setError] = useState<string | null>(null);

  const apply = () => {
    const lat = Number(latitude);
    const lon = Number(longitude);
    if (!Number.isFinite(lat) || lat < -90 || lat > 90) {
      setError("Latitude must be a number between −90 and 90.");
      return;
    }
    if (!Number.isFinite(lon) || lon < -180 || lon > 180) {
      setError("Longitude must be a number between −180 and 180.");
      return;
    }
    if (!isValidTimeZone(timeZone)) {
      setError(`"${timeZone}" is not a time zone this browser knows.`);
      return;
    }
    setError(null);
    onChange(customLocation(lat, lon, timeZone));
  };

  return (
    <>
      <div className="mt-3 grid gap-3 sm:grid-cols-3">
        <Field label="Latitude" htmlFor={`${id}-lat`}>
          <input
            id={`${id}-lat`}
            type="text"
            inputMode="decimal"
            value={latitude}
            onChange={(event) => setLatitude(event.target.value)}
            className={inputClass}
          />
        </Field>
        <Field label="Longitude" htmlFor={`${id}-lon`} hint="Positive east.">
          <input
            id={`${id}-lon`}
            type="text"
            inputMode="decimal"
            value={longitude}
            onChange={(event) => setLongitude(event.target.value)}
            className={inputClass}
          />
        </Field>
        <Field label="Time zone" htmlFor={`${id}-tz`} hint="IANA id.">
          <input
            id={`${id}-tz`}
            type="text"
            value={timeZone}
            onChange={(event) => setTimeZone(event.target.value)}
            className={inputClass}
            spellCheck={false}
          />
        </Field>
      </div>
      {error ? (
        <p role="alert" className="mt-2 text-xs text-danger">
          {error}
        </p>
      ) : null}
      <Button type="button" variant="secondary" size="sm" className="mt-3" onClick={apply}>
        Use this coordinate
      </Button>
    </>
  );
}
