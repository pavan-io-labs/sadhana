/**
 * The wire schemas, and one bug they are here to keep fixed.
 *
 * `blockFieldsSchema` is fed by a form whose numeric inputs hold *text*, so it has to answer the
 * question `z.coerce.number()` gets wrong: what does an empty box mean? Coercion says zero, which
 * is a legal offset, a legal duration and a legal lead time  --  so a user who cleared a field to
 * retype it and then saved would have silently written `0` and been told nothing. Every case below
 * that asserts a rejection is guarding that: the schema is the only thing standing between a
 * cleared text box and a block that quietly moved to its anchor.
 *
 * The rest pins the parts of the block wire that other layers assume  --  the defaults the editor
 * relies on not sending, the `href` path guard, and the shape `fieldErrors` produces, since the
 * form looks its messages up by field name.
 */

import { describe, expect, it } from "vitest";

import {
  blockFieldsSchema,
  blockInputSchema,
  type BlockFields,
  fieldErrors,
  parseSearchParams,
  scheduleQuerySchema,
} from "@/lib/validators";

/** The twelve fields the editor sends, all valid, as strings where the inputs hold strings. */
function formValues(over: Record<string, unknown> = {}) {
  return {
    title: "Sit, twenty minutes",
    detail: "",
    category: "practice",
    anchor: "sunrise",
    offsetMinutes: "18",
    durationMinutes: "2",
    fuel: "any",
    weekdayMask: 127,
    notify: false,
    notifyLeadMinutes: "5",
    icon: "dot",
    enabled: true,
    ...over,
  };
}

/** The messages for one field, or `[]`  --  the same lookup `BlockForm` does per input. */
function errorsOn(field: string, over: Record<string, unknown>): string[] {
  const parsed = blockFieldsSchema.safeParse(formValues(over));
  if (parsed.success) return [];
  return fieldErrors(parsed.error)[field] ?? [];
}

describe("blockFieldsSchema  --  numbers arriving as text", () => {
  it("accepts the digits a form field actually holds", () => {
    const parsed = blockFieldsSchema.parse(formValues());
    expect(parsed.offsetMinutes).toBe(18);
    expect(parsed.durationMinutes).toBe(2);
    expect(parsed.notifyLeadMinutes).toBe(5);
  });

  it("accepts a signed offset, either sign written out", () => {
    expect(blockFieldsSchema.parse(formValues({ offsetMinutes: "-96" })).offsetMinutes).toBe(-96);
    expect(blockFieldsSchema.parse(formValues({ offsetMinutes: "+30" })).offsetMinutes).toBe(30);
  });

  it("accepts a real number, which is how the presets and rule fixes build blocks", () => {
    expect(blockFieldsSchema.parse(formValues({ offsetMinutes: -75 })).offsetMinutes).toBe(-75);
  });

  // The defect this file exists for: every one of these coerces to 0 under `z.coerce.number()`,
  // and 0 is inside every one of these ranges, so each would have saved without a word.
  it.each([
    ["empty", ""],
    ["whitespace", "   "],
    ["a lone minus, mid-type", "-"],
    ["not a number at all", "soon"],
  ])("rejects an offset that is %s", (_label, value) => {
    expect(errorsOn("offsetMinutes", { offsetMinutes: value })).toEqual([
      "The offset needs a whole number of minutes.",
    ]);
  });

  it("rejects the same emptiness in duration and lead time", () => {
    expect(errorsOn("durationMinutes", { durationMinutes: "" })).toEqual([
      "The duration needs a whole number of minutes.",
    ]);
    expect(errorsOn("notifyLeadMinutes", { notify: true, notifyLeadMinutes: "" })).toEqual([
      "The lead time needs a whole number of minutes.",
    ]);
  });

  // `Number()` is happy with all three of these, which is the other half of why coercion is the
  // wrong tool: it does not just misread emptiness, it invents values out of notation.
  it.each([
    ["exponent notation", "1e3", 1000],
    ["hexadecimal", "0x1e", 30],
    ["a leading dot", ".5", 0.5],
  ])("rejects %s rather than reading it as %s", (_label, value) => {
    expect(errorsOn("offsetMinutes", { offsetMinutes: value })).toEqual([
      "The offset needs a whole number of minutes.",
    ]);
  });

  it("rejects a fraction with a message about wholeness, not about range", () => {
    expect(errorsOn("durationMinutes", { durationMinutes: 4.5 })).toEqual([
      "The duration has to be a whole number of minutes.",
    ]);
  });

  it("names the bounds when a number is out of range, minus sign included", () => {
    expect(errorsOn("offsetMinutes", { offsetMinutes: "-800" })).toEqual([
      "The offset has to be between −720 and 1440.",
    ]);
    expect(errorsOn("durationMinutes", { durationMinutes: "900" })).toEqual([
      "The duration has to be between 0 and 720.",
    ]);
  });

  it("still accepts the zeros that mean something", () => {
    // A duration of zero is a moment rather than a stretch, and a mask of zero is a block that
    // stays on the routine and never resolves. Both are documented, so both have to parse.
    const parsed = blockFieldsSchema.parse(
      formValues({ durationMinutes: "0", offsetMinutes: "0", weekdayMask: 0 }),
    );
    expect(parsed.durationMinutes).toBe(0);
    expect(parsed.weekdayMask).toBe(0);
  });
});

