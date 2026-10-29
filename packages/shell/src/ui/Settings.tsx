import type { Account, LinkResult, SyncOutcome } from '@game1/platform';
import { Button, Modal, Segmented, Toggle } from '@game1/ui';
import type { ComponentChildren, JSX } from 'preact';
import { useState } from 'preact/hooks';
import type { ShellTranslate } from '../services.js';
import { LOCALES, type Locale, type LocaleSetting, type ShellSettings } from '../settings.js';

/** What the settings screen needs from a game's session. */
export interface SettingsSession {
  readonly state: { settings: ShellSettings };
  readonly accountsEnabled: boolean;
  readonly account: Account | null;
  readonly cloud: { outcome: SyncOutcome; at: number } | null;
  setSettings(patch: Partial<ShellSettings>): void;
  exportSave(): string;
  importSave(text: string): Promise<boolean>;
  privacyOptionsRequired(): boolean;
  showPrivacyOptions(): Promise<void>;
  linkGoogle(): Promise<LinkResult>;
  switchToGoogle(): Promise<LinkResult>;
  syncCloud(): Promise<unknown>;
  deleteAccount(): Promise<boolean>;
}

/** Each language by its own name. */
const LANGUAGE_NAMES: Record<Locale, string> = { en: 'English', th: 'ไทย' };

export interface SettingsModalProps {
  session: SettingsSession;
  t: ShellTranslate;
  /** A duration in seconds as the game shows it, like "3m 20s". */
  time: (seconds: number) => string;
  now: number;
  /** False when the browser keeps nothing between visits. */
  persistent: boolean;
  version: string;
  onClose: () => void;
  onPrivacy: () => void;
  /** The game's own settings, shown between vibration and language. */
  children?: ComponentChildren;
}

/** Sound, vibration, language, the account, copying and loading the save, the privacy policy. */
export function SettingsModal(props: SettingsModalProps): JSX.Element {
  const { session, t } = props;
  const settings = session.state.settings;
  const [mode, setMode] = useState<'none' | 'export' | 'import'>('none');
  const [text, setText] = useState('');
  const [message, setMessage] = useState<string | null>(null);

  const copySave = async () => {
    const save = session.exportSave();
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
    const ok = await session.importSave(text);
    setMessage(ok ? t('settings.imported') : t('settings.importFailed'));
    if (ok) setMode('none');
  };

  return (
    <Modal title={t('settings.title')} onClose={props.onClose} closeLabel={t('common.close')} testId="settings-modal">
      {!props.persistent && <p class="g1-note g1-note--bad">{t('settings.storageWarning')}</p>}
      <Toggle
        label={t('settings.sound')}
        on={settings.sound}
        onLabel={t('common.on')}
        offLabel={t('common.off')}
        testId="setting-sound"
        onChange={(on) => {
          session.setSettings({ sound: on });
        }}
      />
      <Toggle
        label={t('settings.haptics')}
        on={settings.haptics}
        onLabel={t('common.on')}
        offLabel={t('common.off')}
        testId="setting-haptics"
        onChange={(on) => {
          session.setSettings({ haptics: on });
        }}
      />
      {props.children}
      <div class="g1-setting">
        <span>{t('settings.language')}</span>
        <Segmented<LocaleSetting>
          value={settings.locale}
          onChange={(locale) => {
            session.setSettings({ locale });
          }}
          options={[
            { value: 'auto', label: t('settings.language.auto'), testId: 'lang-auto' },
            ...LOCALES.map((locale) => ({ value: locale, label: LANGUAGE_NAMES[locale], testId: `lang-${locale}` })),
          ]}
        />
      </div>
      {session.accountsEnabled && <AccountSection session={session} t={t} time={props.time} now={props.now} />}
      <div class="g1-row">
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
          class="g1-savebox"
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
          <p class="g1-small">{t('settings.importPrompt')}</p>
          <textarea
            class="g1-savebox"
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
        <p class="g1-small g1-center" role="status" data-testid="settings-message">
          {message}
        </p>
      )}
      <div class="g1-row">
        <Button small variant="ghost" testId="open-privacy" onPress={props.onPrivacy}>
          {t('settings.privacy')}
        </Button>
        {session.privacyOptionsRequired() && (
          <Button
            small
            variant="ghost"
            onPress={() => {
              void session.showPrivacyOptions();
            }}
          >
            {t('settings.adChoices')}
          </Button>
        )}
      </div>
      <p class="g1-small g1-muted g1-center">{t('settings.version', { version: props.version })}</p>
    </Modal>
  );
}

/** Sign-in, cloud save and account deletion; only in the Android version. */
function AccountSection(props: Pick<SettingsModalProps, 'session' | 't' | 'time' | 'now'>): JSX.Element {
  const { session, t } = props;
  const [step, setStep] = useState<'none' | 'already_used' | 'link_failed' | 'confirm_delete'>('none');
  const [working, setWorking] = useState(false);
  const account = session.account;
  const run = (task: () => Promise<unknown>) => {
    setWorking(true);
    void task().finally(() => {
      setWorking(false);
    });
  };
  const cloud = session.cloud;
  return (
    <section class="g1-account" data-testid="account">
      <h3>{t('settings.account')}</h3>
      <p class="g1-small">
        {!account ? t('settings.account.offline') : account.guest ? t('settings.account.guest') : t('settings.account.google', { email: account.email ?? '' })}
      </p>
      {account && (
        <p class="g1-small g1-muted">
          {cloud && cloud.outcome !== 'offline'
            ? t('settings.cloud.synced', { time: props.time(Math.max(1, (props.now - cloud.at) / 1000)) })
            : t('settings.cloud.offline')}
        </p>
      )}
      {account?.guest && <p class="g1-small g1-muted">{t('settings.account.linkHint')}</p>}
      {step === 'already_used' && <p class="g1-note">{t('settings.account.alreadyUsed')}</p>}
      {step === 'link_failed' && <p class="g1-note g1-note--bad">{t('settings.account.linkFailed')}</p>}
      {step === 'confirm_delete' && <p class="g1-note g1-note--bad">{t('settings.deleteConfirm')}</p>}
      <div class="g1-row">
        {account?.guest && step !== 'already_used' && step !== 'confirm_delete' && (
          <Button
            small
            disabled={working}
            testId="link-google"
            onPress={() => {
              run(async () => {
                const result = await session.linkGoogle();
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
                const result = await session.switchToGoogle();
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
              run(() => session.syncCloud());
            }}
          >
            {t('settings.cloud.sync')}
          </Button>
        )}
      </div>
      {account && (
        <div class="g1-row">
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
                    if (await session.deleteAccount()) setStep('none');
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
