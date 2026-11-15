import { Room, type Client } from "colyseus";
import {
  ATTACK_COOLDOWN_MS,
  ATTACK_RANGE,
  MAX_PICKUPS,
  MAX_PLAYERS,
  PICKUP_AMOUNT_MAX,
  PICKUP_AMOUNT_MIN,
  PICKUP_INTERVAL_MS,
  PICKUP_LIFETIME_MS,
  PICKUP_RADIUS,
  PLAYER_RADIUS,
  PLAYER_SPEED,
  PVP_COIN_DROP_RATE,
  RESPAWN_MS,
  STARTING_COINS,
  TICK_MS,
  TICK_SECONDS,
  WORLD_RADIUS,
  XP_PER_CACHE,
  XP_PER_KILL,
  baseAttackForLevel,
  canAfford,
  distanceBetween,
  getItem,
  getShop,
  isEquipSlot,
  isPositionFree,
  itemBuyPrice,
  itemSellPrice,
  levelFromXp,
  listingFee,
  maxHpForLevel,
  randomInt,
  resolveWorldCollision,
  sanitizeChat,
  sanitizeId,
  sanitizeMoveInput,
  sanitizePrice,
  sanitizeQuantity,
  sanitizeYaw,
  stepPosition,
  type AdminResult,
  type BazaarBuyInput,
  type BazaarCancelInput,
  type BazaarItem,
  type BazaarListInput,
  type BazaarView,
  type ChatEvent,
  type CombatEvent,
  type DeathEvent,
  type EquipInput,
  type EquippedGear,
  type LootEvent,
  type MoveInput,
  type NoticeEvent,
  type SelfState,
  type ShopItem,
  type ShopTradeInput,
  type ShopView,
  type UseItemInput,
  type Vec2,
} from "@avarice/shared";
import { LootState, PlayerState, WorldState } from "./schema/WorldState.js";
import {
  addCoinsToPlayer,
  cancelBazaarListing,
  createBazaarListing,
  getBazaarListing,
  listBazaarListings,
  loadOrCreatePlayer,
  persistPlayer,
  reduceListingQuantity,
  type BazaarRow,
  type PlayerSnapshot,
} from "../db.js";
import { verifyAccessToken, type AuthResult } from "../auth.js";
import {
  addItem,
  equipmentAttack,
  equipmentDefense,
  inventoryToStacks,
  removeItem,
  stacksToInventory,
  type InventoryMap,
} from "../inventory.js";

interface PlayerInput {
  x: number;
  z: number;
  yaw: number;
}

interface PlayerData {
  playerId: string;
  authId: string;
  username: string;
  displayName: string;
  isAdmin: boolean;
  xp: number;
  inventory: InventoryMap;
  equipped: EquippedGear;
  lastAttackAt: number;
  lastCombatAt: number;
  lastRegenAt: number;
  respawnAt: number;
}

