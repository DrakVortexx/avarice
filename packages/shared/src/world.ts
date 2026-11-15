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

export interface District {
  name: string;
  x: number;
  z: number;
  radius: number;
}

export const PLAZA_RADIUS = 12;

export const LAKES: Lake[] = [
  { x: 150, z: -95, rx: 62, rz: 42 },
  { x: -250, z: 195, rx: 58, rz: 40 },
  { x: 255, z: 255, rx: 50, rz: 36 },
  { x: -170, z: -300, rx: 44, rz: 32 },
];

const OUTPOSTS: District[] = [
  { name: "Frostgate", x: 0, z: -400, radius: 15 },
  { name: "Highfell", x: 340, z: -340, radius: 14 },
  { name: "Emberhold", x: 430, z: 40, radius: 15 },
  { name: "Sunmere", x: 40, z: 430, radius: 15 },
  { name: "Duskport", x: -340, z: 340, radius: 14 },
  { name: "Mistwood", x: -430, z: -40, radius: 15 },
];

export const DISTRICTS: District[] = [
  { name: "Market Plaza", x: 0, z: 0, radius: PLAZA_RADIUS },
  ...OUTPOSTS,
];

function buildPaths(): Vec2[][] {
  const spokes: Vec2[][] = OUTPOSTS.map((district) => [
    { x: 0, z: 0 },
    { x: district.x * 0.5, z: district.z * 0.5 },
    { x: district.x, z: district.z },
  ]);

  const ring: Vec2[] = OUTPOSTS.map((district) => ({ x: district.x, z: district.z }));
  const first = OUTPOSTS[0];
  if (first) {
    ring.push({ x: first.x, z: first.z });
  }

  return [...spokes, ring];
}

export const PATHS: Vec2[][] = buildPaths();

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
  for (const lake of LAKES) {
    const nx = (x - lake.x) / (lake.rx + padding);
    const nz = (z - lake.z) / (lake.rz + padding);
    if (nx * nx + nz * nz < 1) {
      return true;
    }
  }
  return false;
}

function insideDistrictPlaza(x: number, z: number, padding: number): boolean {
  for (const district of DISTRICTS) {
    if (Math.hypot(district.x - x, district.z - z) < district.radius + padding) {
      return true;
    }
  }
  return false;
}

function rectsOverlap(a: Building, b: Building, padding: number): boolean {
  return (
    a.x - padding < b.x + b.w &&
    a.x + a.w + padding > b.x &&
    a.z - padding < b.z + b.h &&
    a.z + a.h + padding > b.z
  );
}

function buildBuildings(): Building[] {
  const random = mulberry32(0xb01d1e5);
  const buildings: Building[] = [];

  for (const district of DISTRICTS) {
    const isHub = district.radius <= PLAZA_RADIUS + 0.5;
    const count = isHub ? 18 : 10;
    const minRing = district.radius + 5;
    const maxRing = isHub ? 72 : 36;
    let placed = 0;
    let attempts = 0;

    while (placed < count && attempts < 600) {
      attempts += 1;
      const angle = random() * Math.PI * 2;
      const ring = minRing + random() * (maxRing - minRing);
      const w = 6 + random() * 7;
      const h = 6 + random() * 7;
      const cx = district.x + Math.cos(angle) * ring;
      const cz = district.z + Math.sin(angle) * ring;
      const candidate: Building = { x: cx - w / 2, z: cz - h / 2, w, h };

      if (Math.hypot(cx, cz) > WORLD_RADIUS - 24) {
        continue;
      }
      if (insideLake(cx, cz, 3) || distanceToPath(cx, cz) < 5) {
        continue;
      }
      if (buildings.some((building) => rectsOverlap(candidate, building, 4))) {
        continue;
      }

      buildings.push(candidate);
      placed += 1;
    }
  }

  return buildings;
}

export const BUILDINGS: Building[] = buildBuildings();

const TREE_CELL = 8;

function treeCellKey(cx: number, cz: number): string {
  return `${cx}:${cz}`;
}

