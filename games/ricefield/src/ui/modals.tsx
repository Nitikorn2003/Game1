import { PrivacyModal as ShellPrivacyModal, SettingsModal as ShellSettingsModal } from '@game1/shell/ui';
import { Button, Modal } from '@game1/ui';
import type { JSX } from 'preact';
import { useEffect } from 'preact/hooks';
import { SEED_PACKS, catalogItem, type SeedPack } from '../catalog.js';
import { PRIVACY_POLICY } from '../privacy.js';
import { ALBUM_SEEDS, FREE_SEEDS, HEARTS, LOOK_COSTS, MARKERS, OPEN_AFTER, SCENES, TOOL_COSTS, type LookId, type Tool } from '../sim/content.js';
import { dailyPicture } from '../sim/daily.js';
import { albumOf, isPictureId, pictureOf, picturesOf, puzzleOf, type PictureId } from '../sim/fields.js';
import type { AlbumId } from '../sim/pictures.js';
import * as R from '../sim/rules.js';
import { MiniField, PictureArt } from './Field.js';
import { AlbumArt, Icon, MarkerArt, type IconName } from './Icon.js';
import { SceneSwatch } from './Scene.js';
import { useView } from './view.js';

/** A grown field: its picture, what it paid, and the one chance to double it. */
export function ResultsModal(): JSX.Element | null {
  const { game, s, t, ui, fmt } = useView();
  const r = s.result;
  if (!r) return null;
  const home = () => {
    ui.go({ kind: 'home' });
    ui.open(null);
  };
  const daily = r.mode === 'daily';
  const picture = daily ? dailyPicture(r.id) : isPictureId(r.id) ? pictureOf(r.id) : null;
  const album = !daily && isPictureId(r.id) ? albumOf(r.id) : null;
  const next = !daily && isPictureId(r.id) ? R.nextPicture(s, r.id) : null;
  const free = R.hasEntitlement(s, 'remove_ads');
  return (
    <Modal title={daily ? t('result.daily') : t('result.grown')} onClose={home} closeLabel={t('common.close')} testId="results">
      <div class="result">
        {picture && (
          <figure class="result__picture">
            <PictureArt picture={picture} size={200} class="picture--framed" />
            <figcaption data-testid="result-name">{daily ? t('result.dailyName') : isPictureId(r.id) ? t(`picture.${r.id}`) : ''}</figcaption>
          </figure>
        )}
        {r.perfect && (
          <p class="result__perfect" data-testid="result-perfect">
            <Icon name="star" size={18} /> {t('result.perfect')}
          </p>
        )}
        {r.opened && (
          <p class="result__opened" data-testid="result-opened">
            <AlbumArt id={r.opened} size={28} /> {t('result.opened', { name: t(`album.${r.opened}`) })}
          </p>
        )}
        <dl class="tally" data-testid="result-tally">
          {r.pay > 0 && (
            <div>
              <dt>{daily ? t('result.dailyPay') : t('result.pay')}</dt>
              <dd>+{fmt(r.pay)}</dd>
            </div>
          )}
          {r.bonus > 0 && (
            <div>
              <dt>{t('result.bonus')}</dt>
              <dd>+{fmt(r.bonus)}</dd>
            </div>
          )}
          {r.album && (
            <div data-testid="result-album">
              <dt>{t('result.album', { name: t(`album.${r.album}`) })}</dt>
              <dd>+{fmt(r.albumSeeds)}</dd>
            </div>
          )}
        </dl>
        <p class="result__seeds" data-testid="result-seeds">
          <Icon name="seed" size={26} /> {t('result.seeds', { seeds: fmt((r.doubled ? r.seeds * 2 : r.seeds) + r.albumSeeds) })}
          {r.doubled && <Icon name="check" size={18} />}
        </p>
        {game.adOffered('double_seeds') && (
          <Button
            variant="ad"
            block
            testId="double"
            disabled={game.busy}
            onPress={() => {
              void game.watchAd('double_seeds');
            }}
          >
            {!free && <Icon name="play" size={16} />} {t('result.double', { seeds: fmt(r.seeds) })}
          </Button>
        )}
        {daily &&
          (r.pay > 0 ? (
            <p class="g1-small" data-testid="result-streak">
              <Icon name="sun" size={16} /> {t('result.streak', { days: r.streak })}
            </p>
          ) : (
            <p class="g1-small g1-muted">{t('result.dailyAgain')}</p>
          ))}
      </div>
      <div class="g1-row">
        <Button variant="ghost" testId="result-home" onPress={home}>
          <Icon name="home" size={18} /> {t('result.home')}
        </Button>
        {album && (
          <Button
            variant="ghost"
            testId="result-album-open"
            onPress={() => {
              ui.go({ kind: 'home' });
              ui.open({ kind: 'album', album });
            }}
          >
            {t('result.toAlbum')}
          </Button>
        )}
        {next && (
          <Button
            testId="result-next"
            onPress={() => {
              ui.open(null);
              ui.go({ kind: 'play', key: next });
            }}
          >
            {t('result.next')}
          </Button>
        )}
      </div>
    </Modal>
  );
}

