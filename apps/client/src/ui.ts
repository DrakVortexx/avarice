import {
  RARITY_COLORS,
  formatCoins,
  getItem,
  itemSellPrice,
  type BazaarView,
  type EquipSlot,
  type NoticeEvent,
  type SelfState,
  type ShopView,
} from "@avarice/shared";

export interface UiHandlers {
  onAttack: () => void;
  onInteract: () => void;
  onUseItem: (itemId: string) => void;
  onEquip: (itemId: string, slot: EquipSlot) => void;
  onUnequip: (slot: EquipSlot) => void;
  onShopBuy: (shopId: string, itemId: string) => void;
  onShopSell: (shopId: string, itemId: string) => void;
  onOpenBazaar: () => void;
  onBazaarList: (itemId: string, quantity: number, price: number) => void;
  onBazaarBuy: (listingId: string) => void;
  onBazaarCancel: (listingId: string) => void;
  onAdmin: (command: string) => void;
}

export interface StatView {
  name: string;
  coins: number;
  hp: number;
  maxHp: number;
  level: number;
  alive: boolean;
}

const EQUIP_SLOTS: EquipSlot[] = ["weapon", "armor", "trinket"];

function must<T extends Element>(selector: string): T {
  const element = document.querySelector<T>(selector);
  if (!element) {
    throw new Error(`Missing element: ${selector}`);
  }
  return element;
}

function shortStats(itemId: string): string {
  const item = getItem(itemId);
  if (!item) {
    return "";
  }
  const parts: string[] = [];
  if (item.attack) {
    parts.push(`+${item.attack} atk`);
  }
  if (item.defense) {
    parts.push(`+${item.defense} def`);
  }
  if (item.heal) {
    parts.push(`+${item.heal} hp`);
  }
  return parts.join(" · ");
}

export class GameUi {
  private self: SelfState | null = null;
  private stats: StatView = { name: "", coins: 0, hp: 100, maxHp: 100, level: 1, alive: true };
  private shop: ShopView | null = null;
  private bazaar: BazaarView | null = null;
  private deathTimer: number | null = null;

  private readonly coinsEl = must<HTMLSpanElement>("#coins");
  private readonly levelEl = must<HTMLSpanElement>("#vitals-level");
  private readonly hpFill = must<HTMLDivElement>("#hp-fill");
  private readonly hpText = must<HTMLSpanElement>("#hp-text");
  private readonly xpFill = must<HTMLDivElement>("#xp-fill");
  private readonly xpText = must<HTMLSpanElement>("#xp-text");
  private readonly promptEl = must<HTMLDivElement>("#prompt");

  private readonly inventoryEl = must<HTMLElement>("#inventory");
  private readonly equipGrid = must<HTMLDivElement>("#equip-grid");
  private readonly invList = must<HTMLDivElement>("#inv-list");
  private readonly invCoins = must<HTMLSpanElement>("#inv-coins");

  private readonly shopEl = must<HTMLElement>("#shop");
  private readonly shopTitle = must<HTMLElement>("#shop-title");
  private readonly shopList = must<HTMLDivElement>("#shop-list");
  private readonly shopSellList = must<HTMLDivElement>("#shop-sell-list");
  private readonly shopNote = must<HTMLDivElement>("#shop-note");

  private readonly bazaarEl = must<HTMLElement>("#bazaar");
  private readonly bazaarList = must<HTMLDivElement>("#bazaar-list");
  private readonly bazaarItem = must<HTMLSelectElement>("#bazaar-item");
  private readonly bazaarQty = must<HTMLInputElement>("#bazaar-qty");
  private readonly bazaarPrice = must<HTMLInputElement>("#bazaar-price");
  private readonly bazaarNote = must<HTMLDivElement>("#bazaar-note");

  private readonly adminEl = must<HTMLElement>("#admin");
  private readonly adminLog = must<HTMLDivElement>("#admin-log");
  private readonly adminInput = must<HTMLInputElement>("#admin-input");
  private readonly adminButton = must<HTMLButtonElement>("#btn-admin");

  private readonly deathEl = must<HTMLElement>("#death");
  private readonly deathBy = must<HTMLElement>("#death-by");
  private readonly deathTimerText = must<HTMLElement>("#death-timer");
  private readonly noticesEl = must<HTMLDivElement>("#notices");

