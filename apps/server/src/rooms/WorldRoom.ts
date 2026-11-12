import { Room, type Client } from "colyseus";
import {
  ENEMIES,
  ENEMY_RESPAWN_MS,
  LOOT_LIFETIME_MS,
  LOOT_PICKUP_RADIUS,
  MAX_ENEMIES,
  MAX_PLAYERS,
  PLAYER_ATTACK_COOLDOWN_MS,
  PLAYER_ATTACK_DAMAGE,
  PLAYER_MAX_HP,
  PLAYER_RESPAWN_MS,
  PLAYER_SPEED,
  SAFE_RADIUS,
  TICK_MS,
  TICK_SECONDS,
  WORLD_RADIUS,
  applyDamage,
  distanceBetween,
  getEnemy,
  isInAttackArc,
  isInsideSafeZone,
  randomInt,
  sanitizeChat,
  sanitizeMoveInput,
  sanitizeYaw,
  stepPosition,
  type ChatEvent,
  type CombatEvent,
  type EnemyId,
  type LootEvent,
  type MoveInput,
} from "@avarice/shared";
import { EnemyState, LootState, PlayerState, WorldState } from "./schema/WorldState.js";
import { loadOrCreatePlayer, persistPlayer } from "../db.js";
import { verifyAccessToken, type AuthResult } from "../auth.js";

interface PlayerInput {
  x: number;
  z: number;
  yaw: number;
}

interface PersistRecord {
  authId: string;
  name: string;
  x: number;
  z: number;
  coins: number;
}

const PERSIST_INTERVAL_MS = 15_000;
const SCAVENGER_CHANCE = 0.7;

function randomSpawn(): { x: number; z: number } {
  const angle = Math.random() * Math.PI * 2;
  const radius = 6 + Math.random() * 5;
  return { x: Math.cos(angle) * radius, z: Math.sin(angle) * radius };
}

function randomEnemySpawn(): { x: number; z: number } {
  const angle = Math.random() * Math.PI * 2;
  const radius = SAFE_RADIUS + 3 + Math.random() * (WORLD_RADIUS - SAFE_RADIUS - 5);
  return { x: Math.cos(angle) * radius, z: Math.sin(angle) * radius };
}

export class WorldRoom extends Room<{ state: WorldState }> {
  maxClients = MAX_PLAYERS;
  state = new WorldState();

  private readonly playerInputs = new Map<string, PlayerInput>();
  private readonly identities = new Map<string, AuthResult>();
  private readonly attackReadyAt = new Map<string, number>();
  private readonly enemyCooldowns = new Map<string, number>();
  private readonly playerRespawns = new Map<string, number>();
  private readonly lootExpiry = new Map<string, number>();
  private enemyRespawns: number[] = [];
  private lastPersistAt = 0;
  private enemySeq = 0;
  private lootSeq = 0;

  messages = {
    move: (client: Client, message: MoveInput) => {
      const input = sanitizeMoveInput(message);
      this.playerInputs.set(client.sessionId, {
        x: input.x,
        z: input.z,
        yaw: sanitizeYaw(message),
      });
    },
    attack: (client: Client, message: unknown) => {
      this.handleAttack(client, message);
    },
    chat: (client: Client, message: unknown) => {
      const payload = sanitizeChat(message);
      if (!payload) {
        return;
      }
      const identity = this.identities.get(client.sessionId);
      this.broadcast("chat", {
        kind: "chat",
        from: identity?.displayName ?? "Wanderer",
        text: payload.text,
        at: Date.now(),
      } satisfies ChatEvent);
    },
  };

  async onAuth(_client: Client, options: unknown): Promise<AuthResult> {
    const accessToken =
      typeof (options as { accessToken?: unknown } | null)?.accessToken === "string"
        ? (options as { accessToken: string }).accessToken
        : "";
    if (!accessToken) {
      throw new Error("Missing access token.");
    }
    return verifyAccessToken(accessToken);
  }

  onCreate() {
    this.setTimestep(() => this.update(), TICK_MS);
    for (let i = 0; i < MAX_ENEMIES; i += 1) {
      this.spawnEnemy();
    }
  }

