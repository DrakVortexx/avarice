import { Container, Graphics, Text } from "pixi.js";

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

export interface EnemyAvatar extends Avatar {
  setHealth: (hp: number, maxHp: number) => void;
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

function makeLabel(text: string, y: number): Text {
  const label = new Text({ text, style: LABEL_STYLE });
  label.anchor.set(0.5, 1);
  label.y = y;
  return label;
}

export function createAvatar(name: string, color?: number): Avatar {
  const container = new Container();
  const body = new Container();

  const disc = new Graphics();
  disc.circle(0, 0, 16).fill({ color: color ?? colorFromId(name), alpha: 0.95 });
  disc.circle(0, 0, 16).stroke({ width: 2, color: 0xffffff, alpha: 0.22 });
  body.addChild(disc);

  const facing = new Graphics();
  facing
    .moveTo(0, -24)
    .lineTo(7, -13)
    .lineTo(-7, -13)
    .closePath()
    .fill({ color: 0xffffff, alpha: 0.85 });
  body.addChild(facing);

  container.addChild(body);
  container.addChild(makeLabel(name.slice(0, 16), -30));

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

export function createEnemyAvatar(name: string, color: number): EnemyAvatar {
  const container = new Container();
  const body = new Container();

  const shape = new Graphics();
  shape.moveTo(0, -15).lineTo(15, 0).lineTo(0, 15).lineTo(-15, 0).closePath();
  shape.fill({ color, alpha: 0.95 });
  shape.moveTo(0, -15).lineTo(15, 0).lineTo(0, 15).lineTo(-15, 0).closePath();
  shape.stroke({ width: 2, color: 0x0b0f14, alpha: 0.65 });
  body.addChild(shape);

  const core = new Graphics();
  core.circle(0, 0, 4).fill({ color: 0x0b0f14, alpha: 0.5 });
  body.addChild(core);

  const eye = new Graphics();
  eye.circle(0, -6, 2.2).fill({ color: 0xfff3d6, alpha: 0.9 });
  body.addChild(eye);

  container.addChild(body);
  container.addChild(makeLabel(name.slice(0, 16), -46));

  const hpBar = new Graphics();
  hpBar.y = -42;
  container.addChild(hpBar);

  let lastHp = -1;
  let lastMaxHp = -1;

  return {
    container,
    setPosition(x, z) {
      container.position.set(x, z);
    },
    setFacing(yaw) {
      body.rotation = -yaw;
    },
    setHealth(hp, maxHp) {
      if (hp === lastHp && maxHp === lastMaxHp) {
        return;
      }
      lastHp = hp;
      lastMaxHp = maxHp;

      const ratio = maxHp > 0 ? Math.max(0, Math.min(1, hp / maxHp)) : 0;
      const fillColor = ratio > 0.5 ? 0x6ee7a8 : ratio > 0.25 ? 0xe8c15a : 0xff7a5c;

      hpBar.clear();
      hpBar.rect(-17, 0, 34, 4).fill({ color: 0x0b0f14, alpha: 0.8 });
      hpBar.rect(-17, 0, 34 * ratio, 4).fill({ color: fillColor, alpha: 1 });
    },
    destroy() {
      container.destroy({ children: true });
    },
  };
}

export function createLootPile(amount: number): LootPile {
  const container = new Container();

  const glow = new Graphics();
  glow.circle(0, 0, 8).fill({ color: 0xe8c15a, alpha: 0.16 });
  container.addChild(glow);

  const coin = new Graphics();
  coin.circle(0, 0, 4).fill({ color: 0xe8c15a, alpha: 0.95 });
  coin.circle(0, 0, 4).stroke({ width: 1.5, color: 0xfff3d6, alpha: 0.7 });
  container.addChild(coin);

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
  label.y = -8;
  container.addChild(label);

  return {
    container,
    destroy() {
      container.destroy({ children: true });
    },
  };
}
