import { describe, expect, it } from "vitest";
import { BUILDINGS, WORLD_RADIUS, isPositionFree, resolveWorldCollision } from "./index.js";

describe("resolveWorldCollision", () => {
  it("keeps players inside the world boundary", () => {
    const resolved = resolveWorldCollision({ x: 10_000, z: 0 }, 0.5);
    expect(Math.hypot(resolved.x, resolved.z)).toBeLessThanOrEqual(WORLD_RADIUS);
  });

  it("pushes players out of solid buildings", () => {
    const building = BUILDINGS[0]!;
    const center = {
      x: building.x + building.w / 2,
      z: building.z + building.h / 2,
    };
    const resolved = resolveWorldCollision(center, 0.5);
    const stillInside =
      resolved.x > building.x - 0.5 &&
      resolved.x < building.x + building.w + 0.5 &&
      resolved.z > building.z - 0.5 &&
      resolved.z < building.z + building.h + 0.5;
    expect(stillInside).toBe(false);
  });
});

describe("isPositionFree", () => {
  it("rejects the plaza and buildings", () => {
    expect(isPositionFree(0, 0)).toBe(false);
    const building = BUILDINGS[0]!;
    expect(isPositionFree(building.x + building.w / 2, building.z + building.h / 2)).toBe(false);
  });

  it("accepts open ground away from the plaza", () => {
    expect(isPositionFree(0, 40)).toBe(true);
  });
});
