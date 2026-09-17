/**
 * /selftest  --  in-app verification page.
 *
 * Runs the same assertions as the test suite, but inside the running app,
 * so the user can verify on their own machine at any time.
 */

import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { renderSettings, dayInputFromSettings } from "@/lib/settings";
import { buildDayPlan } from "@/lib/day";
import { calendarDateInZone, toISODate, formatClock, isValidTimeZone } from "@/lib/time";
import { solarDay, type Location } from "@/lib/astro";
import { getDb } from "@/lib/db";

export const metadata = {
  title: "Self-Test",
  description: "In-app verification  --  green means everything works.",
};

type TestResult = {
  name: string;
  passed: boolean;
  detail: string;
};

async function runTests(): Promise<TestResult[]> {
  const results: TestResult[] = [];

  const test = (name: string, fn: () => string | true) => {
    try {
      const result = fn();
      if (result === true) {
        results.push({ name, passed: true, detail: "OK" });
      } else {
        results.push({ name, passed: false, detail: result });
      }
    } catch (e) {
      results.push({ name, passed: false, detail: String(e) });
    }
  };

  const testAsync = async (name: string, fn: () => Promise<string | true>) => {
    try {
      const result = await fn();
      if (result === true) {
        results.push({ name, passed: true, detail: "OK" });
      } else {
        results.push({ name, passed: false, detail: result });
      }
    } catch (e) {
      results.push({ name, passed: false, detail: String(e) });
    }
  };

  // 1. Settings loadable
  await testAsync("Settings load", async () => {
    const settings = await renderSettings();
    if (!settings.timeZone) return "No timezone in settings";
    return true;
  });

  // 2. Database connectable
  await testAsync("Database connection", async () => {
    const db = await getDb();
    if (!db) return "getDb() returned null";
    return true;
  });

  // 3. Timezone valid
  await testAsync("Timezone valid", async () => {
    const settings = await renderSettings();
    if (!isValidTimeZone(settings.timeZone)) return `Invalid timezone: ${settings.timeZone}`;
    return true;
  });

  // 4. Solar calculations
  test("Sunrise calculation (Hyderabad)", () => {
    const loc: Location = { latitude: 17.385, longitude: 78.4867, timeZone: "Asia/Kolkata" };
    const day = solarDay({ year: 2026, month: 3, day: 21 }, loc);
    if (day.sunrise === null) return "No sunrise on equinox!";
    // Equinox sunrise should be around 360 min (6:00 AM)
    if (day.sunrise < 340 || day.sunrise > 380) return `Unexpected sunrise: ${day.sunrise} min`;
    return true;
  });

  // 5. Day plan builds
  await testAsync("Day plan builds", async () => {
    const settings = await renderSettings();
    const today = calendarDateInZone(new Date(), settings.timeZone);
    const input = dayInputFromSettings(settings);
    const plan = buildDayPlan(today, input);
    if (!plan.date) return "Plan has no date";
    if (plan.landmarks.length < 3) return "Too few landmarks";
    return true;
  });

  // 6. formatClock works
  test("formatClock", () => {
    const result = formatClock(480, { hour24: true });
    if (result !== "08:00") return `Expected 08:00, got ${result}`;
    return true;
  });

  // 7. ISO date round-trip
  test("ISO date round-trip", () => {
    const date = { year: 2026, month: 9, day: 17 };
    const iso = toISODate(date);
    if (iso !== "2026-09-17") return `Expected 2026-09-17, got ${iso}`;
    return true;
  });

  return results;
}

export default async function SelftestPage() {
  const results = await runTests();
  const allPassed = results.every((r) => r.passed);

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-xl font-semibold tracking-tight text-text-1">Self-Test</h1>
        <p className="mt-1 text-sm text-text-3">
          {allPassed ? "All checks passed ✓" : "Some checks failed"}
        </p>
      </header>

      <Card padded={false}>
        <div className={`border-b border-line px-4 py-3 ${allPassed ? "bg-ok/5" : "bg-danger/5"}`}>
          <div className="flex items-center gap-2">
            <Badge tone={allPassed ? "ok" : "danger"}>
              {allPassed ? "All green" : "Issues found"}
            </Badge>
            <span className="text-sm text-text-2">
              {results.filter((r) => r.passed).length}/{results.length} passed
            </span>
          </div>
        </div>
        <div className="divide-y divide-line">
          {results.map((result, i) => (
            <div key={i} className="flex items-center justify-between px-4 py-3">
              <div className="flex items-center gap-3">
                <span className={`text-lg ${result.passed ? "text-ok" : "text-danger"}`}>
                  {result.passed ? "●" : "●"}
                </span>
                <div>
                  <p className="text-sm text-text-1">{result.name}</p>
                  <p className="text-xs text-text-3">{result.detail}</p>
                </div>
              </div>
              <Badge tone={result.passed ? "ok" : "danger"}>
                {result.passed ? "Pass" : "Fail"}
              </Badge>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
