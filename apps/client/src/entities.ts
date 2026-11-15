import { Container, Graphics, Text } from "pixi.js";
import { getItem } from "@avarice/shared";
import { PIXELS_PER_UNIT } from "./render.js";

const PALETTE = [0x7fd1b9, 0xb79bff, 0xffc98a, 0x6fb8a8, 0xd98a5f, 0x8fd6e8, 0xe8c15a, 0xff7a5c];
const SKIN_TONES = [0xf2c9a0, 0xe0ac7e, 0xc98a5b, 0x9c6b43, 0x6f4a2f];

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
  setHealth: (hp: number, maxHp: number, alive: boolean) => void;
  destroy: () => void;
}

export interface ShopMarker {
  container: Container;
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
  const r = Math.max(0, Math.min(255, ((color >> 16) & 0xff) + amount));
  const g = Math.max(0, Math.min(255, ((color >> 8) & 0xff) + amount));
  const b = Math.max(0, Math.min(255, (color & 0xff) + amount));
  return (r << 16) | (g << 8) | b;
}

export function createAvatar(name: string, color?: number): Avatar {
  const container = new Container();
  const body = new Container();
  const tint = color ?? colorFromId(name);
  const seed = hashString(name);
  const skin = SKIN_TONES[seed % SKIN_TONES.length] ?? 0xf2c9a0;
  const sleeve = lighten(tint, 22);
  const trim = lighten(tint, 54);

  const shadow = new Graphics();
  shadow.ellipse(0, 0.2, 0.62, 0.34).fill({ color: 0x06100c, alpha: 0.32 });
  container.addChild(shadow);

  const legs = new Graphics();
  legs.ellipse(-0.17, 0.22, 0.13, 0.2).fill({ color: 0x1b232b });
  legs.ellipse(0.17, 0.22, 0.13, 0.2).fill({ color: 0x1b232b });
  body.addChild(legs);

  const torso = new Graphics();
  torso
    .roundRect(-0.34, -0.32, 0.68, 0.7, 0.28)
    .fill({ color: tint })
    .stroke({ width: 0.05, color: 0x0b0f14, alpha: 0.55 });
  torso.roundRect(-0.2, -0.22, 0.4, 0.42, 0.18).fill({ color: trim, alpha: 0.35 });
  body.addChild(torso);

  const arms = new Graphics();
  arms
    .roundRect(-0.53, -0.26, 0.17, 0.52, 0.08)
    .fill({ color: sleeve })
    .stroke({ width: 0.04, color: 0x0b0f14, alpha: 0.4 });
  arms
    .roundRect(0.36, -0.26, 0.17, 0.52, 0.08)
    .fill({ color: sleeve })
    .stroke({ width: 0.04, color: 0x0b0f14, alpha: 0.4 });
  arms.circle(-0.445, 0.3, 0.11).fill({ color: skin });
  arms.circle(0.445, 0.3, 0.11).fill({ color: skin });
  body.addChild(arms);

  const head = new Graphics();
  head
    .circle(0, -0.3, 0.29)
    .fill({ color: tint })
    .stroke({ width: 0.05, color: 0x0b0f14, alpha: 0.5 });
  head.circle(0, -0.33, 0.21).fill({ color: lighten(tint, -44) });
  head.circle(0, -0.42, 0.15).fill({ color: skin });
  head
    .moveTo(0, -0.58)
    .lineTo(0.07, -0.44)
    .lineTo(-0.07, -0.44)
    .closePath()
    .fill({ color: lighten(skin, -34), alpha: 0.9 });
  body.addChild(head);

  container.addChild(body);
  container.addChild(makeLabel(name.slice(0, 16)));

  const healthBar = new Graphics();
  healthBar.position.y = -1.18;
  healthBar.visible = false;
  container.addChild(healthBar);

  const setHealth = (hp: number, maxHp: number, alive: boolean): void => {
    healthBar.clear();
    body.alpha = alive ? 1 : 0.4;
    if (!alive) {
      healthBar.visible = false;
      return;
    }
    healthBar.visible = true;
    const ratio = maxHp > 0 ? Math.max(0, Math.min(1, hp / maxHp)) : 0;
    const width = 0.9;
    const color = ratio > 0.5 ? 0x7fd1b9 : ratio > 0.25 ? 0xe8c15a : 0xff7a7a;
    healthBar.roundRect(-width / 2, 0, width, 0.12, 0.06).fill({ color: 0x0b0f14, alpha: 0.72 });
    healthBar
      .roundRect(-width / 2 + 0.02, 0.02, (width - 0.04) * ratio, 0.08, 0.04)
      .fill({ color });
  };

  return {
    container,
    setPosition(x, z) {
      container.position.set(x, z);
    },
    setFacing(yaw) {
      body.rotation = -yaw;
    },
    setHealth,
    destroy() {
      container.destroy({ children: true });
    },
  };
}

