import { Button, useBackHandler } from '@game1/ui';
import type { JSX, RefObject } from 'preact';
import { useEffect, useLayoutEffect, useRef, useState } from 'preact/hooks';
import { STOPS_PER_CANAL, type Mode, type Tool } from '../sim/content.js';
import type { Layout } from '../sim/layouts.js';
import * as R from '../sim/rules.js';
import type { Deal } from '../sim/state.js';
import { EXTRA_CARDS, isFree, STREAK_BONUS, STREAK_EVERY, topCard } from '../sim/table.js';
import { placeOf } from '../sim/trip.js';
import { Back, Face } from './Card.js';
import { Icon, type IconName } from './Icon.js';
import { useView } from './view.js';

/** How long the cleared table shows before its results. */
const FINALE_MS = 1300;
/** The widest a card on the table gets, in pixels, and its height to its width. */
const MAX_CARD = 68;
const CARD_RATIO = 1.4;

/** The finished deal still on the table: the state has none by then. */
interface Finale {
  deal: Deal;
  won: boolean;
}

/** A card moving onto the pile, from where it was, and the cards it turned face up. */
interface Motion {
  from: DOMRect | undefined;
  revealed: readonly number[];
}

let bonusIds = 0;

function reducedMotion(): boolean {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/** The size of an element's content box, kept up to date as the screen changes. */
function useContentSize(ref: RefObject<HTMLElement>): { width: number; height: number } {
  const [size, setSize] = useState({ width: 0, height: 0 });
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    const measure = () => {
      const style = getComputedStyle(el);
      const width = el.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight);
      const height = el.clientHeight - parseFloat(style.paddingTop) - parseFloat(style.paddingBottom);
      setSize((old) => (old.width === width && old.height === height ? old : { width, height }));
    };
    measure();
    // Old WebViews have no ResizeObserver; there the window's size is all that changes.
    const Observer = (window as { ResizeObserver?: typeof ResizeObserver }).ResizeObserver;
    if (!Observer) {
      window.addEventListener('resize', measure);
      return () => {
        window.removeEventListener('resize', measure);
      };
    }
    const observer = new Observer(measure);
    observer.observe(el);
    return () => {
      observer.disconnect();
    };
  }, [ref]);
  return size;
}

/** The card width that fits the whole layout in the space, in whole pixels. */
export function cardWidth(space: { width: number; height: number }, layout: Layout): number {
  const byWidth = space.width / (layout.width / 2);
  const byHeight = space.height / ((layout.height / 2) * CARD_RATIO);
  return Math.max(0, Math.floor(Math.min(MAX_CARD, byWidth, byHeight)));
}

const px = (n: number) => `${n.toFixed(2)}px`;

