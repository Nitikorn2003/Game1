import { PrivacyModal as ShellPrivacyModal, SettingsModal as ShellSettingsModal } from '@game1/shell/ui';
import { Button, Modal, ProgressBar, Segmented } from '@game1/ui';
import type { JSX } from 'preact';
import { useState } from 'preact/hooks';
import { EggArt } from '../art/EggArt.js';
import { Icon } from '../art/Icon.js';
import { LodelingArt } from '../art/LodelingArt.js';
import { ELEMENT_COLORS, RARITY_COLORS } from '../art/palette.js';
import type { HatchResult } from '../game.js';
import { PRIVACY_POLICY } from '../privacy.js';
import * as C from '../sim/content.js';
import * as R from '../sim/rules.js';
import { ElementDot, Stars } from './Lodelings.js';
import { BuyAmountPicker, BuyLabel, levelsToBuy } from './Upgrades.js';
import { useView, type RewardsTab } from './view.js';

function Chips(props: { rarity: C.Rarity; element: C.Element }): JSX.Element {
  const { t } = useView();
  return (
    <div class="chips">
      <span class="chip" style={{ color: RARITY_COLORS[props.rarity] }}>
        {t(`rarity.${props.rarity}`)}
      </span>
      <span class="chip">
        <ElementDot element={props.element} /> {t(`element.${props.element}`)}
      </span>
    </div>
  );
}

export function OfflineModal(): JSX.Element | null {
  const { game, s, t, fmt, time } = useView();
  const report = s.offline;
  if (!report) return null;
  return (
    <Modal title={t('offline.title')} testId="offline-modal">
      <p class="center">{t('offline.body', { time: time(report.seconds) })}</p>
      <div class="reward-big">
        <Icon name="ore" size={40} />
        <strong data-testid="offline-ore">+{fmt(report.ore)}</strong>
      </div>
      {report.eggs.length > 0 && (
        <div class="center">
          {report.eggs.map((kind, i) => (
            <EggArt key={i} kind={kind} size={36} />
          ))}
          <div>{t('offline.eggs', { count: report.eggs.length })}</div>
        </div>
      )}
      <div class="row row--end">
        <Button
          variant="ghost"
          testId="offline-collect"
          onPress={() => {
            game.collectOffline();
          }}
        >
          {t('offline.collect')}
        </Button>
        {game.adOffered('offline_double') && (
          <Button
            variant="ad"
            testId="offline-double"
            disabled={game.busy}
            onPress={() => {
              void game.watchAd('offline_double');
            }}
          >
            <Icon name="play" size={18} /> {t('offline.double')}
          </Button>
        )}
      </div>
    </Modal>
  );
}

export function HatchModal(props: { result: HatchResult }): JSX.Element | null {
  const { t, ui } = useView();
  const species = C.speciesOf(props.result.species);
  if (!species) return null;
  const close = () => {
    ui.open(null);
  };
  const headline = props.result.isNew ? t('hatch.new') : props.result.gems > 0 ? t('hatch.maxStars', { gems: props.result.gems }) : t('hatch.star');
  return (
    <Modal onClose={close} closeLabel={t('common.close')} testId="hatch-modal">
      <div class="hatch">
        <div class="hatch__stage" style={{ '--glow': ELEMENT_COLORS[species.element].glow }}>
          <span class="hatch__burst" aria-hidden="true" />
          <LodelingArt species={species} size={150} class="hatch__art" />
        </div>
        <h2 data-testid="hatch-headline">{headline}</h2>
        <div class="hatch__name" data-testid="hatch-name">
          {species.name}
        </div>
        <Chips rarity={species.rarity} element={species.element} />
        <Stars count={props.result.stars} />
        <Button block testId="hatch-ok" onPress={close}>
          {t('hatch.nice')}
        </Button>
      </div>
    </Modal>
  );
}

