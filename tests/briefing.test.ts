/**
 * Unit tests for lib/briefing  --  template-composed morning and evening briefings.
 */

import { describe, it, expect } from "vitest";
import { composeMorningBriefing, composeEveningBriefing } from "@/lib/briefing";
import type { DayPlan } from "@/lib/day";

const mockPlan: DayPlan = {
  date: "2026-09-17",
  place: { city: "Hyderabad", latitude: 17.385, longitude: 78.487 },
  sun: { sunrise: 360, sunset: 1080, solarNoon: 720, dayLengthMinutes: 720, twilight: { civilStart: 345, civilEnd: 1095 } },
  muhurta: {
    brahma: { start: 264, end: 312 },
    sandhya: { start: 312, end: 360 },
    abhijit: { start: 696, end: 744 },
  },
  dosha: { current: "kapha", period: { start: 360, end: 600, label: "Kapha morning" } },
  personal: {
    wake: 330,
    bedtime: 1275,
    sleepTargetMinutes: 480,
    caffeineCutoff: 765,
    lastFoodBy: 1155,
  },
  landmarks: [],
  blocks: [],
} as unknown as DayPlan;

const baseInput = {
  plan: mockPlan,
  clock24h: true,
  activeTrack: "sandhya",
  sessionNames: ["Strength A"],
  isDeload: false,
  completedBlocks: 0,
  totalBlocks: 10,
  sleepMinutes: null,
  restingHr: null,
  pvtMedianRt: null,
  caffeineMg: 0,
  lastFoodMinute: null,
  waterMl: 0,
};

describe("Morning briefing", () => {
  it("produces a morning briefing with sections", () => {
    const b = composeMorningBriefing(baseInput);
    expect(b.kind).toBe("morning");
    expect(b.date).toBe("2026-09-17");
    expect(b.sections.length).toBeGreaterThanOrEqual(3);
  });

  it("includes solar anchors", () => {
    const b = composeMorningBriefing(baseInput);
    const anchors = b.sections.find((s) => s.heading === "Today's anchors");
    expect(anchors).toBeDefined();
    expect(anchors!.body).toContain("Hyderabad");
  });

  it("includes training info", () => {
    const b = composeMorningBriefing(baseInput);
    const training = b.sections.find((s) => s.heading === "Training");
    expect(training).toBeDefined();
    expect(training!.body).toContain("Strength A");
  });

  it("mentions deload when active", () => {
    const b = composeMorningBriefing({ ...baseInput, isDeload: true });
    const training = b.sections.find((s) => s.heading === "Training");
    expect(training!.body).toContain("deload");
  });

  it("includes science card of the day", () => {
    const b = composeMorningBriefing(baseInput);
    const science = b.sections.find((s) => s.heading === "Science of the day");
    expect(science).toBeDefined();
  });

  it("shows sleep check-in when sleep is logged", () => {
    const b = composeMorningBriefing({ ...baseInput, sleepMinutes: 420 });
    const sleep = b.sections.find((s) => s.heading === "Last night");
    expect(sleep).toBeDefined();
    expect(sleep!.body).toContain("7.0h");
  });

  it("includes PVT in sleep section when available", () => {
    const b = composeMorningBriefing({ ...baseInput, sleepMinutes: 480, pvtMedianRt: 245 });
    const sleep = b.sections.find((s) => s.heading === "Last night");
    expect(sleep!.body).toContain("245 ms");
  });
});

describe("Evening briefing", () => {
  it("produces an evening briefing", () => {
    const b = composeEveningBriefing({
      ...baseInput,
      completedBlocks: 8,
      totalBlocks: 10,
    });
    expect(b.kind).toBe("evening");
    expect(b.sections.length).toBeGreaterThanOrEqual(3);
  });

  it("shows completion rate", () => {
    const b = composeEveningBriefing({
      ...baseInput,
      completedBlocks: 8,
      totalBlocks: 10,
    });
    const completion = b.sections.find((s) => s.heading === "Today's completion");
    expect(completion).toBeDefined();
    expect(completion!.body).toContain("80%");
  });

  it("includes the three numbers when available", () => {
    const b = composeEveningBriefing({
      ...baseInput,
      sleepMinutes: 450,
      restingHr: 62,
      pvtMedianRt: 230,
    });
    const numbers = b.sections.find((s) => s.heading === "The three numbers");
    expect(numbers).toBeDefined();
    expect(numbers!.body).toContain("62 bpm");
    expect(numbers!.body).toContain("230 ms");
  });

  it("includes wind-down section", () => {
    const b = composeEveningBriefing(baseInput);
    const wind = b.sections.find((s) => s.heading === "Wind-down");
    expect(wind).toBeDefined();
    expect(wind!.body).toContain("Dim screens");
  });
});
