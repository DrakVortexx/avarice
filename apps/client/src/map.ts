import { Container, Graphics } from "pixi.js";
import { WORLD_RADIUS } from "@avarice/shared";

interface Block {
  x: number;
  z: number;
  w: number;
  h: number;
  color: number;
}

const BLOCKS: Block[] = [
  { x: 16, z: -18, w: 12, h: 9, color: 0x1f3340 },
  { x: -26, z: -12, w: 9, h: 12, color: 0x1d2f3b },
  { x: -18, z: 16, w: 14, h: 7, color: 0x20303a },
  { x: 18, z: 18, w: 8, h: 8, color: 0x1b2b35 },
  { x: 2, z: -30, w: 16, h: 6, color: 0x223642 },
  { x: -32, z: 2, w: 6, h: 16, color: 0x1e313c },
];

const STALL_COLORS = [0xd98a5f, 0x6fb8a8, 0xc4a1e8];

export function buildMap(): Container {
  const map = new Container();
  const radius = WORLD_RADIUS;
  const extent = radius + 10;

  const ground = new Graphics();
  ground.rect(-extent, -extent, extent * 2, extent * 2).fill(0x111a22);
  map.addChild(ground);

  const grid = new Graphics();
  for (let i = -radius; i <= radius; i += 8) {
    grid.moveTo(i, -radius).lineTo(i, radius);
    grid.moveTo(-radius, i).lineTo(radius, i);
  }
  grid.stroke({ width: 1, color: 0x223442, alpha: 0.7 });
  map.addChild(grid);

  const plaza = new Graphics();
  plaza.circle(0, 0, 13).fill({ color: 0x1c2a35, alpha: 0.95 });
  plaza.circle(0, 0, 13).stroke({ width: 2, color: 0x3c6b62, alpha: 0.85 });
  plaza.circle(0, 0, 8.5).stroke({ width: 1, color: 0x4f8f83, alpha: 0.5 });
  map.addChild(plaza);

  const boundary = new Graphics();
  boundary.circle(0, 0, radius).stroke({ width: 3, color: 0x4f8f83, alpha: 0.8 });
  map.addChild(boundary);

  const decor = new Graphics();
  for (const block of BLOCKS) {
    decor.rect(block.x, block.z, block.w, block.h).fill({ color: block.color, alpha: 0.95 });
    decor
      .rect(block.x, block.z, block.w, block.h)
      .stroke({ width: 1, color: 0x2f4a58, alpha: 0.8 });
  }
  map.addChild(decor);

  STALL_COLORS.forEach((color, index) => {
    const x = 10 + index * 5;
    const z = -14;
    const stall = new Graphics();
    stall.rect(x, z, 3.6, 2.6).fill({ color, alpha: 0.9 });
    stall.rect(x, z, 3.6, 2.6).stroke({ width: 1, color: 0x0b0f14, alpha: 0.6 });
    map.addChild(stall);
  });

  const center = new Graphics();
  center.circle(0, 0, 2.4).fill({ color: 0x7fd1b9, alpha: 0.35 });
  center.circle(0, 0, 2.4).stroke({ width: 1, color: 0x7fd1b9, alpha: 0.8 });
  map.addChild(center);

  return map;
}
