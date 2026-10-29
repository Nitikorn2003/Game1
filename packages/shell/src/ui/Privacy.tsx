import { Modal } from '@game1/ui';
import type { JSX } from 'preact';
import { POLICY_UPDATED, type PolicySection } from '../privacy.js';
import type { ShellTranslate } from '../services.js';

/** The privacy policy, in the player's language. */
export function PrivacyModal(props: { t: ShellTranslate; policy: readonly PolicySection[]; onClose: () => void }): JSX.Element {
  const { t } = props;
  return (
    <Modal title={t('settings.privacy')} onClose={props.onClose} closeLabel={t('common.close')} testId="privacy-modal">
      <div class="g1-policy">
        <p class="g1-small g1-muted">{t('settings.privacyUpdated', { date: POLICY_UPDATED })}</p>
        {props.policy.map((section) => (
          <section key={section.id}>
            <h3>{section.heading}</h3>
            <p>{section.body}</p>
          </section>
        ))}
      </div>
    </Modal>
  );
}
