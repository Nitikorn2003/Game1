import type { CSSProperties, ComponentChildren, JSX } from 'preact';
import { useEffect, useRef } from 'preact/hooks';
import { useHoldRepeat } from './hooks.js';

export type ButtonVariant = 'primary' | 'ghost' | 'gem' | 'ad' | 'good' | 'danger';

export interface ButtonProps {
  children: ComponentChildren;
  /** Return false to stop a held button from repeating. */
  onPress?: () => unknown;
  variant?: ButtonVariant;
  small?: boolean;
  block?: boolean;
  disabled?: boolean;
  /** Keep firing while the button is held down. */
  repeat?: boolean;
  label?: string;
  class?: string;
  testId?: string;
}

export function Button(props: ButtonProps): JSX.Element {
  const { variant = 'primary', disabled = false } = props;
  const hold = useHoldRepeat(() => props.onPress?.(), !disabled && props.repeat === true);
  const classes = ['g1-btn', variant !== 'primary' && `g1-btn--${variant}`, props.small && 'g1-btn--small', props.block && 'g1-btn--block', props.class]
    .filter(Boolean)
    .join(' ');
  return (
    <button
      type="button"
      class={classes}
      disabled={disabled}
      aria-label={props.label}
      data-testid={props.testId}
      {...(props.repeat ? hold : {})}
      onClick={
        props.repeat
          ? (e) => {
              // Pointer presses are handled by the hold repeat; keyboard presses arrive here.
              if (e.detail === 0) props.onPress?.();
            }
          : () => props.onPress?.()
      }
    >
      {props.children}
    </button>
  );
}

export function ProgressBar(props: { value: number; label?: string; from?: string; to?: string; class?: string }): JSX.Element {
  const pct = Math.max(0, Math.min(1, Number.isFinite(props.value) ? props.value : 0)) * 100;
  const style = { '--g1-bar-from': props.from, '--g1-bar-to': props.to } as CSSProperties;
  return (
    <div class={`g1-bar ${props.class ?? ''}`} role="progressbar" aria-label={props.label} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(pct)} style={style}>
      <span style={{ width: `${pct}%` }} />
    </div>
  );
}

export interface ModalProps {
  title?: ComponentChildren;
  children: ComponentChildren;
  onClose?: () => void;
  closeLabel?: string;
  testId?: string;
}

export function Modal(props: ModalProps): JSX.Element {
  const box = useRef<HTMLDivElement>(null);
  const onClose = props.onClose;
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    box.current?.querySelector<HTMLElement>('button, [href], input')?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && onClose) onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
      previous?.focus();
    };
  }, [onClose]);
  return (
    <div
      class="g1-modal-backdrop"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose?.();
      }}
    >
      <div class="g1-modal" role="dialog" aria-modal="true" ref={box} data-testid={props.testId}>
        {onClose && (
          <button type="button" class="g1-btn g1-btn--ghost g1-btn--small g1-modal__close" aria-label={props.closeLabel ?? 'Close'} onClick={onClose}>
            ✕
          </button>
        )}
        {props.title !== undefined && <h2>{props.title}</h2>}
        {props.children}
      </div>
    </div>
  );
}

export interface TabItem<K extends string> {
  key: K;
  label: string;
  icon: ComponentChildren;
  badge?: number;
}

export function Tabs<K extends string>(props: { items: readonly TabItem<K>[]; active: K; onSelect: (key: K) => void }): JSX.Element {
  return (
    <nav class="g1-tabs" role="tablist">
      {props.items.map((item) => (
        <button
          type="button"
          role="tab"
          class="g1-tab"
          key={item.key}
          aria-selected={item.key === props.active}
          data-testid={`tab-${item.key}`}
          onClick={() => {
            props.onSelect(item.key);
          }}
        >
          {item.icon}
          <span>{item.label}</span>
          {item.badge !== undefined && item.badge > 0 && <span class="g1-tab__badge">{item.badge > 9 ? '9+' : item.badge}</span>}
        </button>
      ))}
    </nav>
  );
}

export interface ToastItem {
  id: number;
  content: ComponentChildren;
}

export function Toasts(props: { items: readonly ToastItem[] }): JSX.Element {
  return (
    <div class="g1-toasts" aria-live="polite">
      {props.items.map((t) => (
        <div class="g1-toast" key={t.id}>
          {t.content}
        </div>
      ))}
    </div>
  );
}

export function Toggle(props: { label: string; on: boolean; onChange: (on: boolean) => void; onLabel?: string; offLabel?: string; testId?: string }): JSX.Element {
  return (
    <label class="g1-toggle">
      <span>{props.label}</span>
      <button
        type="button"
        role="switch"
        aria-checked={props.on}
        class="g1-toggle__switch"
        data-testid={props.testId}
        onClick={() => {
          props.onChange(!props.on);
        }}
      >
        <span class="g1-toggle__knob" />
        <span class="g1-toggle__text">{props.on ? (props.onLabel ?? 'On') : (props.offLabel ?? 'Off')}</span>
      </button>
    </label>
  );
}

export interface SegmentedOption<V extends string | number> {
  value: V;
  label: ComponentChildren;
  testId?: string;
}

/** A row of mutually exclusive choices. */
export function Segmented<V extends string | number>(props: { options: readonly SegmentedOption<V>[]; value: V; onChange: (value: V) => void; label?: string }): JSX.Element {
  return (
    <div class="g1-seg" role="radiogroup" aria-label={props.label}>
      {props.options.map((o) => (
        <button
          type="button"
          key={String(o.value)}
          role="radio"
          aria-checked={o.value === props.value}
          class="g1-seg__opt"
          data-testid={o.testId}
          onClick={() => {
            props.onChange(o.value);
          }}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
