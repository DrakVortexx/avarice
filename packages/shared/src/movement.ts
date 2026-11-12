import { PLAYER_RADIUS, PLAYER_SPEED, WORLD_RADIUS } from "./constants.js";

export interface Vec2 {
  x: number;
  z: number;
}

export function clampInput(input: Vec2): Vec2 {
  const x = Number.isFinite(input.x) ? input.x : 0;
  const z = Number.isFinite(input.z) ? input.z : 0;
  const length = Math.hypot(x, z);
  if (length <= 1) {
    return { x, z };
  }
  return { x: x / length, z: z / length };
}

export function stepPosition(
  position: Vec2,
  input: Vec2,
  dtSeconds: number,
  speed: number = PLAYER_SPEED,
  worldRadius: number = WORLD_RADIUS,
): Vec2 {
  const direction = clampInput(input);
  let x = position.x + direction.x * speed * dtSeconds;
  let z = position.z + direction.z * speed * dtSeconds;

  const distance = Math.hypot(x, z);
  const limit = Math.max(0, worldRadius - PLAYER_RADIUS);
  if (distance > limit) {
    const scale = limit / distance;
    x *= scale;
    z *= scale;
  }

  return { x, z };
}

export function sanitizeMoveInput(raw: unknown): Vec2 {
  const value = (raw ?? {}) as Partial<Vec2>;
  return clampInput({
    x: typeof value.x === "number" ? value.x : 0,
    z: typeof value.z === "number" ? value.z : 0,
  });
}

export function sanitizeYaw(raw: unknown): number {
  const value = (raw ?? {}) as { yaw?: unknown };
  return typeof value.yaw === "number" && Number.isFinite(value.yaw) ? value.yaw : 0;
}

export function distanceBetween(a: Vec2, b: Vec2): number {
  return Math.hypot(a.x - b.x, a.z - b.z);
}
