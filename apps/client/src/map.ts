import { Container, Graphics } from "pixi.js";
import {
  BUILDINGS,
  LAKE,
  PATHS,
  PLAZA_RADIUS,
  TREES,
  WORLD_RADIUS,
} from "@avarice/shared";

const GRASS_PALETTE = [0x22352a, 0x283d2f, 0x1e3026, 0x2d4433, 0x24392b];
const TREE_PALETTE = [
  [0x2f5a3a, 0x3b6f47, 0x4c8354],
  [0x2b5340, 0x35674e, 0x47805e],
  [0x3a5c30, 0x497238, 0x5a8a45],
];
const WALL_PALETTE = [0x4a4036, 0x3f4a44, 0x4a3a42, 0x3c4650];
const ROOF_PALETTE = [0x8a4f3c, 0x5d7f6c, 0x6d5a86, 0x7a6a3e];

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

function insideBuilding(x: number, z: number, padding: number): boolean {
  return BUILDINGS.some(
    (b) =>
      x > b.x - padding &&
      x < b.x + b.w + padding &&
      z > b.z - padding &&
      z < b.z + b.h + padding,
  );
}

function insideLake(x: number, z: number, padding: number): boolean {
  const nx = (x - LAKE.x) / (LAKE.rx + padding);
  const nz = (z - LAKE.z) / (LAKE.rz + padding);
  return nx * nx + nz * nz < 1;
}

function drawGround(map: Container): void {
  const extent = WORLD_RADIUS + 24;

  const ground = new Graphics();
  ground.rect(-extent, -extent, extent * 2, extent * 2).fill(0x141f19);
  map.addChild(ground);

  const random = mulberry32(0xa17e5);
  const patches = new Graphics();
  for (let i = 0; i < 350; i += 1) {
    const angle = random() * Math.PI * 2;
    const radius = Math.sqrt(random()) * WORLD_RADIUS;
    const x = Math.cos(angle) * radius;
    const z = Math.sin(angle) * radius;
    const rx = 4 + random() * 15;
    const rz = 3 + random() * 11;
    const color = GRASS_PALETTE[Math.floor(random() * GRASS_PALETTE.length)] ?? 0x22352a;
    patches.ellipse(x, z, rx, rz).fill({ color, alpha: 0.5 + random() * 0.35 });
  }
  map.addChild(patches);
}

function drawPaths(map: Container): void {
  const outer = new Graphics();
  const inner = new Graphics();

  for (const path of PATHS) {
    const first = path[0];
    if (!first) {
      continue;
    }
    outer.moveTo(first.x, first.z);
    inner.moveTo(first.x, first.z);
    for (let i = 1; i < path.length; i += 1) {
      const point = path[i]!;
      outer.lineTo(point.x, point.z);
      inner.lineTo(point.x, point.z);
    }
  }

  outer.stroke({ width: 4.6, color: 0x3a3223, alpha: 0.85, cap: "round", join: "round" });
  inner.stroke({ width: 3.4, color: 0x584a33, alpha: 0.9, cap: "round", join: "round" });
  map.addChild(outer, inner);
}

function drawLake(map: Container): void {
  const shore = new Graphics();
  shore.ellipse(LAKE.x, LAKE.z, LAKE.rx + 4, LAKE.rz + 4).fill({ color: 0x6c6247, alpha: 0.55 });
  shore.ellipse(LAKE.x, LAKE.z, LAKE.rx + 1.5, LAKE.rz + 1.5).fill({ color: 0x8a7d5a, alpha: 0.5 });
  map.addChild(shore);

  const water = new Graphics();
  water.ellipse(LAKE.x, LAKE.z, LAKE.rx, LAKE.rz).fill({ color: 0x1d3f55, alpha: 1 });
  water.ellipse(LAKE.x - 6, LAKE.z - 4, LAKE.rx * 0.78, LAKE.rz * 0.74).fill({ color: 0x27536d, alpha: 0.8 });
  water
    .ellipse(LAKE.x - 10, LAKE.z - 7, LAKE.rx * 0.5, LAKE.rz * 0.46)
    .fill({ color: 0x336a86, alpha: 0.5 });
  map.addChild(water);

  const ripples = new Graphics();
  const random = mulberry32(0x1a4e);
  for (let i = 0; i < 14; i += 1) {
    const angle = random() * Math.PI * 2;
    const radius = Math.sqrt(random());
    const x = LAKE.x + Math.cos(angle) * radius * LAKE.rx * 0.8;
    const z = LAKE.z + Math.sin(angle) * radius * LAKE.rz * 0.8;
    ripples.ellipse(x, z, 1.2 + random() * 2.4, 0.25 + random() * 0.35).stroke({
      width: 0.16,
      color: 0xb6e3f5,
      alpha: 0.35,
    });
  }
  map.addChild(ripples);
}

