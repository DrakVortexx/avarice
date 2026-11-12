export type ItemRarity = "common" | "uncommon" | "rare" | "epic" | "legendary";

export interface ItemDefinition {
  id: string;
  name: string;
  rarity: ItemRarity;
  baseValue: number;
  description: string;
  color: string;
}

export const ITEMS: Record<string, ItemDefinition> = {
  "rusty-key": {
    id: "rusty-key",
    name: "Rusty Key",
    rarity: "common",
    baseValue: 12,
    description: "Opens something. Probably.",
    color: "#b07a4a",
  },
  "glass-shard": {
    id: "glass-shard",
    name: "Glass Shard",
    rarity: "common",
    baseValue: 8,
    description: "Sharp, shiny, and slightly cursed.",
    color: "#8fd6e8",
  },
  "merchant-coin": {
    id: "merchant-coin",
    name: "Merchant Coin",
    rarity: "uncommon",
    baseValue: 65,
    description: "Currency from a bazaar that no longer exists.",
    color: "#e8c15a",
  },
  "moonlit-lens": {
    id: "moonlit-lens",
    name: "Moonlit Lens",
    rarity: "epic",
    baseValue: 900,
    description: "Reveals the true price of everything.",
    color: "#6ee7a8",
  },
  "founders-relic": {
    id: "founders-relic",
    name: "Founder's Relic",
    rarity: "legendary",
    baseValue: 4200,
    description: "Proof that you were here before the economy existed.",
    color: "#ff7a5c",
  },
};

export const RARITY_WEIGHT: Record<ItemRarity, number> = {
  common: 50,
  uncommon: 26,
  rare: 15,
  epic: 7,
  legendary: 2,
};

export function getItem(id: string): ItemDefinition | undefined {
  return ITEMS[id];
}

export function itemsByRarity(rarity: ItemRarity): ItemDefinition[] {
  return Object.values(ITEMS).filter((item) => item.rarity === rarity);
}
