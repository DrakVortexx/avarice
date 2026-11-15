import { BASE_ATTACK, BASE_MAX_HP, HP_PER_LEVEL, XP_PER_LEVEL_BASE, XP_PER_LEVEL_GROWTH } from "./constants.js";

export function xpForLevel(level: number): number {
  const safe = Math.max(1, Math.floor(level));
  return Math.round(XP_PER_LEVEL_BASE * Math.pow(XP_PER_LEVEL_GROWTH, safe - 1));
}

export interface LevelProgress {
  level: number;
  xp: number;
  xpIntoLevel: number;
  xpForNext: number;
}

export function levelFromXp(totalXp: number): LevelProgress {
  let level = 1;
  let remaining = Math.max(0, Math.floor(totalXp));
  let needed = xpForLevel(level);

  while (remaining >= needed && level < 200) {
    remaining -= needed;
    level += 1;
    needed = xpForLevel(level);
  }

  return { level, xp: Math.max(0, Math.floor(totalXp)), xpIntoLevel: remaining, xpForNext: needed };
}

export function maxHpForLevel(level: number): number {
  return BASE_MAX_HP + (Math.max(1, Math.floor(level)) - 1) * HP_PER_LEVEL;
}

export function baseAttackForLevel(level: number): number {
  return BASE_ATTACK + Math.floor((Math.max(1, Math.floor(level)) - 1) * 0.8);
}
