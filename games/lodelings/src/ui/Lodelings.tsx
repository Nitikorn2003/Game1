import type { JSX } from 'preact';
import { Icon } from '../art/Icon.js';
import { LodelingArt } from '../art/LodelingArt.js';
import { ELEMENT_COLORS } from '../art/palette.js';
import * as C from '../sim/content.js';
import * as R from '../sim/rules.js';
import { useView } from './view.js';

export function Stars(props: { count: number }): JSX.Element {
  return (
    <span class="stars" aria-label={`${props.count}/${C.MAX_STARS}`}>
      {Array.from({ length: C.MAX_STARS }, (_, i) => (
        <span key={i} class={i < props.count ? 'star star--on' : 'star'}>
          ★
        </span>
      ))}
    </span>
  );
}

export function ElementDot(props: { element: C.Element }): JSX.Element {
  return <span class="el-dot" style={{ background: ELEMENT_COLORS[props.element].main }} aria-hidden="true" />;
}

export function Lodelings(): JSX.Element {
  const { s, t, ui } = useView();
  const slots = R.teamSlots(s);
  const found = Object.keys(s.roster).length;
  const allSlots = C.TEAM_SLOTS_BASE + C.TEAM_SLOT_DEPTHS.length;
  return (
    <div class="list">
      <h3 class="section">{t('team.title', { used: s.team.length, slots })}</h3>
      <p class="muted small">{t('team.hint')}</p>
      <div class="team-slots">
        {Array.from({ length: allSlots }, (_, i) => {
          if (i >= slots) {
            return (
              <div class="slot slot--locked" key={i}>
                <Icon name="lock" size={20} />
                <span>{t('depth.label', { depth: C.TEAM_SLOT_DEPTHS[i - C.TEAM_SLOTS_BASE] ?? 0 })}</span>
              </div>
            );
          }
          const id = s.team[i];
          if (!id) return <div class="slot slot--empty" key={i} />;
          return (
            <button
              type="button"
              class="slot"
              key={id}
              data-testid={`team-slot-${i}`}
              onClick={() => {
                ui.open({ kind: 'lodeling', id });
              }}
            >
              <LodelingArt species={id} size={54} />
            </button>
          );
        })}
      </div>
      <h3 class="section">{t('collection.title', { found, total: C.SPECIES.length })}</h3>
      {found === 0 && <p class="muted">{t('team.empty')}</p>}
      <div class="dex-grid">
        {C.SPECIES.map((sp) => {
          const owned = s.roster[sp.id];
          if (!owned) {
            return (
              <div class="dex dex--unknown" key={sp.id}>
                <LodelingArt species={sp} size={56} hidden />
                <span class="dex__name">{t('collection.unknown')}</span>
                <span class={`dex__rarity rarity--${sp.rarity}`}>{t(`rarity.${sp.rarity}`)}</span>
              </div>
            );
          }
          return (
            <button
              type="button"
              key={sp.id}
              class={`dex rarity-frame--${sp.rarity} ${s.team.includes(sp.id) ? 'dex--team' : ''}`}
              data-testid={`dex-${sp.id}`}
              onClick={() => {
                ui.open({ kind: 'lodeling', id: sp.id });
              }}
            >
              <LodelingArt species={sp} size={56} />
              <span class="dex__name">
                <ElementDot element={sp.element} /> {sp.name}
              </span>
              <Stars count={owned.stars} />
              <span class="dex__lv">{t('level.short', { level: owned.level })}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
