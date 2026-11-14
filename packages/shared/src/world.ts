import { WORLD_RADIUS } from "./constants.js";
import type { Vec2 } from "./movement.js";

export interface Building {
  x: number;
  z: number;
  w: number;
  h: number;
}

export interface Tree {
  x: number;
  z: number;
  r: number;
  size: number;
  variant: number;
}

export interface Lake {
  x: number;
  z: number;
  rx: number;
  rz: number;
}

export const PLAZA_RADIUS = 10;

export const LAKE: Lake = { x: 118, z: -72, rx: 46, rz: 31 };

export const BUILDINGS: Building[] = [
  { x: 24, z: -40, w: 9, h: 6 },
  { x: 50, z: -34, w: 6, h: 9 },
  { x: 30, z: -64, w: 8, h: 5.5 },
  { x: -34, z: -34, w: 10, h: 6.5 },
  { x: -64, z: -40, w: 6.5, h: 9.5 },
  { x: -32, z: 30, w: 9, h: 7.5 },
  { x: -62, z: 44, w: 7.5, h: 6 },
  { x: 32, z: 38, w: 10, h: 6.5 },
  { x: 62, z: 30, w: 6.5, h: 9 },
  { x: 82, z: -10, w: 7.5, h: 7.5 },
  { x: -84, z: 6, w: 8.5, h: 6.5 },
  { x: -4, z: -84, w: 11, h: 6.5 },
  { x: -2, z: 88, w: 10, h: 6.5 },
  { x: 110, z: 70, w: 8.5, h: 7.5 },
  { x: -118, z: -96, w: 10, h: 7.5 },
  { x: 136, z: -134, w: 11, h: 8.5 },
  { x: -150, z: 126, w: 12, h: 8.5 },
  { x: 148, z: 150, w: 10, h: 8 },
  { x: -160, z: -30, w: 8, h: 10 },
  { x: 40, z: -150, w: 9, h: 8 },
];

export const PATHS: Vec2[][] = [
  [
    { x: 0, z: 0 },
    { x: 0, z: -90 },
    { x: 20, z: -150 },
  ],
  [
    { x: 0, z: 0 },
    { x: 80, z: -20 },
    { x: 140, z: -44 },
  ],
  [
    { x: 0, z: 0 },
    { x: -85, z: 10 },
    { x: -160, z: -30 },
  ],
  [
    { x: 0, z: 0 },
    { x: 30, z: 80 },
    { x: 110, z: 70 },
  ],
  [
    { x: 0, z: 0 },
    { x: -70, z: 60 },
    { x: -150, z: 126 },
  ],
  [
    { x: 0, z: 0 },
    { x: 0, z: 90 },
    { x: 0, z: 170 },
  ],
];

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function distanceToSegment(px: number, pz: number, a: Vec2, b: Vec2): number {
  const abx = b.x - a.x;
  const abz = b.z - a.z;
  const lengthSq = abx * abx + abz * abz;
  const t =
    lengthSq === 0
      ? 0
      : Math.max(0, Math.min(1, ((px - a.x) * abx + (pz - a.z) * abz) / lengthSq));
  return Math.hypot(px - (a.x + abx * t), pz - (a.z + abz * t));
}

function distanceToPath(x: number, z: number): number {
  let closest = Number.POSITIVE_INFINITY;
  for (const path of PATHS) {
    for (let i = 0; i < path.length - 1; i += 1) {
      const a = path[i]!;
      const b = path[i + 1]!;
      closest = Math.min(closest, distanceToSegment(x, z, a, b));
    }
  }
  return closest;
}

function insideBuilding(x: number, z: number, padding: number): boolean {
  for (const building of BUILDINGS) {
    if (
      x > building.x - padding &&
      x < building.x + building.w + padding &&
      z > building.z - padding &&
      z < building.z + building.h + padding
    ) {
      return true;
    }
  }
  return false;
}

