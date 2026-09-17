import { describe, expect, it } from "vitest";

import { solarDay, type Location } from "@/lib/astro";
import {
  DOSHA_BANDS,
  DOSHA_LABELS,
  DOSHA_PERIODS,
  doshaAt,
  doshaProgress,
  nextDoshaChange,
} from "@/lib/dosha";
import { abhijitMuhurta, brahmaMuhurta } from "@/lib/muhurta";
import { addDays, MINUTES_PER_DAY, parseISODate } from "@/lib/time";

const HYDERABAD: Location = { latitude: 17.385, longitude: 78.4867, timeZone: "Asia/Kolkata" };

const at = (hhmm: string): number => {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
};

describe("DOSHA_PERIODS", () => {
  it("has six four-hour periods that tile the day", () => {
    expect(DOSHA_PERIODS).toHaveLength(6);
    for (const p of DOSHA_PERIODS) {
      expect(p.end - p.start).toBe(240);
    }
    const total = DOSHA_PERIODS.reduce((sum, p) => sum + (p.end - p.start), 0);
    expect(total).toBe(MINUTES_PER_DAY);
  });

  it("is contiguous, with only the last period running past midnight", () => {
    for (let i = 1; i < DOSHA_PERIODS.length; i += 1) {
      expect(DOSHA_PERIODS[i].start).toBe(DOSHA_PERIODS[i - 1].end);
    }
    expect(DOSHA_PERIODS[0].start).toBe(at("02:00"));
    expect(DOSHA_PERIODS[DOSHA_PERIODS.length - 1].end).toBe(at("02:00") + MINUTES_PER_DAY);
    expect(DOSHA_PERIODS.filter((p) => p.end > MINUTES_PER_DAY)).toHaveLength(1);
  });
});

describe("DOSHA_PERIODS ordering", () => {
  it("cycles vata, kapha, pitta twice", () => {
    expect(DOSHA_PERIODS.map((p) => p.dosha)).toEqual([
      "vata",
      "kapha",
      "pitta",
      "vata",
      "kapha",
      "pitta",
    ]);
    expect(DOSHA_PERIODS.map((p) => p.id)).toEqual([
      "vata-early",
      "kapha-morning",
      "pitta-midday",
      "vata-afternoon",
      "kapha-evening",
      "pitta-night",
    ]);
  });

  it("carries prose for every period and a label for every dosha", () => {
    for (const p of DOSHA_PERIODS) {
      expect(p.label.length).toBeGreaterThan(0);
      expect(p.qualities.length).toBeGreaterThan(0);
      expect(p.suits.length).toBeGreaterThan(0);
      expect(p.avoid.length).toBeGreaterThan(0);
      expect(DOSHA_LABELS[p.dosha]).toBeTruthy();
    }
    expect(Object.keys(DOSHA_LABELS).sort()).toEqual(["kapha", "pitta", "vata"]);
  });
});

describe("DOSHA_BANDS", () => {
  it("splits the wrapping period into seven drawable arcs", () => {
    expect(DOSHA_BANDS).toHaveLength(7);
    for (const b of DOSHA_BANDS) {
      expect(b.start).toBeGreaterThanOrEqual(0);
      expect(b.end).toBeLessThanOrEqual(MINUTES_PER_DAY);
      expect(b.end).toBeGreaterThan(b.start);
    }
  });

  it("tiles 0-1440 exactly, with no gap or overlap", () => {
    const sorted = [...DOSHA_BANDS].sort((a, b) => a.start - b.start);
    expect(sorted[0].start).toBe(0);
    expect(sorted[sorted.length - 1].end).toBe(MINUTES_PER_DAY);
    for (let i = 1; i < sorted.length; i += 1) {
      expect(sorted[i].start).toBe(sorted[i - 1].end);
    }
    const covered = DOSHA_BANDS.reduce((sum, b) => sum + (b.end - b.start), 0);
    expect(covered).toBe(MINUTES_PER_DAY);
  });

  it("attributes both night arcs to the same logical period", () => {
    const night = DOSHA_BANDS.filter((b) => b.period.id === "pitta-night");
    expect(night).toHaveLength(2);
    expect(night.map((b) => [b.start, b.end])).toEqual(
      expect.arrayContaining([
        [at("22:00"), MINUTES_PER_DAY],
        [0, at("02:00")],
      ]),
    );
  });
});

