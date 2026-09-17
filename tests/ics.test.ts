/**
 * Unit tests for lib/ics  --  ICS calendar export.
 */

import { describe, it, expect } from "vitest";
import { generateIcs } from "@/lib/ics";

describe("ICS generation", () => {
  const date = { year: 2026, month: 9, day: 17 };
  const tz = "Asia/Kolkata";

  it("produces a valid VCALENDAR wrapper", () => {
    const ics = generateIcs(date, [], tz);
    expect(ics).toContain("BEGIN:VCALENDAR");
    expect(ics).toContain("END:VCALENDAR");
    expect(ics).toContain("VERSION:2.0");
    expect(ics).toContain("PRODID:-//Sadhana//Dinacharya OS//EN");
  });

  it("creates VEVENT entries for blocks", () => {
    const blocks = [
      { title: "Brahma Muhurta", startMinute: 285, durationMinutes: 48 },
      { title: "Meditation", startMinute: 333, durationMinutes: 15, description: "Seated mindfulness" },
    ];
    const ics = generateIcs(date, blocks, tz);

    expect(ics).toContain("SUMMARY:Brahma Muhurta");
    expect(ics).toContain("SUMMARY:Meditation");
    expect(ics).toContain("DESCRIPTION:Seated mindfulness");
    expect(ics).toContain("DTSTART;TZID=Asia/Kolkata:20260917T044500");
    expect(ics).toContain("DTEND;TZID=Asia/Kolkata:20260917T053300");
  });

  it("includes a 5-minute VALARM", () => {
    const blocks = [{ title: "Walk", startMinute: 360, durationMinutes: 30 }];
    const ics = generateIcs(date, blocks, tz);

    expect(ics).toContain("BEGIN:VALARM");
    expect(ics).toContain("TRIGGER:-PT5M");
    expect(ics).toContain("END:VALARM");
  });

  it("escapes special characters in titles", () => {
    const blocks = [{ title: "Nadi Shodhana; 5 rounds, calm", startMinute: 340, durationMinutes: 10 }];
    const ics = generateIcs(date, blocks, tz);

    expect(ics).toContain("SUMMARY:Nadi Shodhana\\; 5 rounds\\, calm");
  });

  it("generates unique UIDs per block", () => {
    const blocks = [
      { title: "A", startMinute: 300, durationMinutes: 10 },
      { title: "B", startMinute: 310, durationMinutes: 10 },
    ];
    const ics = generateIcs(date, blocks, tz);

    const uids = ics.match(/UID:.+/g) ?? [];
    expect(uids.length).toBe(2);
    expect(uids[0]).not.toBe(uids[1]);
  });
});
