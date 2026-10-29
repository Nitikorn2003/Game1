import { MemoryStore, type KeyValueStore } from '@game1/engine';

export interface WebStore extends KeyValueStore {
  /** False when the browser refused storage (private mode, blocked site data): nothing survives a reload. */
  readonly persistent: boolean;
}

function probe(): Storage | null {
  try {
    const storage = globalThis.localStorage;
    const key = '__g1_probe__';
    storage.setItem(key, '1');
    storage.removeItem(key);
    return storage;
  } catch {
    return null;
  }
}

/** localStorage under a prefix, or memory when the browser does not allow storage. */
export function webStorage(prefix: string): WebStore {
  const storage = probe();
  if (!storage) {
    const memory = new MemoryStore();
    return { persistent: false, get: (k) => memory.get(k), set: (k, v) => memory.set(k, v), remove: (k) => memory.remove(k) };
  }
  return {
    persistent: true,
    get: (key) => Promise.resolve(storage.getItem(prefix + key)),
    set: (key, value) => {
      try {
        storage.setItem(prefix + key, value);
        return Promise.resolve();
      } catch (err) {
        return Promise.reject(err instanceof Error ? err : new Error(String(err)));
      }
    },
    remove: (key) => {
      storage.removeItem(prefix + key);
      return Promise.resolve();
    },
  };
}
