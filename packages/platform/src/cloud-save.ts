import type { KeyValueStore } from '@game1/engine';
import type { CloudSave, SaveWrite } from './iap-client.js';

/** The server's cloud save endpoints (IapServerClient). */
export interface CloudSaveApi {
  readSave(): Promise<CloudSave | null>;
  writeSave(baseRevision: number | null, data: string): Promise<SaveWrite>;
}

/** What the game provides to the sync. */
export interface CloudSyncHost {
  /** The save as it is now, as export text. */
  current(): string;
  /** How far a save got. When both copies changed, the one further along wins. */
  progress(save: string): number;
  /**
   * Replaces the game with this save from another device, taking over anything from the
   * replaced save that must not be lost, such as purchases: then it answers merged, and the
   * result goes back to the cloud. A throw means not now, and the sync tries again later.
   */
  adopt(save: string): Promise<'adopted' | 'merged' | 'unreadable'>;
  /** This device's save won over this one from another device: take over what must not be lost. */
  absorb?(save: string): Promise<void>;
}

/**
 * uploaded: this device's save is in the cloud now. downloaded: another device got further and
 * its save replaced this one. kept_local: both changed and this device's save won. unchanged:
 * nothing to do. offline: not signed in or the server could not be reached; try again later.
 */
export type SyncOutcome = 'uploaded' | 'downloaded' | 'kept_local' | 'unchanged' | 'offline';

interface SyncMeta {
  /** The cloud revision this device last wrote or read, or null if none yet. */
  revision: number | null;
  /** Hash of the save text at that moment, to tell whether this device has changed it since. */
  hash: string | null;
}

/** FNV-1a: only tells whether the save text changed, so collisions cost nothing worse than an extra upload. */
function textHash(text: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return `${text.length.toString(36)}.${h.toString(36)}`;
}

/**
 * Keeps one save per player in the cloud. Each write names the cloud revision this device last
 * saw, so the server refuses it if another device wrote in between; then the save that got
 * further wins and the other one is kept on this device as a backup.
 */
export class CloudSync {
  private running: Promise<SyncOutcome> | null = null;

  constructor(
    private readonly api: CloudSaveApi,
    private readonly storage: KeyValueStore,
    private readonly host: CloudSyncHost,
    private readonly playerId: () => Promise<string | null>,
  ) {}

  /** Runs one sync; calls made while one runs share its result. */
  sync(): Promise<SyncOutcome> {
    this.running ??= this.run().finally(() => {
      this.running = null;
    });
    return this.running;
  }

  /** Forgets what this device knows about the signed-in player's cloud save, for account deletion. */
  async forget(): Promise<void> {
    const player = await this.playerId();
    if (!player) return;
    await this.storage.remove(`cloud.${player}`);
    await this.storage.remove(`cloud.${player}.backup`);
  }

  /** The save this device replaced with a cloud save, if any, so it can still be recovered. */
  async backup(): Promise<string | null> {
    const player = await this.playerId();
    return player ? this.storage.get(`cloud.${player}.backup`) : null;
  }

  private async run(): Promise<SyncOutcome> {
    const player = await this.playerId();
    if (!player) return 'offline';
    try {
      const meta = await this.meta(player);
      const local = this.host.current();
      const localChanged = textHash(local) !== meta.hash;
      const remote = await this.api.readSave();
      if ((remote?.revision ?? null) === meta.revision) {
        return localChanged ? await this.upload(player, meta.revision, local) : 'unchanged';
      }
      // Another device wrote, or the cloud copy was deleted.
      if (!remote) return await this.upload(player, null, local);
      if (!localChanged) return (await this.download(player, remote)) ? 'downloaded' : await this.overwrite(player, remote);
      return await this.resolve(player, local, remote);
    } catch {
      return 'offline';
    }
  }

  private async upload(player: string, base: number | null, local: string): Promise<SyncOutcome> {
    const result = await this.api.writeSave(base, local);
    if (result.status === 'saved') {
      await this.remember(player, result.save.revision, local);
      return 'uploaded';
    }
    if (!result.current) {
      // Deleted between the read and the write: start a fresh cloud copy.
      const fresh = await this.api.writeSave(null, local);
      if (fresh.status !== 'saved') return 'offline';
      await this.remember(player, fresh.save.revision, local);
      return 'uploaded';
    }
    return this.resolve(player, local, result.current);
  }

  private async resolve(player: string, local: string, remote: CloudSave): Promise<SyncOutcome> {
    if (this.host.progress(remote.data) > this.host.progress(local) && (await this.download(player, remote))) return 'downloaded';
    return this.overwrite(player, remote);
  }

  /** This device's save wins over the cloud copy at `remote.revision`. */
  private async overwrite(player: string, remote: CloudSave): Promise<SyncOutcome> {
    await this.host.absorb?.(remote.data);
    const local = this.host.current();
    const result = await this.api.writeSave(remote.revision, local);
    // Yet another write got in between: leave it for the next sync.
    if (result.status !== 'saved') return 'offline';
    await this.remember(player, result.save.revision, local);
    return 'kept_local';
  }

  private async download(player: string, remote: CloudSave): Promise<boolean> {
    await this.storage.set(`cloud.${player}.backup`, this.host.current());
    const adopted = await this.host.adopt(remote.data);
    if (adopted === 'unreadable') return false;
    const local = this.host.current();
    await this.remember(player, remote.revision, local);
    if (adopted === 'merged') {
      // The cloud copy lacks what this device took over. If another write got in first, the
      // next sync downloads that one and takes it over again.
      const result = await this.api.writeSave(remote.revision, local);
      if (result.status === 'saved') await this.remember(player, result.save.revision, local);
    }
    return true;
  }

  private async meta(player: string): Promise<SyncMeta> {
    const raw = await this.storage.get(`cloud.${player}`);
    if (!raw) return { revision: null, hash: null };
    try {
      const parsed = JSON.parse(raw) as Partial<SyncMeta>;
      return { revision: typeof parsed.revision === 'number' ? parsed.revision : null, hash: typeof parsed.hash === 'string' ? parsed.hash : null };
    } catch {
      return { revision: null, hash: null };
    }
  }

  private remember(player: string, revision: number, text: string): Promise<void> {
    return this.storage.set(`cloud.${player}`, JSON.stringify({ revision, hash: textHash(text) } satisfies SyncMeta));
  }
}