function drawPlaza(map: Container): void {
  const plaza = new Graphics();
  plaza.circle(0, 0, PLAZA_RADIUS + 1.5).fill({ color: 0x26302a, alpha: 0.9 });
  plaza.circle(0, 0, PLAZA_RADIUS).fill({ color: 0x39423b, alpha: 0.98 });
  plaza.circle(0, 0, PLAZA_RADIUS - 1.6).fill({ color: 0x424c44, alpha: 0.9 });
  plaza.circle(0, 0, PLAZA_RADIUS).stroke({ width: 0.28, color: 0x6b7d6e, alpha: 0.8 });
  plaza.circle(0, 0, 4.4).stroke({ width: 0.18, color: 0x5d6d60, alpha: 0.7 });
  plaza.circle(0, 0, 7.4).stroke({ width: 0.15, color: 0x5d6d60, alpha: 0.5 });

  for (let i = 0; i < 16; i += 1) {
    const angle = (i / 16) * Math.PI * 2;
    plaza
      .moveTo(Math.cos(angle) * 4.4, Math.sin(angle) * 4.4)
      .lineTo(Math.cos(angle) * (PLAZA_RADIUS - 1.6), Math.sin(angle) * (PLAZA_RADIUS - 1.6));
  }
  plaza.stroke({ width: 0.12, color: 0x5d6d60, alpha: 0.4 });
  map.addChild(plaza);

  const fountain = new Graphics();
  fountain.circle(0, 0, 2.6).fill({ color: 0x2f3a34, alpha: 1 });
  fountain.circle(0, 0, 2.1).fill({ color: 0x2a5a70, alpha: 1 });
  fountain.circle(0, 0, 2.1).stroke({ width: 0.16, color: 0x7fb7c9, alpha: 0.8 });
  fountain.circle(-0.4, -0.35, 1.2).fill({ color: 0x3f7c93, alpha: 0.7 });
  fountain.circle(0, 0, 0.4).fill({ color: 0xa9dcec, alpha: 0.9 });
  map.addChild(fountain);
}

function drawBuildings(map: Container): void {
  const buildings = new Graphics();

  BUILDINGS.forEach((building, index) => {
    const wall = WALL_PALETTE[index % WALL_PALETTE.length] ?? 0x4a4036;
    const roof = ROOF_PALETTE[index % ROOF_PALETTE.length] ?? 0x8a4f3c;
    const { x, z, w, h } = building;

    buildings.rect(x + 0.55, z + 0.55, w, h).fill({ color: 0x050a07, alpha: 0.35 });
    buildings.rect(x, z, w, h).fill(wall);
    buildings.rect(x, z, w, h).stroke({ width: 0.12, color: 0x1a120c, alpha: 0.7 });
    buildings.rect(x + 0.4, z + 0.4, w - 0.8, h - 0.8).fill(roof);
    buildings.rect(x + 0.4, z + 0.4, w - 0.8, h - 0.8).stroke({
      width: 0.1,
      color: 0xffffff,
      alpha: 0.12,
    });
    buildings
      .moveTo(x + 0.4, z + h / 2)
      .lineTo(x + w - 0.4, z + h / 2)
      .stroke({ width: 0.14, color: 0xffffff, alpha: 0.1 });

    const doorW = 0.9;
    buildings.rect(x + w / 2 - doorW / 2, z + h - 0.75, doorW, 0.75).fill({
      color: 0x241a12,
      alpha: 0.9,
    });

    if (w > 7) {
      buildings.rect(x + 1.1, z + 1, 0.9, 0.6).fill({ color: 0xf3d27a, alpha: 0.55 });
      buildings.rect(x + w - 2, z + 1, 0.9, 0.6).fill({ color: 0xf3d27a, alpha: 0.55 });
    }
  });

  map.addChild(buildings);
}

