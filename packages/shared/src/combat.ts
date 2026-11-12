import { distanceBetween, type Vec2 } from "./movement.js";

export const PLAYER_MAX_HP = 100;
export const PLAYER_ATTACK_DAMAGE = 24;
export const PLAYER_ATTACK_RANGE = 2.8;
export const PLAYER_ATTACK_ARC = Math.PI * 0.8;
export const PLAYER_ATTACK_COOLDOWN_MS = 400;
export const PLAYER_RESPAWN_MS = 4000;
export const SAFE_RADIUS = 12;

export const MAX_ENEMIES = 8;
export const ENEMY_RESPAWN_MS = 15_000;
export const LOOT_PICKUP_RADIUS = 1.8;
export const LOOT_LIFETIME_MS = 60_000;

export function angleDelta(from: number, to: number): number {
  const tau = Math.PI * 2;
  let delta = (to - from) % tau;
  if (delta > Math.PI) {
    delta -= tau;
  }
  if (delta < -Math.PI) {
    delta += tau;
  }
  return delta;
}

export function isInAttackArc(
  origin: Vec2,
  yaw: number,
  target: Vec2,
  range: number = PLAYER_ATTACK_RANGE,
  arc: number = PLAYER_ATTACK_ARC,
): boolean {
  if (distanceBetween(origin, target) > range) {
    return false;
  }
  const targetAngle = Math.atan2(-(target.x - origin.x), -(target.z - origin.z));
  return Math.abs(angleDelta(yaw, targetAngle)) <= arc / 2;
}

export function isInsideSafeZone(position: Vec2): boolean {
  return Math.hypot(position.x, position.z) < SAFE_RADIUS;
}

export function applyDamage(hp: number, damage: number): { hp: number; died: boolean } {
  const next = Math.max(0, hp - Math.max(0, Math.floor(damage)));
  return { hp: next, died: next === 0 };
}

export function randomInt(min: number, max: number, rng: () => number = Math.random): number {
  const low = Math.ceil(Math.min(min, max));
  const high = Math.floor(Math.max(min, max));
  return low + Math.floor(rng() * (high - low + 1));
}