  async onJoin(client: Client, _options: unknown, auth?: unknown) {
    const identity = (auth ?? client.auth) as AuthResult | undefined;
    if (!identity?.authId) {
      throw new Error("Unauthorized.");
    }

    this.identities.set(client.sessionId, identity);
    this.playerInputs.set(client.sessionId, { x: 0, z: 0, yaw: 0 });

    const saved = await loadOrCreatePlayer(identity.authId, identity.username, identity.displayName);
    const spawn = saved ?? randomSpawn();

    const player = new PlayerState({ name: identity.displayName });
    player.x = spawn.x;
    player.z = spawn.z;
    player.yaw = Math.atan2(spawn.x, spawn.z);
    player.maxHp = PLAYER_MAX_HP;
    player.hp = PLAYER_MAX_HP;
    player.coins = saved?.coins ?? 100;
    player.dead = false;
    this.state.players.set(client.sessionId, player);

    this.broadcast(
      "chat",
      {
        kind: "system",
        from: "Avarice",
        text: `${identity.displayName} entered the world.`,
        at: Date.now(),
      } satisfies ChatEvent,
      { except: client },
    );
  }

  async onLeave(client: Client, _code: number) {
    const sessionId = client.sessionId;
    const identity = this.identities.get(sessionId);
    const player = this.state.players.get(sessionId);

    if (identity && player) {
      await persistPlayer(identity.authId, identity.displayName, player.x, player.z, player.coins);
    }

    this.state.players.delete(sessionId);
    this.playerInputs.delete(sessionId);
    this.identities.delete(sessionId);
    this.attackReadyAt.delete(sessionId);
    this.playerRespawns.delete(sessionId);

    if (identity) {
      this.broadcast("chat", {
        kind: "system",
        from: "Avarice",
        text: `${identity.displayName} left the world.`,
        at: Date.now(),
      } satisfies ChatEvent);
    }
  }

  onDispose() {
    this.playerInputs.clear();
    this.identities.clear();
    this.attackReadyAt.clear();
    this.enemyCooldowns.clear();
    this.playerRespawns.clear();
    this.lootExpiry.clear();
    this.enemyRespawns = [];
  }

  private handleAttack(client: Client, message: unknown): void {
    const player = this.state.players.get(client.sessionId);
    if (!player || player.dead) {
      return;
    }

    const now = Date.now();
    const readyAt = this.attackReadyAt.get(client.sessionId) ?? 0;
    if (now < readyAt) {
      return;
    }
    this.attackReadyAt.set(client.sessionId, now + PLAYER_ATTACK_COOLDOWN_MS);

    const yaw = sanitizeYaw(message);
    player.yaw = yaw;

    if (isInsideSafeZone(player)) {
      return;
    }

    const enemyHits: string[] = [];
    for (const [enemyId, enemy] of this.state.enemies) {
      if (isInAttackArc(player, yaw, enemy)) {
        enemyHits.push(enemyId);
      }
    }
    for (const enemyId of enemyHits) {
      const enemy = this.state.enemies.get(enemyId);
      if (enemy) {
        this.damageEnemy(client.sessionId, player.name, enemyId, enemy, PLAYER_ATTACK_DAMAGE);
      }
    }

    const playerHits: string[] = [];
    for (const [otherId, other] of this.state.players) {
      if (otherId === client.sessionId || other.dead || isInsideSafeZone(other)) {
        continue;
      }
      if (isInAttackArc(player, yaw, other)) {
        playerHits.push(otherId);
      }
    }
    for (const otherId of playerHits) {
      const other = this.state.players.get(otherId);
      if (other) {
        this.damagePlayer(otherId, other, PLAYER_ATTACK_DAMAGE, client.sessionId, player.name);
      }
    }
  }

  private damageEnemy(
    sourceId: string,
    sourceName: string,
    enemyId: string,
    enemy: EnemyState,
    damage: number,
  ): void {
    const result = applyDamage(enemy.hp, damage);
    enemy.hp = result.hp;

    this.broadcast("combat", {
      kind: "hit",
      source: sourceName,
      sourceId,
      target: enemy.name,
      targetId: enemyId,
      damage,
      x: enemy.x,
      z: enemy.z,
    } satisfies CombatEvent);

    if (result.died) {
      this.killEnemy(sourceId, sourceName, enemyId, enemy);
    }
  }

