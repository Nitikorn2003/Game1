import { Button, ProgressBar } from '@game1/ui';
import { formatNumber } from '@game1/engine';
import type { CSSProperties, JSX } from 'preact';
import { useEffect, useRef } from 'preact/hooks';
import { GuardianArt } from '../art/GuardianArt.js';
import { Icon } from '../art/Icon.js';
import { LodelingArt } from '../art/LodelingArt.js';
import { RockArt } from '../art/RockArt.js';
import { ELEMENT_COLORS } from '../art/palette.js';
import * as C from '../sim/content.js';
import * as R from '../sim/rules.js';
import type { GameState } from '../sim/state.js';
import { useView, type View } from './view.js';

const MAX_FLOATS = 14;

function spawnFloat(layer: HTMLElement, text: string, kind: string): void {
  if (layer.childElementCount >= MAX_FLOATS) layer.firstElementChild?.remove();
  const el = document.createElement('span');
  el.className = `float ${kind}`;
  el.textContent = text;
  el.style.setProperty('--dx', `${Math.round((Math.random() - 0.5) * 140)}px`);
  el.style.setProperty('--dy', `${Math.round(-40 - Math.random() * 50)}px`);
  el.addEventListener('animationend', () => {
    el.remove();
  });
  layer.append(el);
}

function spawnChips(layer: HTMLElement, hue: number, count: number): void {
  for (let i = 0; i < count; i++) {
    if (layer.childElementCount >= MAX_FLOATS * 2) return;
    const el = document.createElement('span');
    el.className = 'chip';
    const angle = (Math.PI * 2 * (i + Math.random() * 0.6)) / count;
    const reach = 60 + Math.random() * 60;
    el.style.setProperty('--dx', `${Math.round(Math.cos(angle) * reach)}px`);
    el.style.setProperty('--dy', `${Math.round(Math.sin(angle) * reach * 0.7 - 20)}px`);
    el.style.setProperty('--hue', String(hue));
    el.addEventListener('animationend', () => {
      el.remove();
    });
    layer.append(el);
  }
}

function squash(el: HTMLElement): void {
  if (typeof el.animate !== 'function') return;
  el.animate([{ transform: 'scale(0.92, 0.9) translateY(4px)' }, { transform: 'none' }], { duration: 120, easing: 'ease-out' });
}

function tutorialHint(view: View): JSX.Element | null {
  const { s, t } = view;
  let text: string | null = null;
  if (s.stats.taps < 5) text = t('tutorial.tap');
  else if (Object.keys(s.roster).length === 0) text = t('tutorial.egg');
  else if (s.guardian && s.stats.guardians === 0) text = t('tutorial.guardian');
  else if (s.stats.levels === 0 && s.team.some((id) => R.levelCost(s, id, 1) <= s.ore)) text = t('tutorial.level');
  if (!text) return null;
  return (
    <div class="hint" key={text} data-testid="hint">
      {text}
    </div>
  );
}

function blockPips(s: GameState): JSX.Element {
  const guardianDepth = R.isGuardianDepth(s.depth);
  return (
    <div class="pips" aria-hidden="true">
      {Array.from({ length: C.BLOCKS_PER_DEPTH }, (_, i) => {
        const isGuardian = guardianDepth && i === C.BLOCKS_PER_DEPTH - 1;
        const state = i < s.block ? 'done' : i === s.block ? 'now' : 'todo';
        return <span key={i} class={`pip pip--${state} ${isGuardian ? 'pip--guardian' : ''}`} />;
      })}
    </div>
  );
}

