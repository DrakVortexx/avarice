import { getItem, type EquippedGear, type InventoryStack } from "@avarice/shared";

export type InventoryMap = Map<string, number>;

export function stacksToInventory(stacks: InventoryStack[]): InventoryMap {
  const inventory: InventoryMap = new Map();
  for (const stack of stacks) {
    if (stack.quantity > 0 && getItem(stack.itemId)) {
      inventory.set(stack.itemId, (inventory.get(stack.itemId) ?? 0) + stack.quantity);
    }
  }
  return inventory;
}

export function inventoryToStacks(inventory: InventoryMap): InventoryStack[] {
  const stacks: InventoryStack[] = [];
  for (const [itemId, quantity] of inventory) {
    if (quantity > 0) {
      stacks.push({ itemId, quantity });
    }
  }
  stacks.sort((a, b) => a.itemId.localeCompare(b.itemId));
  return stacks;
}

export function addItem(inventory: InventoryMap, itemId: string, quantity: number): boolean {
  if (!getItem(itemId) || quantity <= 0) {
    return false;
  }
  inventory.set(itemId, (inventory.get(itemId) ?? 0) + quantity);
  return true;
}

export function removeItem(inventory: InventoryMap, itemId: string, quantity: number): boolean {
  const current = inventory.get(itemId) ?? 0;
  if (quantity <= 0 || current < quantity) {
    return false;
  }
  const next = current - quantity;
  if (next <= 0) {
    inventory.delete(itemId);
  } else {
    inventory.set(itemId, next);
  }
  return true;
}

export function countItem(inventory: InventoryMap, itemId: string): number {
  return inventory.get(itemId) ?? 0;
}

export function equipmentAttack(equipped: EquippedGear): number {
  let total = 0;
  for (const id of [equipped.weapon, equipped.armor, equipped.trinket]) {
    if (id) {
      total += getItem(id)?.attack ?? 0;
    }
  }
  return total;
}

export function equipmentDefense(equipped: EquippedGear): number {
  let total = 0;
  for (const id of [equipped.weapon, equipped.armor, equipped.trinket]) {
    if (id) {
      total += getItem(id)?.defense ?? 0;
    }
  }
  return total;
}
