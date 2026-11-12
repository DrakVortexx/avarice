import { Application, Container } from "pixi.js";
import { PLAYER_SPEED, WORLD_RADIUS, stepPosition } from "@avarice/shared";
import { buildMap } from "./map.js";
import { createAvatar, type Avatar } from "./entities.js";
import type { Movement } from "./input.js";

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

    this.world.x = this.app.screen.width / 2 - this.localPosition.x;
    this.world.y = this.app.screen.height / 2 - this.localPosition.z;
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
}
