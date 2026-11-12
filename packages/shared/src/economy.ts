export const BAZAAR_FEE_RATE = 0.05;
export const MIN_LISTING_FEE = 1;

export function listingFee(pricePerUnit: number, quantity: number): number {
  const gross = Math.max(0, Math.floor(pricePerUnit)) * Math.max(1, Math.floor(quantity));
  return Math.max(MIN_LISTING_FEE, Math.ceil(gross * BAZAAR_FEE_RATE));
}

export function canAfford(coins: number, cost: number): boolean {
  return Number.isInteger(cost) && cost >= 0 && Number.isFinite(coins) && coins >= cost;
}

export function formatCoins(amount: number): string {
  const rounded = Math.trunc(amount);
  return `${rounded.toLocaleString("en-US")}c`;
}

export function netSaleProceeds(pricePerUnit: number, quantity: number): number {
  const gross = Math.max(0, Math.floor(pricePerUnit)) * Math.max(1, Math.floor(quantity));
  return Math.max(0, gross - listingFee(pricePerUnit, quantity));
}
