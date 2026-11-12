import { describe, expect, it } from "vitest";
import { clampInput, distanceBetween, sanitizeMoveInput, stepPosition } from "./movement.js";
import { PLAYER_SPEED, WORLD_RADIUS } from "./constants.js";

describe("clampInput", () => {
  it("leaves short vectors untouched", () => {
    expect(clampInput({ x: 0.5, z: -0.25 })).toEqual({ x: 0.5, z: -0.25 });
  });

  it("normalizes long vectors to unit length", () => {
    const result = clampInput({ x: 3, z: 4 });
    expect(Math.hypot(result.x, result.z)).toBeCloseTo(1);
    expect(result.x).toBeCloseTo(0.6);
    expect(result.z).toBeCloseTo(0.8);
  });

  it("replaces non-finite values with zero", () => {
    expect(clampInput({ x: Number.NaN, z: Number.POSITIVE_INFINITY })).toEqual({ x: 0, z: 0 });
  });
});

describe("stepPosition", () => {
  it("moves at the configured speed", () => {
    const result = stepPosition({ x: 0, z: 0 }, { x: 1, z: 0 }, 1, PLAYER_SPEED, WORLD_RADIUS);
    expect(result.x).toBeCloseTo(PLAYER_SPEED);
    expect(result.z).toBeCloseTo(0);
  });

  it("clamps movement to the world boundary", () => {
    let position = { x: 0, z: 0 };
    for (let i = 0; i < 1000; i += 1) {
      position = stepPosition(position, { x: 1, z: 0 }, 1, PLAYER_SPEED, WORLD_RADIUS);
    }
    expect(Math.hypot(position.x, position.z)).toBeLessThanOrEqual(WORLD_RADIUS);
  });
});

describe("sanitizeMoveInput", () => {
  it("accepts numeric input and clamps it to a unit vector", () => {
    const result = sanitizeMoveInput({ x: 1, z: -1 });
    expect(result.x).toBeCloseTo(Math.SQRT1_2);
    expect(result.z).toBeCloseTo(-Math.SQRT1_2);
  });

  it("rejects garbage", () => {
    expect(sanitizeMoveInput({ x: "nope", z: null })).toEqual({ x: 0, z: 0 });
  });
});

describe("distanceBetween", () => {
  it("computes planar distance", () => {
    expect(distanceBetween({ x: 0, z: 0 }, { x: 3, z: 4 })).toBe(5);
  });
});