/** Help with a field: a hint once the free one is used, or hearts once they are gone, for an ad or for seeds. */
export function ToolModal(props: { fieldKey: R.FieldKey; tool: Tool }): JSX.Element {
  const { game, s, t, ui, fmt, day } = useView();
  const { fieldKey, tool } = props;
  const close = ui.open;
  const offered = game.toolOffered(fieldKey, tool);
  // Once the tool is no longer of use, bought or not, the sheet goes; and once a hint is given,
  // so that it shows on the field.
  useEffect(() => {
    if (!offered) close(null);
  });
  useEffect(
    () =>
      game.events.on('hint', (e) => {
        if (e.key === fieldKey) close(null);
      }),
    [game, fieldKey, close],
  );
  const placement = R.TOOL_ADS[tool];
  const slot = R.slotOf(fieldKey);
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
      <p class="g1-center">{t(`sheet.${tool}.desc`, { n: HEARTS })}</p>
      <div class="sheet">
        <Button
          variant="ad"
          block
          testId="tool-watch"
          disabled={!game.adOffered(placement, slot) || game.busy}
          onPress={() => {
            void game.watchAd(placement, slot);
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
        {R.adsLeft(s, placement, day) <= 0 && <p class="g1-small g1-muted g1-center">{t('sheet.noAds')}</p>}
        <Button
          block
          variant="ghost"
          testId="tool-spend"
          disabled={s.seeds < cost || game.busy}
          onPress={() => {
            game.buyTool(fieldKey, tool);
          }}
        >
          <Icon name="seed" size={18} /> {t('sheet.spend', { seeds: fmt(cost) })}
        </Button>
        {s.seeds < cost && <p class="g1-small g1-muted g1-center">{t('sheet.short', { seeds: fmt(s.seeds) })}</p>}
        {tool === 'hearts' && (
          <>
            <p class="g1-small g1-muted g1-center sheet__or">{t('sheet.or')}</p>
            <Button
              block
              variant="ghost"
              testId="tool-restart"
              onPress={() => {
                game.restart(fieldKey);
              }}
            >
              <Icon name="restart" size={18} /> {t('sheet.restart')}
            </Button>
          </>
        )}
      </div>
    </Modal>
  );
}

/** An album: its twelve pictures, grown, in progress or still to start. */
export function AlbumModal(props: { album: AlbumId }): JSX.Element {
  const { s, t, ui } = useView();
  const { album } = props;
  const open = R.albumOpen(s, album);
  const pictures = picturesOf(album);
  return (
    <Modal
      title={t(`album.${album}`)}
      onClose={() => {
        ui.open(null);
      }}
      closeLabel={t('common.close')}
      testId="album"
    >
      <p class="album__lore g1-small g1-center">{t(`lore.${album}`)}</p>
      <p class="g1-small g1-muted g1-center" data-testid="album-progress">
        {open ? t('album.progress', { grown: R.grownIn(s, album), total: pictures.length, seeds: ALBUM_SEEDS }) : t('album.locked', { n: R.neededToOpen(s, album), of: OPEN_AFTER })}
      </p>
      <ul class="tiles">
        {pictures.map((id) => (
          <PictureTile key={id} id={id} open={open} />
        ))}
      </ul>
    </Modal>
  );
}

function PictureTile(props: { id: PictureId; open: boolean }): JSX.Element {
  const { s, t, ui } = useView();
  const { id, open } = props;
  const picture = pictureOf(id);
  const puzzle = puzzleOf(picture);
  const grown = s.grown.includes(id);
  // A field opened but not yet planted shows as a new one.
  const opened = R.fieldOf(s, id);
  const field = opened && R.touched(opened) ? opened : null;
  const { width, height } = puzzle.shape;
  return (
    <li>
      <button
        type="button"
        class={`tile${grown ? ' tile--grown' : field ? ' tile--started' : ''}`}
        data-testid={`picture-${id}`}
        disabled={!open}
        aria-label={grown ? t(`picture.${id}`) : t('album.tile', { width, height })}
        onClick={() => {
          if (grown) ui.open({ kind: 'picture', id });
          else {
            ui.open(null);
            ui.go({ kind: 'play', key: id });
          }
        }}
      >
        <span class="tile__art">
          {grown ? (
            <PictureArt picture={picture} size={64} />
          ) : field ? (
            <MiniField field={field} puzzle={puzzle} size={64} />
          ) : (
            <span class="tile__new" aria-hidden="true">
              {open ? '?' : <Icon name="lock" size={18} />}
            </span>
          )}
        </span>
        <span class="tile__name">{grown ? t(`picture.${id}`) : t('album.size', { width, height })}</span>
      </button>
    </li>
  );
}

/** A grown picture, big. */
export function PictureModal(props: { id: PictureId }): JSX.Element {
  const { t, ui } = useView();
  const { id } = props;
  const back = () => {
    ui.open({ kind: 'album', album: albumOf(id) });
  };
  return (
    <Modal title={t(`picture.${id}`)} onClose={back} closeLabel={t('common.close')} testId="picture">
      <figure class="result__picture">
        <PictureArt picture={pictureOf(id)} size={240} class="picture--framed" />
        <figcaption class="g1-small g1-muted">{t(`album.${albumOf(id)}`)}</figcaption>
      </figure>
      <div class="g1-row">
        <Button variant="ghost" testId="picture-back" onPress={back}>
          {t('common.back')}
        </Button>
      </div>
    </Modal>
  );
}

/** How to play, with a worked row. */
export function RulesModal(): JSX.Element {
  const { t, ui, marker } = useView();
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
        <li>{t('rules.clues')}</li>
        <li>
          {t('rules.example')}
          <span class="rules__row" aria-hidden="true">
            <span class="rules__clue">3 1</span>
            {[true, true, true, false, true].map((rice, i) => (
              <span key={i} class={`rules__cell${rice ? ' rules__cell--rice' : ''}`}>
                {rice ? <Icon name="sprout" size={18} /> : <MarkerArt marker={marker} size={16} />}
              </span>
            ))}
          </span>
        </li>
        <li>{t('rules.pebbles')}</li>
        <li>{t('rules.hearts', { n: HEARTS })}</li>
        <li>{t('rules.logic')}</li>
      </ol>
    </Modal>
  );
}

