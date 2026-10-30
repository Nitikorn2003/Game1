import { describe, expect, it } from 'vitest';
import { escapeGoesBack, handleBack, pushBackHandler } from '../src/back.js';

describe('the back button', () => {
  it('goes to the newest handler, and to the app when nothing takes it', () => {
    const calls: string[] = [];
    expect(handleBack()).toBe(false);
    const removeScreen = pushBackHandler(() => {
      calls.push('screen');
      return true;
    });
    const removeModal = pushBackHandler(() => {
      calls.push('modal');
      return true;
    });
    expect(handleBack()).toBe(true);
    removeModal();
    expect(handleBack()).toBe(true);
    removeScreen();
    expect(handleBack()).toBe(false);
    expect(calls).toEqual(['modal', 'screen']);
  });

  it('removes a handler that was added before newer ones', () => {
    const calls: string[] = [];
    const removeOld = pushBackHandler(() => {
      calls.push('old');
      return true;
    });
    const removeNew = pushBackHandler(() => {
      calls.push('new');
      return false;
    });
    removeOld();
    removeOld();
    expect(handleBack()).toBe(false);
    removeNew();
    expect(handleBack()).toBe(false);
    expect(calls).toEqual(['new']);
  });

  it('treats Escape as back', () => {
    const keys = new EventTarget();
    const stop = escapeGoesBack(keys);
    const press = (key: string) => {
      const event = Object.assign(new Event('keydown', { cancelable: true }), { key });
      keys.dispatchEvent(event);
      return event.defaultPrevented;
    };
    let closed = 0;
    const remove = pushBackHandler(() => {
      closed += 1;
      return true;
    });
    expect(press('Enter')).toBe(false);
    expect(press('Escape')).toBe(true);
    remove();
    expect(press('Escape')).toBe(false);
    stop();
    pushBackHandler(() => {
      closed += 1;
      return true;
    })();
    expect(closed).toBe(1);
  });
});