export function Play(props: { mode: Mode }): JSX.Element | null {
  const { game, s, t, ui, back, fmt, cardName } = useView();
  const { mode } = props;
  const { go, open } = ui;
  const live = s.deals[mode];
  const [finale, setFinale] = useState<Finale | null>(null);
  const [bonus, setBonus] = useState<{ coins: number; id: number } | null>(null);
  const boardRef = useRef<HTMLDivElement>(null);
  const pileRef = useRef<HTMLDivElement>(null);
  const stockRef = useRef<HTMLButtonElement>(null);
  const motionRef = useRef<Motion | null>(null);
  const space = useContentSize(boardRef);

  useBackHandler(() => {
    go({ kind: 'home' });
    return true;
  });

  const spotEl = (spot: number) => boardRef.current?.querySelector(`[data-spot="${String(spot)}"]`) ?? null;

  // Where a card comes from is measured when it is played, while it is still on the table.
  useEffect(
    () =>
      game.events.on('play', (e) => {
        if (e.mode !== mode) return;
        motionRef.current = { from: spotEl(e.spot)?.getBoundingClientRect(), revealed: e.revealed };
        if (e.bonus > 0) setBonus({ coins: e.bonus, id: ++bonusIds });
        if (e.result) {
          setFinale({ deal: e.deal, won: true });
          setTimeout(() => {
            open({ kind: 'results' });
          }, FINALE_MS);
        }
      }),
    [game, mode, open],
  );
  useEffect(
    () =>
      game.events.on('draw', (e) => {
        if (e.mode !== mode) return;
        motionRef.current = { from: stockRef.current?.querySelector('.stock__top')?.getBoundingClientRect(), revealed: [] };
      }),
    [game, mode],
  );

  // Once the new pile card is drawn, it flies in from there, and the cards it uncovered turn over.
  useLayoutEffect(() => {
    const m = motionRef.current;
    motionRef.current = null;
    if (!m || reducedMotion()) return;
    const card = pileRef.current?.lastElementChild;
    if (card && m.from) {
      const to = card.getBoundingClientRect();
      const scale = to.width > 0 ? m.from.width / to.width : 1;
      card.animate([{ transform: `translate(${px(m.from.left - to.left)}, ${px(m.from.top - to.top)}) scale(${scale.toFixed(3)})` }, { transform: 'none' }], {
        duration: 260,
        easing: 'cubic-bezier(0.2, 0.8, 0.3, 1)',
      });
    }
    for (const spot of m.revealed) spotEl(spot)?.animate([{ transform: 'rotateY(90deg)' }, { transform: 'none' }], { duration: 240, delay: 140, easing: 'ease-out', fill: 'backwards' });
  });

  const deal = live ?? finale?.deal ?? null;
  useEffect(() => {
    if (!deal) go({ kind: 'home' });
  });
  if (!deal) return null;

  const finished = live === null;
  const table = R.tableOf(deal);
  const { layout } = table;
  const top = topCard(table);
  const under = table.pile[table.pile.length - 2];
  const left = deal.dealt.cards.length - table.played;
  const stuck = !finished && R.stuck(s, mode);
  const cw = cardWidth(space, layout);
  const ch = Math.round(cw * CARD_RATIO);
  const place = mode === 'level' ? placeOf(deal.level) : null;

  const tap = (spot: number) => {
    if (finished) return;
    if (game.play(mode, spot)) return;
    if (!reducedMotion())
      spotEl(spot)?.animate([{ transform: 'none' }, { transform: 'translateX(-4px)' }, { transform: 'translateX(4px)' }, { transform: 'none' }], { duration: 220 });
  };
  const help = (tool: Tool) => {
    open({ kind: 'tool', mode, tool });
  };
  const turn = () => {
    if (finished) return;
    if (table.stock.length > 0) game.draw(mode);
    else if (game.toolOffered(mode, 'extraCards')) help('extraCards');
    else game.nope();
  };
  const undo = () => {
    if (deal.undosLeft > 0) game.undo(mode);
    else help('moreUndos');
  };
  const end = () => {
    setFinale({ deal, won: false });
    if (game.giveUp(mode)) open({ kind: 'results' });
  };

  const stockLabel = table.stock.length === 0 ? t('play.stockEmpty') : table.stock.length === 1 ? t('play.stockOne') : t('play.stock', { n: table.stock.length });

  return (
    <div class={`play${finished ? ' play--finished' : ''}`} data-testid="play">
      <header class="topbar">
        <button
          type="button"
          class="iconbtn"
          aria-label={t('common.back')}
          data-testid="go-home"
          onClick={() => {
            go({ kind: 'home' });
          }}
        >
          <Icon name="home" size={24} />
        </button>
        <h1 class="topbar__title">
          <span data-testid="deal-title">
            {mode === 'daily' ? (
              <>
                <Icon name="sun" size={20} /> {t('play.daily')}
              </>
            ) : (
              t('play.level', { level: deal.level })
            )}
          </span>
          {place && (
            <small class="topbar__where" data-testid="deal-where">
              {t('play.where', { canal: t(`canal.${place.canal}`), stop: place.stop + 1, stops: STOPS_PER_CANAL })}
            </small>
          )}
        </h1>
        <CoinCount />
      </header>

      <div class="status">
        <span class="pot" data-testid="pot" role="img" aria-label={t('play.pot', { coins: table.pot })}>
          <Icon name="coin" size={20} />
          <span>{fmt(table.pot)}</span>
        </span>
        <Garland streak={table.streak} />
        {bonus && (
          <span class="bonus" key={bonus.id} data-testid="streak-bonus">
            {t('play.bonus', { coins: bonus.coins })}
          </span>
        )}
        <span class="left" data-testid="cards-left">
          {t('play.left', { n: left })}
        </span>
      </div>

      <div class="board" ref={boardRef} role="group" aria-label={t('play.board')} data-testid="board" data-layout={layout.id}>
        {cw > 0 && (
          <div class="layout" style={{ width: px((layout.width * cw) / 2), height: px((layout.height * ch) / 2), '--cw': px(cw), '--ch': px(ch) }}>
            {layout.spots.map((spot, i) => {
              if (table.cleared[i]) return null;
              const card = deal.dealt.cards[i] ?? 0;
              const style = { left: px((spot.col * cw) / 2), top: px((spot.row * ch) / 2) };
              return isFree(table, i) ? (
                <button
                  type="button"
                  key={`up-${String(i)}`}
                  class="card card--up"
                  style={style}
                  data-spot={i}
                  data-testid={`card-${String(i)}`}
                  data-card={card}
                  aria-label={cardName(card)}
                  onClick={() => {
                    tap(i);
                  }}
                >
                  <Face card={card} />
                </button>
              ) : (
                <span key={`down-${String(i)}`} class="card card--down" style={style} data-spot={i} data-testid={`card-${String(i)}`}>
                  <Back look={back} />
                </span>
              );
            })}
          </div>
        )}
        {finale?.won && finished && (
          <div class="cleared" data-testid="cleared">
            <Icon name="wild" size={36} />
            <strong>{t('play.cleared')}</strong>
          </div>
        )}
      </div>

      <div class="dock">
        <button type="button" class="stock" ref={stockRef} data-testid="stock" data-count={table.stock.length} aria-label={stockLabel} disabled={finished} onClick={turn}>
          {table.stock.length > 0 ? (
            <>
              {table.stock.length > 2 && (
                <span class="stock__card stock__card--3">
                  <Back look={back} />
                </span>
              )}
              {table.stock.length > 1 && (
                <span class="stock__card stock__card--2">
                  <Back look={back} />
                </span>
              )}
              <span class="stock__card stock__top">
                <Back look={back} />
              </span>
            </>
          ) : (
            <span class="stock__card stock__empty">
              <Icon name="cards" size={26} />
            </span>
          )}
          {table.stock.length > 0 && <span class="stock__count">{table.stock.length}</span>}
        </button>
        <div class="pile" ref={pileRef} data-testid="pile" data-card={top} role="img" aria-label={t('play.open', { card: cardName(top) })}>
          {under !== undefined && (
            <span class="pile__card pile__card--under">
              <Face card={under} />
            </span>
          )}
          <span class="pile__card" key={table.pile.length}>
            <Face card={top} />
          </span>
        </div>
      </div>

      <div class="tools">
        <ToolButton
          icon="undo"
          label={deal.undosLeft > 0 ? t('tool.undo') : t('tool.moreUndos')}
          badge={deal.undosLeft > 0 ? String(deal.undosLeft) : '+'}
          disabled={finished || !R.canUndo(s, mode)}
          onPress={undo}
          testId="tool-undo"
        />
        <ToolButton
          icon="wild"
          label={t('tool.wild')}
          active={stuck}
          disabled={finished || !game.toolOffered(mode, 'wild')}
          onPress={() => {
            help('wild');
          }}
          testId="tool-wild"
        />
        <ToolButton
          icon="cards"
          label={t('tool.extraCards', { n: EXTRA_CARDS })}
          active={stuck && game.toolOffered(mode, 'extraCards')}
          disabled={finished || !game.toolOffered(mode, 'extraCards')}
          onPress={() => {
            help('extraCards');
          }}
          testId="tool-extraCards"
        />
      </div>
      {/* Always there, so the table does not move when a note comes or goes. */}
      <div class="foot">
        {stuck ? (
          <div class="note note--alert" role="alert" data-testid="stuck">
            <p>
              <strong>{t('stuck.title')}</strong> {t('stuck.body')}
            </p>
            <Button small variant="ghost" testId="end-deal" onPress={end}>
              {t('stuck.end')}
            </Button>
          </div>
        ) : (
          !s.taught && (
            <p class="note" data-testid="teach">
              {t('play.teach')}
            </p>
          )
        )}
      </div>
    </div>
  );
}

