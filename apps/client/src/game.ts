import { Application, Container, Graphics, Text } from "pixi.js";
import {
  PLAYER_ATTACK_ARC,
  PLAYER_ATTACK_RANGE,
  PLAYER_SPEED,
  WORLD_RADIUS,
  stepPosition,
} from "@avarice/shared";
import { buildMap } from "./map.js";
import {
  createAvatar,
  createEnemyAvatar,
  createLootPile,
  type Avatar,
  type EnemyAvatar,
  type LootPile,
} from "./entities.js";
import type { Movement } from "./input.js";

const ENEMY_COLORS: Record<string, number> = {
  scavenger: 0xd98a5f,
  brute: 0xc2554f,
};

const EFFECT_TEXT_STYLE = {
  fontFamily: "Segoe UI, system-ui, sans-serif",
  fontSize: 13,
  fontWeight: "700",
  fill: 0xffffff,
  stroke: { color: 0x0b0f14, width: 3 },
} as const;

interface EnemyTarget {
  x: number;
  z: number;
  yaw: number;
  hp: number;
  maxHp: number;
}

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
  private local: Avatar | null = null;
  private readonly remotes = new Map<string, Avatar>();
  private readonly remoteTargets = new Map<string, { x: number; z: number; yaw: number }>();
  private readonly enemies = new Map<string, EnemyAvatar>();
  private readonly enemyTargets = new Map<string, EnemyTarget>();
  private readonly lootPiles = new Map<string, LootPile>();
  private readonly effects: Effect[] = [];

  readonly localPosition = { x: 0, z: 0 };
  private readonly serverPosition = { x: 0, z: 0 };
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
  }

  updateLocal(dt: number, movement: Movement): void {
    const next = stepPosition(this.localPosition, movement, dt, PLAYER_SPEED, WORLD_RADIUS);
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
      if (error > 4) {
        this.localPosition.x = this.serverPosition.x;
        this.localPosition.z = this.serverPosition.z;
      } else if (error > 1.5) {
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

    const enemySmoothing = 1 - Math.exp(-dt * 12);
    for (const [id, avatar] of this.enemies) {
      const target = this.enemyTargets.get(id);
      if (!target) {
        continue;
      }
      avatar.container.position.x += (target.x - avatar.container.position.x) * enemySmoothing;
      avatar.container.position.y += (target.z - avatar.container.position.y) * enemySmoothing;
      avatar.setFacing(target.yaw);
      avatar.setHealth(target.hp, target.maxHp);
    }

    const pulse = 1 + Math.sin(performance.now() / 300) * 0.08;
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

    this.world.x = this.app.screen.width / 2 - this.localPosition.x;
    this.world.y = this.app.screen.height / 2 - this.localPosition.z;
  }

  aimAt(screenX: number, screenY: number): number {
    const worldX = screenX - this.world.x;
    const worldZ = screenY - this.world.y;
    const dx = worldX - this.localPosition.x;
    const dz = worldZ - this.localPosition.z;
    if (Math.hypot(dx, dz) < 0.001) {
      return this.yaw;
    }
    return Math.atan2(-dx, -dz);
  }

  setAim(yaw: number): void {
    this.yaw = yaw;
    this.targetYaw = yaw;
  }

  spawnSwing(yaw: number): void {
    const graphic = new Graphics();
    const start = -yaw - Math.PI / 2 - PLAYER_ATTACK_ARC / 2;
    const end = -yaw - Math.PI / 2 + PLAYER_ATTACK_ARC / 2;
    graphic.moveTo(0, 0).arc(0, 0, PLAYER_ATTACK_RANGE, start, end).closePath();
    graphic.fill({ color: 0xffffff, alpha: 0.22 });
    graphic.position.set(this.localPosition.x, this.localPosition.z);
    this.world.addChild(graphic);
    this.effects.push({ view: graphic, life: 0.16, maxLife: 0.16, rise: 0 });
  }

  spawnFloatingText(x: number, z: number, text: string, color = 0xffffff): void {
    const label = new Text({ text, style: { ...EFFECT_TEXT_STYLE, fill: color } });
    label.anchor.set(0.5, 1);
    label.position.set(x, z);
    this.world.addChild(label);
    this.effects.push({ view: label, life: 0.7, maxLife: 0.7, rise: 28 });
  }

  setServerPosition(x: number, z: number): void {
    this.serverPosition.x = x;
    this.serverPosition.z = z;
    if (!this.hasServerPosition) {
      this.hasServerPosition = true;
      this.localPosition.x = x;
      this.localPosition.z = z;
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

  addEnemy(
    id: string,
    type: string,
    name: string,
    x: number,
    z: number,
    yaw: number,
    hp: number,
    maxHp: number,
  ): void {
    if (this.enemies.has(id)) {
      return;
    }
    const avatar = createEnemyAvatar(name, ENEMY_COLORS[type] ?? 0xd98a5f);
    avatar.setPosition(x, z);
    avatar.setFacing(yaw);
    avatar.setHealth(hp, maxHp);
    this.world.addChild(avatar.container);
    this.enemies.set(id, avatar);
    this.enemyTargets.set(id, { x, z, yaw, hp, maxHp });
  }

  updateEnemy(id: string, x: number, z: number, yaw: number, hp: number, maxHp: number): void {
    const target = this.enemyTargets.get(id);
    if (target) {
      target.x = x;
      target.z = z;
      target.yaw = yaw;
      target.hp = hp;
      target.maxHp = maxHp;
    }
  }

  removeEnemy(id: string): void {
    const avatar = this.enemies.get(id);
    if (avatar) {
      avatar.destroy();
      this.enemies.delete(id);
    }
    this.enemyTargets.delete(id);
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
