/**
 * Unit tests for the science-cards data module.
 */

import { describe, it, expect } from "vitest";
import {
  SCIENCE_CARDS,
  findCard,
  cardsForTag,
  cardsLinkedTo,
  TIERS,
  type EvidenceTier,
} from "@/data/science-cards";

describe("science-cards data", () => {
  it("has at least 20 cards", () => {
    expect(SCIENCE_CARDS.length).toBeGreaterThanOrEqual(20);
  });

  it("every card has a unique id", () => {
    const ids = SCIENCE_CARDS.map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("every card has a valid tier", () => {
    const validTiers: EvidenceTier[] = ["strong", "moderate", "weak", "traditional"];
    for (const card of SCIENCE_CARDS) {
      expect(validTiers).toContain(card.tier);
    }
  });

  it("every card has at least one citation", () => {
    for (const card of SCIENCE_CARDS) {
      expect(card.citations.length).toBeGreaterThanOrEqual(1);
    }
  });

  it("every card has at least one tag", () => {
    for (const card of SCIENCE_CARDS) {
      expect(card.tags.length).toBeGreaterThanOrEqual(1);
    }
  });

  it("TIERS has all four levels", () => {
    expect(Object.keys(TIERS)).toEqual(["strong", "moderate", "weak", "traditional"]);
  });
});

describe("findCard", () => {
  it("finds a card by id", () => {
    const card = findCard("morning-light");
    expect(card).toBeDefined();
    expect(card?.title).toBe("Morning Light Exposure");
    expect(card?.tier).toBe("strong");
  });

  it("returns undefined for unknown id", () => {
    expect(findCard("nonexistent")).toBeUndefined();
  });
});

describe("cardsForTag", () => {
  it("finds cards by tag", () => {
    const cards = cardsForTag("sleep");
    expect(cards.length).toBeGreaterThanOrEqual(2);
    for (const card of cards) {
      expect(card.tags).toContain("sleep");
    }
  });

  it("returns empty for unknown tag", () => {
    expect(cardsForTag("zzz-nonexistent")).toHaveLength(0);
  });
});

describe("cardsLinkedTo", () => {
  it("finds cards linked to a practice slug", () => {
    const cards = cardsLinkedTo("meditation");
    expect(cards.length).toBeGreaterThanOrEqual(1);
    for (const card of cards) {
      expect(card.linkedTo).toContain("meditation");
    }
  });

  it("returns empty for unlinked slug", () => {
    expect(cardsLinkedTo("zzz-nothing")).toHaveLength(0);
  });
});
