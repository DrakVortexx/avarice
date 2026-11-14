import { Room, type Client } from "colyseus";
import {
  MAX_PICKUPS,
  MAX_PLAYERS,
  PICKUP_AMOUNT_MAX,
  PICKUP_AMOUNT_MIN,
  PICKUP_INTERVAL_MS,
  PICKUP_LIFETIME_MS,
  PICKUP_RADIUS,
  PLAYER_RADIUS,
  PLAYER_SPEED,
  STARTING_COINS,
  TICK_MS,
  TICK_SECONDS,
  WORLD_RADIUS,
  distanceBetween,
  isPositionFree,
  randomInt,
  resolveWorldCollision,
  sanitizeChat,
  sanitizeMoveInput,
  sanitizeYaw,
  stepPosition,
  type ChatEvent,
  type LootEvent,
  type MoveInput,
  type Vec2,
} from "@avarice/shared";
import { LootState, PlayerState, WorldState } from "./schema/WorldState.js";
import { loadOrCreatePlayer, persistPlayer } from "../db.js";
import { verifyAccessToken, type AuthResult } from "../auth.js";

interface PlayerInput {
  x: number;
  z: number;
  yaw: number;
}

interface PersistRecord {
  authId: string;
  name: string;
  x: number;
  z: number;
  coins: number;
}

const PERSIST_INTERVAL_MS = 15_000;

function randomSpawn(): Vec2 {
  const angle = Math.random() * Math.PI * 2;
  const radius = 3 + Math.random() * 5;
  return { x: Math.cos(angle) * radius, z: Math.sin(angle) * radius };
}

function randomPickupSpawn(): Vec2 {
  for (let attempt = 0; attempt < 64; attempt += 1) {
    const angle = Math.random() * Math.PI * 2;
    const radius = Math.sqrt(Math.random()) * (WORLD_RADIUS - 8);
    const x = Math.cos(angle) * radius;
    const z = Math.sin(angle) * radius;
    if (isPositionFree(x, z, 1.2)) {
      return { x, z };
    }
  }
  return { x: 0, z: 0 };
}

export class WorldRoom extends Room<{ state: WorldState }> {
  maxClients = MAX_PLAYERS;
  state = new WorldState();

  private readonly playerInputs = new Map<string, PlayerInput>();
  private readonly identities = new Map<string, AuthResult>();
  private readonly lootExpiry = new Map<string, number>();
  private lastPersistAt = 0;
  private lastPickupAt = 0;
  private lootSeq = 0;

  messages = {
    move: (client: Client, message: MoveInput) => {
      const input = sanitizeMoveInput(message);
      this.playerInputs.set(client.sessionId, {
        x: input.x,
        z: input.z,
        yaw: sanitizeYaw(message),
      });
    },
    chat: (client: Client, message: unknown) => {
      const payload = sanitizeChat(message);
      if (!payload) {
        return;
      }
      const identity = this.identities.get(client.sessionId);
      this.broadcast("chat", {
        kind: "chat",
        from: identity?.displayName ?? "Wanderer",
        text: payload.text,
        at: Date.now(),
      } satisfies ChatEvent);
    },
  };

  async onAuth(_client: Client, options: unknown): Promise<AuthResult> {
    const accessToken =
      typeof (options as { accessToken?: unknown } | null)?.accessToken === "string"
        ? (options as { accessToken: string }).accessToken
        : "";
    if (!accessToken) {
      throw new Error("Missing access token.");
    }
    return verifyAccessToken(accessToken);
  }

  onCreate() {
    this.setTimestep(() => this.update(), TICK_MS);

    for (let i = 0; i < Math.floor(MAX_PICKUPS / 2); i += 1) {
      this.spawnPickup();
    }
  }

  async onJoin(client: Client, _options: unknown, auth?: unknown) {
    const identity = (auth ?? client.auth) as AuthResult | undefined;
    if (!identity?.authId) {
      throw new Error("Unauthorized.");
    }

    this.identities.set(client.sessionId, identity);
    this.playerInputs.set(client.sessionId, { x: 0, z: 0, yaw: 0 });

    const saved = await loadOrCreatePlayer(identity.authId, identity.username, identity.displayName);
    const spawn =
      saved && (Math.abs(saved.x) > 0.01 || Math.abs(saved.z) > 0.01)
        ? { x: saved.x, z: saved.z }
        : randomSpawn();
    const resolvedSpawn = resolveWorldCollision(spawn, PLAYER_RADIUS);

    const player = new PlayerState({ name: identity.displayName });
    player.x = resolvedSpawn.x;
    player.z = resolvedSpawn.z;
    player.yaw = Math.atan2(-resolvedSpawn.x, -resolvedSpawn.z);
    player.coins = saved?.coins ?? STARTING_COINS;
    this.state.players.set(client.sessionId, player);

    this.broadcast(
      "chat",
      {
        kind: "system",
        from: "Avarice",
        text: `${identity.displayName} entered the world.`,
        at: Date.now(),
      } satisfies ChatEvent,
      { except: client },
    );
  }

