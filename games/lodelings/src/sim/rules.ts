import { Rng, bulkCost, hashString, isNewDay, maxAffordable } from '@game1/engine';
import * as C from './content.js';
import type { AdPlacement, EggKind, Element, Entitlement, GearId, QuestMetric, RelicId, SkillId, SpeciesId } from './content.js';
import { SETTLED_KEEP, type GameState, type OfflineReport, type Quest } from './state.js';

/** What happened during an action, for the screen to animate. The state is already updated. */
export type SimEvent =
  | { type: 'hit'; amount: number; crit: boolean; source: 'tap' | 'frenzy' | 'dynamite' }
  | { type: 'block'; depth: number; ore: number; gem: boolean }
  | { type: 'egg_found'; egg: EggKind }
  | { type: 'descend'; depth: number }
  | { type: 'guardian_start'; depth: number }
  | { type: 'guardian_won'; depth: number; ore: number; gems: number; egg: EggKind | null; first: boolean }
  | { type: 'guardian_lost'; depth: number }
  | { type: 'unlock'; what: 'skill' | 'slot'; id: string }
  | { type: 'hatch'; species: SpeciesId; isNew: boolean; stars: number; gems: number };

export interface Ctx {
  /** Current time in ms. */
  now: number;
  /** Today's local calendar day (YYYY-MM-DD), for daily rewards, quests and ad limits. */
  day: string;
  events: SimEvent[];
}

export function ctx(now: number, day: string): Ctx {
  return { now, day, events: [] };
}

export type Amount = number | 'max';

// ---------------------------------------------------------------------------------------
// Formulas

export function blockHp(depth: number): number {
  let log = Math.log(C.BALANCE.baseBlockHp);
  let from = 1;
  for (const [upTo, growth] of C.BALANCE.hpGrowth) {
    const to = Math.min(depth, upTo);
    if (to > from) log += (to - from) * Math.log(growth);
    if (depth <= upTo) break;
    from = upTo;
  }
  return Math.exp(log);
}

export function isGuardianDepth(depth: number): boolean {
  return depth % C.GUARDIAN_EVERY === 0;
}

export function guardianHp(depth: number): number {
  return blockHp(depth) * C.BALANCE.guardianHpFactor;
}

export function guardianElement(depth: number): Element {
  return C.ELEMENTS[Math.floor(depth / C.GUARDIAN_EVERY) % C.ELEMENTS.length] ?? 'ember';
}

export function guardianName(depth: number): string {
  const names = C.GUARDIAN_NAMES[guardianElement(depth)];
  return names[Math.floor(depth / (C.GUARDIAN_EVERY * C.ELEMENTS.length)) % names.length] ?? names[0] ?? '';
}

/** Ore per point of rock HP at a depth, before multipliers. */
export function orePerHp(depth: number): number {
  const b = C.BALANCE;
  return b.orePerHp * b.oreRichness ** (depth - 1) * (1 + b.shallowBonus * Math.exp(-(depth - 1) / b.shallowDepths));
}

/** Ore for breaking one rock at a depth, before multipliers. */
export function blockOre(depth: number): number {
  return blockHp(depth) * orePerHp(depth);
}

export function biomeAt(depth: number): { biome: C.Biome; cycle: number } {
  const cycle = Math.floor((depth - 1) / C.BIOME_CYCLE_DEPTHS);
  const local = ((depth - 1) % C.BIOME_CYCLE_DEPTHS) + 1;
  let biome = C.BIOMES[0] as C.Biome;
  for (const b of C.BIOMES) if (local >= b.fromDepth) biome = b;
  return { biome, cycle };
}

export function hasEntitlement(state: GameState, id: Entitlement): boolean {
  return state.shop.entitlements.includes(id);
}

function dustBonus(state: GameState): number {
  return 1 + C.BALANCE.dustDamageBonus * state.lifetimeDust;
}

export function pickDamage(level: number): number {
  return (1 + 2 * level) * 2 ** Math.floor(level / C.BALANCE.levelMilestone);
}

export function critChance(state: GameState, lamp = state.gear.lamp): number {
  return Math.min(0.3, 0.04 + 0.01 * lamp);
}

export function memberDps(speciesId: SpeciesId, level: number, stars: number): number {
  const species = C.speciesOf(speciesId);
  if (!species) return 0;
  return C.RARITY_STATS[species.rarity].dps * level * 2 ** Math.floor(level / C.BALANCE.levelMilestone) * (1 + C.STAR_BONUS * stars);
}

export function skillActive(state: GameState, id: SkillId, now: number): boolean {
  return now < state.skills[id].activeUntil;
}

/** Seconds of the last `dt` seconds (ending at `now`) during which a timed skill was active. */
export function activeSeconds(state: GameState, id: SkillId, now: number, dt: number): number {
  const until = state.skills[id].activeUntil;
  const start = until - C.SKILLS[id].durationSeconds * 1000;
  return Math.max(0, Math.min(now, until) - Math.max(now - dt * 1000, start)) / 1000;
}

