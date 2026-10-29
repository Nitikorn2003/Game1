import { Button, Segmented, useBackHandler } from '@game1/ui';
import type { JSX } from 'preact';
import { useEffect, useRef, useState } from 'preact/hooks';
import { HEARTS } from '../sim/content.js';
import { albumOf, isPictureId, plantedCount } from '../sim/fields.js';
import { FILLED } from '../sim/nonogram.js';
import * as R from '../sim/rules.js';
import type { Field } from '../sim/state.js';
import { Board, boardSize, reducedMotion, useContentSize } from './Field.js';
import { Icon, MarkerArt } from './Icon.js';
import { useView } from './view.js';

/** How long the grown picture shows on the field before its results. */
const FINALE_MS = 1900;
/** How long a wrong move that took the last heart shows before the hearts sheet. */
const WILT_MS = 700;

export function Play(props: { fieldKey: R.FieldKey }): JSX.Element | null {
  const { game, s, t, ui, marker } = useView();
  const { fieldKey } = props;
  const { go, open } = ui;
  const live = R.fieldOf(s, fieldKey);
  // The field the screen shows: the state lets go of a field the moment it grows.
  const [kept, setKept] = useState<Field | null>(live);
  if (live && live !== kept) setKept(live);
  const [grown, setGrown] = useState(false);
  const [action, setAction] = useState<R.Action>('plant');
  const [lost, setLost] = useState(0);
  // The first field teaches the clues to the end, so the field does not move as its picture grows.
  const [teach] = useState(() => !s.taught);
  const spaceRef = useRef<HTMLDivElement>(null);
  const space = useContentSize(spaceRef);

  useBackHandler(() => {
    go({ kind: 'home' });
    return true;
  });

  useEffect(() => {
    const finish = (result: unknown) => {
      if (!result) return;
      setGrown(true);
      setTimeout(
        () => {
          open({ kind: 'results' });
        },
        reducedMotion() ? 300 : FINALE_MS,
      );
    };
    const offAct = game.events.on('act', (e) => {
      if (e.key !== fieldKey) return;
      finish(e.acted.result);
      if (e.acted.mistake) setLost((n) => n + 1);
      if (e.acted.wilted)
        setTimeout(() => {
          open({ kind: 'tool', key: fieldKey, tool: 'hearts' });
        }, WILT_MS);
    });
    const offHint = game.events.on('hint', (e) => {
      if (e.key === fieldKey) finish(e.hinted.result);
    });
    return () => {
      offAct();
      offHint();
    };
  }, [game, fieldKey, open]);

  const field = live ?? (grown ? kept : null);
  useEffect(() => {
    if (!field) go({ kind: 'home' });
  });
  if (!field) return null;

  const puzzle = R.puzzleOfField(field);
  const size = boardSize(space, puzzle);
  const planted = field.board.filter((state, cell) => state === FILLED && puzzle.shape.filled[cell]).length;
  const total = plantedCount(puzzle);
  const wilted = field.hearts <= 0 && !grown;
  const album = field.mode === 'album' && isPictureId(field.id) ? albumOf(field.id) : null;

  const hint = () => {
    if (grown || wilted) return;
    if (field.freeHints > 0) game.freeHint(fieldKey);
    else open({ kind: 'tool', key: fieldKey, tool: 'hint' });
  };

  return (
    <div class={`play${grown ? ' play--grown' : ''}`} data-testid="play" data-field={field.id}>
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
          <span data-testid="field-title">
            {album ? (
              t(`album.${album}`)
            ) : (
              <>
                <Icon name="sun" size={20} /> {t('play.daily')}
              </>
            )}
          </span>
          <small class="topbar__where" data-testid="field-size">
            {t('play.size', { width: puzzle.shape.width, height: puzzle.shape.height })}
          </small>
        </h1>
        <SeedCount />
      </header>

      <div class="status">
        <span class="hearts" key={lost} role="img" aria-label={t('play.hearts', { n: field.hearts, of: HEARTS })} data-testid="hearts" data-hearts={field.hearts}>
          {Array.from({ length: HEARTS }, (_, i) => (
            <span key={i} class={`heart${i < field.hearts ? '' : ' heart--lost'}${i === field.hearts && lost > 0 ? ' heart--breaking' : ''}`}>
              <Icon name={i < field.hearts ? 'heart' : 'heartEmpty'} size={22} />
            </span>
          ))}
        </span>
        <span class="planted" data-testid="planted" role="img" aria-label={t('play.planted', { n: planted, of: total })}>
          <Icon name="sprout" size={20} />
          <span>
            {planted}/{total}
          </span>
        </span>
      </div>

      <div class="space" ref={spaceRef}>
        {space.width > 0 && <Board fieldKey={fieldKey} field={field} puzzle={puzzle} size={size} action={action} grown={grown} />}
        {grown && (
          <div class="grown-banner" data-testid="grown">
            <Icon name="sprout" size={30} />
            <strong>{t('play.grown')}</strong>
          </div>
        )}
      </div>

      <div class="dock">
        <Segmented<R.Action>
          label={t('play.tool')}
          value={action}
          onChange={setAction}
          options={[
            {
              value: 'plant',
              testId: 'tool-plant',
              label: (
                <>
                  <Icon name="sprout" size={22} /> {t('play.plant')}
                </>
              ),
            },
            {
              value: 'pebble',
              testId: 'tool-pebble',
              label: (
                <>
                  <MarkerArt marker={marker} size={22} /> {t('play.pebble')}
                </>
              ),
            },
          ]}
        />
        <button type="button" class="hint-btn" data-testid="hint" disabled={grown || wilted} onClick={hint} aria-label={field.freeHints > 0 ? t('play.hintFree') : t('play.hint')}>
          <Icon name="hint" size={26} />
          <span class="hint-btn__name">{t('play.hintShort')}</span>
          <span class="hint-btn__badge">{field.freeHints > 0 ? t('play.free') : <Icon name="play" size={11} />}</span>
        </button>
      </div>

      {/* Always there, so the field does not move when a note comes or goes. */}
      <div class="foot">
        {wilted ? (
          <div class="note note--alert" role="alert" data-testid="wilted">
            <p>
              <strong>{t('wilted.title')}</strong> {t('wilted.body')}
            </p>
            <Button
              small
              testId="wilted-help"
              onPress={() => {
                open({ kind: 'tool', key: fieldKey, tool: 'hearts' });
              }}
            >
              <Icon name="heart" size={16} /> {t('wilted.help')}
            </Button>
          </div>
        ) : (
          teach && (
            <p class="note" data-testid="teach">
              {t('play.teach')}{' '}
              <button
                type="button"
                class="linkbtn"
                data-testid="teach-more"
                onClick={() => {
                  open({ kind: 'rules' });
                }}
              >
                {t('play.howTo')}
              </button>
            </p>
          )
        )}
      </div>
    </div>
  );
}

/** The seeds a player has; tapping them opens the shop. */
export function SeedCount(): JSX.Element {
  const { s, t, ui, fmt } = useView();
  return (
    <button
      type="button"
      class="res"
      data-testid="seeds"
      aria-label={`${t('res.seeds')}: ${fmt(s.seeds)}`}
      onClick={() => {
        ui.open({ kind: 'shop' });
      }}
    >
      <Icon name="seed" size={22} />
      <span class="res__value">{fmt(s.seeds)}</span>
    </button>
  );
}