describe("doshaAt", () => {
  it("resolves every boundary to the period that starts there", () => {
    const expectations: Array<[string, string]> = [
      ["00:00", "pitta-night"],
      ["01:59", "pitta-night"],
      ["02:00", "vata-early"],
      ["05:59", "vata-early"],
      ["06:00", "kapha-morning"],
      ["09:59", "kapha-morning"],
      ["10:00", "pitta-midday"],
      ["13:59", "pitta-midday"],
      ["14:00", "vata-afternoon"],
      ["17:59", "vata-afternoon"],
      ["18:00", "kapha-evening"],
      ["21:59", "kapha-evening"],
      ["22:00", "pitta-night"],
      ["23:59", "pitta-night"],
    ];
    for (const [clock, id] of expectations) {
      expect(doshaAt(at(clock)).id, clock).toBe(id);
    }
  });

  it("wraps values outside a single day", () => {
    expect(doshaAt(-60).id).toBe("pitta-night");
    expect(doshaAt(MINUTES_PER_DAY).id).toBe("pitta-night");
    expect(doshaAt(MINUTES_PER_DAY + at("02:00")).id).toBe("vata-early");
    expect(doshaAt(-MINUTES_PER_DAY + at("07:00")).id).toBe("kapha-morning");
  });

  it("puts the routine's landmark times in the periods the plan assumes", () => {
    // 4:45 wake sits in the pre-dawn Vata window, 9:15 lights out in Kapha evening.
    expect(doshaAt(at("04:45")).id).toBe("vata-early");
    expect(doshaAt(at("21:15")).id).toBe("kapha-evening");
    // Deep work at midday is Pitta; the late-afternoon strength peak is Vata.
    expect(doshaAt(at("11:00")).dosha).toBe("pitta");
    expect(doshaAt(at("17:30")).dosha).toBe("vata");
  });
});

describe("nextDoshaChange", () => {
  it("counts down to the end of the current period", () => {
    expect(nextDoshaChange(at("02:00"))).toEqual({ inMinutes: 240, next: DOSHA_PERIODS[1] });
    expect(nextDoshaChange(at("05:00"))).toEqual({ inMinutes: 60, next: DOSHA_PERIODS[1] });
    expect(nextDoshaChange(at("13:59"))).toEqual({ inMinutes: 1, next: DOSHA_PERIODS[3] });
    expect(nextDoshaChange(at("21:59"))).toEqual({ inMinutes: 1, next: DOSHA_PERIODS[5] });
  });

  it("counts across midnight for the wrapping night period", () => {
    // 23:20 is 160 minutes from the 02:00 handover, not -1160.
    expect(nextDoshaChange(at("23:20"))).toEqual({ inMinutes: 160, next: DOSHA_PERIODS[0] });
    expect(nextDoshaChange(at("22:00"))).toEqual({ inMinutes: 240, next: DOSHA_PERIODS[0] });
    expect(nextDoshaChange(at("00:00"))).toEqual({ inMinutes: 120, next: DOSHA_PERIODS[0] });
    expect(nextDoshaChange(at("01:00"))).toEqual({ inMinutes: 60, next: DOSHA_PERIODS[0] });
  });

  it("always reports a positive countdown of at most one period", () => {
    for (let m = 0; m < MINUTES_PER_DAY; m += 1) {
      const { inMinutes } = nextDoshaChange(m);
      expect(inMinutes).toBeGreaterThan(0);
      expect(inMinutes).toBeLessThanOrEqual(240);
    }
  });
});

