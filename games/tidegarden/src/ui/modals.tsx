import { PrivacyModal as ShellPrivacyModal, SettingsModal as ShellSettingsModal } from '@game1/shell/ui';
import { Button, Modal } from '@game1/ui';
import type { JSX } from 'preact';
import { useEffect } from 'preact/hooks';
import { COIN_PACKS, catalogItem, type CoinPack } from '../catalog.js';
import { PRIVACY_POLICY } from '../privacy.js';
import { BOMB, COL, PEARL, ROW, TURTLE } from '../sim/board.js';
import { BUDDIES, FREE_COINS, LOOK_COSTS, MORE_MOVES_COST, TOOL_COSTS, WATERS, ZONE_COINS, type LookId, type Tool } from '../sim/content.js';
import { MORE_MOVES, goalsLeft } from '../sim/dive.js';
import { levelsOf, type ZoneId } from '../sim/levels.js';
import * as R from '../sim/rules.js';
import { levelOf } from '../sim/state.js';
import { BuddyArt, CreatureArt, PieceArt } from './art.js';
import { LevelGrid, useDive } from './Home.js';
import { Icon, type IconName } from './Icon.js';
import { GoalChip } from './Play.js';
import { WaterSwatch } from './Scene.js';
import { useView } from './view.js';

/** A dive's end: its stars and what it paid, with the one chance to double it; or, given up, another try. */
export function ResultsModal(): JSX.Element | null {
  const { game, s, t, ui, fmt } = useView();
  const dive = useDive();
  const r = s.result;
  if (!r) return null;
  const home = () => {
    ui.go({ kind: 'home' });
    ui.open(null);
  };
  const daily = r.mode === 'daily';
  const again = () => {
    ui.open(null);
    if (daily) dive.daily();
    else dive.level(r.level);
  };
  const free = R.hasEntitlement(s, 'remove_ads');
  const next = !daily && r.won && R.levelOpen(s, r.level + 1) ? r.level + 1 : null;
  const title = !r.won ? t('result.lost') : daily ? t('result.daily') : t('result.reached', { n: r.level });
  return (
    <Modal title={title} onClose={home} closeLabel={t('common.close')} testId="results">
      <div class="result">
        {r.won ? (
          <p class="result__stars" data-testid="result-stars" data-stars={r.stars} aria-label={t('result.stars', { n: r.stars })}>
            {[1, 2, 3].map((n) => (
              <span key={n} class={`result__star${n <= r.stars ? ' result__star--on' : ''}`} style={{ '--i': String(n) }}>
                <Icon name={n <= r.stars ? 'star' : 'starEmpty'} size={44} />
              </span>
            ))}
          </p>
        ) : (
          <p class="g1-center" data-testid="result-lost">
            {t('result.lostBody')}
          </p>
        )}
        {r.zone && (
          <div class="result__zone" data-testid="result-zone">
            <CreatureArt zone={r.zone} size={72} home={true} />
            <p>
              <strong>{t('result.zoneHome', { creature: t(`creature.${r.zone}`) })}</strong>
              <br />
              <span class="g1-small">{t('result.zoneBody', { zone: t(`zone.${r.zone}`), coins: fmt(ZONE_COINS) })}</span>
            </p>
          </div>
        )}
        {r.won && (
          <dl class="tally" data-testid="result-tally">
            <div>
              <dt>{daily ? t('result.dailyPay') : r.before > 0 ? t('result.newStars') : t('result.pay')}</dt>
              <dd>+{fmt(r.pay)}</dd>
            </div>
            {r.zone && (
              <div>
                <dt>{t('result.zoneBonus')}</dt>
                <dd>+{fmt(r.zoneCoins)}</dd>
              </div>
            )}
          </dl>
        )}
        {r.won && (
          <p class="result__coins" data-testid="result-coins">
            <Icon name="coin" size={26} /> {t('result.coins', { coins: fmt((r.doubled ? r.pay * 2 : r.pay) + r.zoneCoins) })}
            {r.doubled && <Icon name="check" size={18} />}
          </p>
        )}
        {game.adOffered('double_coins') && (
          <Button
            variant="ad"
            block
            testId="double"
            disabled={game.busy}
            onPress={() => {
              void game.watchAd('double_coins');
            }}
          >
            {!free && <Icon name="play" size={16} />} {t('result.double', { coins: fmt(r.pay) })}
          </Button>
        )}
        {daily && r.won && (
          <p class="g1-small g1-center" data-testid="result-streak">
            <Icon name="sun" size={16} /> {r.pay > 0 ? t('result.streak', { days: r.streak }) : t('result.dailyAgain')}
          </p>
        )}
      </div>
      <div class="g1-row">
        <Button variant="ghost" testId="result-home" onPress={home}>
          <Icon name="home" size={18} /> {t('result.home')}
        </Button>
        {(!r.won || (!daily && !next)) && (
          <Button variant={r.won ? 'ghost' : 'primary'} testId="result-again" onPress={again}>
            <Icon name="restart" size={18} /> {t('result.again')}
          </Button>
        )}
        {next && (
          <Button
            testId="result-next"
            onPress={() => {
              ui.open(null);
              dive.level(next);
            }}
          >
            {t('result.next', { n: next })}
          </Button>
        )}
      </div>
    </Modal>
  );
}

