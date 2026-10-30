import { describe, expect, it } from 'vitest';
import {
  MemoryStore,
  SaveError,
  SaveSlots,
  decodeSave,
  encodeSave,
  exportSave,
  importSave,
  type SaveFormat,
} from '../src/save.js';
import { ManualClock } from '../src/time.js';

interface StateV2 {
  ore: number;
  depth: number;
  name: string;
}

const format: SaveFormat<StateV2> = {
  game: 'testgame',
  version: 2,
  migrations: {
    // Version 1 called depth "level".
    1: ({ level, ...rest }) => ({ ...rest, depth: level }),
  },
  restore(data) {
    const ore = typeof data.ore === 'number' && Number.isFinite(data.ore) ? data.ore : 0;
    if (typeof data.depth !== 'number') throw new Error('depth missing');
    return { ore, depth: data.depth, name: typeof data.name === 'string' ? data.name : 'Delver' };
  },
};

const v1Format: SaveFormat<{ ore: number; level: number }> = {
  game: 'testgame',
  version: 1,
  migrations: {},
  restore: (data) => data as { ore: number; level: number },
};

describe('save encoding', () => {
  it('round-trips a state', () => {
    const text = encodeSave(format, { ore: 12.5, depth: 3, name: 'Ari ไทย' }, 4, 1000);
    expect(decodeSave(format, text)).toEqual({
      state: { ore: 12.5, depth: 3, name: 'Ari ไทย' },
      seq: 4,
      savedAt: 1000,
      version: 2,
    });
  });

  it('migrates old saves up to the current version', () => {
    const old = encodeSave(v1Format, { ore: 5, level: 9 }, 1, 0);
    expect(decodeSave(format, old).state).toEqual({ ore: 5, depth: 9, name: 'Delver' });
    expect(decodeSave(format, old).version).toBe(1);
  });

  it('repairs values the restore step can fix, like NaN written as null', () => {
    const text = encodeSave(format, { ore: Number.NaN, depth: 2, name: 'x' }, 1, 0);
    expect(decodeSave(format, text).state.ore).toBe(0);
  });

  it('rejects damaged, foreign, newer and broken saves with a reason', () => {
    const good = encodeSave(format, { ore: 1, depth: 1, name: 'x' }, 1, 0);
    const reason = (text: string, f: SaveFormat<unknown> = format) => {
      try {
        decodeSave(f, text);
        return 'ok';
      } catch (err) {
        return (err as SaveError).reason;
      }
    };
    expect(reason('not json')).toBe('not_a_save');
    expect(reason('{"hello":1}')).toBe('not_a_save');
    expect(reason(good.replace('"ore\\":1', '"ore\\":9'))).toBe('checksum');
    expect(reason(good, { ...format, game: 'othergame' })).toBe('wrong_game');
    expect(reason(good, { ...v1Format })).toBe('too_new');
    expect(reason(good, { ...format, version: 3 })).toBe('migration');
    expect(reason(encodeSave(format, { ore: 1 } as unknown as StateV2, 1, 0))).toBe('invalid');
  });

  it('exports to one line of text and imports it back', () => {
    const text = exportSave(format, { ore: 7, depth: 4, name: 'Ploy ไทย' }, 50);
    expect(text).toMatch(/^testgame:[A-Za-z0-9+/=]+$/);
    expect(importSave(format, `  ${text}\n`).state).toEqual({ ore: 7, depth: 4, name: 'Ploy ไทย' });
    expect(() => importSave(format, 'othergame:abc')).toThrow(SaveError);
    expect(() => importSave(format, 'testgame:%%%')).toThrow(SaveError);
  });
});