  constructor(private readonly handlers: UiHandlers) {
    must<HTMLButtonElement>("#btn-attack").addEventListener("click", () => handlers.onAttack());
    must<HTMLButtonElement>("#btn-interact").addEventListener("click", () => handlers.onInteract());
    must<HTMLButtonElement>("#btn-inventory").addEventListener("click", () => this.toggleInventory());
    must<HTMLButtonElement>("#btn-bazaar").addEventListener("click", () => this.openBazaar());
    this.adminButton.addEventListener("click", () => this.toggleAdmin());

    must<HTMLButtonElement>("#inv-close").addEventListener("click", () => this.closeInventory());
    must<HTMLButtonElement>("#shop-close").addEventListener("click", () => this.closeShop());
    must<HTMLButtonElement>("#bazaar-close").addEventListener("click", () => this.closeBazaar());
    must<HTMLButtonElement>("#admin-close").addEventListener("click", () => this.closeAdmin());

    must<HTMLFormElement>("#bazaar-form").addEventListener("submit", (event) => {
      event.preventDefault();
      const itemId = this.bazaarItem.value;
      const quantity = Math.max(1, Math.floor(Number(this.bazaarQty.value)) || 1);
      const price = Math.max(1, Math.floor(Number(this.bazaarPrice.value)) || 1);
      if (itemId) {
        handlers.onBazaarList(itemId, quantity, price);
      }
    });

    must<HTMLFormElement>("#admin-form").addEventListener("submit", (event) => {
      event.preventDefault();
      const command = this.adminInput.value.trim();
      if (command) {
        this.appendAdminLog(true, `> ${command}`);
        handlers.onAdmin(command);
        this.adminInput.value = "";
      }
    });
  }

  setStats(stats: StatView): void {
    this.stats = stats;
    this.coinsEl.textContent = formatCoins(stats.coins);
    this.invCoins.textContent = formatCoins(stats.coins);
    this.renderVitals();
  }

  setSelf(self: SelfState): void {
    this.self = self;
    this.adminButton.classList.toggle("hidden", !self.isAdmin);
    this.renderVitals();
    this.renderInventory();
    if (!this.shopEl.classList.contains("hidden")) {
      this.renderShopSell();
    }
    this.renderBazaarForm();
  }

  private renderVitals(): void {
    const { hp, maxHp, level } = this.stats;
    const hpPct = maxHp > 0 ? Math.max(0, Math.min(1, hp / maxHp)) * 100 : 0;
    this.hpFill.style.width = `${hpPct}%`;
    this.hpText.textContent = `${Math.round(hp)} / ${Math.round(maxHp)}`;
    this.levelEl.textContent = `Lv ${level}`;

    const xpForNext = this.self?.xpForNext ?? 1;
    const xpInto = this.self?.xpIntoLevel ?? 0;
    const xpPct = xpForNext > 0 ? Math.max(0, Math.min(1, xpInto / xpForNext)) * 100 : 0;
    this.xpFill.style.width = `${xpPct}%`;
    this.xpText.textContent = `${xpInto} / ${xpForNext} XP`;
  }

  private renderInventory(): void {
    this.equipGrid.replaceChildren();
    this.invList.replaceChildren();

    const self = this.self;
    if (!self) {
      return;
    }

    for (const slot of EQUIP_SLOTS) {
      const slotEl = document.createElement("div");
      slotEl.className = "equip-slot";

      const label = document.createElement("span");
      label.className = "equip-slot-label";
      label.textContent = slot;

      const name = document.createElement("span");
      name.className = "equip-slot-name";
      const equippedId = self.equipped[slot];
      name.textContent = equippedId ? (getItem(equippedId)?.name ?? equippedId) : "—";

      slotEl.append(label, name);

      if (equippedId) {
        const button = document.createElement("button");
        button.type = "button";
        button.className = "ghost";
        button.textContent = "Unequip";
        button.addEventListener("click", () => this.handlers.onUnequip(slot));
        slotEl.append(button);
      }

      this.equipGrid.append(slotEl);
    }

    if (self.inventory.length === 0) {
      const empty = document.createElement("div");
      empty.className = "modal-note";
      empty.textContent = "Your bag is empty. Gather resources in the wild.";
      this.invList.append(empty);
      return;
    }

    for (const stack of self.inventory) {
      const item = getItem(stack.itemId);
      if (!item) {
        continue;
      }
      const row = document.createElement("div");
      row.className = "row";

      const dot = document.createElement("span");
      dot.className = "dot";
      dot.style.background = RARITY_COLORS[item.rarity];

      const main = document.createElement("div");
      main.className = "row-main";
      const name = document.createElement("div");
      name.className = "row-name";
      name.textContent = `${item.name} ×${stack.quantity}`;
      const sub = document.createElement("div");
      sub.className = "row-sub";
      const stats = shortStats(item.id);
      sub.textContent = stats ? `${item.rarity} · ${stats}` : item.rarity;
      main.append(name, sub);

      row.append(dot, main);

      if (item.kind === "consumable") {
        const use = document.createElement("button");
        use.type = "button";
        use.textContent = "Use";
        use.addEventListener("click", () => this.handlers.onUseItem(item.id));
        row.append(use);
      } else if (item.slot) {
        const isEquipped = self.equipped[item.slot] === item.id;
        const equip = document.createElement("button");
        equip.type = "button";
        equip.textContent = isEquipped ? "Unequip" : "Equip";
        equip.addEventListener("click", () =>
          isEquipped ? this.handlers.onUnequip(item.slot!) : this.handlers.onEquip(item.id, item.slot!),
        );
        row.append(equip);
      }

      this.invList.append(row);
    }
  }