  private killEnemy(sourceId: string, sourceName: string, enemyId: string, enemy: EnemyState): void {
    const definition = getEnemy(enemy.type);
    const amount = definition ? randomInt(definition.coinMin, definition.coinMax) : 0;

    if (amount > 0) {
      const lootId = `loot-${++this.lootSeq}`;
      const loot = new LootState({ id: lootId, x: enemy.x, z: enemy.z, amount });
      this.state.loot.set(lootId, loot);
      this.lootExpiry.set(lootId, Date.now() + LOOT_LIFETIME_MS);
    }

    this.state.enemies.delete(enemyId);
    this.enemyCooldowns.delete(enemyId);
    this.enemyRespawns.push(Date.now() + ENEMY_RESPAWN_MS);

    this.broadcast("combat", {
      kind: "death",
      source: sourceName,
      sourceId,
      target: enemy.name,
      targetId: enemyId,
      x: enemy.x,
      z: enemy.z,
    } satisfies CombatEvent);
  }

  private damagePlayer(
    targetId: string,
    target: PlayerState,
    damage: number,
    sourceId: string,
    sourceName: string,
  ): void {
    if (target.dead) {
      return;
    }

    const result = applyDamage(target.hp, damage);
    target.hp = result.hp;

    this.broadcast("combat", {
      kind: "hit",
      source: sourceName,
      sourceId,
      target: target.name,
      targetId,
      damage,
      x: target.x,
      z: target.z,
    } satisfies CombatEvent);

    if (result.died) {
      this.killPlayer(targetId, target, sourceId, sourceName);
    }
  }

  private killPlayer(
    sessionId: string,
    player: PlayerState,
    sourceId: string,
    sourceName: string,
  ): void {
    player.dead = true;
    player.hp = 0;

    if (player.coins > 0) {
      const lootId = `loot-${++this.lootSeq}`;
      const loot = new LootState({ id: lootId, x: player.x, z: player.z, amount: player.coins });
      this.state.loot.set(lootId, loot);
      this.lootExpiry.set(lootId, Date.now() + LOOT_LIFETIME_MS);
      player.coins = 0;
    }

    this.playerInputs.set(sessionId, { x: 0, z: 0, yaw: player.yaw });
    this.playerRespawns.set(sessionId, Date.now() + PLAYER_RESPAWN_MS);

    this.broadcast("combat", {
      kind: "death",
      source: sourceName,
      sourceId,
      target: player.name,
      targetId: sessionId,
      x: player.x,
      z: player.z,
    } satisfies CombatEvent);
  }

  private spawnEnemy(): void {
    const type: EnemyId = Math.random() < SCAVENGER_CHANCE ? "scavenger" : "brute";
    const definition = ENEMIES[type];
    const spawn = randomEnemySpawn();
    const id = `enemy-${++this.enemySeq}`;

    const enemy = new EnemyState({
      id,
      type: definition.id,
      name: definition.name,
      x: spawn.x,
      z: spawn.z,
      yaw: Math.atan2(-spawn.x, -spawn.z),
      hp: definition.maxHp,
      maxHp: definition.maxHp,
    });

    this.state.enemies.set(id, enemy);
  }

  private update(): void {
    const now = Date.now();
    this.state.serverTime = now;

    for (const [sessionId, player] of this.state.players) {
      if (player.dead) {
        continue;
      }
      const input = this.playerInputs.get(sessionId);
      if (!input) {
        continue;
      }
      const next = stepPosition(
        { x: player.x, z: player.z },
        { x: input.x, z: input.z },
        TICK_SECONDS,
        PLAYER_SPEED,
        WORLD_RADIUS,
      );
      player.x = next.x;
      player.z = next.z;
      player.yaw = input.yaw;
    }

    this.updateEnemies(now);
    this.updateLoot(now);
    this.updateRespawns(now);
    this.updateEnemyRespawns(now);

    if (now - this.lastPersistAt >= PERSIST_INTERVAL_MS) {
      this.lastPersistAt = now;
      void this.persistAll();
    }
  }

