import { schema, t, type SchemaType } from "@colyseus/schema";

export const PlayerState = schema(
  {
    name: t.string().default("Guest"),
    x: t.number().default(0),
    z: t.number().default(0),
    yaw: t.number().default(0),
    coins: t.number().default(0),
    hp: t.number().default(100),
    maxHp: t.number().default(100),
    level: t.number().default(1),
    alive: t.boolean().default(true),
  },
  "PlayerState",
);
export type PlayerState = SchemaType<typeof PlayerState>;

export const LootState = schema(
  {
    id: t.string().default(""),
    x: t.number().default(0),
    z: t.number().default(0),
    amount: t.number().default(0),
    itemId: t.string().default(""),
    quantity: t.number().default(0),
  },
  "LootState",
);
export type LootState = SchemaType<typeof LootState>;

export const WorldState = schema(
  {
    players: t.map(PlayerState),
    loot: t.map(LootState),
    serverTime: t.number().default(0),
  },
  "WorldState",
);
export type WorldState = SchemaType<typeof WorldState>;