function buildTrees(): Tree[] {
  const random = mulberry32(0x5eed1234);
  const trees: Tree[] = [];
  const cells = new Map<string, Tree[]>();
  const target = 2200;
  let attempts = 0;

  const addTree = (tree: Tree): void => {
    const key = treeCellKey(Math.floor(tree.x / TREE_CELL), Math.floor(tree.z / TREE_CELL));
    const bucket = cells.get(key);
    if (bucket) {
      bucket.push(tree);
    } else {
      cells.set(key, [tree]);
    }
  };

  const tooCrowded = (x: number, z: number, minDistance: number): boolean => {
    const cx = Math.floor(x / TREE_CELL);
    const cz = Math.floor(z / TREE_CELL);
    for (let ox = -1; ox <= 1; ox += 1) {
      for (let oz = -1; oz <= 1; oz += 1) {
        const bucket = cells.get(treeCellKey(cx + ox, cz + oz));
        if (!bucket) {
          continue;
        }
        for (const tree of bucket) {
          if (Math.hypot(tree.x - x, tree.z - z) < minDistance) {
            return true;
          }
        }
      }
    }
    return false;
  };

  while (trees.length < target && attempts < 90_000) {
    attempts += 1;
    const angle = random() * Math.PI * 2;
    const radius = Math.sqrt(random()) * (WORLD_RADIUS - 8);
    const x = Math.cos(angle) * radius;
    const z = Math.sin(angle) * radius;
    const size = 0.75 + random() * 0.75;

    if (insideDistrictPlaza(x, z, 5)) {
      continue;
    }
    if (insideBuilding(x, z, 3) || insideLake(x, z, 4) || distanceToPath(x, z) < 4.5) {
      continue;
    }
    if (tooCrowded(x, z, 2.8)) {
      continue;
    }

    const tree: Tree = {
      x,
      z,
      r: 0.55 + size * 0.35,
      size,
      variant: Math.floor(random() * 3),
    };
    trees.push(tree);
    addTree(tree);
  }

  return trees;
}

export const TREES: Tree[] = buildTrees();

const collisionGrid = new Map<string, Tree[]>();

for (const tree of TREES) {
  const key = treeCellKey(Math.floor(tree.x / TREE_CELL), Math.floor(tree.z / TREE_CELL));
  const bucket = collisionGrid.get(key);
  if (bucket) {
    bucket.push(tree);
  } else {
    collisionGrid.set(key, [tree]);
  }
}

function nearbyTrees(x: number, z: number): Tree[] {
  const cx = Math.floor(x / TREE_CELL);
  const cz = Math.floor(z / TREE_CELL);
  const result: Tree[] = [];
  for (let ox = -1; ox <= 1; ox += 1) {
    for (let oz = -1; oz <= 1; oz += 1) {
      const bucket = collisionGrid.get(treeCellKey(cx + ox, cz + oz));
      if (bucket) {
        for (const tree of bucket) {
          result.push(tree);
        }
      }
    }
  }
  return result;
}

export function isPositionFree(x: number, z: number, padding = 0): boolean {
  if (Math.hypot(x, z) > WORLD_RADIUS - padding - 3) {
    return false;
  }
  if (insideDistrictPlaza(x, z, 2)) {
    return false;
  }
  if (insideBuilding(x, z, padding + 1.5) || insideLake(x, z, padding + 1.5)) {
    return false;
  }
  for (const tree of nearbyTrees(x, z)) {
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

    for (const lake of LAKES) {
      const lakeRx = lake.rx + radius;
      const lakeRz = lake.rz + radius;
      const nx = (x - lake.x) / lakeRx;
      const nz = (z - lake.z) / lakeRz;
      const lakeDistance = Math.hypot(nx, nz);
      if (lakeDistance < 1) {
        if (lakeDistance < 1e-4) {
          x = lake.x + lakeRx;
          z = lake.z;
        } else {
          x = lake.x + (nx / lakeDistance) * lakeRx;
          z = lake.z + (nz / lakeDistance) * lakeRz;
        }
      }
    }

    for (const tree of nearbyTrees(x, z)) {
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
