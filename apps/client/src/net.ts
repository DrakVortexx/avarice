import { Client } from "@colyseus/sdk";
import { WORLD_ROOM_NAME, type ChatEvent, type LootEvent } from "@avarice/shared";
import { SERVER_URL } from "./config.js";

export interface PlayerView {
  name: string;
  x: number;
  z: number;
  yaw: number;
  coins: number;
}

export interface PlayerSnapshot {
  id: string;
  name: string;
  x: number;
  z: number;
  yaw: number;
}

export interface LootSnapshot {
  id: string;
  x: number;
  z: number;
  amount: number;
}

export interface LocalStats {
  name: string;
  coins: number;
}

export interface NetHandlers {
  onChat: (event: ChatEvent) => void;
  onLoot: (event: LootEvent) => void;
  onPlayerAdd: (player: PlayerSnapshot) => void;
  onPlayerUpdate: (player: PlayerSnapshot) => void;
  onPlayerRemove: (id: string) => void;
  onLootAdd: (loot: LootSnapshot) => void;
  onLootRemove: (id: string) => void;
  onLocalPosition: (x: number, z: number) => void;
  onLocalStats: (stats: LocalStats) => void;
  onConnected: (sessionId: string) => void;
  onDisconnected: (code: number) => void;
  onError: (message: string) => void;
}

export interface Net {
  sessionId: string;
  sendInput: (x: number, z: number, yaw: number) => void;
  sendChat: (text: string) => void;
  leave: () => void;
}

interface LootView {
  x: number;
  z: number;
  amount: number;
}

interface RoomStateView {
  players: {
    forEach: (callback: (player: PlayerView, sessionId: string) => void) => void;
  };
  loot?: {
    forEach: (callback: (loot: LootView, id: string) => void) => void;
  };
}

export async function connect(accessToken: string, handlers: NetHandlers): Promise<Net> {
  const client = new Client(SERVER_URL);
  const room = await client.joinOrCreate(WORLD_ROOM_NAME, { accessToken });

  handlers.onConnected(room.sessionId);

  let knownPlayers = new Set<string>();
  let knownLoot = new Set<string>();

  room.onStateChange((state: RoomStateView) => {
    const seenPlayers = new Set<string>();

    state.players.forEach((player, sessionId) => {
      seenPlayers.add(sessionId);

      if (sessionId === room.sessionId) {
        handlers.onLocalPosition(player.x, player.z);
        handlers.onLocalStats({ name: player.name, coins: player.coins });
        return;
      }

      const snapshot: PlayerSnapshot = {
        id: sessionId,
        name: player.name,
        x: player.x,
        z: player.z,
        yaw: player.yaw,
      };

      if (knownPlayers.has(sessionId)) {
        handlers.onPlayerUpdate(snapshot);
      } else {
        handlers.onPlayerAdd(snapshot);
      }
    });

    for (const id of knownPlayers) {
      if (!seenPlayers.has(id)) {
        handlers.onPlayerRemove(id);
      }
    }
    knownPlayers = seenPlayers;

    const seenLoot = new Set<string>();
    state.loot?.forEach((loot, id) => {
      seenLoot.add(id);
      if (!knownLoot.has(id)) {
        handlers.onLootAdd({ id, x: loot.x, z: loot.z, amount: loot.amount });
      }
    });
    for (const id of knownLoot) {
      if (!seenLoot.has(id)) {
        handlers.onLootRemove(id);
      }
    }
    knownLoot = seenLoot;
  });

  room.onMessage("chat", (event: ChatEvent) => {
    handlers.onChat(event);
  });

  room.onMessage("loot", (event: LootEvent) => {
    handlers.onLoot(event);
  });

  room.onLeave((code: number) => {
    handlers.onDisconnected(code);
  });

  room.onError((code: number, message?: string) => {
    handlers.onError(message ?? `Connection error (${code})`);
  });

  return {
    sessionId: room.sessionId,
    sendInput: (x, z, yaw) => room.send("move", { x, z, yaw }),
    sendChat: (text) => room.send("chat", { text }),
    leave: () => {
      void room.leave();
    },
  };
}
