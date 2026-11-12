import { Client } from "@colyseus/sdk";
import {
  WORLD_ROOM_NAME,
  type ChatEvent,
  type CombatEvent,
  type LootEvent,
} from "@avarice/shared";
import { SERVER_URL } from "./config.js";

export interface PlayerView {
  name: string;
  x: number;
  z: number;
  yaw: number;
  hp: number;
  maxHp: number;
  coins: number;
  dead: boolean;
}

export interface PlayerSnapshot {
  id: string;
  name: string;
  x: number;
  z: number;
  yaw: number;
}

export interface EnemySnapshot {
  id: string;
  type: string;
  name: string;
  x: number;
  z: number;
  yaw: number;
  hp: number;
  maxHp: number;
}

export interface LootSnapshot {
  id: string;
  x: number;
  z: number;
  amount: number;
}

export interface LocalStats {
  name: string;
  hp: number;
  maxHp: number;
  coins: number;
  dead: boolean;
}

export interface NetHandlers {
  onChat: (event: ChatEvent) => void;
  onCombat: (event: CombatEvent) => void;
  onLoot: (event: LootEvent) => void;
  onPlayerAdd: (player: PlayerSnapshot) => void;
  onPlayerUpdate: (player: PlayerSnapshot) => void;
  onPlayerRemove: (id: string) => void;
  onEnemyAdd: (enemy: EnemySnapshot) => void;
  onEnemyUpdate: (enemy: EnemySnapshot) => void;
  onEnemyRemove: (id: string) => void;
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
  sendAttack: (yaw: number) => void;
  sendChat: (text: string) => void;
  leave: () => void;
}

interface EnemyView {
  type: string;
  name: string;
  x: number;
  z: number;
  yaw: number;
  hp: number;
  maxHp: number;
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
  enemies?: {
    forEach: (callback: (enemy: EnemyView, id: string) => void) => void;
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
  let knownEnemies = new Set<string>();
  let knownLoot = new Set<string>();

  room.onStateChange((state: RoomStateView) => {
    const seenPlayers = new Set<string>();

    state.players.forEach((player, sessionId) => {
      seenPlayers.add(sessionId);

      if (sessionId === room.sessionId) {
        handlers.onLocalPosition(player.x, player.z);
        handlers.onLocalStats({
          name: player.name,
          hp: player.hp,
          maxHp: player.maxHp,
          coins: player.coins,
          dead: player.dead,
        });
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

    const seenEnemies = new Set<string>();
    state.enemies?.forEach((enemy, id) => {
      seenEnemies.add(id);
      const snapshot: EnemySnapshot = {
        id,
        type: enemy.type,
        name: enemy.name,
        x: enemy.x,
        z: enemy.z,
        yaw: enemy.yaw,
        hp: enemy.hp,
        maxHp: enemy.maxHp,
      };

      if (knownEnemies.has(id)) {
        handlers.onEnemyUpdate(snapshot);
      } else {
        handlers.onEnemyAdd(snapshot);
      }
    });
    for (const id of knownEnemies) {
      if (!seenEnemies.has(id)) {
        handlers.onEnemyRemove(id);
      }
    }
    knownEnemies = seenEnemies;

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

  room.onMessage("combat", (event: CombatEvent) => {
    handlers.onCombat(event);
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
    sendAttack: (yaw) => room.send("attack", { yaw }),
    sendChat: (text) => room.send("chat", { text }),
    leave: () => {
      void room.leave();
    },
  };
}