/** One Lodeling's damage per second against rock with relics and Relic Dust, at its level or another. */
export function lodelingDps(state: GameState, id: SpeciesId, level?: number): number {
  const owned = state.roster[id];
  if (!owned) return 0;
  return memberDps(id, level ?? owned.level, owned.stars) * (1 + C.RELICS.heart.perLevel * state.relics.heart) * dustBonus(state);
}

/** Team damage per second without the Rally skill. */
function baseTeamDps(state: GameState, target: Element | null): number {
  let total = 0;
  for (const id of state.team) {
    const owned = state.roster[id];
    const species = C.speciesOf(id);
    if (!owned || !species) continue;
    total += memberDps(id, owned.level, owned.stars) * C.elementMultiplier(species.element, target);
  }
  return total * (1 + C.RELICS.heart.perLevel * state.relics.heart) * dustBonus(state);
}

/** The team's damage per second against a target of the given element (null for rock). */
export function teamDps(state: GameState, now: number, target: Element | null = null): number {
  return baseTeamDps(state, target) * (skillActive(state, 'rally', now) ? C.RALLY_MULTIPLIER : 1);
}

export function currentTarget(state: GameState): Element | null {
  return state.guardian ? guardianElement(state.depth) : null;
}

/** Damage of one tap; the gear levels can be overridden to preview an upgrade. */
export function tapDamage(state: GameState, now: number, pick = state.gear.pick, echo = state.gear.echo): number {
  const relic = 1 + C.RELICS.pick.perLevel * state.relics.pick;
  const echoDamage = 0.02 * echo * teamDps(state, now, currentTarget(state));
  return pickDamage(pick) * relic * dustBonus(state) + echoDamage;
}

/** Ore multiplier from things that last (gear, relics, purchases), without timed boosts. */
export function lastingOreMultiplier(state: GameState): number {
  const cart = 1 + 0.15 * state.gear.cart;
  const map = 1 + C.RELICS.map.perLevel * state.relics.map;
  const doubler = hasEntitlement(state, 'ore_doubler') ? C.ORE_DOUBLER_MULTIPLIER : 1;
  return cart * map * doubler;
}

export function oreMultiplier(state: GameState, now: number): number {
  const rush = skillActive(state, 'goldrush', now) ? C.GOLDRUSH_MULTIPLIER : 1;
  const blessing = now < state.blessingUntil ? C.BLESSING_MULTIPLIER : 1;
  return lastingOreMultiplier(state) * rush * blessing;
}

/** Ore per second from the team alone, at the current depth, with lasting multipliers. */
export function idleOrePerSecond(state: GameState, now: number): number {
  return teamDps(state, now, null) * orePerHp(state.depth) * lastingOreMultiplier(state);
}

export function eggChance(state: GameState): number {
  return C.BLOCK_EGG_CHANCE * (1 + C.RELICS.fortune.perLevel * state.relics.fortune);
}

export function hatchSeconds(state: GameState, kind: EggKind): number {
  return C.EGGS[kind].hatchSeconds * (1 - C.RELICS.hearth.perLevel * state.relics.hearth);
}

export function guardianSeconds(state: GameState): number {
  return C.BALANCE.guardianSeconds + C.RELICS.bane.perLevel * state.relics.bane;
}

export function offlineCapSeconds(state: GameState): number {
  return C.OFFLINE_BASE_SECONDS + C.RELICS.hourglass.perLevel * state.relics.hourglass;
}

export function teamSlots(state: GameState): number {
  return C.TEAM_SLOTS_BASE + C.TEAM_SLOT_DEPTHS.filter((d) => state.bestDepth >= d).length;
}

export function skillUnlocked(state: GameState, id: SkillId): boolean {
  return state.bestDepth >= C.SKILLS[id].unlockDepth;
}

// ---------------------------------------------------------------------------------------
// Randomness lives in the state, so a reload replays the same rolls.

function roll(state: GameState, probability: number): boolean {
  const rng = new Rng(state.rng);
  const hit = rng.chance(probability);
  state.rng = rng.state;
  return hit;
}

function rollWith<T>(state: GameState, pick: (rng: Rng) => T): T {
  const rng = new Rng(state.rng);
  const value = pick(rng);
  state.rng = rng.state;
  return value;
}

// ---------------------------------------------------------------------------------------
// Mining

function earnOre(state: GameState, amount: number): void {
  state.ore += amount;
  state.stats.oreEarned += amount;
}

export function tap(state: GameState, c: Ctx): void {
  state.stats.taps += 1;
  bumpQuest(state, 'taps', 1);
  strike(state, c, 'tap');
}