function insideLake(x: number, z: number, padding: number): boolean {
  const nx = (x - LAKE.x) / (LAKE.rx + padding);
  const nz = (z - LAKE.z) / (LAKE.rz + padding);
  return nx * nx + nz * nz < 1;
}

function buildTrees(): Tree[] {
  const random = mulberry32(0x5eed1234);
  const trees: Tree[] = [];
  let attempts = 0;

  while (trees.length < 700 && attempts < 30_000) {
    attempts += 1;
    const angle = random() * Math.PI * 2;
    const radius = Math.sqrt(random()) * (WORLD_RADIUS - 6);
    const x = Math.cos(angle) * radius;
    const z = Math.sin(angle) * radius;
    const size = 0.75 + random() * 0.75;

    if (Math.hypot(x, z) < PLAZA_RADIUS + 7) {
      continue;
    }
    if (insideBuilding(x, z, 3) || insideLake(x, z, 4) || distanceToPath(x, z) < 4.5) {
      continue;
    }

    let crowded = false;
    for (const tree of trees) {
      if (Math.hypot(tree.x - x, tree.z - z) < 2.8) {
        crowded = true;
        break;
      }
    }
    if (crowded) {
      continue;
    }

    trees.push({
      x,
      z,
      r: 0.55 + size * 0.35,
      size,
      variant: Math.floor(random() * 3),
    });
  }

  return trees;
}

export const TREES: Tree[] = buildTrees();

export function isPositionFree(x: number, z: number, padding = 0): boolean {
  if (Math.hypot(x, z) > WORLD_RADIUS - padding - 3) {
    return false;
  }
  if (Math.hypot(x, z) < PLAZA_RADIUS + 2) {
    return false;
  }
  if (insideBuilding(x, z, padding + 1.5) || insideLake(x, z, padding + 1.5)) {
    return false;
  }
  for (const tree of TREES) {
    if (Math.hypot(tree.x - x, tree.z - z) < tree.r + padding + 0.8) {
      return false;
    }
  }
  return true;
}

export function resolveWorldCollision(position: Vec2, radius: number): Vec2 {
  let { x, z } = position;

  for (let pass = 0; pass < 2; pass += 1) {
    for (const building of BUILDINGS) {
      const minX = building.x - radius;
      const maxX = building.x + building.w + radius;
      const minZ = building.z - radius;
      const maxZ = building.z + building.h + radius;
      if (x <= minX || x >= maxX || z <= minZ || z >= maxZ) {
        continue;
      }
      const left = x - minX;
      const right = maxX - x;
      const top = z - minZ;
      const bottom = maxZ - z;
      const smallest = Math.min(left, right, top, bottom);
      if (smallest === left) {
        x = minX;
      } else if (smallest === right) {
        x = maxX;
      } else if (smallest === top) {
        z = minZ;
      } else {
        z = maxZ;
      }
    }

    const lakeRx = LAKE.rx + radius;
    const lakeRz = LAKE.rz + radius;
    const nx = (x - LAKE.x) / lakeRx;
    const nz = (z - LAKE.z) / lakeRz;
    const lakeDistance = Math.hypot(nx, nz);
    if (lakeDistance < 1) {
      if (lakeDistance < 1e-4) {
        x = LAKE.x + lakeRx;
        z = LAKE.z;
      } else {
        x = LAKE.x + (nx / lakeDistance) * lakeRx;
        z = LAKE.z + (nz / lakeDistance) * lakeRz;
      }
    }

    for (const tree of TREES) {
      const dx = x - tree.x;
      const dz = z - tree.z;
      const minDistance = tree.r + radius;
      const distance = Math.hypot(dx, dz);
      if (distance < minDistance && distance > 1e-4) {
        x = tree.x + (dx / distance) * minDistance;
        z = tree.z + (dz / distance) * minDistance;
      }
    }

    const limit = WORLD_RADIUS - radius;
    const distance = Math.hypot(x, z);
    if (distance > limit) {
      const scale = limit / distance;
      x *= scale;
      z *= scale;
    }
  }

  return { x, z };
}
