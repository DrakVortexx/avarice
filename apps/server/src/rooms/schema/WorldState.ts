import { schema, t, type SchemaType } from "@colyseus/schema";

export const PlayerState = schema(
  {
    name: t.string().default("Guest"),
    x: t.number().default(0),
    y: t.number().default(0),
    z: t.number().default(0),
    yaw: t.number().default(0),
  },
  "PlayerState",
);
export type PlayerState = SchemaType<typeof PlayerState>;

export const WorldState = schema(
  {
    players: t.map(PlayerState),
    serverTime: t.number().default(0),
  },
  "WorldState",
);
export type WorldState = SchemaType<typeof WorldState>;
