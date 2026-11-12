import { describe, expect, it } from "vitest";
import { angleDelta, applyDamage, isInAttackArc, isInsideSafeZone, randomInt } from "./combat.js";

describe("angleDelta", () => {
  it("wraps across the -PI/PI seam", () => {
    expect(angleDelta(Math.PI - 0.1, -Math.PI + 0.1)).toBeCloseTo(0.2);
  });

  it("returns zero for identical angles", () => {
    expect(angleDelta(1.2, 1.2)).toBe(0);
  });
});

describe("isInAttackArc", () => {
  const origin = { x: 0, z: 0 };

  it("hits a target in front", () => {
    expect(isInAttackArc(origin, 0, { x: 0, z: -2 })).toBe(true);
  });

  it("misses a target behind", () => {
    expect(isInAttackArc(origin, 0, { x: 0, z: 2 })).toBe(false);
  });

  it("hits inside the cone and misses to the side", () => {
    expect(isInAttackArc(origin, 0, { x: 1.5, z: -1.5 })).toBe(true);
    expect(isInAttackArc(origin, 0, { x: 2, z: 0 })).toBe(false);
  });

  it("misses targets beyond range", () => {
    expect(isInAttackArc(origin, 0, { x: 0, z: -5 })).toBe(false);
  });

  it("respects custom range and arc", () => {
    expect(isInAttackArc(origin, 0, { x: 0, z: -5 }, 6, Math.PI)).toBe(true);
  });
});

describe("applyDamage", () => {
  it("subtracts damage and floors it", () => {
    expect(applyDamage(100, 24.9)).toEqual({ hp: 76, died: false });
  });

  it("never drops below zero and reports death", () => {
    expect(applyDamage(10, 50)).toEqual({ hp: 0, died: true });
  });

  it("ignores negative damage", () => {
    expect(applyDamage(10, -5)).toEqual({ hp: 10, died: false });
  });
});

describe("isInsideSafeZone", () => {
  it("detects the center and the edge", () => {
    expect(isInsideSafeZone({ x: 0, z: 0 })).toBe(true);
    expect(isInsideSafeZone({ x: 100, z: 0 })).toBe(false);
  });
});

describe("randomInt", () => {
  it("stays within inclusive bounds", () => {
    expect(randomInt(3, 5, () => 0)).toBe(3);
    expect(randomInt(3, 5, () => 0.999999)).toBe(5);
  });
});