/** Out of moves with goals still to reach: five more, for an ad or for sand dollars, or the dive ends. */
export function StuckModal(): JSX.Element | null {
  const { game, s, t, ui, fmt, day } = useView();
  const close = ui.open;
  const stuck = R.isStuck(s);
  // Once the moves are back, the sheet goes.
  useEffect(() => {
    if (!stuck) close(null);
  });
  const c = s.current;
  if (!c) return null;
  const level = levelOf(c);
  const left = goalsLeft(c.dive, level);
  const free = R.hasEntitlement(s, 'remove_ads');
  const end = () => {
    game.giveUp();
    close({ kind: 'results' });
  };
  return (
    <Modal
      title={t('stuck.title')}
      onClose={() => {
        close(null);
      }}
      closeLabel={t('common.close')}
      testId="stuck"
    >
      <p class="g1-center">{t('stuck.body', { n: MORE_MOVES })}</p>
      <ul class="goal-list goal-list--sheet" aria-label={t('play.goals')}>
        {level.goals.map((goal, i) => ((left[i] ?? 0) > 0 ? <GoalChip key={i} goal={goal} left={left[i] ?? 0} size={28} /> : null))}
      </ul>
      <div class="sheet">
        <Button
          variant="ad"
          block
          testId="stuck-watch"
          disabled={!game.adOffered('more_moves') || game.busy}
          onPress={() => {
            void game.watchAd('more_moves');
          }}
        >
          {free ? (
            t('stuck.free', { n: MORE_MOVES })
          ) : (
            <>
              <Icon name="play" size={16} /> {t('stuck.watch', { n: MORE_MOVES })}
            </>
          )}
        </Button>
        {R.adsLeft(s, 'more_moves', day) <= 0 && <p class="g1-small g1-muted g1-center">{t('sheet.noAds')}</p>}
        <Button
          block
          variant="ghost"
          testId="stuck-spend"
          disabled={s.coins < MORE_MOVES_COST || game.busy}
          onPress={() => {
            game.buyMoreMoves();
          }}
        >
          <Icon name="coin" size={18} /> {t('stuck.spend', { n: MORE_MOVES, coins: fmt(MORE_MOVES_COST) })}
        </Button>
        {s.coins < MORE_MOVES_COST && <p class="g1-small g1-muted g1-center">{t('sheet.short', { coins: fmt(s.coins) })}</p>}
        <p class="g1-small g1-muted g1-center sheet__or">{t('sheet.or')}</p>
        <Button block variant="ghost" testId="stuck-end" onPress={end}>
          <Icon name="flag" size={18} /> {t('stuck.end')}
        </Button>
      </div>
    </Modal>
  );
}