function strike(state: GameState, c: Ctx, source: 'tap' | 'frenzy'): void {
  const crit = roll(state, critChance(state));
  const amount = tapDamage(state, c.now) * (crit ? C.CRIT_MULTIPLIER : 1);
  c.events.push({ type: 'hit', amount, crit, source });
  damage(state, c, amount);
}

/** Applies damage to the current target. Overkill carries into the next rocks, not into a Guardian. */
function damage(state: GameState, c: Ctx, amount: number): void {
  let left = amount;
  for (let i = 0; left > 0 && i < 100; i++) {
    if (state.guardian) {
      state.hp -= left;
      if (state.hp <= 0) winGuardian(state, c);
      return;
    }
    const hit = Math.min(left, state.hp);
    state.hp -= hit;
    left -= hit;
    if (state.hp > 0) return;
    if (breakBlock(state, c) === 'guardian') return;
  }
}

function breakBlock(state: GameState, c: Ctx): 'rock' | 'guardian' {
  const depth = state.depth;
  const ore = blockOre(depth) * oreMultiplier(state, c.now);
  earnOre(state, ore);
  state.stats.blocks += 1;
  bumpQuest(state, 'blocks', 1);
  const gem = roll(state, C.BLOCK_GEM_CHANCE);
  if (gem) state.gems += 1;
  c.events.push({ type: 'block', depth, ore, gem });
  if (state.eggs.length < C.EGG_STORAGE && roll(state, eggChance(state))) {
    state.eggs.push('pebble');
    c.events.push({ type: 'egg_found', egg: 'pebble' });
    autoIncubate(state, c.now);
  }
  return nextBlock(state, c);
}

function nextBlock(state: GameState, c: Ctx): 'rock' | 'guardian' {
  const depth = state.depth;
  if (isGuardianDepth(depth)) {
    if (state.block + 1 >= C.BLOCKS_PER_DEPTH - 1) {
      if (state.farming) {
        state.block = 0;
        state.hp = blockHp(depth);
        return 'rock';
      }
      startGuardian(state, c);
      return 'guardian';
    }
  } else if (state.block + 1 >= C.BLOCKS_PER_DEPTH) {
    descend(state, c);
    return 'rock';
  }
  state.block += 1;
  state.hp = blockHp(depth);
  return 'rock';
}

function descend(state: GameState, c: Ctx): void {
  const before = state.bestDepth;
  state.depth += 1;
  state.block = 0;
  state.hp = blockHp(state.depth);
  state.maxDepth = Math.max(state.maxDepth, state.depth);
  state.bestDepth = Math.max(state.bestDepth, state.depth);
  c.events.push({ type: 'descend', depth: state.depth });
  if (state.bestDepth > before) {
    for (const id of C.SKILL_IDS) {
      const at = C.SKILLS[id].unlockDepth;
      if (at > before && at <= state.bestDepth) c.events.push({ type: 'unlock', what: 'skill', id });
    }
    for (const at of C.TEAM_SLOT_DEPTHS) {
      if (at > before && at <= state.bestDepth) c.events.push({ type: 'unlock', what: 'slot', id: String(at) });
    }
  }
}

/** Starts the Guardian fight of the current depth. Used when the rocks run out and by the Challenge button. */
export function startGuardian(state: GameState, c: Ctx, bonusSeconds = 0): boolean {
  if (!isGuardianDepth(state.depth) || state.guardian) return false;
  const maxHp = guardianHp(state.depth);
  state.guardian = { endsAt: c.now + (guardianSeconds(state) + bonusSeconds) * 1000, maxHp, retried: bonusSeconds > 0 };
  state.block = C.BLOCKS_PER_DEPTH - 1;
  state.hp = maxHp;
  c.events.push({ type: 'guardian_start', depth: state.depth });
  return true;
}

function loseGuardian(state: GameState, c: Ctx): void {
  state.guardian = null;
  state.farming = true;
  state.block = 0;
  state.hp = blockHp(state.depth);
  c.events.push({ type: 'guardian_lost', depth: state.depth });
}

function winGuardian(state: GameState, c: Ctx): void {
  const depth = state.depth;
  const first = !state.guardiansBeaten.includes(depth);
  const ore = blockOre(depth) * C.GUARDIAN_ORE_FACTOR * oreMultiplier(state, c.now);
  earnOre(state, ore);
  let gems = first ? C.GUARDIAN_FIRST_WIN_GEMS : 0;
  let egg: EggKind | null = null;
  if ((first && depth % 10 === 0) || roll(state, C.GUARDIAN_EGG_CHANCE)) egg = 'geode';
  if (egg && state.eggs.length >= C.EGG_STORAGE) {
    // A full egg basket never swallows a reward.
    egg = null;
    gems += 5;
  }
  if (egg) state.eggs.push(egg);
  state.gems += gems;
  if (first) state.guardiansBeaten.push(depth);
  state.stats.guardians += 1;
  bumpQuest(state, 'guardians', 1);
  state.guardian = null;
  state.farming = false;
  c.events.push({ type: 'guardian_won', depth, ore, gems, egg, first });
  if (egg) autoIncubate(state, c.now);
  descend(state, c);
}

