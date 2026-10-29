import { isRecord, list, num, type Data } from '@game1/engine';

/**
 * The purchase record every save keeps as `state.shop`. The purchase server decides what was
 * paid; a save only records the server's answers, so that each one is applied exactly once.
 */
export interface ShopRecord<E extends string = string> {
  /** One-time purchases the server says this player owns, such as No Ad Breaks. */
  entitlements: E[];
  /**
   * The newest settlements this save received, so a repeat grants nothing and a save that
   * replaces this one can take over its purchases.
   */
  settled: Settled[];
  /** A settlement id saved before asking the server, so a crash cannot lose purchases. */
  pending: string | null;
}

/** Currencies the server moved from its wallet into this save. Negative after a refund. */
export interface Settled {
  id: string;
  amounts: Record<string, number>;
  at: number;
}

/** How many settlements a save remembers. A player making this many purchases is very rare. */
export const SETTLED_KEEP = 200;

/** The entitlement of every game's No Ad Breaks product: ad breaks stop and rewards come without ads. */
export const REMOVE_ADS = 'remove_ads';

const SETTLEMENT_ID = /^[A-Za-z0-9_-]{1,64}$/;

export function createShop<E extends string = string>(): ShopRecord<E> {
  return { entitlements: [], settled: [], pending: null };
}

/** The entitlements the server lists that this game knows, in the game's order. */
export function knownEntitlements<E extends string>(entitlements: readonly string[], known: readonly E[]): E[] {
  return known.filter((e) => entitlements.includes(e));
}

export function restoreShop<E extends string>(data: unknown, known: readonly E[]): ShopRecord<E> {
  const shop = isRecord(data) ? data : {};
  return {
    entitlements: [...new Set(list(shop.entitlements).filter((e): e is E => typeof e === 'string' && (known as readonly string[]).includes(e)))],
    settled: restoreSettled(list(shop.settled)),
    pending: typeof shop.pending === 'string' && shop.pending.length <= 64 ? shop.pending : null,
  };
}

function restoreSettled(entries: unknown[]): Settled[] {
  const seen = new Set<string>();
  const out: Settled[] = [];
  for (const entry of entries) {
    // Early test saves listed only the ids.
    const e: Data = typeof entry === 'string' ? { id: entry } : isRecord(entry) ? entry : {};
    if (typeof e.id !== 'string' || !SETTLEMENT_ID.test(e.id) || seen.has(e.id)) continue;
    seen.add(e.id);
    const amounts: Record<string, number> = {};
    if (isRecord(e.amounts)) {
      for (const [currency, amount] of Object.entries(e.amounts)) {
        if (currency.length <= 32 && Number.isSafeInteger(amount) && amount !== 0) amounts[currency] = amount as number;
      }
    }
    out.push({ id: e.id, amounts, at: num(e.at, 0) });
  }
  return out.slice(-SETTLED_KEEP);
}

/**
 * Records one settlement in the save. Returns the amounts the game must now add to its state,
 * or null when this save already has the settlement, so a repeated answer grants nothing.
 */
export function recordSettlement(shop: ShopRecord, id: string, amounts: Readonly<Record<string, number>>, at: number): Record<string, number> | null {
  if (shop.settled.some((s) => s.id === id)) return null;
  const applied: Record<string, number> = {};
  for (const [currency, amount] of Object.entries(amounts)) {
    if (Number.isSafeInteger(amount) && amount !== 0) applied[currency] = amount;
  }
  shop.settled = [...shop.settled, { id, amounts: applied, at }].sort((a, b) => a.at - b.at).slice(-SETTLED_KEEP);
  return applied;
}

/**
 * The settlements `from` received that `into` did not, oldest first. When one save replaces
 * another (a cloud save from another phone, or a pasted one), applying these to `into` keeps
 * everything bought on either.
 */
export function missingSettlements(into: ShopRecord, from: ShopRecord): Settled[] {
  const known = new Set(into.settled.map((s) => s.id));
  // A full list has dropped its oldest entries, and `from` may still list those.
  const oldest = into.settled.length >= SETTLED_KEEP ? Math.min(...into.settled.map((s) => s.at)) : Number.NEGATIVE_INFINITY;
  return from.settled.filter((s) => !known.has(s.id) && s.at >= oldest);
}

/** Adds the currencies of one settlement to a game's state; negative amounts take them back after a refund. */
export type Grant<S> = (state: S, amounts: Readonly<Record<string, number>>, now: number) => void;

/**
 * Applies one wallet settlement from the server: currencies moved from the server wallet into
 * the save. Each settlement id is applied at most once, so a repeated answer grants nothing.
 */
export function applySettlement<S extends { shop: ShopRecord }>(
  state: S,
  grant: Grant<S>,
  id: string,
  amounts: Readonly<Record<string, number>>,
  now: number,
  at = now,
): boolean {
  const applied = recordSettlement(state.shop, id, amounts, at);
  if (!applied) return false;
  grant(state, applied, now);
  return true;
}

/**
 * Applies the settlements `from` received that `into` did not, so that when one save replaces
 * another (a cloud save from another phone, or a pasted one), nothing bought on either is lost.
 * Returns how many it applied.
 */
export function mergeSettlements<S extends { shop: ShopRecord }>(into: S, from: S, grant: Grant<S>, now: number): number {
  let applied = 0;
  for (const s of missingSettlements(into.shop, from.shop)) {
    if (applySettlement(into, grant, s.id, s.amounts, now, s.at)) applied += 1;
  }
  return applied;
}