const PERSIST_INTERVAL_MS = 10_000;
const SHOP_RANGE = 7;
const REGEN_INTERVAL_MS = 1_000;
const REGEN_AMOUNT = 3;
const REGEN_DELAY_MS = 5_000;
const RESOURCE_DROPS = ["wood", "stone", "iron-ore", "coal", "herb", "leather", "cloth", "glass-shard"];

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

  private readonly players = new Map<string, PlayerData>();
  private readonly playerInputs = new Map<string, PlayerInput>();
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
      const data = this.players.get(client.sessionId);
      this.broadcast("chat", {
        kind: "chat",
        from: data?.displayName ?? "Wanderer",
        text: payload.text,
        at: Date.now(),
      } satisfies ChatEvent);
    },
    attack: (client: Client) => this.handleAttack(client),
    use: (client: Client, message: UseItemInput) => this.handleUse(client, message),
    equip: (client: Client, message: EquipInput) => this.handleEquip(client, message),
    shopOpen: (client: Client, message: { shopId?: unknown }) =>
      this.handleShopOpen(client, sanitizeId(message?.shopId)),
    shopBuy: (client: Client, message: ShopTradeInput) => this.handleShopBuy(client, message),
    shopSell: (client: Client, message: ShopTradeInput) => this.handleShopSell(client, message),
    bazaarQuery: (client: Client) => {
      void this.sendBazaar(client.sessionId);
    },
    bazaarList: (client: Client, message: BazaarListInput) => {
      void this.handleBazaarList(client, message);
    },
    bazaarBuy: (client: Client, message: BazaarBuyInput) => {
      void this.handleBazaarBuy(client, message);
    },
    bazaarCancel: (client: Client, message: BazaarCancelInput) => {
      void this.handleBazaarCancel(client, message);
    },
    admin: (client: Client, message: { command?: unknown }) =>
      this.handleAdmin(client, typeof message?.command === "string" ? message.command : ""),
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

    const saved = await loadOrCreatePlayer(identity.authId, identity.username, identity.displayName);
    const spawn =
      saved && (Math.abs(saved.x) > 0.01 || Math.abs(saved.z) > 0.01)
        ? { x: saved.x, z: saved.z }
        : randomSpawn();
    const resolvedSpawn = resolveWorldCollision(spawn, PLAYER_RADIUS);

    const progress = levelFromXp(saved?.xp ?? 0);
    const maxHp = maxHpForLevel(progress.level);
    const hp = saved && saved.hp > 0 ? Math.min(saved.hp, maxHp) : maxHp;

    const player = new PlayerState({ name: identity.displayName });
    player.x = resolvedSpawn.x;
    player.z = resolvedSpawn.z;
    player.yaw = Math.atan2(-resolvedSpawn.x, -resolvedSpawn.z);
    player.coins = saved?.coins ?? STARTING_COINS;
    player.level = progress.level;
    player.maxHp = maxHp;
    player.hp = hp;
    player.alive = true;
    this.state.players.set(client.sessionId, player);

    this.players.set(client.sessionId, {
      playerId: saved?.id ?? "",
      authId: identity.authId,
      username: identity.username,
      displayName: identity.displayName,
      isAdmin: saved?.isAdmin ?? false,
      xp: saved?.xp ?? 0,
      inventory: stacksToInventory(saved?.inventory ?? []),
      equipped: saved?.equipped ?? {},
      lastAttackAt: 0,
      lastCombatAt: 0,
      lastRegenAt: 0,
      respawnAt: 0,
    });
    this.playerInputs.set(client.sessionId, {
      x: resolvedSpawn.x,
      z: resolvedSpawn.z,
      yaw: player.yaw,
    });

    this.sendSelf(client.sessionId);

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
    const data = this.players.get(sessionId);

    if (data) {
      await this.persistOne(sessionId);
    }

    this.state.players.delete(sessionId);
    this.playerInputs.delete(sessionId);
    this.players.delete(sessionId);

    if (data) {
      this.broadcast("chat", {
        kind: "system",
        from: "Avarice",
        text: `${data.displayName} left the world.`,
        at: Date.now(),
      } satisfies ChatEvent);
    }
  }

  async onDispose() {
    await this.persistAll();
    this.players.clear();
    this.playerInputs.clear();
    this.lootExpiry.clear();
  }

  private update(): void {
    const now = Date.now();
    this.state.serverTime = now;

    for (const [sessionId, player] of this.state.players) {
      if (!player.alive) {
        const data = this.players.get(sessionId);
        if (data && data.respawnAt > 0 && now >= data.respawnAt) {
          this.respawn(sessionId);
        }
        continue;
      }

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

      const data = this.players.get(sessionId);
      if (
        data &&
        player.hp < player.maxHp &&
        now - data.lastCombatAt > REGEN_DELAY_MS &&
        now - data.lastRegenAt >= REGEN_INTERVAL_MS
      ) {
        data.lastRegenAt = now;
        player.hp = Math.min(player.maxHp, player.hp + REGEN_AMOUNT);
      }
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
        if (!player.alive) {
          continue;
        }
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

      const data = this.players.get(pickerId);
      if (!data) {
        continue;
      }

      if (loot.itemId) {
        if (!addItem(data.inventory, loot.itemId, loot.quantity)) {
          continue;
        }
        collected.push(lootId);
        this.addXp(pickerId, XP_PER_CACHE);
        this.broadcast("loot", {
          sessionId: pickerId,
          amount: 0,
          coins: picker.coins,
          x: loot.x,
          z: loot.z,
          itemId: loot.itemId,
          quantity: loot.quantity,
        } satisfies LootEvent);
      } else {
        picker.coins += loot.amount;
        collected.push(lootId);
        this.addXp(pickerId, XP_PER_CACHE);
        this.broadcast("loot", {
          sessionId: pickerId,
          amount: loot.amount,
          coins: picker.coins,
          x: loot.x,
          z: loot.z,
        } satisfies LootEvent);
      }

      void this.persistOne(pickerId);
    }

    for (const lootId of collected) {
      this.state.loot.delete(lootId);
      this.lootExpiry.delete(lootId);
    }
  }

  private spawnPickup(): void {
    const spawn = randomPickupSpawn();
    if (Math.random() < 0.3) {
      const itemId = RESOURCE_DROPS[Math.floor(Math.random() * RESOURCE_DROPS.length)] ?? "wood";
      this.spawnLoot(spawn.x, spawn.z, 0, itemId, randomInt(1, 3));
    } else {
      this.spawnLoot(spawn.x, spawn.z, randomInt(PICKUP_AMOUNT_MIN, PICKUP_AMOUNT_MAX));
    }
  }

  private spawnLoot(x: number, z: number, amount: number, itemId = "", quantity = 0): string {
    const lootId = `drop-${++this.lootSeq}`;
    const loot = new LootState({ id: lootId, x, z, amount, itemId, quantity });
    this.state.loot.set(lootId, loot);
    this.lootExpiry.set(lootId, Date.now() + PICKUP_LIFETIME_MS);
    return lootId;
  }

  private handleAttack(client: Client): void {
    const now = Date.now();
    const data = this.players.get(client.sessionId);
    const attacker = this.state.players.get(client.sessionId);
    if (!data || !attacker || !attacker.alive) {
      return;
    }
    if (now - data.lastAttackAt < ATTACK_COOLDOWN_MS) {
      return;
    }
    data.lastAttackAt = now;
    data.lastCombatAt = now;

    let targetId = "";
    let target: PlayerState | null = null;
    let best = ATTACK_RANGE;
    for (const [sessionId, candidate] of this.state.players) {
      if (sessionId === client.sessionId || !candidate.alive) {
        continue;
      }
      const distance = distanceBetween(attacker, candidate);
      if (distance <= best) {
        best = distance;
        targetId = sessionId;
        target = candidate;
      }
    }
    if (!target || !targetId) {
      return;
    }

    const targetData = this.players.get(targetId);
    if (!targetData) {
      return;
    }
    targetData.lastCombatAt = now;

    const attack = baseAttackForLevel(attacker.level) + equipmentAttack(data.equipped);
    const defense = equipmentDefense(targetData.equipped);
    const raw = Math.max(1, attack - defense * 0.5);
    const damage = Math.max(1, Math.round(raw * (0.85 + Math.random() * 0.3)));
    target.hp = Math.max(0, target.hp - damage);

    this.broadcast("combat", {
      attackerId: client.sessionId,
      attackerName: attacker.name,
      targetId,
      targetName: target.name,
      damage,
      hp: target.hp,
      maxHp: target.maxHp,
      killed: target.hp <= 0,
      x: target.x,
      z: target.z,
    } satisfies CombatEvent);

    if (target.hp <= 0) {
      this.killPlayer(targetId, client.sessionId);
    }
  }

  private killPlayer(victimId: string, killerId: string | null): void {
    const victim = this.state.players.get(victimId);
    const victimData = this.players.get(victimId);
    if (!victim || !victimData || !victim.alive) {
      return;
    }

    victim.alive = false;
    victim.hp = 0;
    victimData.respawnAt = Date.now() + RESPAWN_MS;
    victimData.lastCombatAt = Date.now();

    const coinDrop = Math.floor(victim.coins * PVP_COIN_DROP_RATE);
    if (coinDrop > 0) {
      victim.coins -= coinDrop;
      this.spawnLoot(victim.x, victim.z, coinDrop);
    }

    const stackIds = [...victimData.inventory.keys()];
    for (let dropped = 0; dropped < 2 && stackIds.length > 0; dropped += 1) {
      const index = Math.floor(Math.random() * stackIds.length);
      const itemId = stackIds.splice(index, 1)[0];
      if (!itemId) {
        continue;
      }
      const quantity = victimData.inventory.get(itemId) ?? 0;
      if (quantity <= 0) {
        continue;
      }
      victimData.inventory.delete(itemId);
      this.spawnLoot(victim.x, victim.z, 0, itemId, quantity);
    }

    const killerName = killerId ? this.state.players.get(killerId)?.name : undefined;
    if (killerId) {
      this.addXp(killerId, XP_PER_KILL);
    }

    this.clients.getById(victimId)?.send("death", {
      byName: killerName,
      respawnAt: victimData.respawnAt,
    } satisfies DeathEvent);

    this.broadcast("chat", {
      kind: "system",
      from: "Avarice",
      text: killerName ? `${victim.name} was slain by ${killerName}.` : `${victim.name} died.`,
      at: Date.now(),
    } satisfies ChatEvent);

    this.sendSelf(victimId);
    void this.persistOne(victimId);
  }

  private respawn(sessionId: string): void {
    const player = this.state.players.get(sessionId);
    const data = this.players.get(sessionId);
    if (!player || !data) {
      return;
    }
    const spawn = resolveWorldCollision(randomSpawn(), PLAYER_RADIUS);
    player.x = spawn.x;
    player.z = spawn.z;
    player.yaw = Math.atan2(-spawn.x, -spawn.z);
    player.hp = player.maxHp;
    player.alive = true;
    data.respawnAt = 0;
    data.lastCombatAt = 0;
    this.playerInputs.set(sessionId, { x: spawn.x, z: spawn.z, yaw: player.yaw });
    this.sendSelf(sessionId);
  }

  private handleUse(client: Client, message: UseItemInput): void {
    const data = this.players.get(client.sessionId);
    const player = this.state.players.get(client.sessionId);
    if (!data || !player) {
      return;
    }
    const item = getItem(sanitizeId(message?.itemId));
    if (!item || item.kind !== "consumable" || !item.heal) {
      this.notice(client, "error", "You can't use that.");
      return;
    }
    if (!player.alive) {
      return;
    }
    if (player.hp >= player.maxHp) {
      this.notice(client, "error", "You are already at full health.");
      return;
    }
    if (!removeItem(data.inventory, item.id, 1)) {
      this.notice(client, "error", "You don't have that.");
      return;
    }
    player.hp = Math.min(player.maxHp, player.hp + item.heal);
    this.notice(client, "success", `Used ${item.name}.`);
    this.sendSelf(client.sessionId);
    void this.persistOne(client.sessionId);
  }

  private handleEquip(client: Client, message: EquipInput): void {
    const data = this.players.get(client.sessionId);
    if (!data) {
      return;
    }
    const slot = message?.slot;
    if (!isEquipSlot(slot)) {
      return;
    }
    const itemId = sanitizeId(message?.itemId);
    if (!itemId) {
      data.equipped[slot] = undefined;
      this.sendSelf(client.sessionId);
      void this.persistOne(client.sessionId);
      return;
    }
    const item = getItem(itemId);
    if (!item || item.slot !== slot || !data.inventory.has(itemId)) {
      this.notice(client, "error", "You can't equip that.");
      return;
    }
    data.equipped[slot] = itemId;
    this.sendSelf(client.sessionId);
    void this.persistOne(client.sessionId);
  }

  private handleShopOpen(client: Client, shopId: string): void {
    const shop = getShop(shopId);
    const player = this.state.players.get(client.sessionId);
    if (!shop || !player) {
      return;
    }
    if (Math.hypot(player.x - shop.x, player.z - shop.z) > SHOP_RANGE) {
      this.notice(client, "error", "Move closer to the merchant.");
      return;
    }
    this.sendShop(client.sessionId, shop.id);
  }

  private handleShopBuy(client: Client, message: ShopTradeInput): void {
    const shop = getShop(sanitizeId(message?.shopId));
    const player = this.state.players.get(client.sessionId);
    const data = this.players.get(client.sessionId);
    if (!shop || !player || !data) {
      return;
    }
    if (Math.hypot(player.x - shop.x, player.z - shop.z) > SHOP_RANGE) {
      this.notice(client, "error", "Move closer to the merchant.");
      return;
    }
    const itemId = sanitizeId(message?.itemId);
    if (!shop.sells.includes(itemId)) {
      return;
    }
    const item = getItem(itemId);
    if (!item) {
      return;
    }
    const quantity = sanitizeQuantity(message?.quantity);
    const cost = itemBuyPrice(item) * quantity;
    if (!canAfford(player.coins, cost)) {
      this.notice(client, "error", "Not enough coins.");
      return;
    }
    if (!addItem(data.inventory, item.id, quantity)) {
      return;
    }
    player.coins -= cost;
    this.notice(client, "success", `Bought ${quantity}× ${item.name} for ${cost}c.`);
    this.sendSelf(client.sessionId);
    void this.persistOne(client.sessionId);
  }

  private handleShopSell(client: Client, message: ShopTradeInput): void {
    const shop = getShop(sanitizeId(message?.shopId));
    const player = this.state.players.get(client.sessionId);
    const data = this.players.get(client.sessionId);
    if (!shop || !shop.buys || !player || !data) {
      return;
    }
    if (Math.hypot(player.x - shop.x, player.z - shop.z) > SHOP_RANGE) {
      this.notice(client, "error", "Move closer to the merchant.");
      return;
    }
    const item = getItem(sanitizeId(message?.itemId));
    if (!item) {
      return;
    }
    const quantity = sanitizeQuantity(message?.quantity);
    if (!removeItem(data.inventory, item.id, quantity)) {
      this.notice(client, "error", "You don't have that many.");
      return;
    }
    const payout = itemSellPrice(item) * quantity;
    player.coins += payout;
    this.notice(client, "success", `Sold ${quantity}× ${item.name} for ${payout}c.`);
    this.sendSelf(client.sessionId);
    void this.persistOne(client.sessionId);
  }

  private async sendBazaar(sessionId: string): Promise<void> {
    const client = this.clients.getById(sessionId);
    if (!client) {
      return;
    }
    const listings = await listBazaarListings();
    client.send("bazaar", { listings: listings.map((row) => this.toBazaarItem(row)) } satisfies BazaarView);
  }

  private toBazaarItem(row: BazaarRow): BazaarItem {
    const item = getItem(row.itemId);
    return {
      id: row.id,
      itemId: row.itemId,
      name: item?.name ?? row.itemId,
      rarity: item?.rarity ?? "common",
      color: item?.color ?? "#cdd3d8",
      quantity: row.quantity,
      pricePerUnit: row.pricePerUnit,
      seller: row.sellerName,
    };
  }

  private async handleBazaarList(client: Client, message: BazaarListInput): Promise<void> {
    const data = this.players.get(client.sessionId);
    const player = this.state.players.get(client.sessionId);
    if (!data || !player) {
      return;
    }
    const item = getItem(sanitizeId(message?.itemId));
    if (!item) {
      return;
    }
    const quantity = sanitizeQuantity(message?.quantity);
    const price = sanitizePrice(message?.pricePerUnit);
    if (!removeItem(data.inventory, item.id, quantity)) {
      this.notice(client, "error", "You don't have that many.");
      return;
    }
    const fee = listingFee(price, quantity);
    if (!canAfford(player.coins, fee)) {
      addItem(data.inventory, item.id, quantity);
      this.notice(client, "error", `The listing fee is ${fee}c.`);
      return;
    }
    const id = data.playerId ? await createBazaarListing(data.playerId, item.id, quantity, price) : null;
    if (!id) {
      addItem(data.inventory, item.id, quantity);
      this.notice(client, "error", "The bazaar is unavailable right now.");
      return;
    }
    player.coins -= fee;
    this.notice(client, "success", `Listed ${quantity}× ${item.name} at ${price}c each.`);
    this.sendSelf(client.sessionId);
    void this.persistOne(client.sessionId);
    await this.sendBazaar(client.sessionId);
  }

  private async handleBazaarBuy(client: Client, message: BazaarBuyInput): Promise<void> {
    const data = this.players.get(client.sessionId);
    const player = this.state.players.get(client.sessionId);
    if (!data || !player) {
      return;
    }
    const listing = await getBazaarListing(sanitizeId(message?.listingId));
    if (!listing) {
      this.notice(client, "error", "That listing is gone.");
      return;
    }
    if (listing.sellerAuthId === data.authId) {
      this.notice(client, "error", "That is your own listing.");
      return;
    }
    const item = getItem(listing.itemId);
    if (!item) {
      return;
    }
    const quantity = Math.min(sanitizeQuantity(message?.quantity), listing.quantity);
    const cost = listing.pricePerUnit * quantity;
    if (!canAfford(player.coins, cost)) {
      this.notice(client, "error", "Not enough coins.");
      return;
    }

    const sellerSession = this.sessionForAuth(listing.sellerAuthId);
    if (sellerSession) {
      const sellerPlayer = this.state.players.get(sellerSession);
      if (sellerPlayer) {
        sellerPlayer.coins += cost;
        this.sendSelf(sellerSession);
        void this.persistOne(sellerSession);
      }
    } else {
      await addCoinsToPlayer(listing.sellerPlayerId, cost);
    }

    await reduceListingQuantity(listing.id, quantity);
    addItem(data.inventory, listing.itemId, quantity);
    player.coins -= cost;
    this.notice(client, "success", `Bought ${quantity}× ${item.name} for ${cost}c.`);
    this.sendSelf(client.sessionId);
    void this.persistOne(client.sessionId);
    await this.sendBazaar(client.sessionId);
  }

  private async handleBazaarCancel(client: Client, message: BazaarCancelInput): Promise<void> {
    const data = this.players.get(client.sessionId);
    if (!data) {
      return;
    }
    const listing = await getBazaarListing(sanitizeId(message?.listingId));
    if (!listing) {
      this.notice(client, "error", "That listing is gone.");
      return;
    }
    if (listing.sellerAuthId !== data.authId) {
      this.notice(client, "error", "That is not your listing.");
      return;
    }
    const ok = await cancelBazaarListing(listing.id);
    if (!ok) {
      return;
    }
    addItem(data.inventory, listing.itemId, listing.quantity);
    this.notice(client, "success", "Listing cancelled.");
    this.sendSelf(client.sessionId);
    void this.persistOne(client.sessionId);
    await this.sendBazaar(client.sessionId);
  }

  private handleAdmin(client: Client, rawCommand: string): void {
    const data = this.players.get(client.sessionId);
    const player = this.state.players.get(client.sessionId);
    if (!data || !player) {
      return;
    }
    if (!data.isAdmin) {
      client.send("admin", { ok: false, text: "Not authorized." } satisfies AdminResult);
      return;
    }
    const tokens = rawCommand.trim().split(/\s+/).filter((token) => token.length > 0);
    const command = (tokens[0] ?? "help").toLowerCase();
    const result = this.runAdminCommand(client, player, command, tokens.slice(1));
    client.send("admin", result satisfies AdminResult);
  }

  private runAdminCommand(
    client: Client,
    player: PlayerState,
    command: string,
    args: string[],
  ): AdminResult {
    const data = this.players.get(client.sessionId);
    switch (command) {
      case "coins": {
        const amount = Math.trunc(Number(args[0]));
        if (!Number.isFinite(amount)) {
          return { ok: false, text: "Usage: coins <amount>" };
        }
        player.coins = Math.max(0, player.coins + amount);
        this.sendSelf(client.sessionId);
        void this.persistOne(client.sessionId);
        return { ok: true, text: `Adjusted purse by ${amount}c.` };
      }
      case "item": {
        const item = getItem(sanitizeId(args[0]));
        if (!item || !data) {
          return { ok: false, text: "Usage: item <itemId> [qty]" };
        }
        const quantity = Math.max(1, Math.trunc(Number(args[1])) || 1);
        addItem(data.inventory, item.id, quantity);
        this.sendSelf(client.sessionId);
        void this.persistOne(client.sessionId);
        return { ok: true, text: `Granted ${quantity}× ${item.name}.` };
      }
      case "heal": {
        player.hp = player.maxHp;
        return { ok: true, text: "Fully healed." };
      }
      case "kill": {
        const target = this.sessionForName(args.join(" "));
        if (!target) {
          return { ok: false, text: "No such player." };
        }
        this.killPlayer(target, client.sessionId);
        return { ok: true, text: "Target slain." };
      }
      case "kick": {
        const target = this.sessionForName(args.join(" "));
        if (!target) {
          return { ok: false, text: "No such player." };
        }
        this.clients.getById(target)?.leave();
        return { ok: true, text: "Target kicked." };
      }
      case "tp": {
        const x = Number(args[0]);
        const z = Number(args[1]);
        if (!Number.isFinite(x) || !Number.isFinite(z)) {
          return { ok: false, text: "Usage: tp <x> <z>" };
        }
        const resolved = resolveWorldCollision({ x, z }, PLAYER_RADIUS);
        player.x = resolved.x;
        player.z = resolved.z;
        this.playerInputs.set(client.sessionId, { x: resolved.x, z: resolved.z, yaw: player.yaw });
        return { ok: true, text: `Teleported to ${Math.round(resolved.x)}, ${Math.round(resolved.z)}.` };
      }
      case "broadcast": {
        const text = args.join(" ");
        if (!text) {
          return { ok: false, text: "Usage: broadcast <message>" };
        }
        this.broadcast("chat", {
          kind: "system",
          from: "Admin",
          text,
          at: Date.now(),
        } satisfies ChatEvent);
        return { ok: true, text: "Broadcast sent." };
      }
      default:
        return {
          ok: true,
          text: "Commands: coins <n>, item <id> [qty], heal, kill <name>, kick <name>, tp <x> <z>, broadcast <msg>",
        };
    }
  }

  private sessionForAuth(authId: string): string | null {
    for (const [sessionId, data] of this.players) {
      if (data.authId === authId) {
        return sessionId;
      }
    }
    return null;
  }

  private sessionForName(name: string): string | null {
    const needle = name.trim().toLowerCase();
    if (!needle) {
      return null;
    }
    for (const [sessionId, data] of this.players) {
      if (data.displayName.toLowerCase() === needle) {
        return sessionId;
      }
    }
    return null;
  }

  private addXp(sessionId: string, amount: number): boolean {
    const data = this.players.get(sessionId);
    if (!data || amount <= 0) {
      return false;
    }
    data.xp += amount;
    const leveled = this.refreshDerived(sessionId);
    if (leveled) {
      const player = this.state.players.get(sessionId);
      this.broadcast("chat", {
        kind: "system",
        from: "Avarice",
        text: `${player?.name ?? "Someone"} reached level ${player?.level ?? 1}!`,
        at: Date.now(),
      } satisfies ChatEvent);
    }
    this.sendSelf(sessionId);
    return leveled;
  }

  private refreshDerived(sessionId: string): boolean {
    const data = this.players.get(sessionId);
    const player = this.state.players.get(sessionId);
    if (!data || !player) {
      return false;
    }
    const progress = levelFromXp(data.xp);
    const maxHp = maxHpForLevel(progress.level);
    const leveled = progress.level > player.level;
    player.level = progress.level;
    player.maxHp = maxHp;
    if (player.hp > maxHp) {
      player.hp = maxHp;
    }
    if (leveled && player.alive) {
      player.hp = maxHp;
    }
    return leveled;
  }

  private sendSelf(sessionId: string): void {
    const data = this.players.get(sessionId);
    const player = this.state.players.get(sessionId);
    const client = this.clients.getById(sessionId);
    if (!data || !player || !client) {
      return;
    }
    const progress = levelFromXp(data.xp);
    client.send("self", {
      coins: player.coins,
      hp: player.hp,
      maxHp: player.maxHp,
      level: player.level,
      xp: progress.xp,
      xpIntoLevel: progress.xpIntoLevel,
      xpForNext: progress.xpForNext,
      isAdmin: data.isAdmin,
      inventory: inventoryToStacks(data.inventory),
      equipped: data.equipped,
    } satisfies SelfState);
  }

  private sendShop(sessionId: string, shopId: string): void {
    const shop = getShop(shopId);
    const client = this.clients.getById(sessionId);
    if (!shop || !client) {
      return;
    }
    const items: ShopItem[] = [];
    for (const itemId of shop.sells) {
      const item = getItem(itemId);
      if (!item) {
        continue;
      }
      items.push({
        itemId: item.id,
        name: item.name,
        rarity: item.rarity,
        color: item.color,
        price: itemBuyPrice(item),
        attack: item.attack,
        defense: item.defense,
        heal: item.heal,
      });
    }
    client.send("shop", { shopId: shop.id, name: shop.name, items } satisfies ShopView);
  }

  private notice(client: Client, kind: NoticeEvent["kind"], text: string): void {
    client.send("notice", { kind, text } satisfies NoticeEvent);
  }

  private async persistOne(sessionId: string): Promise<void> {
    const data = this.players.get(sessionId);
    const player = this.state.players.get(sessionId);
    if (!data || !player || !data.playerId) {
      return;
    }
    const snapshot: PlayerSnapshot = {
      playerId: data.playerId,
      authId: data.authId,
      displayName: data.displayName,
      x: player.x,
      z: player.z,
      coins: player.coins,
      level: player.level,
      xp: data.xp,
      hp: player.hp,
      isAdmin: data.isAdmin,
      equipped: data.equipped,
      inventory: inventoryToStacks(data.inventory),
    };
    await persistPlayer(snapshot);
  }

  private async persistAll(): Promise<void> {
    for (const sessionId of this.players.keys()) {
      await this.persistOne(sessionId);
    }
  }
}
