import type { PrismaClient } from "@prisma/client";

let clientPromise: Promise<PrismaClient | null> | null = null;
let databaseReady = false;

export interface PlayerProfile {
  name: string;
  x: number;
  z: number;
  coins: number;
}

function describeError(error: unknown): string {
  if (error instanceof Error) {
    const code = (error as { code?: string }).code;
    return code ? `${error.message} (${code})` : error.message;
  }
  return String(error);
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
    const player = await prisma.player.upsert({
      where: { authId },
      update: { username, displayName },
      create: { authId, username, displayName },
    });
    return { name: player.displayName, x: player.lastX, z: player.lastZ, coins: player.coins };
  } catch (error) {
    console.error("[db] loadOrCreatePlayer failed:", describeError(error));
    return null;
  }
}

export async function persistPlayer(
  authId: string,
  displayName: string,
  x: number,
  z: number,
  coins: number,
): Promise<void> {
  const prisma = await getPrisma();
  if (!prisma) {
    return;
  }

  try {
    await prisma.player.update({
      where: { authId },
      data: { displayName, lastX: x, lastZ: z, coins },
    });
  } catch (error) {
    console.error("[db] persistPlayer failed:", describeError(error));
  }
}
