import { Button, Modal, ProgressBar, Segmented, Toggle } from '@game1/ui';
import type { JSX } from 'preact';
import { useState } from 'preact/hooks';
import { EggArt } from '../art/EggArt.js';
import { Icon } from '../art/Icon.js';
import { LodelingArt } from '../art/LodelingArt.js';
import { ELEMENT_COLORS, RARITY_COLORS } from '../art/palette.js';
import type { HatchResult } from '../game.js';
import { PRIVACY_POLICY, PRIVACY_UPDATED } from '../privacy.js';
import * as C from '../sim/content.js';
import * as R from '../sim/rules.js';
import type { LocaleSetting } from '../sim/state.js';
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
  const { game, s, t, ui } = useView();
  const [mode, setMode] = useState<'none' | 'export' | 'import'>('none');
  const [text, setText] = useState('');
  const [message, setMessage] = useState<string | null>(null);

  const copySave = async () => {
    const save = game.exportSave();
    try {
      await navigator.clipboard.writeText(save);
      setMode('none');
      setMessage(t('settings.exported'));
    } catch {
      // No clipboard access: show the text so it can be copied by hand.
      setText(save);
      setMode('export');
      setMessage(null);
    }
  };
  const loadSave = async () => {
    const ok = await game.importSave(text);
    setMessage(ok ? t('settings.imported') : t('settings.importFailed'));
    if (ok) setMode('none');
  };

  return (
    <Modal
      title={t('settings.title')}
      onClose={() => {
        ui.open(null);
      }}
      closeLabel={t('common.close')}
      testId="settings-modal"
    >
      {!ui.persistent && <p class="note note--bad">{t('settings.storageWarning')}</p>}
      <Toggle
        label={t('settings.sound')}
        on={s.settings.sound}
        onLabel={t('common.on')}
        offLabel={t('common.off')}
        testId="setting-sound"
        onChange={(on) => {
          game.setSettings({ sound: on });
        }}
      />
      <Toggle
        label={t('settings.haptics')}
        on={s.settings.haptics}
        onLabel={t('common.on')}
        offLabel={t('common.off')}
        testId="setting-haptics"
        onChange={(on) => {
          game.setSettings({ haptics: on });
        }}
      />
      <div class="setting">
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
      <div class="setting">
        <span>{t('settings.language')}</span>
        <Segmented<LocaleSetting>
          value={s.settings.locale}
          onChange={(locale) => {
            game.setSettings({ locale });
          }}
          options={[
            { value: 'auto', label: t('settings.language.auto'), testId: 'lang-auto' },
            { value: 'en', label: 'English', testId: 'lang-en' },
            { value: 'th', label: 'ไทย', testId: 'lang-th' },
          ]}
        />
      </div>
      {game.accountsEnabled && <AccountSection />}
      <div class="row">
        <Button
          small
          variant="ghost"
          testId="export-save"
          onPress={() => {
            void copySave();
          }}
        >
          {t('settings.export')}
        </Button>
        <Button
          small
          variant="ghost"
          testId="import-save"
          onPress={() => {
            setText('');
            setMessage(null);
            setMode('import');
          }}
        >
          {t('settings.import')}
        </Button>
      </div>
      {mode === 'export' && (
        <textarea
          class="savebox"
          readOnly
          value={text}
          data-testid="export-text"
          onFocus={(e) => {
            e.currentTarget.select();
          }}
        />
      )}
      {mode === 'import' && (
        <div>
          <p class="small">{t('settings.importPrompt')}</p>
          <textarea
            class="savebox"
            value={text}
            data-testid="import-text"
            onInput={(e) => {
              setText(e.currentTarget.value);
            }}
          />
          <Button
            small
            block
            testId="import-confirm"
            disabled={text.trim() === ''}
            onPress={() => {
              void loadSave();
            }}
          >
            {t('settings.import')}
          </Button>
        </div>
      )}
      {message && (
        <p class="small center" role="status" data-testid="settings-message">
          {message}
        </p>
      )}
      <div class="row">
        <Button
          small
          variant="ghost"
          testId="open-privacy"
          onPress={() => {
            ui.open({ kind: 'privacy' });
          }}
        >
          {t('settings.privacy')}
        </Button>
        {game.privacyOptionsRequired() && (
          <Button
            small
            variant="ghost"
            onPress={() => {
              void game.showPrivacyOptions();
            }}
          >
            {t('settings.adChoices')}
          </Button>
        )}
      </div>
      <p class="small muted center">{t('settings.version', { version: ui.version })}</p>
    </Modal>
  );
}