  private updateEnemies(now: number): void {
    for (const [enemyId, enemy] of this.state.enemies) {
      const definition = getEnemy(enemy.type);
      if (!definition) {
        continue;
      }

      let targetId = "";
      let target: PlayerState | null = null;
      let best = Number.POSITIVE_INFINITY;

      for (const [sessionId, player] of this.state.players) {
        if (player.dead || isInsideSafeZone(player)) {
          continue;
        }
        const distance = distanceBetween(enemy, player);
        if (distance <= definition.aggroRadius && distance < best) {
          best = distance;
          targetId = sessionId;
          target = player;
        }
      }

      if (target === null) {
        enemy.targetId = "";
        continue;
      }

      enemy.targetId = targetId;
      const dx = target.x - enemy.x;
      const dz = target.z - enemy.z;
      const distance = Math.hypot(dx, dz);
      if (distance < 0.001) {
        continue;
      }
      enemy.yaw = Math.atan2(-dx, -dz);

      if (distance > definition.attackRange) {
        const next = stepPosition(
          enemy,
          { x: dx / distance, z: dz / distance },
          TICK_SECONDS,
          definition.speed,
          WORLD_RADIUS,
        );
        if (!isInsideSafeZone(next)) {
          enemy.x = next.x;
          enemy.z = next.z;
        }
        continue;
      }

      const readyAt = this.enemyCooldowns.get(enemyId) ?? 0;
      if (now < readyAt) {
        continue;
      }
      this.enemyCooldowns.set(enemyId, now + definition.attackCooldownMs);
      this.damagePlayer(targetId, target, definition.damage, enemyId, enemy.name);
    }
  }

  private updateLoot(now: number): void {
    const collected: string[] = [];

    for (const [lootId, loot] of this.state.loot) {
      const expiresAt = this.lootExpiry.get(lootId) ?? 0;
      if (now >= expiresAt) {
        collected.push(lootId);
        continue;
      }

      let pickerId = "";
      let picker: PlayerState | null = null;

      for (const [sessionId, player] of this.state.players) {
        if (player.dead) {
          continue;
        }
        if (distanceBetween(player, loot) <= LOOT_PICKUP_RADIUS) {
          pickerId = sessionId;
          picker = player;
          break;
        }
      }

      if (picker === null) {
        continue;
      }

      picker.coins += loot.amount;
      collected.push(lootId);

      this.broadcast("loot", {
        sessionId: pickerId,
        amount: loot.amount,
        coins: picker.coins,
        x: loot.x,
        z: loot.z,
      } satisfies LootEvent);
    }

    for (const lootId of collected) {
      this.state.loot.delete(lootId);
      this.lootExpiry.delete(lootId);
    }
  }

  private updateRespawns(now: number): void {
    const ready: string[] = [];
    for (const [sessionId, at] of this.playerRespawns) {
      if (now >= at) {
        ready.push(sessionId);
      }
    }

    for (const sessionId of ready) {
      this.playerRespawns.delete(sessionId);
      const player = this.state.players.get(sessionId);
      if (!player) {
        continue;
      }

      const spawn = randomSpawn();
      player.x = spawn.x;
      player.z = spawn.z;
      player.hp = player.maxHp;
      player.dead = false;
      this.playerInputs.set(sessionId, { x: 0, z: 0, yaw: player.yaw });

      this.broadcast("combat", {
        kind: "respawn",
        source: player.name,
        sourceId: sessionId,
        target: player.name,
        targetId: sessionId,
        x: player.x,
        z: player.z,
      } satisfies CombatEvent);
    }
  }

  private updateEnemyRespawns(now: number): void {
    if (this.enemyRespawns.length === 0) {
      return;
    }

    const remaining: number[] = [];
    for (const at of this.enemyRespawns) {
      if (now >= at) {
        this.spawnEnemy();
      } else {
        remaining.push(at);
      }
    }
    this.enemyRespawns = remaining;
  }

  private async persistAll(): Promise<void> {
    const records: PersistRecord[] = [];

    for (const [sessionId, player] of this.state.players) {
      const identity = this.identities.get(sessionId);
      if (!identity) {
        continue;
      }
      records.push({
        authId: identity.authId,
        name: player.name,
        x: player.x,
        z: player.z,
        coins: player.coins,
      });
    }

    for (const record of records) {
      await persistPlayer(record.authId, record.name, record.x, record.z, record.coins);
    }
  }
}
