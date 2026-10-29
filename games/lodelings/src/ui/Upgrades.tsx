import { Button, Segmented } from '@game1/ui';
import type { JSX } from 'preact';
import { Icon } from '../art/Icon.js';
import { LodelingArt } from '../art/LodelingArt.js';
import { GEAR, GEAR_IDS, speciesOf, type GearId, type SpeciesId } from '../sim/content.js';
import * as R from '../sim/rules.js';
import type { GameState } from '../sim/state.js';
import { useView, type BuyAmount, type View } from './view.js';

export function BuyAmountPicker(): JSX.Element {
  const { t, ui } = useView();
  return (
    <Segmented<BuyAmount>
      value={ui.buyAmount}
      onChange={ui.setBuyAmount}
      options={[
        { value: 1, label: t('buy.one'), testId: 'amount-1' },
        { value: 10, label: t('buy.ten'), testId: 'amount-10' },
        { value: 'max', label: t('buy.max'), testId: 'amount-max' },
      ]}
    />
  );
}

export function BuyLabel(props: { count: number; cost: number; fmt: (n: number) => string; label: string; currency?: 'ore' | 'gem' | 'dust' }): JSX.Element {
  return (
    <span class="buy">
      <span class="buy__what">{props.count > 1 ? `+${props.count}` : props.label}</span>
      <span class="buy__cost">
        <Icon name={props.currency ?? 'ore'} size={14} />
        {Number.isFinite(props.cost) ? props.fmt(props.cost) : '-'}
      </span>
    </span>
  );
}

/** How many to buy for the chosen amount: "max" shows at least the next one. */
export function levelsToBuy(amount: BuyAmount, affordable: number, room = Infinity): number {
  const wanted = amount === 'max' ? Math.max(1, affordable) : amount;
  return Math.max(0, Math.min(wanted, room));
}

export function LevelRow(props: { id: SpeciesId }): JSX.Element | null {
  const { game, s, t, fmt, ui } = useView();
  const owned = s.roster[props.id];
  const species = speciesOf(props.id);
  if (!owned || !species) return null;
  const count = levelsToBuy(ui.buyAmount, R.affordableLevels(s, props.id));
  const cost = R.levelCost(s, props.id, count);
  return (
    <div class="card row-card" data-testid={`level-row-${props.id}`}>
      <button
        type="button"
        class="row-card__art"
        aria-label={species.name}
        onClick={() => {
          ui.open({ kind: 'lodeling', id: props.id });
        }}
      >
        <LodelingArt species={species} size={48} />
      </button>
      <div class="row-card__body">
        <div class="row-card__title">
          {species.name} <span class="lv">{t('level.short', { level: owned.level })}</span>
        </div>
        <div class="row-card__sub">
          {t('lodeling.dps', { value: fmt(R.lodelingDps(s, props.id)) })} <span class="next">→ {fmt(R.lodelingDps(s, props.id, owned.level + count))}</span>
        </div>
      </div>
      <Button small repeat disabled={cost > s.ore || game.busy} testId={`level-${props.id}`} onPress={() => game.levelUp(props.id, ui.buyAmount) > 0}>
        <BuyLabel count={count} cost={cost} fmt={fmt} label={t('lodeling.levelUp')} />
      </Button>
    </div>
  );
}

/** The number a gear upgrade changes, at a given level. */
function gearValue(view: View, id: GearId, level: number): string {
  const { s, fmt, now } = view;
  switch (id) {
    case 'pick':
      return fmt(R.tapDamage(s, now, level));
    case 'lamp':
      return `${Math.round(R.critChance(s, level) * 100)}%`;
    case 'cart':
      return `${15 * level}%`;
    case 'echo':
      return `${2 * level}%`;
  }
}

function GearRow(props: { id: GearId }): JSX.Element {
  const view = useView();
  const { game, s, t, fmt, ui } = view;
  const id = props.id;
  const def = GEAR[id];
  const level = s.gear[id];
  const room = def.max - level;
  const count = levelsToBuy(ui.buyAmount, R.affordableGear(s, id), room);
  const cost = count > 0 ? R.gearCost(s, id, count) : Infinity;
  const maxed = room <= 0;
  return (
    <div class="card row-card" data-testid={`gear-row-${id}`}>
      <div class="row-card__art row-card__art--icon">
        <Icon name={id} size={34} />
      </div>
      <div class="row-card__body">
        <div class="row-card__title">
          {t(`gear.${id}`)} <span class="lv">{maxed ? t('level.max') : t('level.short', { level })}</span>
        </div>
        <div class="row-card__sub">
          {t(`gear.${id}.effect`, { value: gearValue(view, id, level) })}
          {!maxed && <span class="next"> → {gearValue(view, id, level + count)}</span>}
        </div>
      </div>
      {maxed ? (
        <span class="maxed">{t('level.max')}</span>
      ) : (
        <Button small repeat disabled={cost > s.ore || game.busy} testId={`gear-${id}`} onPress={() => game.buyGear(id, ui.buyAmount) > 0}>
          <BuyLabel count={count} cost={cost} fmt={fmt} label={t('lodeling.levelUp')} />
        </Button>
      )}
    </div>
  );
}

function teamLevelsAffordable(s: GameState): boolean {
  return s.team.some((id) => R.levelCost(s, id, 1) <= s.ore);
}

export function Upgrades(): JSX.Element {
  const { s, t } = useView();
  return (
    <div class="list">
      <BuyAmountPicker />
      <h3 class="section">
        {t('team.title', { used: s.team.length, slots: R.teamSlots(s) })}
        {teamLevelsAffordable(s) && <Icon name="up" size={16} />}
      </h3>
      {s.team.length === 0 && <p class="muted">{t('team.empty')}</p>}
      {s.team.map((id) => (
        <LevelRow key={id} id={id} />
      ))}
      <h3 class="section">{t('upgrades.gear')}</h3>
      {GEAR_IDS.map((id) => (
        <GearRow key={id} id={id} />
      ))}
    </div>
  );
}