/** Five marigolds on a string: one lights up for each card played in a row, and the fifth pays a bonus. */
function Garland(props: { streak: number }): JSX.Element {
  const { t } = useView();
  const { streak } = props;
  const lit = streak > 0 && streak % STREAK_EVERY === 0 ? STREAK_EVERY : streak % STREAK_EVERY;
  return (
    <span class="garland" role="img" aria-label={t('play.streak', { n: streak, every: STREAK_EVERY, coins: STREAK_BONUS })} data-testid="streak" data-streak={streak}>
      {Array.from({ length: STREAK_EVERY }, (_, i) => (
        <span key={i} class={`bead${i < lit ? ' bead--lit' : ''}`} />
      ))}
    </span>
  );
}

function ToolButton(props: { icon: IconName; label: string; badge?: string; active?: boolean; disabled: boolean; onPress: () => void; testId: string }): JSX.Element {
  return (
    <button type="button" class={`tool${props.active ? ' tool--active' : ''}`} disabled={props.disabled} data-testid={props.testId} onClick={props.onPress}>
      <Icon name={props.icon} size={26} />
      <span class="tool__name">{props.label}</span>
      {props.badge !== undefined && <span class="tool__badge">{props.badge}</span>}
    </button>
  );
}

/** The coins a player has; tapping them opens the shop. */
export function CoinCount(): JSX.Element {
  const { s, t, ui, fmt } = useView();
  return (
    <button
      type="button"
      class="res"
      data-testid="coins"
      aria-label={`${t('res.coins')}: ${fmt(s.coins)}`}
      onClick={() => {
        ui.open({ kind: 'shop' });
      }}
    >
      <Icon name="coin" size={22} />
      <span class="res__value">{fmt(s.coins)}</span>
    </button>
  );
}