  private renderShop(): void {
    const shop = this.shop;
    this.shopList.replaceChildren();
    if (!shop) {
      return;
    }
    this.shopTitle.textContent = shop.name;
    for (const item of shop.items) {
      const row = document.createElement("div");
      row.className = "row";

      const dot = document.createElement("span");
      dot.className = "dot";
      dot.style.background = item.color;

      const main = document.createElement("div");
      main.className = "row-main";
      const name = document.createElement("div");
      name.className = "row-name";
      name.textContent = item.name;
      const sub = document.createElement("div");
      sub.className = "row-sub";
      const stats = shortStats(item.itemId);
      sub.textContent = stats ? `${item.rarity} · ${stats}` : item.rarity;
      main.append(name, sub);

      const buy = document.createElement("button");
      buy.type = "button";
      buy.textContent = `${item.price}c`;
      buy.addEventListener("click", () => this.handlers.onShopBuy(shop.shopId, item.itemId));

      row.append(dot, main, buy);
      this.shopList.append(row);
    }
    this.renderShopSell();
  }

  private renderShopSell(): void {
    const shop = this.shop;
    this.shopSellList.replaceChildren();
    if (!shop || !this.self) {
      return;
    }
    if (this.self.inventory.length === 0) {
      const empty = document.createElement("div");
      empty.className = "modal-note";
      empty.textContent = "Nothing to sell.";
      this.shopSellList.append(empty);
      return;
    }
    for (const stack of this.self.inventory) {
      const item = getItem(stack.itemId);
      if (!item) {
        continue;
      }
      const row = document.createElement("div");
      row.className = "row";

      const dot = document.createElement("span");
      dot.className = "dot";
      dot.style.background = RARITY_COLORS[item.rarity];

      const main = document.createElement("div");
      main.className = "row-main";
      const name = document.createElement("div");
      name.className = "row-name";
      name.textContent = `${item.name} ×${stack.quantity}`;
      main.append(name);

      const sell = document.createElement("button");
      sell.type = "button";
      sell.className = "ghost";
      sell.textContent = `${itemSellPrice(item)}c`;
      sell.addEventListener("click", () => this.handlers.onShopSell(shop.shopId, item.id));

      row.append(dot, main, sell);
      this.shopSellList.append(row);
    }
  }

  private renderBazaarForm(): void {
    const previous = this.bazaarItem.value;
    this.bazaarItem.replaceChildren();
    const self = this.self;
    if (!self) {
      return;
    }
    for (const stack of self.inventory) {
      const item = getItem(stack.itemId);
      if (!item) {
        continue;
      }
      const option = document.createElement("option");
      option.value = item.id;
      option.textContent = `${item.name} ×${stack.quantity}`;
      this.bazaarItem.append(option);
    }
    if (previous) {
      this.bazaarItem.value = previous;
    }
  }