/** Advances the game by `dt` seconds of play. */
export function step(state: GameState, c: Ctx, dt: number): void {
  state.lastSeenAt = c.now;
  state.stats.playSeconds += dt;
  if (state.guardian && c.now >= state.guardian.endsAt) loseGuardian(state, c);
  // Timed skills count exactly the part of the step they were active for, so a 10 second
  // Frenzy always gives 100 taps however the steps line up with it.
  const frenzy = activeSeconds(state, 'frenzy', c.now, dt);
  if (frenzy > 0) {
    state.frenzyCarry += C.FRENZY_TAPS_PER_SECOND * frenzy;
    while (state.frenzyCarry >= 1 - 1e-9) {
      state.frenzyCarry = Math.max(0, state.frenzyCarry - 1);
      strike(state, c, 'frenzy');
    }
  } else {
    state.frenzyCarry = 0;
  }
  const rally = activeSeconds(state, 'rally', c.now, dt);
  const amount = baseTeamDps(state, currentTarget(state)) * (dt + rally * (C.RALLY_MULTIPLIER - 1));
  if (amount > 0) damage(state, c, amount);
}

// ---------------------------------------------------------------------------------------
// Skills

export function castSkill(state: GameState, c: Ctx, id: SkillId): boolean {
  if (!skillUnlocked(state, id)) return false;
  const skill = state.skills[id];
  if (c.now < skill.readyAt) return false;
  const def = C.SKILLS[id];
  skill.readyAt = c.now + def.cooldownSeconds * 1000;
  skill.activeUntil = c.now + def.durationSeconds * 1000;
  state.stats.skills += 1;
  bumpQuest(state, 'skills', 1);
  if (id === 'dynamite') {
    const amount = Math.max(
      C.DYNAMITE_TAPS * tapDamage(state, c.now),
      C.DYNAMITE_TEAM_SECONDS * teamDps(state, c.now, currentTarget(state)),
    );
    c.events.push({ type: 'hit', amount, crit: false, source: 'dynamite' });
    damage(state, c, amount);
  }
  return true;
}

export function resetSkills(state: GameState, now: number): boolean {
  const cooling = C.SKILL_IDS.some((id) => skillUnlocked(state, id) && now < state.skills[id].readyAt);
  if (!cooling || state.gems < C.SKILL_RESET_GEMS) return false;
  state.gems -= C.SKILL_RESET_GEMS;
  for (const id of C.SKILL_IDS) state.skills[id].readyAt = Math.min(state.skills[id].readyAt, now);
  return true;
}

// ---------------------------------------------------------------------------------------
// Spending ore

export function levelCost(state: GameState, id: SpeciesId, count: number): number {
  const species = C.speciesOf(id);
  const owned = state.roster[id];
  if (!species || !owned) return Infinity;
  return bulkCost(C.RARITY_STATS[species.rarity].levelCost, C.BALANCE.levelCostGrowth, owned.level - 1, count);
}

export function affordableLevels(state: GameState, id: SpeciesId): number {
  const species = C.speciesOf(id);
  const owned = state.roster[id];
  if (!species || !owned) return 0;
  return maxAffordable(C.RARITY_STATS[species.rarity].levelCost, C.BALANCE.levelCostGrowth, owned.level - 1, state.ore);
}

/** Levels a Lodeling up `amount` times (or as often as affordable). Returns the levels bought. */
export function levelUp(state: GameState, id: SpeciesId, amount: Amount): number {
  const owned = state.roster[id];
  if (!owned) return 0;
  const count = amount === 'max' ? affordableLevels(state, id) : amount;
  if (count <= 0) return 0;
  const cost = levelCost(state, id, count);
  if (cost > state.ore) return 0;
  state.ore -= cost;
  owned.level += count;
  state.stats.levels += count;
  bumpQuest(state, 'levels', count);
  return count;
}

export function gearCost(state: GameState, id: GearId, count: number): number {
  const def = C.GEAR[id];
  if (state.gear[id] + count > def.max) return Infinity;
  return bulkCost(def.base, def.growth, state.gear[id], count);
}

export function affordableGear(state: GameState, id: GearId): number {
  const def = C.GEAR[id];
  return maxAffordable(def.base, def.growth, state.gear[id], state.ore, def.max - state.gear[id]);
}

