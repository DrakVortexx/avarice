import type { PrismaClient } from "@prisma/client";
import { ITEMS, type EquippedGear, type InventoryStack } from "@avarice/shared";

let clientPromise: Promise<PrismaClient | null> | null = null;
let databaseReady = false;

const DEFAULT_ADMINS = ["knowkey"];

export interface PlayerProfile {
  id: string;
  name: string;
  x: number;
  z: number;
  coins: number;
  level: number;
  xp: number;
  hp: number;
  isAdmin: boolean;
  equipped: EquippedGear;
  inventory: InventoryStack[];
}

export interface PlayerSnapshot {
  playerId: string;
  authId: string;
  displayName: string;
  x: number;
  z: number;
  coins: number;
  level: number;
  xp: number;
  hp: number;
  isAdmin: boolean;
  equipped: EquippedGear;
  inventory: InventoryStack[];
}

export interface BazaarRow {
  id: string;
  itemId: string;
  quantity: number;
  pricePerUnit: number;
  sellerPlayerId: string;
  sellerAuthId: string;
  sellerName: string;
}

function describeError(error: unknown): string {
  if (error instanceof Error) {
    const code = (error as { code?: string }).code;
    return code ? `${error.message} (${code})` : error.message;
  }
  return String(error);
}

export function adminUsernames(): string[] {
  const raw = process.env.ADMIN_USERNAMES;
  if (!raw) {
    return DEFAULT_ADMINS;
  }
  const list = raw
    .split(",")
    .map((name) => name.trim().toLowerCase())
    .filter((name) => name.length > 0);
  return list.length > 0 ? list : DEFAULT_ADMINS;
}

export function isAdminUsername(username: string): boolean {
  return adminUsernames().includes(username.trim().toLowerCase());
}

export function getPrisma(): Promise<PrismaClient | null> {
  if (!process.env.DATABASE_URL) {
    return Promise.resolve(null);
  }

  if (!clientPromise) {
    clientPromise = import("@prisma/client")
      .then(({ PrismaClient }) => new PrismaClient())
      .catch((error: unknown) => {
        console.error("[db] Failed to load the Prisma Client:", describeError(error));
        return null;
      });
  }

  return clientPromise;
}

export function isDatabaseReady(): boolean {
  return databaseReady;
}

export async function seedItems(): Promise<void> {
  const prisma = await getPrisma();
  if (!prisma) {
    return;
  }

  try {
    await prisma.$transaction(
      Object.values(ITEMS).map((item) =>
        prisma.item.upsert({
          where: { id: item.id },
          update: {
            name: item.name,
            rarity: item.rarity,
            baseValue: item.baseValue,
            description: item.description,
          },
          create: {
            id: item.id,
            name: item.name,
            rarity: item.rarity,
            baseValue: item.baseValue,
            description: item.description,
          },
        }),
      ),
    );
    console.log(`[db] Seeded ${Object.keys(ITEMS).length} item definitions.`);
  } catch (error) {
    console.error("[db] seedItems failed:", describeError(error));
  }
}

export async function initDatabase(): Promise<boolean> {
  if (!process.env.DATABASE_URL) {
    console.warn("[db] DATABASE_URL is not set. Player progress will NOT be saved.");
    return false;
  }

  const prisma = await getPrisma();
  if (!prisma) {
    console.error("[db] Prisma Client unavailable. Player progress will NOT be saved.");
    return false;
  }

  try {
    await prisma.player.count();
    await seedItems();
    databaseReady = true;
    console.log("[db] Connected. Player progress will be saved.");
    return true;
  } catch (error) {
    console.error("[db] Could not reach the database:", describeError(error));
    console.error("[db] Run `npm run db:push` to create the schema, then restart the server.");
    return false;
  }
}

export async function loadOrCreatePlayer(
  authId: string,
  username: string,
  displayName: string,
): Promise<PlayerProfile | null> {
  const prisma = await getPrisma();
  if (!prisma) {
    return null;
  }

  try {
    let player = await prisma.player.upsert({
      where: { authId },
      update: { username, displayName },
      create: { authId, username, displayName, isAdmin: isAdminUsername(username) },
      include: { inventory: true },
    });

    if (isAdminUsername(username) && !player.isAdmin) {
      player = await prisma.player.update({
        where: { authId },
        data: { isAdmin: true },
        include: { inventory: true },
      });
    }

    return {
      id: player.id,
      name: player.displayName,
      x: player.lastX,
      z: player.lastZ,
      coins: player.coins,
      level: player.level,
      xp: player.xp,
      hp: player.hp,
      isAdmin: player.isAdmin,
      equipped: {
        weapon: player.equippedWeapon ?? undefined,
        armor: player.equippedArmor ?? undefined,
        trinket: player.equippedTrinket ?? undefined,
      },
      inventory: player.inventory
        .filter((entry) => entry.quantity > 0 && ITEMS[entry.itemId])
        .map((entry) => ({ itemId: entry.itemId, quantity: entry.quantity })),
    };
  } catch (error) {
    console.error("[db] loadOrCreatePlayer failed:", describeError(error));
    return null;
  }
}