/** A tool for the bag, for an ad or for sand dollars, once the bag has none of it. */
export function ToolModal(props: { tool: Tool }): JSX.Element {
  const { game, s, t, ui, fmt, day } = useView();
  const { tool } = props;
  const close = ui.open;
  // Once there is one in the bag, the sheet goes.
  const has = s.tools[tool] > 0;
  useEffect(() => {
    if (has) close(null);
  });
  const slot = R.slotOfTool(tool);
  const cost = TOOL_COSTS[tool];
  const free = R.hasEntitlement(s, 'remove_ads');
  return (
    <Modal
      title={t(`tool.${tool}`)}
      onClose={() => {
        close(null);
      }}
      closeLabel={t('common.close')}
      testId="tool-sheet"
    >
      <p class="sheet__art" aria-hidden="true">
        <Icon name={tool} size={56} />
      </p>
      <p class="g1-center">{t(`sheet.${tool}`)}</p>
      <div class="sheet">
        <Button
          variant="ad"
          block
          testId="tool-watch"
          disabled={!game.adOffered('tool', slot) || game.busy}
          onPress={() => {
            void game.watchAd('tool', slot);
          }}
        >
          {free ? (
            t('sheet.free')
          ) : (
            <>
              <Icon name="play" size={16} /> {t('sheet.watch')}
            </>
          )}
        </Button>
        {R.adsLeft(s, 'tool', day) <= 0 && <p class="g1-small g1-muted g1-center">{t('sheet.noAds')}</p>}
        <Button
          block
          variant="ghost"
          testId="tool-spend"
          disabled={s.coins < cost || game.busy}
          onPress={() => {
            game.buyTool(tool);
          }}
        >
          <Icon name="coin" size={18} /> {t('sheet.spend', { coins: fmt(cost) })}
        </Button>
        {s.coins < cost && <p class="g1-small g1-muted g1-center">{t('sheet.short', { coins: fmt(s.coins) })}</p>}
      </div>
    </Modal>
  );
}

/** A zone of the reef: its creature's story and its twelve levels. */
export function ZoneModal(props: { zone: ZoneId }): JSX.Element {
  const { s, t, ui } = useView();
  const { zone } = props;
  const opened = R.zoneOpen(s, zone);
  const home = R.zoneDone(s, zone);
  const first = levelsOf(zone)[0] ?? 1;
  return (
    <Modal
      title={t(`zone.${zone}`)}
      onClose={() => {
        ui.open(null);
      }}
      closeLabel={t('common.close')}
      testId="zone"
    >
      <div class="zone-sheet">
        <CreatureArt zone={zone} size={84} home={home} />
        <p class="g1-small">{t(`lore.${zone}`)}</p>
      </div>
      <p class="g1-small g1-muted g1-center" data-testid="zone-progress">
        {home ? t('zone.home', { creature: t(`creature.${zone}`) }) : opened ? t('zone.progress', { creature: t(`creature.${zone}`), coins: ZONE_COINS }) : t('zone.closed', { n: first })}
      </p>
      {opened && (
        <LevelGrid
          zone={zone}
          onPick={() => {
            ui.open(null);
          }}
        />
      )}
    </Modal>
  );
}

/** How to play: the swaps, the special pieces and what each zone brings. */
export function RulesModal(): JSX.Element {
  const { t, ui } = useView();
  return (
    <Modal
      title={t('rules.title')}
      onClose={() => {
        ui.open(null);
      }}
      closeLabel={t('common.close')}
      testId="rules"
    >
      <ol class="rules">
        <li>{t('rules.swap')}</li>
        <li class="rules__specials">
          <span>
            <PieceArt kind={3} special={ROW} size={36} /> {t('rules.wave')}
          </span>
          <span>
            <PieceArt kind={4} special={BOMB} size={36} /> {t('rules.bomb')}
          </span>
          <span>
            <PieceArt kind={PEARL} size={36} /> {t('rules.pearl')}
          </span>
        </li>
        <li>
          <PieceArt kind={0} special={COL} size={28} class="rules__inline" /> {t('rules.combos')}
        </li>
        <li>{t('rules.goals')}</li>
        <li>
          <PieceArt kind={TURTLE} size={28} class="rules__inline" /> {t('rules.turtles')}
        </li>
        <li>{t('rules.tools')}</li>
        <li>{t('rules.stars', { n: MORE_MOVES })}</li>
      </ol>
    </Modal>
  );
}