export function buyGear(state: GameState, id: GearId, amount: Amount): number {
  const count = amount === 'max' ? affordableGear(state, id) : amount;
  if (count <= 0) return 0;
  const cost = gearCost(state, id, count);
  if (cost > state.ore) return 0;
  state.ore -= cost;
  state.gear[id] += count;
  state.stats.gear += count;
  bumpQuest(state, 'gear', count);
  return count;
}

// ---------------------------------------------------------------------------------------
// Team and eggs

export function toggleTeam(state: GameState, id: SpeciesId): boolean {
  if (!state.roster[id]) return false;
  const at = state.team.indexOf(id);
  if (at >= 0) {
    state.team.splice(at, 1);
    return true;
  }
  if (state.team.length >= teamSlots(state)) return false;
  state.team.push(id);
  return true;
}

/** Puts eggs from the basket into empty incubators, oldest first. */
export function autoIncubate(state: GameState, now: number): void {
  for (let slot = 0; slot < state.incubators.length && state.eggs.length > 0; slot++) {
    if (state.incubators[slot] !== null) continue;
    const kind = state.eggs.shift() as EggKind;
    state.incubators[slot] = { kind, startedAt: now, readyAt: now + hatchSeconds(state, kind) * 1000 };
  }
}

export function eggReady(state: GameState, slot: number, now: number): boolean {
  const egg = state.incubators[slot];
  return egg !== null && egg !== undefined && now >= egg.readyAt;
}

export function hatch(state: GameState, c: Ctx, slot: number): SpeciesId | null {
  const egg = state.incubators[slot];
  if (!egg || c.now < egg.readyAt) return null;
  const odds = C.EGGS[egg.kind].odds;
  const species = rollWith(state, (rng) => {
    if (egg.kind === 'starter') return rng.pick(C.STARTER_SPECIES);
    const rarity = rng.weighted(C.RARITIES.map((r) => [r, odds[r]] as const));
    return rng.pick(C.SPECIES.filter((s) => s.rarity === rarity)).id;
  });
  const def = C.speciesOf(species);
  const owned = state.roster[species];
  let gems = 0;
  let isNew = false;
  if (!owned) {
    state.roster[species] = { level: 1, stars: 0 };
    isNew = true;
    if (state.team.length < teamSlots(state)) state.team.push(species);
  } else if (owned.stars < C.MAX_STARS) {
    owned.stars += 1;
  } else if (def) {
    gems = C.RARITY_STATS[def.rarity].maxStarGems;
    state.gems += gems;
  }
  state.incubators[slot] = null;
  state.stats.hatches += 1;
  bumpQuest(state, 'hatches', 1);
  c.events.push({ type: 'hatch', species, isNew, stars: state.roster[species]?.stars ?? 0, gems });
  autoIncubate(state, c.now);
  return species;
}

export function rushEgg(state: GameState, slot: number, seconds: number): boolean {
  const egg = state.incubators[slot];
  if (!egg) return false;
  egg.readyAt -= seconds * 1000;
  return true;
}

export function instantHatchGems(state: GameState, slot: number, now: number): number {
  const egg = state.incubators[slot];
  if (!egg || now >= egg.readyAt) return 0;
  return Math.max(1, Math.ceil((egg.readyAt - now) / 1000 / C.INSTANT_HATCH_SECONDS_PER_GEM));
}

export function finishEggWithGems(state: GameState, slot: number, now: number): boolean {
  const cost = instantHatchGems(state, slot, now);
  const egg = state.incubators[slot];
  if (!egg || cost === 0 || state.gems < cost) return false;
  state.gems -= cost;
  egg.readyAt = now;
  return true;
}

export function buyEgg(state: GameState, kind: EggKind, now: number): boolean {
  const price = C.EGGS[kind].gemPrice;
  if (price === null || state.gems < price || state.eggs.length >= C.EGG_STORAGE) return false;
  state.gems -= price;
  state.eggs.push(kind);
  autoIncubate(state, now);
  return true;
}

export function nextIncubatorPrice(state: GameState): number | null {
  return C.INCUBATOR_PRICES[state.incubators.length - 1] ?? null;
}

export function buyIncubator(state: GameState, now: number): boolean {
  const price = nextIncubatorPrice(state);
  if (price === null || state.gems < price) return false;
  state.gems -= price;
  state.incubators.push(null);
  autoIncubate(state, now);
  return true;
}

// ---------------------------------------------------------------------------------------
// Resurfacing and relics

export function resurfaceDust(state: GameState): number {
  if (state.maxDepth < C.RESURFACE_MIN_DEPTH) return 0;
  const b = C.BALANCE;
  return Math.floor(b.dustScale * (blockHp(state.maxDepth) / blockHp(C.RESURFACE_MIN_DEPTH)) ** b.dustPower);
}