export function Scene(): JSX.Element {
  const view = useView();
  const { game, s, t, fmt, now, time } = view;
  const target = useRef<HTMLDivElement>(null);
  const layer = useRef<HTMLDivElement>(null);
  const { biome, cycle } = R.biomeAt(s.depth);

  useEffect(
    () =>
      game.events.on('sim', (events) => {
        const box = layer.current;
        if (!box) return;
        const state = game.state;
        const f = (value: number) => formatNumber(value, state.settings.numbers);
        const hue = R.biomeAt(state.depth).biome.veinHue;
        let hits = 0;
        for (const e of events) {
          if (e.type === 'hit') {
            if (hits++ < 3) spawnFloat(box, f(e.amount), e.crit ? 'float--crit' : e.source === 'dynamite' ? 'float--boom' : 'float--hit');
            if (e.source !== 'frenzy' && target.current) squash(target.current);
          } else if (e.type === 'block') {
            spawnChips(box, hue, 5);
            spawnFloat(box, `+${f(e.ore)}`, 'float--ore');
          } else if (e.type === 'guardian_won') {
            spawnChips(box, hue, 12);
            spawnFloat(box, `+${f(e.ore)}`, 'float--ore float--big');
          }
        }
      }),
    [game],
  );

  const guardian = s.guardian;
  const element = guardian ? R.guardianElement(s.depth) : null;
  const maxHp = guardian ? guardian.maxHp : R.blockHp(s.depth);
  const health = Math.max(0, Math.min(1, s.hp / maxHp));
  const seed = s.depth * 16 + s.block;
  const blessing = Math.max(0, (s.blessingUntil - now) / 1000);
  const style: CSSProperties = { '--sky': biome.skyHue, '--rock': biome.rockHue, '--vein': biome.veinHue };
  const challengeable = s.farming && !guardian && R.isGuardianDepth(s.depth);

  return (
    <section class={`scene ${guardian ? 'scene--guardian' : ''}`} style={style} data-testid="scene">
      <div class="scene__head">
        <div class="depth" data-testid="depth">
          <strong>{t('depth.label', { depth: s.depth })}</strong>
          <span>
            {t(`biome.${biome.id}` as 'biome.rootworn')}
            {cycle > 0 && ` · ${t('depth.cycle', { cycle: cycle + 1 })}`}
          </span>
        </div>
        {blockPips(s)}
        {blessing > 0 && (
          <div class="blessing" data-testid="blessing">
            <Icon name="star" size={14} /> {t('scene.blessing', { time: time(blessing) })}
          </div>
        )}
      </div>

      {guardian && element && (
        <div class="guardian-info">
          <span class="guardian-info__name">{R.guardianName(s.depth)}</span>
          <span class="chip-el" style={{ '--el': ELEMENT_COLORS[element].main }}>
            {t(`element.${element}`)}
          </span>
          <span class="guardian-info__weak">{t('scene.weakTo', { element: t(`element.${C.weaknessOf(element)}`) })}</span>
        </div>
      )}

      <div
        class={`target ${s.stats.taps < 5 ? 'target--hint' : ''}`}
        ref={target}
        role="button"
        tabIndex={0}
        aria-label={t('scene.tapHint')}
        data-testid="rock"
        onPointerDown={(e) => {
          if (e.button > 0) return;
          e.preventDefault();
          game.tap();
        }}
        onKeyDown={(e) => {
          if (e.key === ' ' || e.key === 'Enter') {
            e.preventDefault();
            if (!e.repeat) game.tap();
          }
        }}
      >
        {guardian && element ? (
          <div class="target__art target__art--guardian" key={`g${s.depth}`}>
            <GuardianArt depth={s.depth} element={element} rockHue={biome.rockHue} health={health} size={220} />
          </div>
        ) : (
          <div class="target__art" key={`r${seed}`}>
            <RockArt seed={seed} rockHue={biome.rockHue} veinHue={biome.veinHue} health={health} size={200} />
          </div>
        )}
        <div class="fx" ref={layer} aria-hidden="true" />
      </div>

      <div class="hpbar">
        <ProgressBar value={health} label={t('scene.guardian')} from={guardian ? '#ff5a5a' : '#ff9f5a'} to={guardian ? '#ff9a6b' : '#ffd166'} />
        <span class="hpbar__text">
          {fmt(Math.max(0, s.hp))} / {fmt(maxHp)}
        </span>
      </div>

      {guardian && <GuardianTimer endsAt={guardian.endsAt} total={R.guardianSeconds(s) + (guardian.retried ? C.GUARDIAN_RETRY_BONUS_SECONDS : 0)} />}

      {challengeable && (
        <div class="farming" data-testid="farming">
          <p>{t('scene.farming')}</p>
          <div class="row">
            <Button
              small
              testId="challenge"
              onPress={() => {
                game.challengeGuardian();
              }}
            >
              <Icon name="sword" size={18} /> {t('scene.challenge')}
            </Button>
            {game.adOffered('guardian_retry') && (
              <Button
                small
                variant="ad"
                testId="retry-ad"
                disabled={game.busy}
                onPress={() => {
                  void game.watchAd('guardian_retry');
                }}
              >
                <Icon name="play" size={18} /> {t('scene.retryAd')}
              </Button>
            )}
          </div>
        </div>
      )}

      <div class="team" aria-label={t('team.title', { used: s.team.length, slots: R.teamSlots(s) })}>
        {s.team.map((id, i) => {
          const species = C.speciesOf(id);
          const mult = species && element ? C.elementMultiplier(species.element, element) : 1;
          return (
            <div class={`member ${R.skillActive(s, 'rally', now) ? 'member--rally' : ''}`} key={id} style={{ '--i': i }}>
              <LodelingArt species={id} size={46} />
              {mult !== 1 && <span class={`member__mult ${mult > 1 ? 'member__mult--up' : 'member__mult--down'}`}>{mult > 1 ? '▲' : '▼'}</span>}
            </div>
          );
        })}
      </div>

      {tutorialHint(view)}
    </section>
  );
}

function GuardianTimer(props: { endsAt: number; total: number }): JSX.Element {
  const { now, t } = useView();
  const left = Math.max(0, (props.endsAt - now) / 1000);
  return (
    <div class="timer" data-testid="guardian-timer">
      <Icon name="clock" size={16} />
      <ProgressBar value={left / props.total} label={t('scene.guardian')} from="#63d3ff" to="#c89bff" />
      <span class={left < 5 ? 'timer__left timer__left--low' : 'timer__left'}>{Math.ceil(left)}</span>
    </div>
  );
}
