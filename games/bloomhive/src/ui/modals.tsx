import { PrivacyModal as ShellPrivacyModal, SettingsModal as ShellSettingsModal } from '@game1/shell/ui';
import { Button, Modal } from '@game1/ui';
import type { JSX } from 'preact';
import { useEffect } from 'preact/hooks';
import { COIN_PACKS, catalogItem, type CoinPack } from '../catalog.js';
import { PRIVACY_POLICY } from '../privacy.js';
import { FREE_COINS, HATS, LOOK_COSTS, MORE_SHOTS_COST, SKIES, TOOLS, TOOL_COSTS, ZONE_COINS, type LookId, type Tool } from '../sim/content.js';
import { reachedPip } from '../sim/hive.js';
import { levelsOf, type ZoneId } from '../sim/levels.js';
import { MORE_SHOTS, goalsLeft } from '../sim/round.js';
import * as R from '../sim/rules.js';
import { levelOf } from '../sim/state.js';
import { BudArt, FlowerArt, PipArt, PollenArt, ToolBall } from './art.js';
import { LevelGrid, useRound } from './Home.js';
import { Icon, type IconName } from './Icon.js';
import { GoalChip } from './Play.js';
import { SkySwatch } from './Scene.js';
import { useView } from './view.js';

/** A round's end: its stars and what it paid, with the one chance to double it; or, given up, another try. */
export function ResultsModal(): JSX.Element | null {
  const { game, s, t, ui, fmt } = useView();
  const round = useRound();
  const r = s.result;
  if (!r) return null;
  const home = () => {
    ui.go({ kind: 'home' });
    ui.open(null);
  };
  const daily = r.mode === 'daily';
  const again = () => {
    ui.open(null);
    if (daily) round.daily();
    else round.level(r.level);
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
            <FlowerArt zone={r.zone} size={72} bloomed={true} />
            <p>
              <strong>{t('result.zoneBloom', { flower: t(`flower.${r.zone}`) })}</strong>
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
              round.level(next);
            }}
          >
            {t('result.next', { n: next })}
          </Button>
        )}
      </div>
    </Modal>
  );
}

/** Out of pollen, or a bud at Pip, with goals still to reach: five more, for an ad or for honey, or the round ends. */
export function StuckModal(): JSX.Element | null {
  const { game, s, t, ui, fmt, day, hat } = useView();
  const close = ui.open;
  const stuck = R.isStuck(s);
  // Once there is pollen again, the sheet goes.
  useEffect(() => {
    if (!stuck) close(null);
  });
  const c = s.current;
  if (!c) return null;
  const level = levelOf(c);
  const left = goalsLeft(c.round, level);
  const atPip = reachedPip(c.round.board);
  const free = R.hasEntitlement(s, 'remove_ads');
  const end = () => {
    game.giveUp();
    close({ kind: 'results' });
  };
  return (
    <Modal
      title={atPip ? t('stuck.pip') : t('stuck.title')}
      onClose={() => {
        close(null);
      }}
      closeLabel={t('common.close')}
      testId="stuck"
    >
      <p class="sheet__art" aria-hidden="true">
        <PipArt hat={hat} size={64} mood="worried" />
      </p>
      <p class="g1-center">{atPip ? t('stuck.bodyPip', { n: MORE_SHOTS }) : t('stuck.body', { n: MORE_SHOTS })}</p>
      <ul class="goal-list goal-list--sheet" aria-label={t('play.goals')}>
        {level.goals.map((goal, i) => ((left[i] ?? 0) > 0 ? <GoalChip key={i} goal={goal} left={left[i] ?? 0} size={28} /> : null))}
      </ul>
      <div class="sheet">
        <Button
          variant="ad"
          block
          testId="stuck-watch"
          disabled={!game.adOffered('more_shots') || game.busy}
          onPress={() => {
            void game.watchAd('more_shots');
          }}
        >
          {free ? (
            t('stuck.free', { n: MORE_SHOTS })
          ) : (
            <>
              <Icon name="play" size={16} /> {t('stuck.watch', { n: MORE_SHOTS })}
            </>
          )}
        </Button>
        {R.adsLeft(s, 'more_shots', day) <= 0 && <p class="g1-small g1-muted g1-center">{t('sheet.noAds')}</p>}
        <Button
          block
          variant="ghost"
          testId="stuck-spend"
          disabled={s.coins < MORE_SHOTS_COST || game.busy}
          onPress={() => {
            game.buyMoreShots();
          }}
        >
          <Icon name="coin" size={18} /> {t('stuck.spend', { n: MORE_SHOTS, coins: fmt(MORE_SHOTS_COST) })}
        </Button>
        {s.coins < MORE_SHOTS_COST && <p class="g1-small g1-muted g1-center">{t('sheet.short', { coins: fmt(s.coins) })}</p>}
        <p class="g1-small g1-muted g1-center sheet__or">{t('sheet.or')}</p>
        <Button block variant="ghost" testId="stuck-end" onPress={end}>
          <Icon name="flag" size={18} /> {t('stuck.end')}
        </Button>
      </div>
    </Modal>
  );
}