/** Trades this run's depth for Relic Dust and starts again from the top, keeping creatures and gems. */
export function resurface(state: GameState, now: number): number {
  const dust = resurfaceDust(state);
  if (dust <= 0) return 0;
  state.dust += dust;
  state.lifetimeDust += dust;
  state.depth = 1;
  state.block = 0;
  state.hp = blockHp(1);
  state.guardian = null;
  state.farming = false;
  state.maxDepth = 1;
  state.ore = 0;
  for (const id of C.GEAR_IDS) state.gear[id] = 0;
  for (const owned of Object.values(state.roster)) owned.level = 1;
  for (const id of C.SKILL_IDS) state.skills[id] = { readyAt: now, activeUntil: 0 };
  state.frenzyCarry = 0;
  state.stats.resurfaces += 1;
  return dust;
}

export function relicCost(state: GameState, id: RelicId): number {
  const def = C.RELICS[id];
  if (state.relics[id] >= def.max) return Infinity;
  return Math.ceil(def.base * def.growth ** state.relics[id]);
}

export function buyRelic(state: GameState, id: RelicId): boolean {
  const cost = relicCost(state, id);
  if (cost > state.dust) return false;
  state.dust -= cost;
  state.relics[id] += 1;
  return true;
}

// ---------------------------------------------------------------------------------------
// Offline time

/** What the team earned while the game was closed. Mining continues at the current depth. */
export function offlineEarnings(state: GameState, now: number): OfflineReport | null {
  const gap = (now - state.lastSeenAt) / 1000;
  if (!(gap >= C.OFFLINE_MIN_SECONDS)) return null;
  const seconds = Math.min(gap, offlineCapSeconds(state));
  const perSecond = idleOrePerSecond(state, now) * C.OFFLINE_EFFICIENCY;
  const blessed = Math.min(Math.max((state.blessingUntil - state.lastSeenAt) / 1000, 0), seconds);
  const ore = perSecond * (seconds + blessed * (C.BLESSING_MULTIPLIER - 1));
  const rocks = (teamDps(state, now, null) * seconds * C.OFFLINE_EFFICIENCY) / blockHp(state.depth);
  const expected = rocks * eggChance(state);
  const found = Math.floor(expected) + (roll(state, expected - Math.floor(expected)) ? 1 : 0);
  const room = Math.max(0, C.EGG_STORAGE - state.eggs.length);
  const eggs: EggKind[] = new Array<EggKind>(Math.min(found, C.OFFLINE_MAX_EGGS, room)).fill('pebble');
  return { seconds, ore, eggs };
}

/**
 * Called when the game starts or wakes up after a long gap. A Guardian fight that ran out
 * meanwhile is lost; earnings wait in state.offline until the player collects them.
 */
export function returnFromOffline(state: GameState, c: Ctx): OfflineReport | null {
  if (state.guardian && c.now >= state.guardian.endsAt) loseGuardian(state, c);
  const report = offlineEarnings(state, c.now);
  state.lastSeenAt = Math.max(state.lastSeenAt, c.now);
  if (!report) return null;
  state.offline = state.offline
    ? {
        seconds: state.offline.seconds + report.seconds,
        ore: state.offline.ore + report.ore,
        eggs: [...state.offline.eggs, ...report.eggs].slice(0, C.OFFLINE_MAX_EGGS),
      }
    : report;
  return state.offline;
}

export function collectOffline(state: GameState, now: number, doubled: boolean): OfflineReport | null {
  const report = state.offline;
  if (!report) return null;
  earnOre(state, report.ore * (doubled ? 2 : 1));
  for (const egg of report.eggs) if (state.eggs.length < C.EGG_STORAGE) state.eggs.push(egg);
  state.offline = null;
  autoIncubate(state, now);
  return report;
}

// ---------------------------------------------------------------------------------------
// Daily reward, quests and achievements

export function dailyRewardReady(state: GameState, day: string): boolean {
  return isNewDay(state.daily.claimDay, day);
}

export function nextDailyReward(state: GameState): C.DailyReward {
  return C.DAILY_REWARDS[state.daily.claims % C.DAILY_REWARDS.length] as C.DailyReward;
}

export function claimDaily(state: GameState, c: Ctx): C.DailyReward | null {
  if (!dailyRewardReady(state, c.day)) return null;
  const reward = nextDailyReward(state);
  if (reward.kind === 'gems') state.gems += reward.amount;
  if (reward.kind === 'ore_minutes') earnOre(state, Math.max(5000, idleOrePerSecond(state, c.now) * 60 * reward.minutes));
  if (reward.kind === 'egg') {
    if (state.eggs.length < C.EGG_STORAGE) {
      state.eggs.push(reward.egg);
      autoIncubate(state, c.now);
    } else {
      state.gems += Math.ceil((C.EGGS[reward.egg].gemPrice ?? 30) / 3);
    }
  }
  state.daily.claimDay = c.day;
  state.daily.claims += 1;
  return reward;
}