function LookPreview(props: { id: LookId }): JSX.Element {
  if (R.isBuddy(props.id))
    return (
      <span class="look__preview look__buddy" aria-hidden="true">
        <BuddyArt buddy={props.id} size={40} />
      </span>
    );
  return <WaterSwatch water={props.id} />;
}

function LookRow(props: { id: LookId; inUse: boolean }): JSX.Element {
  const { game, s, t, fmt } = useView();
  const { id } = props;
  const cost = LOOK_COSTS[id];
  return (
    <li class={`look${props.inUse ? ' look--in-use' : ''}`} data-testid={`look-${id}`}>
      <LookPreview id={id} />
      <strong class="look__name">{t(`look.${id}`)}</strong>
      {props.inUse ? (
        <span class="owned">
          <Icon name="check" size={16} /> {t('looks.inUse')}
        </span>
      ) : R.ownsLook(s, id) ? (
        <Button
          small
          variant="ghost"
          testId={`use-${id}`}
          onPress={() => {
            game.chooseLook(id);
          }}
        >
          {t('looks.use')}
        </Button>
      ) : (
        <Button
          small
          testId={`buy-look-${id}`}
          disabled={s.coins < cost}
          onPress={() => {
            game.buyLook(id);
          }}
        >
          <Icon name="coin" size={14} /> {fmt(cost)}
        </Button>
      )}
    </li>
  );
}

export function LooksModal(): JSX.Element {
  const { game, s, t, ui, water, buddy } = useView();
  return (
    <Modal
      title={t('looks.title')}
      onClose={() => {
        ui.open(null);
      }}
      closeLabel={t('common.close')}
      testId="looks"
    >
      <p class="g1-small g1-muted g1-center">{t('looks.note')}</p>
      <h3 class="looks__heading">{t('looks.waters')}</h3>
      <ul class="looks">
        {WATERS.map((id) => (
          <LookRow key={id} id={id} inUse={id === water} />
        ))}
      </ul>
      <h3 class="looks__heading">{t('looks.buddies')}</h3>
      <ul class="looks">
        {BUDDIES.map((id) => (
          <LookRow key={id} id={id} inUse={id === buddy} />
        ))}
      </ul>
      {game.sells && R.collectionOffered(s) && (
        <div class="looks__collection">
          <Icon name="chest" size={28} />
          <span class="g1-small g1-muted">{t('looks.collection')}</span>
          <Button
            small
            variant="ghost"
            testId="looks-shop"
            onPress={() => {
              ui.open({ kind: 'shop' });
            }}
          >
            {t('shop.title')}
          </Button>
        </div>
      )}
    </Modal>
  );
}

function priceOf(id: string, products: ReadonlyMap<string, { price: string | null }>): string | null {
  return products.get(id)?.price ?? null;
}

function PackCard(props: { id: CoinPack }): JSX.Element {
  const { game, t, fmt } = useView();
  const price = priceOf(props.id, game.products);
  const coins = catalogItem(props.id)?.grants?.coins ?? 0;
  return (
    <button
      type="button"
      class={`pack pack--${props.id}`}
      data-testid={`buy-${props.id}`}
      disabled={price === null || game.busy}
      onClick={() => {
        void game.purchase(props.id);
      }}
    >
      <Icon name="coin" size={34} />
      <span class="pack__amount">{t('shop.coins', { coins: fmt(coins) })}</span>
      <span class="pack__name g1-small">{t(`shop.${props.id}`)}</span>
      <span class="pack__price">{price ?? '…'}</span>
    </button>
  );
}

type OneTime = 'diver_kit' | 'remove_ads' | 'reef_collection';

const ONE_TIME_ICONS: Record<OneTime, IconName> = { diver_kit: 'mask', remove_ads: 'noads', reef_collection: 'chest' };