/** A tool for the pouch, for an ad or for honey, once the pouch has none of it. */
export function ToolModal(props: { tool: Tool }): JSX.Element {
  const { game, s, t, ui, fmt, day } = useView();
  const { tool } = props;
  const close = ui.open;
  // Once there is one in the pouch, the sheet goes.
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
        <ToolBall tool={tool} size={64} />
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

/** A zone of the meadow: its story, its flower and its twelve levels. */
export function ZoneModal(props: { zone: ZoneId }): JSX.Element {
  const { s, t, ui } = useView();
  const { zone } = props;
  const opened = R.zoneOpen(s, zone);
  const bloomed = R.zoneDone(s, zone);
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
        <FlowerArt zone={zone} size={84} bloomed={bloomed} />
        <p class="g1-small">{t(`lore.${zone}`)}</p>
      </div>
      <p class="g1-small g1-muted g1-center" data-testid="zone-progress">
        {bloomed ? t('zone.bloomed', { flower: t(`flower.${zone}`) }) : opened ? t('zone.progress', { flower: t(`flower.${zone}`), coins: ZONE_COINS }) : t('zone.closed', { n: first })}
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

const plain = { kind: 'bud', colour: 0, bee: false, honey: false, butterfly: false } as const;

/** How to play: aiming, matches and falls, the jar, the goals, what the zones bring, and the tools. */
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
        <li>{t('rules.aim')}</li>
        <li class="rules__line">
          <span class="rules__buds" aria-hidden="true">
            <PollenArt colour={3} size={26} />
            <PollenArt colour={3} size={26} />
            <PollenArt colour={3} size={26} />
          </span>
          {t('rules.match')}
        </li>
        <li class="rules__line">
          <span class="rules__buds" aria-hidden="true">
            <BudArt bud={{ ...plain, colour: 1, bee: true }} size={28} />
          </span>
          {t('rules.fall')}
        </li>
        <li>{t('rules.bounce')}</li>
        <li class="rules__line">
          <Icon name="jar" size={26} /> {t('rules.jar')}
        </li>
        <li>{t('rules.goals')}</li>
        <li class="rules__specials">
          <span aria-hidden="true" class="rules__buds">
            <BudArt bud={{ ...plain, kind: 'wax', colour: -1 }} size={28} />
            <BudArt bud={{ ...plain, colour: 5, honey: true }} size={28} />
            <BudArt bud={{ ...plain, kind: 'puff', colour: -1 }} size={28} />
            <BudArt bud={{ ...plain, colour: 4, butterfly: true }} size={28} />
          </span>
          <span>{t('rules.blockers')}</span>
        </li>
        <li class="rules__line">
          <span class="rules__buds" aria-hidden="true">
            {TOOLS.map((tool) => (
              <ToolBall key={tool} tool={tool} size={26} />
            ))}
          </span>
          {t('rules.tools')}
        </li>
        <li>{t('rules.pip', { n: MORE_SHOTS })}</li>
        <li>{t('rules.stars')}</li>
      </ol>
    </Modal>
  );
}

function LookPreview(props: { id: LookId }): JSX.Element {
  if (R.isHat(props.id))
    return (
      <span class="look__preview look__hat" aria-hidden="true">
        <PipArt hat={props.id} size={44} />
      </span>
    );
  return <SkySwatch sky={props.id} />;
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
  const { game, s, t, ui, sky, hat } = useView();
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
      <h3 class="looks__heading">{t('looks.skies')}</h3>
      <ul class="looks">
        {SKIES.map((id) => (
          <LookRow key={id} id={id} inUse={id === sky} />
        ))}
      </ul>
      <h3 class="looks__heading">{t('looks.hats')}</h3>
      <ul class="looks">
        {HATS.map((id) => (
          <LookRow key={id} id={id} inUse={id === hat} />
        ))}
      </ul>
      {game.sells && R.collectionOffered(s) && (
        <div class="looks__collection">
          <Icon name="basket" size={28} />
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

type OneTime = 'keeper_kit' | 'remove_ads' | 'meadow_collection';

const ONE_TIME_ICONS: Record<OneTime, IconName> = { keeper_kit: 'kit', remove_ads: 'noads', meadow_collection: 'basket' };

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
  const kit = R.hasEntitlement(s, 'keeper_kit');
  const collection = R.hasEntitlement(s, 'meadow_collection');
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
      <div class="pouch" data-testid="pouch">
        <strong class="pouch__title">{t('shop.pouch')}</strong>
        <ul class="pouch__tools">
          {TOOLS.map((tool) => (
            <li key={tool} class="pouch__tool">
              <ToolBall tool={tool} size={28} />
              <span>{t('shop.pouchTool', { name: t(`tool.${tool}`), n: s.tools[tool] })}</span>
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
          {(kit || R.keeperKitOffered(s)) && <OfferRow id="keeper_kit" owned={kit} />}
          <OfferRow id="remove_ads" owned={free} />
          {(collection || R.collectionOffered(s)) && <OfferRow id="meadow_collection" owned={collection} />}
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