function LookPreview(props: { id: LookId }): JSX.Element {
  if (R.isMarker(props.id))
    return (
      <span class="look__preview look__marker" aria-hidden="true">
        <MarkerArt marker={props.id} size={34} />
      </span>
    );
  return <SceneSwatch scene={props.id} />;
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
          disabled={s.seeds < cost}
          onPress={() => {
            game.buyLook(id);
          }}
        >
          <Icon name="seed" size={14} /> {fmt(cost)}
        </Button>
      )}
    </li>
  );
}

export function LooksModal(): JSX.Element {
  const { game, s, t, ui, scene, marker } = useView();
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
      <h3 class="looks__heading">{t('looks.scenes')}</h3>
      <ul class="looks">
        {SCENES.map((id) => (
          <LookRow key={id} id={id} inUse={id === scene} />
        ))}
      </ul>
      <h3 class="looks__heading">{t('looks.markers')}</h3>
      <ul class="looks">
        {MARKERS.map((id) => (
          <LookRow key={id} id={id} inUse={id === marker} />
        ))}
      </ul>
      {game.sells && R.collectionOffered(s) && (
        <div class="looks__collection">
          <Icon name="frame" size={28} />
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

function PackCard(props: { id: SeedPack }): JSX.Element {
  const { game, t, fmt } = useView();
  const price = priceOf(props.id, game.products);
  const seeds = catalogItem(props.id)?.grants?.seeds ?? 0;
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
      <Icon name="seed" size={34} />
      <span class="pack__amount">{t('shop.seeds', { seeds: fmt(seeds) })}</span>
      <span class="pack__name g1-small">{t(`shop.${props.id}`)}</span>
      <span class="pack__price">{price ?? '…'}</span>
    </button>
  );
}

type OneTime = 'farmer_kit' | 'remove_ads' | 'field_collection';

const ONE_TIME_ICONS: Record<OneTime, IconName> = { farmer_kit: 'hat', remove_ads: 'noads', field_collection: 'frame' };

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
  const kit = R.hasEntitlement(s, 'farmer_kit');
  const collection = R.hasEntitlement(s, 'field_collection');
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
        <Icon name="seed" size={32} />
        <div class="offer__body">
          <strong>{t('shop.free')}</strong>
          <span class="g1-small g1-muted">{t('shop.free.desc', { seeds: FREE_SEEDS, left: R.adsLeft(s, 'free_seeds', day) })}</span>
        </div>
        <Button
          small
          variant="ad"
          testId="watch-free"
          disabled={!game.adOffered('free_seeds') || game.busy}
          onPress={() => {
            void game.watchAd('free_seeds');
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
      {game.sells && (
        <>
          <div class="packs" data-testid="seed-packs">
            {SEED_PACKS.map((id) => (
              <PackCard key={id} id={id} />
            ))}
          </div>
          {(kit || R.farmerKitOffered(s)) && <OfferRow id="farmer_kit" owned={kit} />}
          <OfferRow id="remove_ads" owned={free} />
          {(collection || R.collectionOffered(s)) && <OfferRow id="field_collection" owned={collection} />}
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
