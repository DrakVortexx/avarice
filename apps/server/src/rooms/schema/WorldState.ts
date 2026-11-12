import { schema, t, type SchemaType } from "@colyseus/schema";

export const PlayerState = schema(
  {
    name: t.string().default("Guest"),
    x: t.number().default(0),
    y: t.number().default(0),
    z: t.number().default(0),
    yaw: t.number().default(0),
    hp: t.number().default(100),
    maxHp: t.number().default(100),
    coins: t.number().default(0),
    dead: t.boolean().default(false),
  },
  "PlayerState",
);
export type PlayerState = SchemaType<typeof PlayerState>;

export const EnemyState = schema(
  {
    id: t.string().default(""),
    type: t.string().default("scavenger"),
    name: t.string().default("Scavenger"),
    x: t.number().default(0),
    z: t.number().default(0),
    yaw: t.number().default(0),
    hp: t.number().default(1),
    maxHp: t.number().default(1),
    targetId: t.string().default(""),
  },
  "EnemyState",
);
export type EnemyState = SchemaType<typeof EnemyState>;

export const LootState = schema(
  {
    id: t.string().default(""),
    x: t.number().default(0),
    z: t.number().default(0),
    amount: t.number().default(0),
  },
  "LootState",
);
export type LootState = SchemaType<typeof LootState>;

export const WorldState = schema(
  {
    players: t.map(PlayerState),
    enemies: t.map(EnemyState),
    loot: t.map(LootState),
    serverTime: t.number().default(0),
  },
  "WorldState",
);
export type WorldState = SchemaType<typeof WorldState>;