export function LodelingModal(props: { id: C.SpeciesId }): JSX.Element | null {
  const { game, s, t, fmt, ui } = useView();
  const species = C.speciesOf(props.id);
  const owned = s.roster[props.id];
  if (!species || !owned) return null;
  const inTeam = s.team.includes(props.id);
  const full = !inTeam && s.team.length >= R.teamSlots(s);
  const count = levelsToBuy(ui.buyAmount, R.affordableLevels(s, props.id));
  const cost = R.levelCost(s, props.id, count);
  const strong = C.ELEMENTS.find((e) => C.elementMultiplier(species.element, e) > 1) ?? species.element;
  const weak = C.weaknessOf(species.element);
  return (
    <Modal
      onClose={() => {
        ui.open(null);
      }}
      closeLabel={t('common.close')}
      testId="lodeling-modal"
    >
      <div class="detail">
        <LodelingArt species={species} size={130} />
        <h2>{species.name}</h2>
        <Chips rarity={species.rarity} element={species.element} />
        <Stars count={owned.stars} />
        <dl class="stats">
          <div>
            <dt>{t('lodeling.level')}</dt>
            <dd>{owned.level}</dd>
          </div>
          <div>
            <dt>{t('lodeling.damage')}</dt>
            <dd>{t('lodeling.dps', { value: fmt(R.lodelingDps(s, props.id)) })}</dd>
          </div>
        </dl>
        <p class="small muted center">
          {t('lodeling.strong', { element: t(`element.${strong}`) })} · {t('lodeling.weak', { element: t(`element.${weak}`) })}
        </p>
        <BuyAmountPicker />
        <div class="row">
          <Button repeat disabled={cost > s.ore} testId="detail-level" onPress={() => game.levelUp(props.id, ui.buyAmount) > 0}>
            <BuyLabel count={count} cost={cost} fmt={fmt} label={t('lodeling.levelUp')} />
          </Button>
          <Button
            variant={inTeam ? 'ghost' : 'good'}
            disabled={full}
            testId="toggle-team"
            onPress={() => {
              game.toggleTeam(props.id);
            }}
          >
            {inTeam ? t('team.remove') : full ? t('team.full') : t('team.add')}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

function rewardLabel(reward: C.DailyReward, t: ReturnType<typeof useView>['t']): JSX.Element {
  switch (reward.kind) {
    case 'gems':
      return (
        <>
          <Icon name="gem" size={26} />
          <span>{reward.amount}</span>
        </>
      );
    case 'egg':
      return (
        <>
          <EggArt kind={reward.egg} size={30} />
          <span class="small">{t(`egg.${reward.egg}`)}</span>
        </>
      );
    case 'ore_minutes':
      return (
        <>
          <Icon name="ore" size={26} />
          <span class="small">{t('daily.oreMinutes', { minutes: reward.minutes })}</span>
        </>
      );
  }
}

function DailyPanel(): JSX.Element {
  const { game, s, t, day } = useView();
  const ready = R.dailyRewardReady(s, day);
  const position = s.daily.claims % C.DAILY_REWARDS.length;
  return (
    <div>
      <div class="daily-grid">
        {C.DAILY_REWARDS.map((reward, i) => (
          <div key={i} class={`daily ${i < position ? 'daily--done' : ''} ${i === position ? (ready ? 'daily--ready' : 'daily--next') : ''}`}>
            <span class="daily__day">{t('daily.day', { day: i + 1 })}</span>
            {rewardLabel(reward, t)}
            {i < position && <span class="daily__check">✓</span>}
          </div>
        ))}
      </div>
      {ready ? (
        <Button
          block
          variant="good"
          testId="claim-daily"
          onPress={() => {
            game.claimDaily();
          }}
        >
          {t('daily.claim')}
        </Button>
      ) : (
        <p class="center muted">{t('daily.claimed')}</p>
      )}
    </div>
  );
}

function QuestsPanel(): JSX.Element {
  const { game, s, t, fmt } = useView();
  return (
    <div class="list list--flush">
      {s.daily.quests.map((q, i) => (
        <div class="card quest" key={q.metric} data-testid={`quest-${i}`}>
          <div class="quest__text">{t(`quests.${q.metric}`, { target: fmt(q.target) })}</div>
          <ProgressBar value={q.progress / q.target} from="#63d3ff" to="#7bd88f" />
          <div class="quest__foot">
            <span class="small muted">
              {fmt(q.progress)} / {fmt(q.target)}
            </span>
            {q.claimed ? (
              <span class="owned">{t('quests.done')}</span>
            ) : (
              <Button
                small
                variant="gem"
                disabled={q.progress < q.target}
                testId={`claim-quest-${i}`}
                onPress={() => {
                  game.claimQuest(i);
                }}
              >
                <Icon name="gem" size={14} /> {C.QUEST_GEMS}
              </Button>
            )}
          </div>
        </div>
      ))}
      <div class="card quest quest--bonus">
        <div class="quest__text">{t('quests.bonus', { gems: C.QUEST_BONUS_GEMS })}</div>
        {s.daily.bonusClaimed ? (
          <span class="owned">{t('quests.done')}</span>
        ) : (
          <Button
            small
            variant="good"
            disabled={!R.questBonusReady(s)}
            testId="claim-quest-bonus"
            onPress={() => {
              game.claimQuestBonus();
            }}
          >
            {t('quests.claim')}
          </Button>
        )}
      </div>
    </div>
  );
}

function AchievementsPanel(): JSX.Element {
  const { game, s, t, fmt } = useView();
  return (
    <div class="list list--flush">
      {C.ACHIEVEMENT_IDS.map((id) => {
        const target = R.achievementTarget(s, id);
        const value = R.achievementValue(s, id);
        const tier = s.achievements[id];
        const def = C.ACHIEVEMENTS[id];
        return (
          <div class="card quest" key={id} data-testid={`achievement-${id}`}>
            <div class="quest__text">
              <Icon name="trophy" size={18} /> {target === null ? t('achievements.complete') : t(`achievements.${id}`, { target: fmt(target) })}
            </div>
            {target !== null && <ProgressBar value={value / target} from="#ffc23d" to="#ffe08a" />}
            <div class="quest__foot">
              <span class="small muted">
                {tier}/{def.tiers.length}
              </span>
              {target !== null && (
                <Button
                  small
                  variant="gem"
                  disabled={!R.achievementReady(s, id)}
                  testId={`claim-achievement-${id}`}
                  onPress={() => {
                    game.claimAchievement(id);
                  }}
                >
                  <Icon name="gem" size={14} /> {def.gems[tier] ?? 0}
                </Button>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function RewardsModal(props: { tab: RewardsTab }): JSX.Element {
  const { t, ui } = useView();
  const [tab, setTab] = useState<RewardsTab>(props.tab);
  return (
    <Modal
      onClose={() => {
        ui.open(null);
      }}
      closeLabel={t('common.close')}
      testId="rewards-modal"
    >
      <div class="modal-tabs">
        <Segmented<RewardsTab>
          value={tab}
          onChange={setTab}
          options={[
            { value: 'daily', label: t('rewards.daily'), testId: 'rewards-daily' },
            { value: 'quests', label: t('rewards.quests'), testId: 'rewards-quests' },
            { value: 'achievements', label: t('rewards.achievements'), testId: 'rewards-achievements' },
          ]}
        />
      </div>
      {tab === 'daily' && <DailyPanel />}
      {tab === 'quests' && <QuestsPanel />}
      {tab === 'achievements' && <AchievementsPanel />}
    </Modal>
  );
}

export function SettingsModal(): JSX.Element {
  const { game, s, t, ui, time, now } = useView();
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
    >
      <div class="g1-setting">
        <span>{t('settings.numbers')}</span>
        <Segmented
          value={s.settings.numbers}
          onChange={(numbers) => {
            game.setSettings({ numbers });
          }}
          options={[
            { value: 'short', label: t('settings.numbers.short') },
            { value: 'scientific', label: t('settings.numbers.scientific') },
          ]}
        />
      </div>
    </ShellSettingsModal>
  );
}

export function ResurfaceModal(): JSX.Element {
  const { game, s, t, fmt, ui } = useView();
  const dust = R.resurfaceDust(s);
  return (
    <Modal
      title={t('resurface.title')}
      onClose={() => {
        ui.open(null);
      }}
      closeLabel={t('common.close')}
      testId="resurface-modal"
    >
      <div class="reward-big">
        <Icon name="dust" size={40} />
        <strong>+{fmt(dust)}</strong>
      </div>
      <p>{t('resurface.keep')}</p>
      <p class="muted">{t('resurface.reset')}</p>
      <div class="row row--end">
        <Button
          variant="ghost"
          onPress={() => {
            ui.open(null);
          }}
        >
          {t('common.cancel')}
        </Button>
        <Button
          disabled={dust <= 0}
          testId="resurface-confirm"
          onPress={() => {
            game.resurface();
            ui.open(null);
            void game.naturalBreak();
          }}
        >
          <Icon name="up" size={18} /> {t('resurface.confirm')}
        </Button>
      </div>
    </Modal>
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
