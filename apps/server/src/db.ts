import type { PrismaClient } from "@prisma/client";

let clientPromise: Promise<PrismaClient | null> | null = null;

export interface PlayerProfile {
  name: string;
  x: number;
  z: number;
}

export function getPrisma(): Promise<PrismaClient | null> {
  if (!process.env.DATABASE_URL) {
    return Promise.resolve(null);
  }

  if (!clientPromise) {
    clientPromise = import("@prisma/client")
      .then(({ PrismaClient }) => new PrismaClient())
      .catch((error: unknown) => {
        console.warn("[db] Prisma unavailable, running in memory only:", error);
        return null;
      });
  }

  return clientPromise;
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
    return { name: player.displayName, x: player.lastX, z: player.lastZ };
  } catch (error) {
    console.warn("[db] loadOrCreatePlayer failed:", error);
    return null;
  }
}

export async function persistPlayer(
  authId: string,
  displayName: string,
  x: number,
  z: number,
): Promise<void> {
  const prisma = await getPrisma();
  if (!prisma) {
    return;
  }

  try {
    await prisma.player.update({
      where: { authId },
      data: { displayName, lastX: x, lastZ: z },
    });
  } catch (error) {
    console.warn("[db] persistPlayer failed:", error);
  }
}