describe('SaveSlots', () => {
  it('starts empty, then loads the newest save', async () => {
    const store = new MemoryStore();
    const clock = new ManualClock(100);
    const slots = new SaveSlots(store, 'g', format, clock);
    expect(await slots.load()).toEqual({ kind: 'empty' });
    await slots.save({ ore: 1, depth: 1, name: 'a' });
    clock.advance(10);
    await slots.save({ ore: 2, depth: 1, name: 'a' });
    await slots.save({ ore: 3, depth: 2, name: 'a' });
    const again = new SaveSlots(store, 'g', format, clock);
    const loaded = await again.load();
    expect(loaded.kind).toBe('loaded');
    if (loaded.kind !== 'loaded') return;
    expect(loaded.save.state.ore).toBe(3);
    expect(loaded.save.seq).toBe(3);
    expect(loaded.fellBack).toBe(false);
    expect([...store.data.keys()].sort()).toEqual(['g.a', 'g.b']);
  });

  it('falls back to the older copy when the newest one is damaged, then overwrites the damaged one', async () => {
    const store = new MemoryStore();
    const slots = new SaveSlots(store, 'g', format, new ManualClock());
    await slots.save({ ore: 1, depth: 1, name: 'a' }); // seq 1 -> b
    await slots.save({ ore: 2, depth: 1, name: 'a' }); // seq 2 -> a
    store.data.set('g.a', (store.data.get('g.a') ?? '').slice(0, 30)); // cut-off write
    const reopened = new SaveSlots(store, 'g', format, new ManualClock());
    const loaded = await reopened.load();
    expect(loaded.kind === 'loaded' && loaded.save.state.ore).toBe(1);
    expect(loaded.kind === 'loaded' && loaded.fellBack).toBe(true);
    await reopened.save({ ore: 5, depth: 1, name: 'a' }); // seq 2 -> a, replacing the damaged copy
    const third = await new SaveSlots(store, 'g', format, new ManualClock()).load();
    expect(third.kind === 'loaded' && third.save.state.ore).toBe(5);
    expect(third.kind === 'loaded' && third.fellBack).toBe(false);
  });

  it('keeps unreadable saves aside instead of losing them', async () => {
    const store = new MemoryStore();
    store.data.set('g.a', 'garbage');
    const loaded = await new SaveSlots(store, 'g', format, new ManualClock()).load();
    expect(loaded.kind).toBe('unreadable');
    expect(JSON.parse(store.data.get('g.broken') ?? 'null')).toEqual(['garbage']);
  });

  it('writes the state as it was when save was called, in call order', async () => {
    let release!: () => void;
    const gate = new Promise<void>((resolve) => (release = resolve));
    const store = new MemoryStore();
    const writes: string[] = [];
    const slowStore = {
      get: (k: string) => store.get(k),
      remove: (k: string) => store.remove(k),
      async set(k: string, v: string) {
        if (writes.length === 0) await gate;
        writes.push(k);
        await store.set(k, v);
      },
    };
    const slots = new SaveSlots(slowStore, 'g', format, new ManualClock());
    const state = { ore: 1, depth: 1, name: 'a' };
    const first = slots.save(state);
    state.ore = 2;
    const second = slots.save(state);
    release();
    await Promise.all([first, second]);
    expect(writes).toEqual(['g.b', 'g.a']);
    expect(decodeSave(format, store.data.get('g.b') ?? '').state.ore).toBe(1);
    expect(decodeSave(format, store.data.get('g.a') ?? '').state.ore).toBe(2);
  });

  it('reports a failed write and keeps working afterwards', async () => {
    const store = new MemoryStore();
    let fail = true;
    const flaky = {
      get: (k: string) => store.get(k),
      remove: (k: string) => store.remove(k),
      set: (k: string, v: string) => (fail ? Promise.reject(new Error('quota')) : store.set(k, v)),
    };
    const slots = new SaveSlots(flaky, 'g', format, new ManualClock());
    await expect(slots.save({ ore: 1, depth: 1, name: 'a' })).rejects.toThrow('quota');
    fail = false;
    await slots.save({ ore: 2, depth: 1, name: 'a' });
    const loaded = await new SaveSlots(store, 'g', format, new ManualClock()).load();
    expect(loaded.kind === 'loaded' && loaded.save.state.ore).toBe(2);
    await slots.clear();
    expect(store.data.size).toBe(0);
  });
});