  private renderBazaar(): void {
    this.bazaarList.replaceChildren();
    const view = this.bazaar;
    if (!view) {
      return;
    }
    if (view.listings.length === 0) {
      const empty = document.createElement("div");
      empty.className = "modal-note";
      empty.textContent = "No listings yet. Be the first to sell.";
      this.bazaarList.append(empty);
      return;
    }
    for (const listing of view.listings) {
      const row = document.createElement("div");
      row.className = "row";

      const dot = document.createElement("span");
      dot.className = "dot";
      dot.style.background = listing.color;

      const main = document.createElement("div");
      main.className = "row-main";
      const name = document.createElement("div");
      name.className = "row-name";
      name.textContent = `${listing.name} ×${listing.quantity}`;
      const sub = document.createElement("div");
      sub.className = "row-sub";
      sub.textContent = `${listing.pricePerUnit}c each · ${listing.seller}`;
      main.append(name, sub);

      row.append(dot, main);

      if (listing.seller === this.stats.name) {
        const cancel = document.createElement("button");
        cancel.type = "button";
        cancel.className = "ghost";
        cancel.textContent = "Cancel";
        cancel.addEventListener("click", () => this.handlers.onBazaarCancel(listing.id));
        row.append(cancel);
      } else {
        const buy = document.createElement("button");
        buy.type = "button";
        buy.textContent = "Buy";
        buy.addEventListener("click", () => this.handlers.onBazaarBuy(listing.id));
        row.append(buy);
      }

      this.bazaarList.append(row);
    }
  }

  setShop(shop: ShopView): void {
    this.shop = shop;
    this.shopNote.textContent = "";
    this.renderShop();
    this.openModal(this.shopEl);
  }

  closeShop(): void {
    this.shop = null;
    this.shopEl.classList.add("hidden");
  }

  setBazaar(view: BazaarView): void {
    this.bazaar = view;
    this.renderBazaar();
    this.renderBazaarForm();
    this.openModal(this.bazaarEl);
  }

  openBazaar(): void {
    this.handlers.onOpenBazaar();
    this.openModal(this.bazaarEl);
  }

  closeBazaar(): void {
    this.bazaar = null;
    this.bazaarEl.classList.add("hidden");
  }

  toggleInventory(): void {
    if (this.inventoryEl.classList.contains("hidden")) {
      this.renderInventory();
      this.inventoryEl.classList.remove("hidden");
    } else {
      this.closeInventory();
    }
  }

  closeInventory(): void {
    this.inventoryEl.classList.add("hidden");
  }

  toggleAdmin(): void {
    if (this.adminEl.classList.contains("hidden")) {
      this.openModal(this.adminEl);
      this.adminInput.focus();
    } else {
      this.closeAdmin();
    }
  }

  closeAdmin(): void {
    this.adminEl.classList.add("hidden");
  }

  private openModal(el: HTMLElement): void {
    el.classList.remove("hidden");
  }

  setPrompt(text: string | null): void {
    if (text) {
      this.promptEl.textContent = text;
      this.promptEl.classList.remove("hidden");
    } else {
      this.promptEl.classList.add("hidden");
    }
  }

  notice(kind: NoticeEvent["kind"], text: string): void {
    const el = document.createElement("div");
    el.className = `notice ${kind}`;
    el.textContent = text;
    this.noticesEl.append(el);
    window.setTimeout(() => el.remove(), 3200);
  }

  shopNoteText(text: string): void {
    this.shopNote.textContent = text;
  }

  bazaarNoteText(text: string): void {
    this.bazaarNote.textContent = text;
  }

  appendAdminLog(ok: boolean, text: string): void {
    const el = document.createElement("div");
    el.className = ok ? "ok" : "err";
    el.textContent = text;
    this.adminLog.append(el);
    this.adminLog.scrollTop = this.adminLog.scrollHeight;
  }

  showDeath(byName: string | undefined, respawnAt: number): void {
    this.deathBy.textContent = byName ? `${byName} struck you down.` : "You were slain.";
    this.deathEl.classList.remove("hidden");
    if (this.deathTimer !== null) {
      window.clearInterval(this.deathTimer);
    }
    const tick = (): void => {
      const remaining = Math.max(0, Math.ceil((respawnAt - Date.now()) / 1000));
      this.deathTimerText.textContent = `Respawning in ${remaining}s…`;
      if (remaining <= 0) {
        this.clearDeath();
      }
    };
    tick();
    this.deathTimer = window.setInterval(tick, 250);
  }

  clearDeath(): void {
    if (this.deathTimer !== null) {
      window.clearInterval(this.deathTimer);
      this.deathTimer = null;
    }
    this.deathEl.classList.add("hidden");
  }

  isAnyOpen(): boolean {
    return (
      !this.inventoryEl.classList.contains("hidden") ||
      !this.shopEl.classList.contains("hidden") ||
      !this.bazaarEl.classList.contains("hidden") ||
      !this.adminEl.classList.contains("hidden")
    );
  }

  closeAll(): void {
    this.closeInventory();
    this.closeShop();
    this.closeBazaar();
    this.closeAdmin();
  }
}
