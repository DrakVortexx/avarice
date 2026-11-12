import { Room, type Client } from "colyseus";
import {
  MAX_PLAYERS,
  PLAYER_SPEED,
  TICK_MS,
  TICK_SECONDS,
  WORLD_RADIUS,
  sanitizeChat,
  sanitizeMoveInput,
  sanitizeYaw,
  stepPosition,
  type ChatEvent,
  type MoveInput,
} from "@avarice/shared";
import { WorldState, PlayerState } from "./schema/WorldState.js";
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
}

const PERSIST_INTERVAL_MS = 15_000;

function randomSpawn(): { x: number; z: number } {
  const angle = Math.random() * Math.PI * 2;
  const radius = 6 + Math.random() * 5;
  return { x: Math.cos(angle) * radius, z: Math.sin(angle) * radius };
}

export class WorldRoom extends Room<{ state: WorldState }> {
  maxClients = MAX_PLAYERS;
  state = new WorldState();

  private readonly playerInputs = new Map<string, PlayerInput>();
  private readonly identities = new Map<string, AuthResult>();
  private lastPersistAt = 0;

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
  }

  async onJoin(client: Client, _options: unknown, auth?: unknown) {
    const identity = (auth ?? client.auth) as AuthResult | undefined;
    if (!identity?.authId) {
      throw new Error("Unauthorized.");
    }

    this.identities.set(client.sessionId, identity);
    this.playerInputs.set(client.sessionId, { x: 0, z: 0, yaw: 0 });

    const saved = await loadOrCreatePlayer(identity.authId, identity.username, identity.displayName);
    const spawn = saved ?? randomSpawn();

    const player = new PlayerState({ name: identity.displayName });
    player.x = spawn.x;
    player.z = spawn.z;
    player.yaw = Math.atan2(-spawn.x, -spawn.z);
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
      await persistPlayer(identity.authId, identity.displayName, player.x, player.z);
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
  }

  private update() {
    this.state.serverTime = Date.now();

    this.state.players.forEach((player, sessionId) => {
      const input = this.playerInputs.get(sessionId);
      if (!input) {
        return;
      }

      const next = stepPosition(
        { x: player.x, z: player.z },
        { x: input.x, z: input.z },
        TICK_SECONDS,
        PLAYER_SPEED,
        WORLD_RADIUS,
      );

      player.x = next.x;
      player.z = next.z;
      player.yaw = input.yaw;
    });

    const now = Date.now();
    if (now - this.lastPersistAt >= PERSIST_INTERVAL_MS) {
      this.lastPersistAt = now;
      void this.persistAll();
    }
  }

  private async persistAll() {
    const records: PersistRecord[] = [];

    this.state.players.forEach((player, sessionId) => {
      const identity = this.identities.get(sessionId);
      if (!identity) {
        return;
      }
      records.push({ authId: identity.authId, name: player.name, x: player.x, z: player.z });
    });

    for (const record of records) {
      await persistPlayer(record.authId, record.name, record.x, record.z);
    }
  }
}