export function createShopMarker(name: string): ShopMarker {
  const container = new Container();

  const shadow = new Graphics();
  shadow.ellipse(0, 0.5, 1.1, 0.42).fill({ color: 0x06100c, alpha: 0.32 });
  container.addChild(shadow);

  const base = new Graphics();
  base
    .roundRect(-1, -0.1, 2, 1, 0.18)
    .fill({ color: 0x5b4632 })
    .stroke({ width: 0.06, color: 0x0b0f14, alpha: 0.6 });
  base.roundRect(-1, -0.1, 2, 0.28, 0.14).fill({ color: 0x7a5a3c });
  container.addChild(base);

  const postLeft = new Graphics();
  postLeft.roundRect(-0.95, -0.75, 0.16, 0.7, 0.06).fill({ color: 0x4a3827 });
  postLeft.roundRect(0.79, -0.75, 0.16, 0.7, 0.06).fill({ color: 0x4a3827 });
  container.addChild(postLeft);

  const awning = new Graphics();
  awning
    .roundRect(-1.05, -0.85, 2.1, 0.34, 0.1)
    .fill({ color: 0x7fd1b9 })
    .stroke({ width: 0.05, color: 0x0b0f14, alpha: 0.5 });
  awning.roundRect(-1.05, -0.85, 0.5, 0.34, 0.1).fill({ color: 0xe8eef5, alpha: 0.85 });
  awning.roundRect(0.05, -0.85, 0.5, 0.34, 0.1).fill({ color: 0xe8eef5, alpha: 0.85 });
  container.addChild(awning);

  const label = new Text({
    text: name,
    style: {
      fontFamily: "Segoe UI, system-ui, sans-serif",
      fontSize: 11,
      fontWeight: "700",
      fill: 0x7fd1b9,
      stroke: { color: 0x0b0f14, width: 3 },
    },
  });
  label.anchor.set(0.5, 1);
  label.position.y = -0.95;
  label.scale.set(1 / PIXELS_PER_UNIT);
  container.addChild(label);

  return {
    container,
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

export function createItemPile(itemId: string, quantity: number): LootPile {
  const container = new Container();
  const item = getItem(itemId);
  const color = item?.color ?? "#cdd3d8";
  const numeric = Number.parseInt(color.replace("#", ""), 16) || 0xffffff;

  const glow = new Graphics();
  glow.circle(0, 0, 1.1).fill({ color: numeric, alpha: 0.16 });
  glow.circle(0, 0, 0.68).fill({ color: numeric, alpha: 0.12 });
  container.addChild(glow);

  const shadow = new Graphics();
  shadow.ellipse(0, 0.24, 0.46, 0.24).fill({ color: 0x06100c, alpha: 0.35 });
  container.addChild(shadow);

  const gem = new Graphics();
  gem
    .moveTo(0, -0.42)
    .lineTo(0.34, -0.05)
    .lineTo(0, 0.36)
    .lineTo(-0.34, -0.05)
    .closePath()
    .fill({ color: numeric })
    .stroke({ width: 0.05, color: 0x0b0f14, alpha: 0.55 });
  gem
    .moveTo(0, -0.42)
    .lineTo(0, 0.36)
    .lineTo(-0.34, -0.05)
    .closePath()
    .fill({ color: lighten(numeric, -40), alpha: 0.55 });
  container.addChild(gem);

  const label = new Text({
    text: quantity > 1 ? `${item?.name ?? itemId} ×${quantity}` : (item?.name ?? itemId),
    style: {
      fontFamily: "Segoe UI, system-ui, sans-serif",
      fontSize: 10,
      fontWeight: "700",
      fill: numeric,
      stroke: { color: 0x0b0f14, width: 3 },
    },
  });
  label.anchor.set(0.5, 1);
  label.position.y = -0.6;
  label.scale.set(1 / PIXELS_PER_UNIT);
  container.addChild(label);

  return {
    container,
    destroy() {
      container.destroy({ children: true });
    },
  };
}
