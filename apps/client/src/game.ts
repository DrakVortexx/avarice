import { Application, Container, Graphics, Text } from "pixi.js";
import {
  BUILDINGS,
  DISTRICTS,
  LAKES,
  PLAYER_RADIUS,
  PLAYER_SPEED,
  PLAZA_RADIUS,
  WORLD_RADIUS,
  resolveWorldCollision,
  stepPosition,
} from "@avarice/shared";
import { buildMap } from "./map.js";
import { createAvatar, createLootPile, type Avatar, type LootPile } from "./entities.js";
import { PIXELS_PER_UNIT } from "./render.js";
import type { Movement } from "./input.js";

const EFFECT_TEXT_STYLE = {
  fontFamily: "Segoe UI, system-ui, sans-serif",
  fontSize: 13,
  fontWeight: "700",
  fill: 0xffffff,
  stroke: { color: 0x0b0f14, width: 3 },
} as const;

const MINIMAP_RADIUS = 76;
const MINIMAP_SCALE = MINIMAP_RADIUS / WORLD_RADIUS;

interface Effect {
  view: Container;
  life: number;
  maxLife: number;
  rise: number;
}

function lerpAngle(from: number, to: number, t: number): number {
  const tau = Math.PI * 2;
  const delta = ((((to - from) % tau) + tau + Math.PI) % tau) - Math.PI;
  return from + delta * t;
}

export class Game {
  readonly app = new Application();
  private readonly world = new Container();
  private readonly minimap = new Container();
  private readonly minimapDots = new Graphics();
  private local: Avatar | null = null;
  private readonly remotes = new Map<string, Avatar>();
  private readonly remoteTargets = new Map<string, { x: number; z: number; yaw: number }>();
  private readonly lootPiles = new Map<string, LootPile>();
  private readonly effects: Effect[] = [];

  readonly localPosition = { x: 0, z: 0 };
  private readonly serverPosition = { x: 0, z: 0 };
  private readonly camera = { x: 0, y: 0 };
  private hasServerPosition = false;
  yaw = 0;
  private targetYaw = 0;

  get remoteCount(): number {
    return this.remotes.size;
  }

  async init(canvas: HTMLCanvasElement): Promise<void> {
    await this.app.init({
      canvas,
      resizeTo: window,
      background: 0x0b0f14,
      antialias: true,
      resolution: Math.min(window.devicePixelRatio, 2),
      autoDensity: true,
    });

    this.world.addChild(buildMap());
    this.app.stage.addChild(this.world);

    this.local = createAvatar("You", 0x7fd1b9);
    this.world.addChild(this.local.container);

    this.buildMinimap();
  }

  private buildMinimap(): void {
    const base = new Graphics();
    base.circle(0, 0, MINIMAP_RADIUS + 8).fill({ color: 0x0b0f14, alpha: 0.72 });
    base.circle(0, 0, MINIMAP_RADIUS + 8).stroke({ width: 2, color: 0x4f8f83, alpha: 0.45 });
    base.circle(0, 0, MINIMAP_RADIUS).fill({ color: 0x1b2a22, alpha: 0.85 });
    base.circle(0, 0, MINIMAP_RADIUS).stroke({ width: 1.5, color: 0x6fb8a8, alpha: 0.6 });

    base.circle(0, 0, PLAZA_RADIUS * MINIMAP_SCALE).fill({ color: 0x39423b, alpha: 0.9 });

    for (const district of DISTRICTS) {
      base
        .circle(district.x * MINIMAP_SCALE, district.z * MINIMAP_SCALE, district.radius * MINIMAP_SCALE)
        .fill({ color: 0x424c44, alpha: 0.9 });
    }

    for (const lake of LAKES) {
      base
        .ellipse(lake.x * MINIMAP_SCALE, lake.z * MINIMAP_SCALE, lake.rx * MINIMAP_SCALE, lake.rz * MINIMAP_SCALE)
        .fill({ color: 0x2a5a70, alpha: 0.85 });
    }

    for (const building of BUILDINGS) {
      base
        .rect(
          building.x * MINIMAP_SCALE,
          building.z * MINIMAP_SCALE,
          building.w * MINIMAP_SCALE,
          building.h * MINIMAP_SCALE,
        )
        .fill({ color: 0x8a6a4a, alpha: 0.85 });
    }

    this.minimap.addChild(base, this.minimapDots);
    this.app.stage.addChild(this.minimap);
  }

  updateLocal(dt: number, movement: Movement): void {
    const stepped = stepPosition(this.localPosition, movement, dt, PLAYER_SPEED, WORLD_RADIUS);
    const next = resolveWorldCollision(stepped, PLAYER_RADIUS);
    this.localPosition.x = next.x;
    this.localPosition.z = next.z;

    if (Math.hypot(movement.x, movement.z) > 0.01) {
      this.targetYaw = Math.atan2(-movement.x, -movement.z);
    }
    this.yaw = lerpAngle(this.yaw, this.targetYaw, 1 - Math.exp(-dt * 14));

    if (this.hasServerPosition) {
      const error = Math.hypot(
        this.localPosition.x - this.serverPosition.x,
        this.localPosition.z - this.serverPosition.z,
      );
      if (error > 6) {
        this.localPosition.x = this.serverPosition.x;
        this.localPosition.z = this.serverPosition.z;
      } else if (error > 1.2) {
        const correction = 1 - Math.exp(-dt * 3);
        this.localPosition.x += (this.serverPosition.x - this.localPosition.x) * correction;
        this.localPosition.z += (this.serverPosition.z - this.localPosition.z) * correction;
      }
    }
  }