export async function persistPlayer(snapshot: PlayerSnapshot): Promise<void> {
  const prisma = await getPrisma();
  if (!prisma) {
    return;
  }

  const inventory = snapshot.inventory.filter(
    (stack) => stack.quantity > 0 && ITEMS[stack.itemId],
  );

  try {
    await prisma.$transaction([
      prisma.inventoryEntry.deleteMany({ where: { playerId: snapshot.playerId } }),
      prisma.inventoryEntry.createMany({
        data: inventory.map((stack) => ({
          playerId: snapshot.playerId,
          itemId: stack.itemId,
          quantity: stack.quantity,
        })),
        skipDuplicates: true,
      }),
      prisma.player.update({
        where: { authId: snapshot.authId },
        data: {
          displayName: snapshot.displayName,
          lastX: snapshot.x,
          lastZ: snapshot.z,
          coins: snapshot.coins,
          level: snapshot.level,
          xp: snapshot.xp,
          hp: snapshot.hp,
          isAdmin: snapshot.isAdmin,
          equippedWeapon: snapshot.equipped.weapon ?? null,
          equippedArmor: snapshot.equipped.armor ?? null,
          equippedTrinket: snapshot.equipped.trinket ?? null,
        },
      }),
    ]);
  } catch (error) {
    console.error("[db] persistPlayer failed:", describeError(error));
  }
}

export async function addInventoryItem(
  playerId: string,
  itemId: string,
  quantity: number,
): Promise<void> {
  const prisma = await getPrisma();
  if (!prisma || quantity <= 0 || !ITEMS[itemId]) {
    return;
  }
  try {
    await prisma.inventoryEntry.upsert({
      where: { playerId_itemId: { playerId, itemId } },
      update: { quantity: { increment: quantity } },
      create: { playerId, itemId, quantity },
    });
  } catch (error) {
    console.error("[db] addInventoryItem failed:", describeError(error));
  }
}

export async function addCoinsToPlayer(playerId: string, delta: number): Promise<void> {
  const prisma = await getPrisma();
  if (!prisma || delta === 0) {
    return;
  }
  try {
    await prisma.player.update({
      where: { id: playerId },
      data: { coins: { increment: delta } },
    });
  } catch (error) {
    console.error("[db] addCoinsToPlayer failed:", describeError(error));
  }
}

export async function listBazaarListings(limit = 120): Promise<BazaarRow[]> {
  const prisma = await getPrisma();
  if (!prisma) {
    return [];
  }
  try {
    const rows = await prisma.bazaarListing.findMany({
      where: { status: "active", quantity: { gt: 0 } },
      orderBy: { createdAt: "desc" },
      take: limit,
      include: { seller: { select: { id: true, authId: true, displayName: true } } },
    });
    return rows
      .filter((row) => ITEMS[row.itemId])
      .map((row) => ({
        id: row.id,
        itemId: row.itemId,
        quantity: row.quantity,
        pricePerUnit: row.pricePerUnit,
        sellerPlayerId: row.seller.id,
        sellerAuthId: row.seller.authId,
        sellerName: row.seller.displayName,
      }));
  } catch (error) {
    console.error("[db] listBazaarListings failed:", describeError(error));
    return [];
  }
}

export async function getBazaarListing(id: string): Promise<BazaarRow | null> {
  const prisma = await getPrisma();
  if (!prisma) {
    return null;
  }
  try {
    const row = await prisma.bazaarListing.findUnique({
      where: { id },
      include: { seller: { select: { id: true, authId: true, displayName: true } } },
    });
    if (!row || row.status !== "active" || row.quantity <= 0 || !ITEMS[row.itemId]) {
      return null;
    }
    return {
      id: row.id,
      itemId: row.itemId,
      quantity: row.quantity,
      pricePerUnit: row.pricePerUnit,
      sellerPlayerId: row.seller.id,
      sellerAuthId: row.seller.authId,
      sellerName: row.seller.displayName,
    };
  } catch (error) {
    console.error("[db] getBazaarListing failed:", describeError(error));
    return null;
  }
}

export async function createBazaarListing(
  sellerId: string,
  itemId: string,
  quantity: number,
  pricePerUnit: number,
): Promise<string | null> {
  const prisma = await getPrisma();
  if (!prisma || !ITEMS[itemId]) {
    return null;
  }
  try {
    const listing = await prisma.bazaarListing.create({
      data: { sellerId, itemId, quantity, pricePerUnit },
    });
    return listing.id;
  } catch (error) {
    console.error("[db] createBazaarListing failed:", describeError(error));
    return null;
  }
}

export async function reduceListingQuantity(id: string, quantity: number): Promise<number> {
  const prisma = await getPrisma();
  if (!prisma) {
    return 0;
  }
  try {
    const listing = await prisma.bazaarListing.findUnique({ where: { id } });
    if (!listing) {
      return 0;
    }
    const remaining = Math.max(0, listing.quantity - quantity);
    await prisma.bazaarListing.update({
      where: { id },
      data: { quantity: remaining, status: remaining <= 0 ? "sold" : "active" },
    });
    return remaining;
  } catch (error) {
    console.error("[db] reduceListingQuantity failed:", describeError(error));
    return 0;
  }
}

export async function cancelBazaarListing(id: string): Promise<boolean> {
  const prisma = await getPrisma();
  if (!prisma) {
    return false;
  }
  try {
    const listing = await prisma.bazaarListing.findUnique({ where: { id } });
    if (!listing || listing.status !== "active") {
      return false;
    }
    await prisma.bazaarListing.update({ where: { id }, data: { status: "cancelled" } });
    return true;
  } catch (error) {
    console.error("[db] cancelBazaarListing failed:", describeError(error));
    return false;
  }
}
