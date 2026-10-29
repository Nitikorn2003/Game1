import { Button } from '@game1/ui';
import type { JSX } from 'preact';
import { Icon } from '../art/Icon.js';
import { BALANCE, RELICS, RELIC_IDS, RESURFACE_MIN_DEPTH, type RelicId } from '../sim/content.js';
import * as R from '../sim/rules.js';
import { useView } from './view.js';

/** What a relic gives at a level, as shown in its effect line. */
export function relicValue(id: RelicId, level: number, time: (seconds: number) => string): string {
  const total = RELICS[id].perLevel * level;
  if (id === 'hourglass' || id === 'bane') return time(total);
  return `${Math.round(total * 100)}%`;
}

function RelicRow(props: { id: RelicId }): JSX.Element {
  const { game, s, t, fmt, time } = useView();
  const id = props.id;
  const level = s.relics[id];
  const def = RELICS[id];
  const maxed = level >= def.max;
  const cost = R.relicCost(s, id);
  return (
    <div class="card row-card" data-testid={`relic-row-${id}`}>
      <div class={`row-card__art row-card__art--icon relic-art relic-art--${id}`}>
        <Icon name="relic" size={34} />
      </div>
      <div class="row-card__body">
        <div class="row-card__title">
          {t(`relic.${id}`)} <span class="lv">{maxed ? t('level.max') : t('level.short', { level })}</span>
        </div>
        <div class="row-card__sub">
          {t(`relic.${id}.effect`, { value: relicValue(id, level, time) })}
          {!maxed && <span class="next"> → {relicValue(id, level + 1, time)}</span>}
        </div>
      </div>
      {maxed ? (
        <span class="maxed">{t('level.max')}</span>
      ) : (
        <Button
          small
          testId={`relic-${id}`}
          disabled={cost > s.dust}
          onPress={() => {
            game.buyRelic(id);
          }}
        >
          <span class="buy">
            <span class="buy__what">{t('lodeling.levelUp')}</span>
            <span class="buy__cost">
              <Icon name="dust" size={14} />
              {fmt(cost)}
            </span>
          </span>
        </Button>
      )}
    </div>
  );
}

export function Relics(): JSX.Element {
  const { s, t, fmt, ui } = useView();
  const dust = R.resurfaceDust(s);
  const bonus = Math.round(BALANCE.dustDamageBonus * 100);
  return (
    <div class="list">
      <div class="card resurface-card">
        <h3>{t('resurface.title')}</h3>
        {dust > 0 ? <p>{t('resurface.gain', { dust: fmt(dust) })}</p> : <p class="muted">{t('resurface.locked', { depth: RESURFACE_MIN_DEPTH })}</p>}
        <p class="small muted">{t('resurface.bonus', { value: `${bonus}%`, total: `${fmt(s.lifetimeDust * bonus)}%` })}</p>
        <Button
          block
          disabled={dust <= 0}
          testId="open-resurface"
          onPress={() => {
            ui.open({ kind: 'resurface' });
          }}
        >
          <Icon name="up" size={18} /> {t('resurface.title')}
        </Button>
      </div>
      <div class="balance" data-testid="dust-balance">
        <Icon name="dust" size={20} /> {fmt(s.dust)} {t('res.dust')}
      </div>
      {RELIC_IDS.map((id) => (
        <RelicRow key={id} id={id} />
      ))}
    </div>
  );
}