function drawTrees(map: Container): void {
  const shadows = new Graphics();
  const foliage = new Graphics();

  for (const tree of TREES) {
    const palette = TREE_PALETTE[tree.variant % TREE_PALETTE.length] ?? TREE_PALETTE[0]!;
    const s = tree.size;

    shadows
      .ellipse(tree.x + s * 0.28, tree.z + s * 0.34, s * 0.95, s * 0.62)
      .fill({ color: 0x050a07, alpha: 0.28 });

    foliage.circle(tree.x, tree.z + 0.18, s * 0.28).fill({ color: 0x3a2a1c, alpha: 1 });
    foliage.circle(tree.x, tree.z, s * 0.92).fill({ color: palette[0]!, alpha: 1 });
    foliage.circle(tree.x - s * 0.36, tree.z - s * 0.3, s * 0.62).fill({
      color: palette[1]!,
      alpha: 1,
    });
    foliage.circle(tree.x + s * 0.34, tree.z - s * 0.24, s * 0.56).fill({
      color: palette[1]!,
      alpha: 1,
    });
    foliage.circle(tree.x - s * 0.08, tree.z - s * 0.46, s * 0.44).fill({
      color: palette[2]!,
      alpha: 0.95,
    });
  }

  map.addChild(shadows, foliage);
}

function drawScatter(map: Container): void {
  const random = mulberry32(0x7c0ffee);
  const rocks = new Graphics();
  const bushes = new Graphics();

  for (let i = 0; i < 700; i += 1) {
    const angle = random() * Math.PI * 2;
    const radius = Math.sqrt(random()) * (WORLD_RADIUS - 4);
    const x = Math.cos(angle) * radius;
    const z = Math.sin(angle) * radius;
    if (Math.hypot(x, z) < PLAZA_RADIUS + 3 || insideBuilding(x, z, 2) || insideLake(x, z, 2)) {
      continue;
    }
    const size = 0.5 + random() * 0.9;
    rocks.ellipse(x + 0.2, z + 0.25, size, size * 0.6).fill({ color: 0x0a120d, alpha: 0.3 });
    rocks.ellipse(x, z, size, size * 0.62).fill({ color: 0x586158, alpha: 0.9 });
    rocks.ellipse(x - size * 0.2, z - size * 0.15, size * 0.55, size * 0.35).fill({
      color: 0x768076,
      alpha: 0.8,
    });
  }

  for (let i = 0; i < 700; i += 1) {
    const angle = random() * Math.PI * 2;
    const radius = Math.sqrt(random()) * (WORLD_RADIUS - 4);
    const x = Math.cos(angle) * radius;
    const z = Math.sin(angle) * radius;
    if (Math.hypot(x, z) < PLAZA_RADIUS + 2 || insideBuilding(x, z, 1.5) || insideLake(x, z, 1.5)) {
      continue;
    }
    const size = 0.4 + random() * 0.6;
    bushes.circle(x, z, size).fill({ color: 0x2c4a33, alpha: 0.95 });
    bushes.circle(x - size * 0.4, z - size * 0.3, size * 0.6).fill({
      color: 0x396040,
      alpha: 0.9,
    });
  }

  map.addChild(rocks, bushes);
}

function drawLanterns(map: Container): void {
  const lanterns = new Graphics();

  for (let i = 0; i < 12; i += 1) {
    const angle = (i / 12) * Math.PI * 2;
    const x = Math.cos(angle) * (PLAZA_RADIUS + 2.5);
    const z = Math.sin(angle) * (PLAZA_RADIUS + 2.5);
    lanterns.circle(x, z, 2).fill({ color: 0xf3c46a, alpha: 0.08 });
    lanterns.circle(x, z, 0.42).fill({ color: 0x2a2118, alpha: 1 });
    lanterns.circle(x, z, 0.24).fill({ color: 0xf3d27a, alpha: 0.95 });
  }

  map.addChild(lanterns);
}

function drawBoundary(map: Container): void {
  const boundary = new Graphics();
  boundary.circle(0, 0, WORLD_RADIUS).stroke({ width: 1.6, color: 0x4f8f83, alpha: 0.7 });
  boundary.circle(0, 0, WORLD_RADIUS - 1.2).stroke({ width: 0.6, color: 0x9adfd0, alpha: 0.22 });
  boundary.circle(0, 0, WORLD_RADIUS + 1.4).stroke({ width: 0.5, color: 0x0a1410, alpha: 0.5 });
  map.addChild(boundary);
}

export function buildMap(): Container {
  const map = new Container();
  drawGround(map);
  drawPaths(map);
  drawLake(map);
  drawPlaza(map);
  drawBuildings(map);
  drawTrees(map);
  drawScatter(map);
  drawLanterns(map);
  drawBoundary(map);
  return map;
}
