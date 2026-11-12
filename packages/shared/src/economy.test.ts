import { describe, expect, it } from "vitest";
import { canAfford, formatCoins, listingFee, netSaleProceeds } from "./economy.js";

describe("listingFee", () => {
  it("charges five percent with a minimum", () => {
    expect(listingFee(100, 2)).toBe(10);
    expect(listingFee(1, 1)).toBe(1);
  });

  it("never returns a negative fee", () => {
    expect(listingFee(-50, 2)).toBe(1);
  });
});

describe("netSaleProceeds", () => {
  it("subtracts the listing fee from gross", () => {
    expect(netSaleProceeds(100, 2)).toBe(190);
  });
});

describe("canAfford", () => {
  it("accepts valid costs", () => {
    expect(canAfford(50, 50)).toBe(true);
  });

  it("rejects invalid or excessive costs", () => {
    expect(canAfford(50, 51)).toBe(false);
    expect(canAfford(50, -1)).toBe(false);
    expect(canAfford(50, 1.5)).toBe(false);
  });
});

describe("formatCoins", () => {
  it("formats whole amounts", () => {
    expect(formatCoins(1234.9)).toBe("1,234c");
  });
});
