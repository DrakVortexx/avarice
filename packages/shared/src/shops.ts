export interface ShopDefinition {  id: string;
  name: string;
  district: string;
  x: number;
  z: number;
  sells: string[];
  buys: boolean;
}

export const SHOPS: ShopDefinition[] = [
  {
    id: "ironworks",
    name: "The Ironworks",
    district: "Market Plaza",
    x: 18,
    z: 4,
    sells: ["rusty-dagger", "iron-sword", "steel-blade", "moonlit-blade", "founders-blade"],
    buys: true,
  },
  {
    id: "tannery",
    name: "Hide & Thread",
    district: "Market Plaza",
    x: -18,
    z: 4,
    sells: ["cloth-tunic", "leather-armor", "iron-plate", "aegis-mail"],
    buys: true,
  },
  {
    id: "apothecary",
    name: "The Apothecary",
    district: "Market Plaza",
    x: 0,
    z: -18,
    sells: ["health-potion", "herb"],
    buys: true,
  },
  {
    id: "frostgate-store",
    name: "Frostgate Supplies",
    district: "Frostgate",
    x: 0,
    z: -382,
    sells: ["health-potion", "rusty-dagger", "cloth-tunic", "herb"],
    buys: true,
  },
  {
    id: "emberhold-forge",
    name: "Emberhold Forge",
    district: "Emberhold",
    x: 430,
    z: 58,
    sells: ["iron-sword", "leather-armor", "health-potion", "coal", "iron-ore"],
    buys: true,
  },
  {
    id: "sunmere-market",
    name: "Sunmere Market",
    district: "Sunmere",
    x: 40,
    z: 448,
    sells: ["health-potion", "herb", "cloth", "lucky-charm"],
    buys: true,
  },
  {
    id: "mistwood-trader",
    name: "Mistwood Trader",
    district: "Mistwood",
    x: -430,
    z: -22,
    sells: ["wood", "leather", "herb", "leather-armor", "health-potion"],
    buys: true,
  },
  {
    id: "duskport-bazaar",
    name: "Duskport Outfitters",
    district: "Duskport",
    x: -340,
    z: 358,
    sells: ["steel-blade", "iron-plate", "merchant-ring", "health-potion"],
    buys: true,
  },
  {
    id: "highfell-vendor",
    name: "Highfell Vendor",
    district: "Highfell",
    x: 340,
    z: -322,
    sells: ["iron-sword", "leather-armor", "lucky-charm", "health-potion"],
    buys: true,
  },
];

export function getShop(id: string): ShopDefinition | undefined {
  return SHOPS.find((shop) => shop.id === id);
}
