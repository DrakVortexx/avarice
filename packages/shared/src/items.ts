export type ItemRarity = "common" | "uncommon" | "rare" | "epic" | "legendary";
export type ItemKind = "resource" | "weapon" | "armor" | "trinket" | "consumable";
export type EquipSlot = "weapon" | "armor" | "trinket";

export interface ItemDefinition {
  id: string;
  name: string;
  kind: ItemKind;
  rarity: ItemRarity;
  baseValue: number;
  description: string;
  color: string;
  stackable: boolean;
  slot?: EquipSlot;
  attack?: number;
  defense?: number;
  heal?: number;
}

export const ITEMS: Record<string, ItemDefinition> = {
  wood: {
    id: "wood",
    name: "Timber",
    kind: "resource",
    rarity: "common",
    baseValue: 6,
    description: "Sturdy wood from the Mistwood.",
    color: "#8a6a4a",
    stackable: true,
  },
  stone: {
    id: "stone",
    name: "Stone",
    kind: "resource",
    rarity: "common",
    baseValue: 5,
    description: "A chunk of good building rock.",
    color: "#8b9188",
    stackable: true,
  },
  "iron-ore": {
    id: "iron-ore",
    name: "Iron Ore",
    kind: "resource",
    rarity: "common",
    baseValue: 14,
    description: "Raw ore waiting for a forge.",
    color: "#9aa4ad",
    stackable: true,
  },
  coal: {
    id: "coal",
    name: "Coal",
    kind: "resource",
    rarity: "common",
    baseValue: 9,
    description: "Burns hot enough to work steel.",
    color: "#3a3a42",
    stackable: true,
  },
  herb: {
    id: "herb",
    name: "Wild Herb",
    kind: "resource",
    rarity: "common",
    baseValue: 11,
    description: "Smells faintly of mint and danger.",
    color: "#6fb36a",
    stackable: true,
  },
  leather: {
    id: "leather",
    name: "Leather",
    kind: "resource",
    rarity: "common",
    baseValue: 13,
    description: "Tanned hide, ready for a tailor.",
    color: "#a9743f",
    stackable: true,
  },
  cloth: {
    id: "cloth",
    name: "Cloth",
    kind: "resource",
    rarity: "common",
    baseValue: 8,
    description: "Woven fibre, soft and plain.",
    color: "#c9c2b0",
    stackable: true,
  },
  gemstone: {
    id: "gemstone",
    name: "Gemstone",
    kind: "resource",
    rarity: "rare",
    baseValue: 220,
    description: "A cut gem that catches every light.",
    color: "#8fd6e8",
    stackable: true,
  },
  "glass-shard": {
    id: "glass-shard",
    name: "Glass Shard",
    kind: "resource",
    rarity: "common",
    baseValue: 8,
    description: "Sharp, shiny, and slightly cursed.",
    color: "#b7e6f2",
    stackable: true,
  },
  "rusty-key": {
    id: "rusty-key",
    name: "Rusty Key",
    kind: "resource",
    rarity: "common",
    baseValue: 12,
    description: "Opens something. Probably.",
    color: "#b07a4a",
    stackable: true,
  },
  "health-potion": {
    id: "health-potion",
    name: "Health Potion",
    kind: "consumable",
    rarity: "common",
    baseValue: 45,
    description: "Drink to restore 45 health.",
    color: "#ff6b6b",
    stackable: true,
    heal: 45,
  },
  "rusty-dagger": {
    id: "rusty-dagger",
    name: "Rusty Dagger",
    kind: "weapon",
    rarity: "common",
    baseValue: 40,
    description: "Better than bare hands.",
    color: "#b07a4a",
    stackable: false,
    slot: "weapon",
    attack: 5,
  },
  "iron-sword": {
    id: "iron-sword",
    name: "Iron Sword",
    kind: "weapon",
    rarity: "uncommon",
    baseValue: 180,
    description: "A dependable blade.",
    color: "#b8c2cc",
    stackable: false,
    slot: "weapon",
    attack: 10,
  },
  "steel-blade": {
    id: "steel-blade",
    name: "Steel Blade",
    kind: "weapon",
    rarity: "rare",
    baseValue: 620,
    description: "Folded steel with a wicked edge.",
    color: "#d7e2ec",
    stackable: false,
    slot: "weapon",
    attack: 17,
  },
  "moonlit-blade": {
    id: "moonlit-blade",
    name: "Moonlit Blade",
    kind: "weapon",
    rarity: "epic",
    baseValue: 2400,
    description: "Its edge hums under moonlight.",
    color: "#9adfd0",
    stackable: false,
    slot: "weapon",
    attack: 27,
  },
  "founders-blade": {
    id: "founders-blade",
    name: "Founder's Blade",
    kind: "weapon",
    rarity: "legendary",
    baseValue: 9000,
    description: "Proof you were here before the economy existed.",
    color: "#ff7a5c",
    stackable: false,
    slot: "weapon",
    attack: 40,
  },
  "cloth-tunic": {
    id: "cloth-tunic",
    name: "Cloth Tunic",
    kind: "armor",
    rarity: "common",
    baseValue: 35,
    description: "Soft, but it covers the important bits.",
    color: "#c9c2b0",
    stackable: false,
    slot: "armor",
    defense: 4,
  },
  "leather-armor": {
    id: "leather-armor",
    name: "Leather Armor",
    kind: "armor",
    rarity: "uncommon",
    baseValue: 160,
    description: "Light and forgiving.",
    color: "#a9743f",
    stackable: false,
    slot: "armor",
    defense: 8,
  },
  "iron-plate": {
    id: "iron-plate",
    name: "Iron Plate",
    kind: "armor",
    rarity: "rare",
    baseValue: 560,
    description: "Heavy, loud, and reliable.",
    color: "#9aa4ad",
    stackable: false,
    slot: "armor",
    defense: 14,
  },
  "aegis-mail": {
    id: "aegis-mail",
    name: "Aegis Mail",
    kind: "armor",
    rarity: "epic",
    baseValue: 2200,
    description: "Chain forged with a whisper of starlight.",
    color: "#6ee7a8",
    stackable: false,
    slot: "armor",
    defense: 22,
  },
  "lucky-charm": {
    id: "lucky-charm",
    name: "Lucky Charm",
    kind: "trinket",
    rarity: "uncommon",
    baseValue: 140,
    description: "You feel a little braver.",
    color: "#e8c15a",
    stackable: false,
    slot: "trinket",
    attack: 2,
  },
  "merchant-ring": {
    id: "merchant-ring",
    name: "Merchant Ring",
    kind: "trinket",
    rarity: "rare",
    baseValue: 480,
    description: "Prices bend slightly in your favour.",
    color: "#e8c15a",
    stackable: false,
    slot: "trinket",
    attack: 3,
    defense: 3,
  },
  "moonlit-lens": {
    id: "moonlit-lens",
    name: "Moonlit Lens",
    kind: "trinket",
    rarity: "epic",
    baseValue: 1900,
    description: "Reveals the true price of everything.",
    color: "#6ee7a8",
    stackable: false,
    slot: "trinket",
    attack: 5,
    defense: 4,
  },
};

export const RARITY_WEIGHT: Record<ItemRarity, number> = {
  common: 50,
  uncommon: 26,
  rare: 15,
  epic: 7,
  legendary: 2,
};

export const RARITY_COLORS: Record<ItemRarity, string> = {
  common: "#cdd3d8",
  uncommon: "#7fd1b9",
  rare: "#8fd6e8",
  epic: "#b79bff",
  legendary: "#ffa85c",
};

export function getItem(id: string): ItemDefinition | undefined {
  return ITEMS[id];
}

export function itemsByRarity(rarity: ItemRarity): ItemDefinition[] {
  return Object.values(ITEMS).filter((item) => item.rarity === rarity);
}

export function isEquipSlot(value: string): value is EquipSlot {
  return value === "weapon" || value === "armor" || value === "trinket";
}

export function itemBuyPrice(item: ItemDefinition): number {
  return Math.max(1, Math.round(item.baseValue));
}

export function itemSellPrice(item: ItemDefinition): number {
  return Math.max(1, Math.floor(item.baseValue * 0.4));
}