/** Gives the player a fresh set of daily quests when the day has changed. */
export function refreshQuests(state: GameState, day: string): boolean {
  if (state.daily.questDay === day) return false;
  const rng = new Rng(hashString(`${day}:${Math.floor(state.createdAt)}`));
  const pool = [...C.QUEST_METRICS];
  const quests: Quest[] = [];
  while (quests.length < C.QUESTS_PER_DAY && pool.length > 0) {
    const metric = pool.splice(rng.int(pool.length), 1)[0] as QuestMetric;
    quests.push({ metric, target: C.QUEST_TARGETS[metric], progress: 0, claimed: false });
  }
  state.daily.questDay = day;
  state.daily.quests = quests;
  state.daily.bonusClaimed = false;
  return true;
}

export function bumpQuest(state: GameState, metric: QuestMetric, amount: number): void {
  for (const quest of state.daily.quests) {
    if (quest.metric === metric) quest.progress = Math.min(quest.target, quest.progress + amount);
  }
}

export function claimQuest(state: GameState, index: number): boolean {
  const quest = state.daily.quests[index];
  if (!quest || quest.claimed || quest.progress < quest.target) return false;
  quest.claimed = true;
  state.gems += C.QUEST_GEMS;
  return true;
}

export function questBonusReady(state: GameState): boolean {
  return !state.daily.bonusClaimed && state.daily.quests.length > 0 && state.daily.quests.every((q) => q.claimed);
}

export function claimQuestBonus(state: GameState, now: number): boolean {
  if (!questBonusReady(state)) return false;
  state.daily.bonusClaimed = true;
  state.gems += C.QUEST_BONUS_GEMS;
  if (state.eggs.length < C.EGG_STORAGE) {
    state.eggs.push('pebble');
    autoIncubate(state, now);
  } else {
    state.gems += 10;
  }
  return true;
}

export function achievementValue(state: GameState, id: C.AchievementId): number {
  switch (id) {
    case 'blocks':
      return state.stats.blocks;
    case 'depth':
      return state.bestDepth;
    case 'guardians':
      return state.stats.guardians;
    case 'hatches':
      return state.stats.hatches;
    case 'species':
      return Object.keys(state.roster).length;
    case 'taps':
      return state.stats.taps;
    case 'resurfaces':
      return state.stats.resurfaces;
  }
}

/** The next tier's target, or null when every tier is claimed. */
export function achievementTarget(state: GameState, id: C.AchievementId): number | null {
  return C.ACHIEVEMENTS[id].tiers[state.achievements[id]] ?? null;
}

export function achievementReady(state: GameState, id: C.AchievementId): boolean {
  const target = achievementTarget(state, id);
  return target !== null && achievementValue(state, id) >= target;
}

export function claimAchievement(state: GameState, id: C.AchievementId): number {
  if (!achievementReady(state, id)) return 0;
  const gems = C.ACHIEVEMENTS[id].gems[state.achievements[id]] ?? 0;
  state.achievements[id] += 1;
  state.gems += gems;
  return gems;
}

// ---------------------------------------------------------------------------------------
// Rewarded ads

function rollAdDay(state: GameState, day: string): void {
  if (state.ads.day === day) return;
  state.ads.day = day;
  state.ads.total = 0;
  state.ads.interstitials = 0;
  for (const p of C.AD_PLACEMENTS) state.ads.counts[p] = 0;
}

export function adsLeft(state: GameState, placement: AdPlacement, day: string): number {
  const fresh = state.ads.day !== day;
  const used = fresh ? 0 : state.ads.counts[placement];
  const total = fresh ? 0 : state.ads.total;
  return Math.max(0, Math.min(C.AD_DAILY_LIMITS[placement] - used, C.AD_REWARDED_DAILY_TOTAL - total));
}

/** Whether a rewarded ad for this placement would do something right now. */
export function adOffered(state: GameState, placement: AdPlacement, c: Pick<Ctx, 'now' | 'day'>, slot = 0): boolean {
  if (adsLeft(state, placement, c.day) <= 0) return false;
  switch (placement) {
    case 'offline_double':
      return state.offline !== null && state.offline.ore > 0;
    case 'guardian_retry':
      return state.farming && state.guardian === null && isGuardianDepth(state.depth);
    case 'egg_rush': {
      const egg = state.incubators[slot];
      return egg !== null && egg !== undefined && c.now < egg.readyAt;
    }
    case 'blessing':
      // Offered while another 15 minutes still fit under the one-hour cap.
      return state.blessingUntil - c.now <= (C.BLESSING_MAX_SECONDS - C.BLESSING_SECONDS) * 1000;
    case 'gem_crate':
      return true;
  }
}

/**
 * Gives the reward for a watched rewarded ad. Call only after the ad network confirmed the
 * reward. offline_double is applied by collectOffline(doubled = true) right after.
 */
