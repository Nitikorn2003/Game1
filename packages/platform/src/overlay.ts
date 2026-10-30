/**
 * Minimal DOM dialogs for the test ad and test store, so they work in any game without the
 * game's UI framework. They are clearly marked as tests: no real ad, no real payment.
 */
export interface OverlayButton {
  label: string;
  primary?: boolean;
  testId?: string;
}

const STYLE = `
.g1-test-overlay{position:fixed;inset:0;z-index:1000;display:flex;align-items:center;justify-content:center;padding:max(16px,env(safe-area-inset-top,0px)) 16px max(16px,env(safe-area-inset-bottom,0px));background:rgba(5,4,10,.82);font-family:system-ui,sans-serif}
.g1-test-card{width:min(360px,100%);background:#fff;color:#1d1b24;border-radius:18px;padding:20px 18px 16px;box-shadow:0 20px 60px rgba(0,0,0,.5);text-align:center}
.g1-test-card h3{margin:0 0 6px;font-size:18px}
.g1-test-card p{margin:6px 0 14px;font-size:14px;line-height:1.4;color:#4b4858}
.g1-test-tag{display:inline-block;margin-bottom:10px;padding:2px 8px;border-radius:6px;background:#ffe08a;color:#5a3d00;font-size:12px;font-weight:700;letter-spacing:.04em}
.g1-test-row{display:flex;gap:8px;justify-content:center;flex-wrap:wrap}
.g1-test-row button{min-height:44px;min-width:110px;padding:8px 14px;border-radius:12px;border:0;font:inherit;font-size:15px;cursor:pointer;background:#ece9f3;color:#1d1b24}
.g1-test-row button[data-primary]{background:#5b3df5;color:#fff}
.g1-test-row button:disabled{opacity:.5;cursor:default}
.g1-test-count{font-size:40px;font-weight:700;margin:8px 0;color:#5b3df5}
@media (prefers-color-scheme: dark){.g1-test-card{background:#211f2b;color:#f4f2fa}.g1-test-card p{color:#b9b5c9}.g1-test-row button{background:#34313f;color:#f4f2fa}}
`;

function ensureStyle(): void {
  if (document.getElementById('g1-test-overlay-style')) return;
  const style = document.createElement('style');
  style.id = 'g1-test-overlay-style';
  style.textContent = STYLE;
  document.head.append(style);
}

export interface OverlayOptions {
  tag: string;
  title: string;
  body: string;
  buttons: OverlayButton[];
  /** Seconds to count down before the primary button unlocks. */
  countdown?: number;
  testId?: string;
}

/** Shows a dialog and resolves with the index of the pressed button. */
export function showOverlay(options: OverlayOptions): Promise<number> {
  ensureStyle();
  return new Promise((resolve) => {
    const root = document.createElement('div');
    root.className = 'g1-test-overlay';
    root.setAttribute('role', 'dialog');
    root.setAttribute('aria-modal', 'true');
    if (options.testId) root.dataset.testid = options.testId;
    const card = document.createElement('div');
    card.className = 'g1-test-card';
    const tag = document.createElement('span');
    tag.className = 'g1-test-tag';
    tag.textContent = options.tag;
    const title = document.createElement('h3');
    title.textContent = options.title;
    const body = document.createElement('p');
    body.textContent = options.body;
    card.append(tag, title, body);
    const count = document.createElement('div');
    count.className = 'g1-test-count';
    if (options.countdown) card.append(count);
    const row = document.createElement('div');
    row.className = 'g1-test-row';
    const buttons = options.buttons.map((b, index) => {
      const el = document.createElement('button');
      el.type = 'button';
      el.textContent = b.label;
      if (b.primary) el.dataset.primary = '';
      if (b.testId) el.dataset.testid = b.testId;
      el.addEventListener('click', () => {
        clearInterval(timer);
        root.remove();
        resolve(index);
      });
      row.append(el);
      return { el, primary: b.primary === true };
    });
    card.append(row);
    root.append(card);
    document.body.append(root);
    let left = options.countdown ?? 0;
    const sync = () => {
      count.textContent = left > 0 ? String(left) : '✓';
      for (const b of buttons) if (b.primary) b.el.disabled = left > 0;
    };
    sync();
    const timer = setInterval(() => {
      left -= 1;
      sync();
      if (left <= 0) clearInterval(timer);
    }, 1000);
    (buttons.find((b) => !b.primary) ?? buttons[0])?.el.focus();
  });
}
