import { Client } from "@colyseus/sdk";
import {
  WORLD_ROOM_NAME,
  type AdminResult,
  type BazaarBuyInput,
  type BazaarCancelInput,
  type BazaarListInput,
  type BazaarView,
  type ChatEvent,
  type CombatEvent,
  type DeathEvent,
  type EquipSlot,
  type LootEvent,
  type NoticeEvent,
  type SelfState,
  type ShopTradeInput,
  type ShopView,
} from "@avarice/shared";
import { SERVER_URL } from "./config.js";

export interface PlayerView {
  name: string;
  x: number;
  z: number;
  yaw: number;
  coins: number;
  hp: number;
  maxHp: number;
  level: number;
  alive: boolean;
}

export interface PlayerSnapshot {
  id: string;
  name: string;
  x: number;
  z: number;
  yaw: number;
  hp: number;
  maxHp: number;
  level: number;
  alive: boolean;
}

export interface LootSnapshot {
  id: string;
  x: number;
  z: number;
  amount: number;
  itemId: string;
  quantity: number;
}

export interface LocalStats {
  name: string;
  coins: number;
  hp: number;
  maxHp: number;
  level: number;
  alive: boolean;
}

export interface NetHandlers {
  onChat: (event: ChatEvent) => void;
  onLoot: (event: LootEvent) => void;
  onCombat: (event: CombatEvent) => void;
  onDeath: (event: DeathEvent) => void;
  onSelf: (state: SelfState) => void;
  onShop: (view: ShopView) => void;
  onBazaar: (view: BazaarView) => void;
  onNotice: (event: NoticeEvent) => void;
  onAdminResult: (result: AdminResult) => void;
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
  sendAttack: () => void;
  sendUse: (itemId: string) => void;
  sendEquip: (itemId: string | null, slot: EquipSlot) => void;
  sendShopOpen: (shopId: string) => void;
  sendShopBuy: (shopId: string, itemId: string, quantity: number) => void;
  sendShopSell: (shopId: string, itemId: string, quantity: number) => void;
  sendBazaarQuery: () => void;
  sendBazaarList: (itemId: string, quantity: number, price: number) => void;
  sendBazaarBuy: (listingId: string, quantity: number) => void;
  sendBazaarCancel: (listingId: string) => void;
  sendAdmin: (command: string) => void;
  leave: () => void;
}

interface LootView {
  x: number;
  z: number;
  amount: number;
  itemId: string;
  quantity: number;
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
        handlers.onLocalStats({
          name: player.name,
          coins: player.coins,
          hp: player.hp,
          maxHp: player.maxHp,
          level: player.level,
          alive: player.alive,
        });
        return;
      }

      const snapshot: PlayerSnapshot = {
        id: sessionId,
        name: player.name,
        x: player.x,
        z: player.z,
        yaw: player.yaw,
        hp: player.hp,
        maxHp: player.maxHp,
        level: player.level,
        alive: player.alive,
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
        handlers.onLootAdd({
          id,
          x: loot.x,
          z: loot.z,
          amount: loot.amount,
          itemId: loot.itemId,
          quantity: loot.quantity,
        });
      }
    });
    for (const id of knownLoot) {
      if (!seenLoot.has(id)) {
        handlers.onLootRemove(id);
      }
    }
    knownLoot = seenLoot;
  });

  room.onMessage("chat", (event: ChatEvent) => handlers.onChat(event));
  room.onMessage("loot", (event: LootEvent) => handlers.onLoot(event));
  room.onMessage("combat", (event: CombatEvent) => handlers.onCombat(event));
  room.onMessage("death", (event: DeathEvent) => handlers.onDeath(event));
  room.onMessage("self", (state: SelfState) => handlers.onSelf(state));
  room.onMessage("shop", (view: ShopView) => handlers.onShop(view));
  room.onMessage("bazaar", (view: BazaarView) => handlers.onBazaar(view));
  room.onMessage("notice", (event: NoticeEvent) => handlers.onNotice(event));
  room.onMessage("admin", (result: AdminResult) => handlers.onAdminResult(result));

  room.onLeave((code: number) => handlers.onDisconnected(code));
  room.onError((code: number, message?: string) =>
    handlers.onError(message ?? `Connection error (${code})`),
  );

  return {
    sessionId: room.sessionId,
    sendInput: (x, z, yaw) => room.send("move", { x, z, yaw }),
    sendChat: (text) => room.send("chat", { text }),
    sendAttack: () => room.send("attack", {}),
    sendUse: (itemId) => room.send("use", { itemId }),
    sendEquip: (itemId, slot) => room.send("equip", { itemId, slot }),
    sendShopOpen: (shopId) => room.send("shopOpen", { shopId }),
    sendShopBuy: (shopId, itemId, quantity) =>
      room.send("shopBuy", { shopId, itemId, quantity } satisfies ShopTradeInput),
    sendShopSell: (shopId, itemId, quantity) =>
      room.send("shopSell", { shopId, itemId, quantity } satisfies ShopTradeInput),
    sendBazaarQuery: () => room.send("bazaarQuery", {}),
    sendBazaarList: (itemId, quantity, pricePerUnit) =>
      room.send("bazaarList", { itemId, quantity, pricePerUnit } satisfies BazaarListInput),
    sendBazaarBuy: (listingId, quantity) =>
      room.send("bazaarBuy", { listingId, quantity } satisfies BazaarBuyInput),
    sendBazaarCancel: (listingId) =>
      room.send("bazaarCancel", { listingId } satisfies BazaarCancelInput),
    sendAdmin: (command) => room.send("admin", { command }),
    leave: () => {
      void room.leave();
    },
  };
}