/** Sign-in, cloud save and account deletion; only in the Android version. */
function AccountSection(): JSX.Element {
  const { game, t, time, now } = useView();
  const [step, setStep] = useState<'none' | 'already_used' | 'link_failed' | 'confirm_delete'>('none');
  const [working, setWorking] = useState(false);
  const account = game.account;
  const run = (task: () => Promise<unknown>) => {
    setWorking(true);
    void task().finally(() => {
      setWorking(false);
    });
  };
  const cloud = game.cloud;
  return (
    <section class="account" data-testid="account">
      <h3>{t('settings.account')}</h3>
      <p class="small">
        {!account ? t('settings.account.offline') : account.guest ? t('settings.account.guest') : t('settings.account.google', { email: account.email ?? '' })}
      </p>
      {account && (
        <p class="small muted">
          {cloud && cloud.outcome !== 'offline' ? t('settings.cloud.synced', { time: time(Math.max(1, (now - cloud.at) / 1000)) }) : t('settings.cloud.offline')}
        </p>
      )}
      {account?.guest && <p class="small muted">{t('settings.account.linkHint')}</p>}
      {step === 'already_used' && <p class="note">{t('settings.account.alreadyUsed')}</p>}
      {step === 'link_failed' && <p class="note note--bad">{t('settings.account.linkFailed')}</p>}
      {step === 'confirm_delete' && <p class="note note--bad">{t('settings.deleteConfirm')}</p>}
      <div class="row">
        {account?.guest && step !== 'already_used' && step !== 'confirm_delete' && (
          <Button
            small
            disabled={working}
            testId="link-google"
            onPress={() => {
              run(async () => {
                const result = await game.linkGoogle();
                setStep(result === 'already_used' ? 'already_used' : result === 'failed' ? 'link_failed' : 'none');
              });
            }}
          >
            {t('settings.account.link')}
          </Button>
        )}
        {step === 'already_used' && (
          <Button
            small
            disabled={working}
            testId="switch-google"
            onPress={() => {
              run(async () => {
                const result = await game.switchToGoogle();
                setStep(result === 'failed' ? 'link_failed' : 'none');
              });
            }}
          >
            {t('settings.account.switch')}
          </Button>
        )}
        {account && step !== 'confirm_delete' && (
          <Button
            small
            variant="ghost"
            disabled={working}
            testId="sync-cloud"
            onPress={() => {
              run(() => game.syncCloud());
            }}
          >
            {t('settings.cloud.sync')}
          </Button>
        )}
      </div>
      {account && (
        <div class="row">
          {step === 'confirm_delete' ? (
            <>
              <Button
                small
                variant="ghost"
                disabled={working}
                testId="delete-no"
                onPress={() => {
                  setStep('none');
                }}
              >
                {t('settings.deleteNo')}
              </Button>
              <Button
                small
                variant="danger"
                disabled={working}
                testId="delete-yes"
                onPress={() => {
                  run(async () => {
                    if (await game.deleteAccount()) setStep('none');
                  });
                }}
              >
                {t('settings.deleteYes')}
              </Button>
            </>
          ) : (
            <Button
              small
              variant="ghost"
              disabled={working}
              testId="delete-account"
              onPress={() => {
                setStep('confirm_delete');
              }}
            >
              {t('settings.delete')}
            </Button>
          )}
        </div>
      )}
    </section>
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
  const { t, ui } = useView();
  return (
    <Modal
      title={t('settings.privacy')}
      onClose={() => {
        ui.open({ kind: 'settings' });
      }}
      closeLabel={t('common.close')}
      testId="privacy-modal"
    >
      <div class="policy" lang="en">
        <p class="small muted">Updated {PRIVACY_UPDATED}</p>
        {PRIVACY_POLICY.map((section) => (
          <section key={section.heading}>
            <h3>{section.heading}</h3>
            <p>{section.body}</p>
          </section>
        ))}
      </div>
    </Modal>
  );
}
