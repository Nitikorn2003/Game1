import type { CSSProperties, JSX } from 'preact';
import { Icon } from '../art/Icon.js';
import { SKILLS, SKILL_IDS, type SkillId } from '../sim/content.js';
import * as R from '../sim/rules.js';
import { useView } from './view.js';

export function SkillBar(): JSX.Element {
  return (
    <div class="skills" role="toolbar">
      {SKILL_IDS.map((id) => (
        <SkillButton key={id} id={id} />
      ))}
    </div>
  );
}

function SkillButton(props: { id: SkillId }): JSX.Element {
  const { game, s, t, now } = useView();
  const id = props.id;
  const def = SKILLS[id];
  const unlocked = R.skillUnlocked(s, id);
  const skill = s.skills[id];
  const active = R.skillActive(s, id, now);
  const cooling = unlocked && !active && now < skill.readyAt;
  const progress = cooling ? 1 - (skill.readyAt - now) / (def.cooldownSeconds * 1000) : active && def.durationSeconds > 0 ? (skill.activeUntil - now) / (def.durationSeconds * 1000) : 1;
  const style: CSSProperties = { '--p': Math.max(0, Math.min(1, progress)) };
  const label = unlocked ? `${t(`skill.${id}`)}: ${t(`skill.${id}.desc`)}` : t('skill.locked', { depth: def.unlockDepth });
  const seconds = cooling ? Math.ceil((skill.readyAt - now) / 1000) : active ? Math.ceil((skill.activeUntil - now) / 1000) : 0;
  return (
    <button
      type="button"
      class={`skill ${active ? 'skill--active' : ''} ${cooling ? 'skill--cooling' : ''} ${unlocked ? '' : 'skill--locked'}`}
      style={style}
      disabled={!unlocked || cooling || active}
      aria-label={label}
      title={label}
      data-testid={`skill-${id}`}
      onClick={() => {
        game.castSkill(id);
      }}
    >
      <span class="skill__ring" aria-hidden="true" />
      <Icon name={unlocked ? id : 'lock'} size={26} />
      <span class="skill__name">{unlocked ? t(`skill.${id}`) : t('skill.locked', { depth: def.unlockDepth })}</span>
      {seconds > 0 && <span class="skill__time">{seconds}</span>}
    </button>
  );
}