  async onLeave(client: Client, _code: number) {
    const sessionId = client.sessionId;
    const identity = this.identities.get(sessionId);
    const player = this.state.players.get(sessionId);

    if (identity && player) {
      await persistPlayer(identity.authId, identity.displayName, player.x, player.z, player.coins);
    }

    this.state.players.delete(sessionId);
    this.playerInputs.delete(sessionId);
    this.identities.delete(sessionId);

    if (identity) {
      this.broadcast("chat", {
        kind: "system",
        from: "Avarice",
        text: `${identity.displayName} left the world.`,
        at: Date.now(),
      } satisfies ChatEvent);
    }
  }

  onDispose() {
    this.playerInputs.clear();
    this.identities.clear();
    this.lootExpiry.clear();
  }

  private spawnPickup(): void {
    const spawn = randomPickupSpawn();
    const amount = randomInt(PICKUP_AMOUNT_MIN, PICKUP_AMOUNT_MAX);
    const lootId = `cache-${++this.lootSeq}`;
    const loot = new LootState({ id: lootId, x: spawn.x, z: spawn.z, amount });
    this.state.loot.set(lootId, loot);
    this.lootExpiry.set(lootId, Date.now() + PICKUP_LIFETIME_MS);
  }

  private update(): void {
    const now = Date.now();
    this.state.serverTime = now;

    for (const [sessionId, player] of this.state.players) {
      const input = this.playerInputs.get(sessionId);
      if (!input) {
        continue;
      }
      const stepped = stepPosition(
        { x: player.x, z: player.z },
        { x: input.x, z: input.z },
        TICK_SECONDS,
        PLAYER_SPEED,
        WORLD_RADIUS,
      );
      const next = resolveWorldCollision(stepped, PLAYER_RADIUS);
      player.x = next.x;
      player.z = next.z;
      player.yaw = input.yaw;
    }

    this.updatePickups(now);

    if (this.state.loot.size < MAX_PICKUPS && now - this.lastPickupAt >= PICKUP_INTERVAL_MS) {
      this.lastPickupAt = now;
      this.spawnPickup();
    }

    if (now - this.lastPersistAt >= PERSIST_INTERVAL_MS) {
      this.lastPersistAt = now;
      void this.persistAll();
    }
  }

  private updatePickups(now: number): void {
    const collected: string[] = [];

    for (const [lootId, loot] of this.state.loot) {
      const expiresAt = this.lootExpiry.get(lootId) ?? 0;
      if (now >= expiresAt) {
        collected.push(lootId);
        continue;
      }

      let pickerId = "";
      let picker: PlayerState | null = null;
      let best = PICKUP_RADIUS;

      for (const [sessionId, player] of this.state.players) {
        const distance = distanceBetween(player, loot);
        if (distance <= best) {
          best = distance;
          pickerId = sessionId;
          picker = player;
        }
      }

      if (picker === null) {
        continue;
      }

      picker.coins += loot.amount;
      collected.push(lootId);

      this.broadcast("loot", {
        sessionId: pickerId,
        amount: loot.amount,
        coins: picker.coins,
        x: loot.x,
        z: loot.z,
      } satisfies LootEvent);
    }

    for (const lootId of collected) {
      this.state.loot.delete(lootId);
      this.lootExpiry.delete(lootId);
    }
  }

  private async persistAll(): Promise<void> {
    const records: PersistRecord[] = [];

    for (const [sessionId, player] of this.state.players) {
      const identity = this.identities.get(sessionId);
      if (!identity) {
        continue;
      }
      records.push({
        authId: identity.authId,
        name: player.name,
        x: player.x,
        z: player.z,
        coins: player.coins,
      });
    }

    for (const record of records) {
      await persistPlayer(record.authId, record.name, record.x, record.z, record.coins);
    }
  }
}