  render(dt: number): void {
    if (this.local) {
      this.local.setPosition(this.localPosition.x, this.localPosition.z);
      this.local.setFacing(this.yaw);
    }

    const smoothing = 1 - Math.exp(-dt * 10);
    for (const [id, avatar] of this.remotes) {
      const target = this.remoteTargets.get(id);
      if (!target) {
        continue;
      }
      avatar.container.position.x += (target.x - avatar.container.position.x) * smoothing;
      avatar.container.position.y += (target.z - avatar.container.position.y) * smoothing;
      avatar.setFacing(target.yaw);
    }

    const pulse = 1 + Math.sin(performance.now() / 320) * 0.09;
    for (const pile of this.lootPiles.values()) {
      pile.container.scale.set(pulse);
    }

    for (let i = this.effects.length - 1; i >= 0; i -= 1) {
      const effect = this.effects[i]!;
      effect.life -= dt;
      const remaining = Math.max(0, effect.life / effect.maxLife);
      effect.view.alpha = remaining;
      if (effect.rise > 0) {
        effect.view.y -= effect.rise * dt;
      }
      if (effect.life <= 0) {
        effect.view.destroy({ children: true });
        this.effects.splice(i, 1);
      }
    }

    const camSmoothing = 1 - Math.exp(-dt * 9);
    this.camera.x += (this.localPosition.x * PIXELS_PER_UNIT - this.camera.x) * camSmoothing;
    this.camera.y += (this.localPosition.z * PIXELS_PER_UNIT - this.camera.y) * camSmoothing;

    this.world.scale.set(PIXELS_PER_UNIT);
    this.world.x = this.app.screen.width / 2 - this.camera.x;
    this.world.y = this.app.screen.height / 2 - this.camera.y;

    this.updateMinimap();
  }

  private updateMinimap(): void {
    this.minimap.position.set(this.app.screen.width - MINIMAP_RADIUS - 32, this.app.screen.height - MINIMAP_RADIUS - 32);

    const dots = this.minimapDots;
    dots.clear();

    for (const pile of this.lootPiles.values()) {
      dots.circle(pile.container.x * MINIMAP_SCALE, pile.container.y * MINIMAP_SCALE, 1.4).fill({
        color: 0xe8c15a,
        alpha: 0.65,
      });
    }

    for (const [id] of this.remotes) {
      const target = this.remoteTargets.get(id);
      if (!target) {
        continue;
      }
      dots.circle(target.x * MINIMAP_SCALE, target.z * MINIMAP_SCALE, 2.6).fill({
        color: 0xb79bff,
        alpha: 0.95,
      });
      dots.circle(target.x * MINIMAP_SCALE, target.z * MINIMAP_SCALE, 2.6).stroke({
        width: 0.8,
        color: 0x0b0f14,
        alpha: 0.6,
      });
    }

    const halfW = (this.app.screen.width / PIXELS_PER_UNIT) * MINIMAP_SCALE * 0.5;
    const halfH = (this.app.screen.height / PIXELS_PER_UNIT) * MINIMAP_SCALE * 0.5;
    dots
      .rect(
        this.localPosition.x * MINIMAP_SCALE - halfW,
        this.localPosition.z * MINIMAP_SCALE - halfH,
        halfW * 2,
        halfH * 2,
      )
      .stroke({ width: 1, color: 0xffffff, alpha: 0.22 });

    dots.circle(this.localPosition.x * MINIMAP_SCALE, this.localPosition.z * MINIMAP_SCALE, 3.4).fill({
      color: 0x7fd1b9,
      alpha: 1,
    });
    dots
      .circle(this.localPosition.x * MINIMAP_SCALE, this.localPosition.z * MINIMAP_SCALE, 3.4)
      .stroke({ width: 1, color: 0x0b0f14, alpha: 0.7 });
  }

  spawnFloatingText(x: number, z: number, text: string, color = 0xffffff): void {
    const label = new Text({ text, style: { ...EFFECT_TEXT_STYLE, fill: color } });
    label.anchor.set(0.5, 1);
    label.position.set(x, z);
    label.scale.set(1 / PIXELS_PER_UNIT);
    this.world.addChild(label);
    this.effects.push({ view: label, life: 0.9, maxLife: 0.9, rise: 2.4 });
  }

  setServerPosition(x: number, z: number): void {
    this.serverPosition.x = x;
    this.serverPosition.z = z;
    if (!this.hasServerPosition) {
      this.hasServerPosition = true;
      this.localPosition.x = x;
      this.localPosition.z = z;
      this.camera.x = x * PIXELS_PER_UNIT;
      this.camera.y = z * PIXELS_PER_UNIT;
    }
  }

  addRemote(id: string, name: string, x: number, z: number, yaw: number): void {
    if (this.remotes.has(id)) {
      return;
    }
    const avatar = createAvatar(name);
    avatar.setPosition(x, z);
    avatar.setFacing(yaw);
    this.world.addChild(avatar.container);
    this.remotes.set(id, avatar);
    this.remoteTargets.set(id, { x, z, yaw });
  }

  updateRemote(id: string, x: number, z: number, yaw: number): void {
    if (this.remoteTargets.has(id)) {
      this.remoteTargets.set(id, { x, z, yaw });
    }
  }

  removeRemote(id: string): void {
    const avatar = this.remotes.get(id);
    if (avatar) {
      avatar.destroy();
      this.remotes.delete(id);
    }
    this.remoteTargets.delete(id);
  }

  addLoot(id: string, x: number, z: number, amount: number): void {
    if (this.lootPiles.has(id)) {
      return;
    }
    const pile = createLootPile(amount);
    pile.container.position.set(x, z);
    this.world.addChild(pile.container);
    this.lootPiles.set(id, pile);
  }

  removeLoot(id: string): void {
    const pile = this.lootPiles.get(id);
    if (pile) {
      pile.destroy();
      this.lootPiles.delete(id);
    }
  }
}