export function grantAdReward(state: GameState, c: Ctx, placement: AdPlacement, slot = 0): boolean {
  if (!adOffered(state, placement, c, slot)) return false;
  rollAdDay(state, c.day);
  state.ads.counts[placement] += 1;
  state.ads.total += 1;
  state.ads.lastRewardedAt = c.now;
  switch (placement) {
    case 'offline_double':
      collectOffline(state, c.now, true);
      break;
    case 'guardian_retry':
      startGuardian(state, c, C.GUARDIAN_RETRY_BONUS_SECONDS);
      break;
    case 'egg_rush':
      rushEgg(state, slot, C.EGG_RUSH_SECONDS);
      break;
    case 'blessing':
      state.blessingUntil = Math.min(Math.max(state.blessingUntil, c.now) + C.BLESSING_SECONDS * 1000, c.now + C.BLESSING_MAX_SECONDS * 1000);
      break;
    case 'gem_crate':
      state.gems += C.GEM_CRATE_GEMS;
      break;
  }
  return true;
}

export interface InterstitialRules {
  minBestDepth: number;
  minSessionMs: number;
  minGapMs: number;
  afterRewardedMs: number;
  maxPerDay: number;
}

export const INTERSTITIAL_RULES: InterstitialRules = {
  minBestDepth: 12,
  minSessionMs: 5 * 60_000,
  minGapMs: 5 * 60_000,
  afterRewardedMs: 2 * 60_000,
  maxPerDay: 10,
};

/** Interstitials only at natural breaks, rarely, never early and never for Remove Ads owners. */
export function interstitialAllowed(state: GameState, c: Pick<Ctx, 'now' | 'day'>, sessionStartedAt: number, rules = INTERSTITIAL_RULES): boolean {
  if (hasEntitlement(state, 'remove_ads')) return false;
  if (state.bestDepth < rules.minBestDepth) return false;
  if (c.now - sessionStartedAt < rules.minSessionMs) return false;
  if (c.now - state.ads.lastInterstitialAt < rules.minGapMs) return false;
  if (c.now - state.ads.lastRewardedAt < rules.afterRewardedMs) return false;
  const shownToday = state.ads.day === c.day ? state.ads.interstitials : 0;
  return shownToday < rules.maxPerDay;
}

export function recordInterstitial(state: GameState, c: Pick<Ctx, 'now' | 'day'>): void {
  rollAdDay(state, c.day);
  state.ads.interstitials += 1;
  state.ads.lastInterstitialAt = c.now;
}

// ---------------------------------------------------------------------------------------
// Purchases. The server decides what was paid; these only apply its answers.

/**
 * Applies one wallet settlement from the server: currencies moved from the server wallet into
 * this save. Each settlement id is applied at most once, so a repeated answer grants nothing.
 */
export function applySettlement(state: GameState, id: string, amounts: Readonly<Record<string, number>>, now: number, at = now): boolean {
  if (state.shop.settled.some((s) => s.id === id)) return false;
  const applied: Record<string, number> = {};
  for (const [currency, amount] of Object.entries(amounts)) {
    if (!Number.isSafeInteger(amount) || amount === 0) continue;
    applied[currency] = amount;
    if (currency === 'gems') state.gems += amount;
    const egg = /^egg_(pebble|geode|prism)$/.exec(currency)?.[1] as EggKind | undefined;
    if (egg) {
      if (amount > 0) for (let i = 0; i < amount; i++) state.eggs.push(egg);
      else for (let i = 0; i < -amount; i++) {
        const at = state.eggs.lastIndexOf(egg);
        if (at >= 0) state.eggs.splice(at, 1);
      }
    }
  }
  state.shop.settled = [...state.shop.settled, { id, amounts: applied, at }].sort((a, b) => a.at - b.at).slice(-SETTLED_KEEP);
  autoIncubate(state, now);
  return true;
}

/**
 * Applies the settlements `from` received that `into` did not, so that when one save replaces
 * another (a cloud save from another phone, or a pasted one), nothing bought on either is lost.
 * Returns how many it applied.
 */
export function mergeSettlements(into: GameState, from: GameState, now: number): number {
  const known = new Set(into.shop.settled.map((s) => s.id));
  // A full list has dropped its oldest entries, and `from` may still list those.
  const oldest = into.shop.settled.length >= SETTLED_KEEP ? Math.min(...into.shop.settled.map((s) => s.at)) : Number.NEGATIVE_INFINITY;
  let applied = 0;
  for (const s of from.shop.settled) {
    if (known.has(s.id) || s.at < oldest) continue;
    if (applySettlement(into, s.id, s.amounts, now, s.at)) applied += 1;
  }
  return applied;
}

export function setEntitlements(state: GameState, entitlements: readonly string[]): void {
  state.shop.entitlements = C.ENTITLEMENTS.filter((e) => entitlements.includes(e));
}
