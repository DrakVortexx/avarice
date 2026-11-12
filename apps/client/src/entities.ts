import { Container, Graphics, Text } from "pixi.js";

const PALETTE = [0x7fd1b9, 0xb79bff, 0xffc98a, 0x6fb8a8, 0xd98a5f, 0x8fd6e8, 0xe8c15a, 0xff7a5c];

export interface Avatar {
  container: Container;
  setPosition: (x: number, z: number) => void;
  setFacing: (yaw: number) => void;
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

export function createAvatar(name: string, color?: number): Avatar {
  const container = new Container();

  const body = new Container();

  const disc = new Graphics();
  disc.circle(0, 0, 16).fill({ color: color ?? colorFromId(name), alpha: 0.95 });
  disc.circle(0, 0, 16).stroke({ width: 2, color: 0xffffff, alpha: 0.22 });
  body.addChild(disc);

  const facing = new Graphics();
  facing.moveTo(0, -24).lineTo(7, -13).lineTo(-7, -13).closePath().fill({ color: 0xffffff, alpha: 0.85 });
  body.addChild(facing);

  container.addChild(body);

  const label = new Text({
    text: name.slice(0, 16),
    style: {
      fontFamily: "Segoe UI, system-ui, sans-serif",
      fontSize: 12,
      fontWeight: "600",
      fill: 0xe8eef5,
      stroke: { color: 0x0b0f14, width: 3 },
    },
  });
  label.anchor.set(0.5, 1);
  label.y = -30;
  container.addChild(label);

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