describe("blockFieldsSchema  --  the rest of the form", () => {
  it("trims the title and rejects one that was only spaces", () => {
    expect(blockFieldsSchema.parse(formValues({ title: "  Sit  " })).title).toBe("Sit");
    expect(errorsOn("title", { title: "   " })).toHaveLength(1);
  });

  it("carries no href or scienceIds, so a PATCH cannot strip a shipped block of either", () => {
    const parsed: BlockFields = blockFieldsSchema.parse(formValues());
    expect(parsed).not.toHaveProperty("href");
    expect(parsed).not.toHaveProperty("scienceIds");
  });

  it("reports every bad field at once, keyed the way the form looks them up", () => {
    const parsed = blockFieldsSchema.safeParse(
      formValues({ title: "", offsetMinutes: "", durationMinutes: "" }),
    );
    expect(parsed.success).toBe(false);
    if (parsed.success) return;
    expect(Object.keys(fieldErrors(parsed.error)).sort()).toEqual([
      "durationMinutes",
      "offsetMinutes",
      "title",
    ]);
  });
});

describe("blockInputSchema", () => {
  const full = {
    title: "Outside",
    category: "light",
    anchor: "wake",
    offsetMinutes: 15,
    durationMinutes: 25,
  };

  it("fills the eight defaults a caller may leave out", () => {
    const parsed = blockInputSchema.parse(full);
    expect(parsed).toMatchObject({
      detail: "",
      fuel: "any",
      weekdayMask: 127,
      notify: false,
      notifyLeadMinutes: 5,
      icon: "dot",
      scienceIds: [],
      href: null,
      enabled: true,
    });
  });

  it("takes an in-app path and refuses an absolute URL", () => {
    expect(blockInputSchema.parse({ ...full, href: "/mindgym/pvt" }).href).toBe("/mindgym/pvt");
    const parsed = blockInputSchema.safeParse({ ...full, href: "https://example.com" });
    expect(parsed.success).toBe(false);
  });
});

describe("parseSearchParams", () => {
  it("coerces a query string and applies the schedule defaults", () => {
    const parsed = parseSearchParams(
      scheduleQuerySchema,
      new URLSearchParams("days=7&includeDisabled=true"),
    );
    expect(parsed.success && parsed.data).toEqual({
      days: 7,
      includeDisabled: true,
      gapThreshold: 90,
    });
  });

  it("keys an unpathed issue under `_`, which the form renders as a whole-form message", () => {
    const parsed = scheduleQuerySchema.safeParse({ days: 99 });
    expect(parsed.success).toBe(false);
    if (parsed.success) return;
    expect(Object.keys(fieldErrors(parsed.error))).toEqual(["days"]);
  });
});
