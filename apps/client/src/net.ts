import { Client } from "@colyseus/sdk";
import { WORLD_ROOM_NAME, type ChatEvent } from "@avarice/shared";
import { SERVER_URL } from "./config.js";

export interface PlayerView {
  name: string;
  x: number;
  z: number;
  yaw: number;
}

export interface PlayerSnapshot {
  id: string;
  name: string;
  x: number;
  z: number;
  yaw: number;
}

export interface NetHandlers {
  onChat: (event: ChatEvent) => void;
  onPlayerAdd: (player: PlayerSnapshot) => void;
  onPlayerUpdate: (player: PlayerSnapshot) => void;
  onPlayerRemove: (id: string) => void;
  onLocalPosition: (x: number, z: number) => void;
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

interface RoomStateView {
  players: {
    forEach: (callback: (player: PlayerView, sessionId: string) => void) => void;
  };
}

export async function connect(accessToken: string, handlers: NetHandlers): Promise<Net> {
  const client = new Client(SERVER_URL);
  const room = await client.joinOrCreate(WORLD_ROOM_NAME, { accessToken });

  handlers.onConnected(room.sessionId);

  let known = new Set<string>();

  room.onStateChange((state: RoomStateView) => {
    const seen = new Set<string>();

    state.players.forEach((player, sessionId) => {
      seen.add(sessionId);

      if (sessionId === room.sessionId) {
        handlers.onLocalPosition(player.x, player.z);
        return;
      }

      const snapshot: PlayerSnapshot = {
        id: sessionId,
        name: player.name,
        x: player.x,
        z: player.z,
        yaw: player.yaw,
      };

      if (known.has(sessionId)) {
        handlers.onPlayerUpdate(snapshot);
      } else {
        handlers.onPlayerAdd(snapshot);
      }
    });

    for (const id of known) {
      if (!seen.has(id)) {
        handlers.onPlayerRemove(id);
      }
    }

    known = seen;
  });

  room.onMessage("chat", (event: ChatEvent) => {
    handlers.onChat(event);
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
