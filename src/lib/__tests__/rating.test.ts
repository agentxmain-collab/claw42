import { describe, expect, test } from "vitest";
import { RATING_BG, RATING_COLOR, RATING_ORDER, computeRating } from "@/lib/rating";

describe("computeRating", () => {
  test("maps high-confidence long signals to StrongBuy", () => {
    expect(computeRating("long", 0.9)).toBe("StrongBuy");
    expect(computeRating("bullish", 90)).toBe("StrongBuy");
  });

  test("maps medium-confidence long signals to Buy", () => {
    expect(computeRating("long", 0.6)).toBe("Buy");
    expect(computeRating("bullish", 60)).toBe("Buy");
  });

  test("maps weak or neutral signals to Hold", () => {
    expect(computeRating("long", 0.49)).toBe("Hold");
    expect(computeRating("neutral", 0.95)).toBe("Hold");
    expect(computeRating("wait", 0.95)).toBe("Hold");
    expect(computeRating(null, 0.95)).toBe("Hold");
  });

  test("maps medium-confidence short signals to Sell", () => {
    expect(computeRating("short", 0.6)).toBe("Sell");
    expect(computeRating("bearish", 60)).toBe("Sell");
  });

  test("maps high-confidence short signals to StrongSell", () => {
    expect(computeRating("short", 0.9)).toBe("StrongSell");
    expect(computeRating("bearish", 90)).toBe("StrongSell");
  });

  test("keeps visual tokens complete for all five tiers", () => {
    expect(RATING_ORDER).toEqual(["StrongBuy", "Buy", "Hold", "Sell", "StrongSell"]);
    for (const rating of RATING_ORDER) {
      expect(RATING_COLOR[rating]).toBeTruthy();
      expect(RATING_BG[rating]).toBeTruthy();
    }
  });
});