describe("doshaProgress", () => {
  it("runs 0 to 1 within a period", () => {
    expect(doshaProgress(at("02:00"))).toBe(0);
    expect(doshaProgress(at("04:00"))).toBe(0.5);
    expect(doshaProgress(at("05:59"))).toBeCloseTo(239 / 240, 9);
    expect(doshaProgress(at("06:00"))).toBe(0);
  });

  it("keeps increasing across midnight", () => {
    expect(doshaProgress(at("22:00"))).toBe(0);
    expect(doshaProgress(at("23:20"))).toBeCloseTo(1 / 3, 9);
    expect(doshaProgress(at("00:00"))).toBe(0.5);
    expect(doshaProgress(at("01:00"))).toBe(0.75);
    expect(doshaProgress(at("01:59"))).toBeCloseTo(239 / 240, 9);
  });

  it("stays inside 0-1 for every minute of the day", () => {
    for (let m = 0; m < MINUTES_PER_DAY; m += 1) {
      const p = doshaProgress(m);
      expect(p).toBeGreaterThanOrEqual(0);
      expect(p).toBeLessThan(1);
    }
  });
});

describe("agreement between the dosha clock and the muhurta windows", () => {
  const dates = ["2026-03-20", "2026-06-21", "2026-09-05", "2026-12-21"];

  it("keeps Brahma Muhurta inside the pre-dawn Vata period all year", () => {
    // What DOSHA_PERIODS[0].suits claims in prose, asserted numerically.
    for (const date of dates) {
      const d = parseISODate(date);
      const today = solarDay(d, HYDERABAD);
      const previousSunset = solarDay(addDays(d, -1), HYDERABAD).sunset! - MINUTES_PER_DAY;
      for (const mode of ["fixed", "proportional"] as const) {
        const w = brahmaMuhurta(today.sunrise!, previousSunset, mode);
        expect(doshaAt(w.start).id, `${date} ${mode} start`).toBe("vata-early");
        expect(doshaAt(w.end).id, `${date} ${mode} end`).toBe("vata-early");
      }
    }
  });

  it("keeps Abhijit Muhurta inside the Pitta midday period all year", () => {
    // The convergence the app leans on: the auspicious midday window and the
    // circadian peak for hard cognitive work are the same stretch of clock.
    for (const date of dates) {
      const today = solarDay(parseISODate(date), HYDERABAD);
      expect(doshaAt(today.solarNoon).dosha, date).toBe("pitta");
      for (const mode of ["fixed", "proportional"] as const) {
        const w = abhijitMuhurta(today.solarNoon, today.dayLength, mode);
        expect(doshaAt(w.start).id, `${date} ${mode} start`).toBe("pitta-midday");
        expect(doshaAt(w.end).id, `${date} ${mode} end`).toBe("pitta-midday");
      }
    }
  });

  it("shows the fixed clock and the sun diverging at sunset in winter", () => {
    // The dosha clock is fixed to the wall clock while sunset moves, so the two
    // do not always line up: Hyderabad's June sunset lands in Kapha evening, but
    // its December sunset falls before 18:00, while Vata afternoon still runs.
    // Worth pinning down, because it is why the app anchors *blocks* to the sun
    // and only the background bands to the clock.
    expect(doshaAt(solarDay(parseISODate("2026-06-21"), HYDERABAD).sunset!).id).toBe("kapha-evening");
    expect(doshaAt(solarDay(parseISODate("2026-12-21"), HYDERABAD).sunset!).id).toBe("vata-afternoon");

    for (const date of dates) {
      const sunset = solarDay(parseISODate(date), HYDERABAD).sunset!;
      // Either way it is within an hour of the 18:00 handover.
      expect(Math.abs(sunset - at("18:00")), date).toBeLessThan(60);
    }
  });
});
