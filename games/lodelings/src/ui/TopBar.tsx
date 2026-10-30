import type { JSX } from 'preact';
import { Icon } from '../art/Icon.js';
import * as R from '../sim/rules.js';
import { useView } from './view.js';

export function TopBar(): JSX.Element {
  const { game, s, t, fmt, now, ui } = useView();
  const claimable = game.claimable();
  const showDust = s.lifetimeDust > 0 || s.bestDepth >= 25;
  return (
    <header class="topbar">
      <div class="res res--ore" data-testid="ore">
        <Icon name="ore" size={22} />
        <span class="res__value">{fmt(s.ore)}</span>
        <span class="res__rate">{t('res.perSecond', { value: fmt(R.idleOrePerSecond(s, now)) })}</span>
      </div>
      <div class="res res--gem" data-testid="gems">
        <Icon name="gem" size={20} />
        <span class="res__value">{fmt(s.gems)}</span>
      </div>
      {showDust && (
        <div class="res res--dust" data-testid="dust">
          <Icon name="dust" size={20} />
          <span class="res__value">{fmt(s.dust)}</span>
        </div>
      )}
      <div class="topbar__actions">
        <button
          type="button"
          class="iconbtn"
          aria-label={t('daily.title')}
          data-testid="open-rewards"
          onClick={() => {
            ui.open({ kind: 'rewards', tab: R.dailyRewardReady(s, game.today()) ? 'daily' : 'quests' });
          }}
        >
          <Icon name="gift" size={26} />
          {claimable > 0 && <span class="g1-badge">{claimable > 9 ? '9+' : claimable}</span>}
        </button>
        <button
          type="button"
          class="iconbtn"
          aria-label={t('settings.title')}
          data-testid="open-settings"
          onClick={() => {
            ui.open({ kind: 'settings' });
          }}
        >
          <Icon name="gear" size={24} />
        </button>
      </div>
    </header>
  );
}
