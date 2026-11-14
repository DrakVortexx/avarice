import { Container, Graphics, Text } from "pixi.js";
import { PIXELS_PER_UNIT } from "./render.js";

const PALETTE = [0x7fd1b9, 0xb79bff, 0xffc98a, 0x6fb8a8, 0xd98a5f, 0x8fd6e8, 0xe8c15a, 0xff7a5c];

const LABEL_STYLE = {
  fontFamily: "Segoe UI, system-ui, sans-serif",
  fontSize: 12,
  fontWeight: "600",
  fill: 0xe8eef5,
  stroke: { color: 0x0b0f14, width: 3 },
} as const;

export interface Avatar {
  container: Container;
  setPosition: (x: number, z: number) => void;
  setFacing: (yaw: number) => void;
  destroy: () => void;
}

export interface LootPile {
  container: Container;
  destroy: () => void;
}

function hashString(value: string): number {
  let hash = 2166136261;
  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

export function colorFromId(id: string): number {
  return PALETTE[hashString(id) % PALETTE.length] ?? 0x7fd1b9;
}

function makeLabel(text: string): Text {
  const label = new Text({ text, style: LABEL_STYLE });
  label.anchor.set(0.5, 1);
  label.position.y = -0.95;
  label.scale.set(1 / PIXELS_PER_UNIT);
  return label;
}

function lighten(color: number, amount: number): number {
  const r = Math.min(255, ((color >> 16) & 0xff) + amount);
  const g = Math.min(255, ((color >> 8) & 0xff) + amount);
  const b = Math.min(255, (color & 0xff) + amount);
  return (r << 16) | (g << 8) | b;
}

export function createAvatar(name: string, color?: number): Avatar {
  const container = new Container();
  const body = new Container();
  const tint = color ?? colorFromId(name);

  const shadow = new Graphics();
  shadow.ellipse(0, 0.16, 0.62, 0.36).fill({ color: 0x06100c, alpha: 0.32 });
  container.addChild(shadow);

  const cloak = new Graphics();
  cloak.circle(0, 0, 0.52).fill({ color: 0x0b0f14, alpha: 0.5 });
  body.addChild(cloak);

  const disc = new Graphics();
  disc.circle(0, 0, 0.46).fill({ color: tint, alpha: 0.96 });
  disc.circle(0, 0, 0.46).stroke({ width: 0.07, color: 0xffffff, alpha: 0.28 });
  disc.circle(-0.13, -0.14, 0.17).fill({ color: lighten(tint, 34), alpha: 0.55 });
  body.addChild(disc);

  const facing = new Graphics();
  facing
    .moveTo(0, -0.78)
    .lineTo(0.3, -0.3)
    .lineTo(-0.3, -0.3)
    .closePath()
    .fill({ color: 0xffffff, alpha: 0.9 });
  body.addChild(facing);

  container.addChild(body);
  container.addChild(makeLabel(name.slice(0, 16)));

  return {
    container,
    setPosition(x, z) {
      container.position.set(x, z);
    },
    setFacing(yaw) {
      body.rotation = -yaw;
    },
    destroy() {
      container.destroy({ children: true });
    },
  };
}

export function createLootPile(amount: number): LootPile {
  const container = new Container();

  const glow = new Graphics();
  glow.circle(0, 0, 1.15).fill({ color: 0xe8c15a, alpha: 0.13 });
  glow.circle(0, 0, 0.72).fill({ color: 0xffe9a8, alpha: 0.12 });
  container.addChild(glow);

  const shadow = new Graphics();
  shadow.ellipse(0, 0.22, 0.5, 0.26).fill({ color: 0x06100c, alpha: 0.35 });
  container.addChild(shadow);

  const coins = new Graphics();
  coins.ellipse(0, 0.12, 0.34, 0.16).fill({ color: 0xb8892f, alpha: 1 });
  coins.ellipse(0, 0.02, 0.34, 0.16).fill({ color: 0xd8a83c, alpha: 1 });
  coins.ellipse(-0.12, -0.08, 0.2, 0.1).fill({ color: 0xf0c860, alpha: 1 });
  coins.ellipse(0.14, -0.12, 0.17, 0.09).fill({ color: 0xffe08a, alpha: 1 });
  coins.circle(0, -0.16, 0.1).fill({ color: 0xfff3c4, alpha: 1 });
  container.addChild(coins);

  const sparkle = new Graphics();
  sparkle
    .moveTo(0.44, -0.34)
    .lineTo(0.5, -0.16)
    .lineTo(0.68, -0.1)
    .lineTo(0.5, -0.04)
    .lineTo(0.44, 0.14)
    .lineTo(0.38, -0.04)
    .lineTo(0.2, -0.1)
    .lineTo(0.38, -0.16)
    .closePath()
    .fill({ color: 0xfff6cf, alpha: 0.9 });
  container.addChild(sparkle);

  const label = new Text({
    text: `${amount}c`,
    style: {
      fontFamily: "Segoe UI, system-ui, sans-serif",
      fontSize: 11,
      fontWeight: "700",
      fill: 0xffe9a8,
      stroke: { color: 0x0b0f14, width: 3 },
    },
  });
  label.anchor.set(0.5, 1);
  label.position.y = -0.7;
  label.scale.set(1 / PIXELS_PER_UNIT);
  container.addChild(label);

  return {
    container,
    destroy() {
      container.destroy({ children: true });
    },
  };
}
