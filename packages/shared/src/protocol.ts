import { MAX_MESSAGE_LENGTH } from "./constants.js";
import type { EquipSlot, ItemRarity } from "./items.js";

export interface JoinOptions {
  accessToken: string;
}

export interface MoveInput {
  x: number;
  z: number;
  yaw: number;
  seq?: number;
}

export interface ChatPayload {
  text: string;
}

export interface LootEvent {
  sessionId: string;
  amount: number;
  coins: number;
  x: number;
  z: number;
  itemId?: string;
  quantity?: number;
}

export interface ChatEvent {
  kind: "chat" | "system";
  from: string;
  text: string;
  at: number;
}

export interface PointOfInterest {
  id: string;
  label: string;
  x: number;
  z: number;
}

export function sanitizeChat(raw: unknown): ChatPayload | null {
  const value = (raw ?? {}) as Partial<ChatPayload>;
  if (typeof value.text !== "string") {
    return null;
  }
  const text = value.text.trim().slice(0, MAX_MESSAGE_LENGTH);
  return text.length > 0 ? { text } : null;
}

export interface InventoryStack {
  itemId: string;
  quantity: number;
}

export interface EquippedGear {
  weapon?: string;
  armor?: string;
  trinket?: string;
}

export interface SelfState {
  coins: number;
  hp: number;
  maxHp: number;
  level: number;
  xp: number;
  xpIntoLevel: number;
  xpForNext: number;
  isAdmin: boolean;
  inventory: InventoryStack[];
  equipped: EquippedGear;
}

export interface CombatEvent {
  attackerId: string;
  attackerName: string;
  targetId: string;
  targetName: string;
  damage: number;
  hp: number;
  maxHp: number;
  killed: boolean;
  x: number;
  z: number;
}

export interface DeathEvent {
  byName?: string;
  respawnAt: number;
}

export interface ShopItem {
  itemId: string;
  name: string;
  rarity: ItemRarity;
  color: string;
  price: number;
  attack?: number;
  defense?: number;
  heal?: number;
}

export interface ShopView {
  shopId: string;
  name: string;
  items: ShopItem[];
}

export interface BazaarItem {
  id: string;
  itemId: string;
  name: string;
  rarity: ItemRarity;
  color: string;
  quantity: number;
  pricePerUnit: number;
  seller: string;
}

export interface BazaarView {
  listings: BazaarItem[];
}

export interface NoticeEvent {
  kind: "info" | "error" | "success";
  text: string;
}

export interface AdminResult {
  ok: boolean;
  text: string;
}

export interface UseItemInput {
  itemId: string;
}

export interface EquipInput {
  itemId: string | null;
  slot: EquipSlot;
}

export interface ShopTradeInput {
  shopId: string;
  itemId: string;
  quantity: number;
}

export interface BazaarListInput {
  itemId: string;
  quantity: number;
  pricePerUnit: number;
}

export interface BazaarBuyInput {
  listingId: string;
  quantity: number;
}

export interface BazaarCancelInput {
  listingId: string;
}

export interface AdminInput {
  command: string;
}

export function sanitizeQuantity(raw: unknown): number {
  const value = Math.floor(Number(raw));
  if (!Number.isFinite(value) || value < 1) {
    return 1;
  }
  return Math.min(value, 999);
}

export function sanitizePrice(raw: unknown): number {
  const value = Math.floor(Number(raw));
  if (!Number.isFinite(value) || value < 1) {
    return 1;
  }
  return Math.min(value, 100_000_000);
}

export function sanitizeId(raw: unknown): string {
  return typeof raw === "string" ? raw.trim().slice(0, 64) : "";
}