function OfferRow(props: { id: OneTime; owned: boolean }): JSX.Element {
  const { game, t } = useView();
  const price = priceOf(props.id, game.products);
  return (
    <div class="offer" data-testid={`offer-${props.id}`}>
      <Icon name={ONE_TIME_ICONS[props.id]} size={32} />
      <div class="offer__body">
        <strong>{t(`shop.${props.id}`)}</strong>
        <span class="g1-small g1-muted">{t(`shop.${props.id}.desc`)}</span>
        {!props.owned && game.needsGoogleFor(props.id) && <span class="g1-small g1-muted">{t('shop.needsGoogle')}</span>}
      </div>
      {props.owned ? (
        <span class="owned">{t('shop.owned')}</span>
      ) : (
        <Button
          small
          testId={`buy-${props.id}`}
          disabled={price === null || game.busy}
          onPress={() => {
            void game.purchase(props.id);
          }}
        >
          {price ?? '…'}
        </Button>
      )}
    </div>
  );
}

export function ShopModal(): JSX.Element {
  const { game, s, t, ui, day } = useView();
  const free = R.hasEntitlement(s, 'remove_ads');
  const kit = R.hasEntitlement(s, 'diver_kit');
  const collection = R.hasEntitlement(s, 'reef_collection');
  return (
    <Modal
      title={t('shop.title')}
      onClose={() => {
        ui.open(null);
      }}
      closeLabel={t('common.close')}
      testId="shop-modal"
    >
      {game.testMode && (
        <p class="g1-note" data-testid="test-note">
          {t('shop.testNote')}
        </p>
      )}
      {game.storeError && <p class="g1-note g1-note--bad">{t('shop.offline')}</p>}
      <div class="offer" data-testid="offer-free">
        <Icon name="coin" size={32} />
        <div class="offer__body">
          <strong>{t('shop.free')}</strong>
          <span class="g1-small g1-muted">{t('shop.free.desc', { coins: FREE_COINS, left: R.adsLeft(s, 'free_coins', day) })}</span>
        </div>
        <Button
          small
          variant="ad"
          testId="watch-free"
          disabled={!game.adOffered('free_coins') || game.busy}
          onPress={() => {
            void game.watchAd('free_coins');
          }}
        >
          {free ? (
            t('shop.claim')
          ) : (
            <>
              <Icon name="play" size={16} /> {t('shop.watch')}
            </>
          )}
        </Button>
      </div>
      <div class="bag" data-testid="bag">
        <strong class="bag__title">{t('shop.bag')}</strong>
        <ul class="bag__tools">
          {(['claw', 'tide', 'crab'] as const).map((tool) => (
            <li key={tool} class="bag__tool">
              <Icon name={tool} size={28} />
              <span>{t('shop.bagTool', { name: t(`tool.${tool}`), n: s.tools[tool] })}</span>
            </li>
          ))}
        </ul>
      </div>
      {game.sells && (
        <>
          <div class="packs" data-testid="coin-packs">
            {COIN_PACKS.map((id) => (
              <PackCard key={id} id={id} />
            ))}
          </div>
          {(kit || R.diverKitOffered(s)) && <OfferRow id="diver_kit" owned={kit} />}
          <OfferRow id="remove_ads" owned={free} />
          {(collection || R.collectionOffered(s)) && <OfferRow id="reef_collection" owned={collection} />}
        </>
      )}
    </Modal>
  );
}

export function SettingsModal(): JSX.Element {
  const { game, t, ui, time, now } = useView();
  return (
    <ShellSettingsModal
      session={game}
      t={t}
      time={time}
      now={now}
      persistent={ui.persistent}
      version={ui.version}
      onClose={() => {
        ui.open(null);
      }}
      onPrivacy={() => {
        ui.open({ kind: 'privacy' });
      }}
    />
  );
}

export function PrivacyModal(): JSX.Element {
  const { t, ui, locale } = useView();
  return (
    <ShellPrivacyModal
      t={t}
      policy={PRIVACY_POLICY[locale]}
      onClose={() => {
        ui.open({ kind: 'settings' });
      }}
    />
  );
}
