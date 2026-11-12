export type EnemyId = "scavenger" | "brute";

export interface EnemyDefinition {
  id: EnemyId;
  name: string;
  maxHp: number;
  speed: number;
  damage: number;
  attackRange: number;
  aggroRadius: number;
  attackCooldownMs: number;
  color: string;
  coinMin: number;
  coinMax: number;
}

export const ENEMIES: Record<EnemyId, EnemyDefinition> = {
  scavenger: {
    id: "scavenger",
    name: "Scavenger",
    maxHp: 60,
    speed: 2.4,
    damage: 7,
    attackRange: 1.7,
    aggroRadius: 9,
    attackCooldownMs: 1200,
    color: "#d98a5f",
    coinMin: 4,
    coinMax: 14,
  },
  brute: {
    id: "brute",
    name: "Brute",
    maxHp: 150,
    speed: 1.9,
    damage: 16,
    attackRange: 2.1,
    aggroRadius: 11,
    attackCooldownMs: 1600,
    color: "#c2554f",
    coinMin: 15,
    coinMax: 35,
  },
};

export const ENEMY_IDS = Object.keys(ENEMIES) as EnemyId[];

export function isEnemyId(value: string): value is EnemyId {
  return value in ENEMIES;
}

export function getEnemy(id: string): EnemyDefinition | undefined {
  return ENEMIES[id as EnemyId];
}
