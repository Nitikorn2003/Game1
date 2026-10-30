import { MemoryStore } from '@game1/engine';
import { describe, expect, it } from 'vitest';
import { FirebaseAuth, type FirebaseAuthenticationPlugin } from '../src/auth.js';
import { CloudSync, type CloudSaveApi, type CloudSyncHost } from '../src/cloud-save.js';
import type { CloudSave, SaveWrite } from '../src/iap-client.js';

type User = { uid: string; isAnonymous: boolean; email: string | null };

class FakeFirebase implements FirebaseAuthenticationPlugin {
  user: User | null = null;
  offline = false;
  linkError: { code?: string; message: string } | null = null;
  signIns = 0;
  /** Like Firebase after a while: deleting needs a fresh sign-in first. */
  staleLogin = false;
  /** The Google account picked in the sign-in sheet. */
  googleAccount = 'google-user';
  readonly deleted: string[] = [];
  getCurrentUser() {
    return this.offline ? Promise.reject(new Error('offline')) : Promise.resolve({ user: this.user });
  }
  signInAnonymously() {
    this.signIns += 1;
    this.user = { uid: `guest-${this.signIns}`, isAnonymous: true, email: null };
    return Promise.resolve({ user: this.user });
  }
  signInWithGoogle() {
    this.user = { uid: this.googleAccount, isAnonymous: false, email: 'player@example.com' };
    this.staleLogin = false;
    return Promise.resolve({ user: this.user });
  }
  linkWithGoogle() {
    if (this.linkError) return Promise.reject(Object.assign(new Error(this.linkError.message), this.linkError.code ? { code: this.linkError.code } : {}));
    if (this.user) this.user = { ...this.user, isAnonymous: false, email: 'player@example.com' };
    return Promise.resolve({ user: this.user });
  }
  getIdToken(options?: { forceRefresh: boolean }) {
    return Promise.resolve({ token: `${this.user?.uid ?? 'none'}${options?.forceRefresh ? ':fresh' : ''}` });
  }
  deleteUser(): Promise<void> {
    if (this.staleLogin) return Promise.reject(Object.assign(new Error('This operation is sensitive and requires recent authentication.'), { code: 'auth/requires-recent-login' }));
    if (this.user) this.deleted.push(this.user.uid);
    this.user = null;
    return Promise.resolve();
  }
  signOut(): Promise<void> {
    this.user = null;
    return Promise.resolve();
  }
}

describe('Firebase sign-in', () => {
  it('signs a new player in as a guest once, even when asked many times at once', async () => {
    const firebase = new FakeFirebase();
    const auth = new FirebaseAuth(firebase);
    const accounts = await Promise.all([auth.account(), auth.account(), auth.idToken(false)]);
    expect(accounts).toEqual([{ playerId: 'guest-1', guest: true, email: null }, { playerId: 'guest-1', guest: true, email: null }, 'guest-1']);
    expect(firebase.signIns).toBe(1);
    expect(await auth.idToken(true)).toBe('guest-1:fresh');
  });

  it('keeps playing signed out when Firebase cannot be reached', async () => {
    const firebase = new FakeFirebase();
    firebase.offline = true;
    const auth = new FirebaseAuth(firebase);
    expect(await auth.account()).toBeNull();
    expect(await auth.idToken(false)).toBeNull();
  });

  it('links Google to the guest account and explains why linking failed', async () => {
    const firebase = new FakeFirebase();
    const auth = new FirebaseAuth(firebase);
    expect(await auth.linkGoogle()).toBe('linked');
    expect(await auth.account()).toEqual({ playerId: 'guest-1', guest: false, email: 'player@example.com' });

    firebase.linkError = { code: 'auth/credential-already-in-use', message: 'This credential is already associated with a different user account.' };
    expect(await auth.linkGoogle()).toBe('already_used');
    firebase.linkError = { message: '12501: ' };
    expect(await auth.linkGoogle()).toBe('cancelled');
    firebase.linkError = { message: 'Authorization canceled.' };
    expect(await auth.linkGoogle()).toBe('cancelled');
    firebase.linkError = { message: '7: A network error occurred.' };
    expect(await auth.linkGoogle()).toBe('failed');

    expect(await auth.switchToGoogle()).toBe('linked');
    expect((await auth.account())?.playerId).toBe('google-user');
  });

  it('deletes the account, signing in to Google again first when Firebase asks for it', async () => {
    const firebase = new FakeFirebase();
    const auth = new FirebaseAuth(firebase);
    await auth.switchToGoogle();
    firebase.staleLogin = true;
    await auth.deleteAccount();
    expect(firebase.deleted).toEqual(['google-user']);
    // The next start is a new guest.
    expect(await auth.account()).toMatchObject({ playerId: 'guest-1', guest: true });
  });

  it('never deletes a different Google account picked in that sign-in sheet', async () => {
    const firebase = new FakeFirebase();
    const auth = new FirebaseAuth(firebase);
    await auth.switchToGoogle();
    firebase.staleLogin = true;
    firebase.googleAccount = 'someone-else';
    await expect(auth.deleteAccount()).rejects.toThrow('different Google account');
    expect(firebase.deleted).toEqual([]);
    expect(firebase.user).toBeNull();
  });

  it('leaves a guest account that Firebase will not delete without a sign-in it cannot do', async () => {
    const firebase = new FakeFirebase();
    const auth = new FirebaseAuth(firebase);
    await auth.account();
    firebase.staleLogin = true;
    await auth.deleteAccount();
    expect(firebase.deleted).toEqual([]);
    expect(await auth.account()).toMatchObject({ playerId: 'guest-2', guest: true });
  });
});

/** The server's cloud save rules: a write must name the revision it started from. */
class FakeCloud implements CloudSaveApi {
  save: CloudSave | null = null;
  offline = false;
  writes = 0;
  /** Runs once before the next write is applied, like another device writing in between. */
  beforeWrite: (() => void) | null = null;
  readSave(): Promise<CloudSave | null> {
    return this.offline ? Promise.reject(new Error('offline')) : Promise.resolve(this.save);
  }
  writeSave(baseRevision: number | null, data: string): Promise<SaveWrite> {
    if (this.offline) return Promise.reject(new Error('offline'));
    const interfere = this.beforeWrite;
    this.beforeWrite = null;
    interfere?.();
    this.writes += 1;
    if ((this.save?.revision ?? null) !== baseRevision) return Promise.resolve({ status: 'conflict', current: this.save });
    this.save = { revision: (this.save?.revision ?? 0) + 1, data, updatedAt: new Date(0).toISOString() };
    return Promise.resolve({ status: 'saved', save: this.save });
  }
  otherDeviceWrites(data: string): void {
    this.save = { revision: (this.save?.revision ?? 0) + 1, data, updatedAt: new Date(0).toISOString() };
  }
}

/** A device whose save is just its progress number, written as text. */
class Device implements CloudSyncHost {
  readonly absorbed: string[] = [];
  constructor(
    public save: string,
    private readonly merges = false,
  ) {}
  current(): string {
    return this.save;
  }
  progress(save: string): number {
    return Number(save.split(':')[1]);
  }
  adopt(save: string): Promise<'adopted' | 'merged' | 'unreadable'> {
    if (!save.startsWith('save:')) return Promise.resolve('unreadable');
    this.save = this.merges ? `${save}:merged` : save;
    return Promise.resolve(this.merges ? 'merged' : 'adopted');
  }
  absorb(save: string): Promise<void> {
    this.absorbed.push(save);
    if (this.merges) this.save = `${this.save}:merged`;
    return Promise.resolve();
  }
}

function device(cloud: FakeCloud, save: string, player: string | null = 'p1', merges = false) {
  const host = new Device(save, merges);
  const storage = new MemoryStore();
  return { host, storage, sync: new CloudSync(cloud, storage, host, () => Promise.resolve(player)) };
}

describe('cloud save sync', () => {
  it('uploads the first save, then only changes', async () => {
    const cloud = new FakeCloud();
    const d = device(cloud, 'save:10');
    expect(await d.sync.sync()).toBe('uploaded');
    expect(await d.sync.sync()).toBe('unchanged');
    d.host.save = 'save:20';
    expect(await d.sync.sync()).toBe('uploaded');
    expect(cloud.save).toMatchObject({ revision: 2, data: 'save:20' });
    expect(cloud.writes).toBe(2);
  });

  it('loads the cloud save on a new phone, keeping the fresh local save as a backup', async () => {
    const cloud = new FakeCloud();
    cloud.otherDeviceWrites('save:500');
    const phone = device(cloud, 'save:3');
    expect(await phone.sync.sync()).toBe('downloaded');
    expect(phone.host.save).toBe('save:500');
    expect(await phone.sync.backup()).toBe('save:3');
    expect(await phone.sync.sync()).toBe('unchanged');
  });

  it('takes another device\'s newer save when this device did not change since', async () => {
    const cloud = new FakeCloud();
    const phone = device(cloud, 'save:10');
    await phone.sync.sync();
    cloud.otherDeviceWrites('save:5');
    expect(await phone.sync.sync()).toBe('downloaded');
    expect(phone.host.save).toBe('save:5');
  });

  it('keeps the save that got further when both devices changed', async () => {
    const cloud = new FakeCloud();
    const phone = device(cloud, 'save:10');
    await phone.sync.sync();

    cloud.otherDeviceWrites('save:50');
    phone.host.save = 'save:30';
    expect(await phone.sync.sync()).toBe('downloaded');
    expect(phone.host.save).toBe('save:50');

    cloud.otherDeviceWrites('save:60');
    phone.host.save = 'save:90';
    expect(await phone.sync.sync()).toBe('kept_local');
    expect(cloud.save).toMatchObject({ revision: 4, data: 'save:90' });
    expect(await phone.sync.sync()).toBe('unchanged');
  });

  it('lets the save that won take over what the cloud copy must not lose before uploading', async () => {
    const cloud = new FakeCloud();
    const phone = device(cloud, 'save:10', 'p1', true);
    await phone.sync.sync();
    cloud.otherDeviceWrites('save:20');
    phone.host.save = 'save:90';
    expect(await phone.sync.sync()).toBe('kept_local');
    expect(phone.host.absorbed).toEqual(['save:20']);
    expect(cloud.save?.data).toBe('save:90:merged');
    expect(await phone.sync.sync()).toBe('unchanged');
  });

  it('puts what the adopted save took over back in the cloud', async () => {
    const cloud = new FakeCloud();
    cloud.otherDeviceWrites('save:500');
    const phone = device(cloud, 'save:3', 'p1', true);
    expect(await phone.sync.sync()).toBe('downloaded');
    expect(cloud.save).toMatchObject({ revision: 2, data: 'save:500:merged' });
    expect(await phone.sync.sync()).toBe('unchanged');
  });

  it('tries again later when adopting the cloud save has to wait', async () => {
    const cloud = new FakeCloud();
    const phone = device(cloud, 'save:10');
    await phone.sync.sync();
    cloud.otherDeviceWrites('save:50');
    phone.host.adopt = () => Promise.reject(new Error('a purchase is still being settled'));
    expect(await phone.sync.sync()).toBe('offline');
    expect(cloud.save?.data).toBe('save:50');
    expect(phone.host.save).toBe('save:10');
  });

  it('resolves a write that loses a race against another device', async () => {
    const cloud = new FakeCloud();
    const phone = device(cloud, 'save:10');
    await phone.sync.sync();
    phone.host.save = 'save:20';
    cloud.beforeWrite = () => {
      cloud.otherDeviceWrites('save:99');
    };
    expect(await phone.sync.sync()).toBe('downloaded');
    expect(phone.host.save).toBe('save:99');
  });

  it('starts a new cloud copy after the cloud save was deleted', async () => {
    const cloud = new FakeCloud();
    const phone = device(cloud, 'save:10');
    await phone.sync.sync();
    cloud.save = null;
    expect(await phone.sync.sync()).toBe('uploaded');
    expect(cloud.save).toMatchObject({ revision: 1, data: 'save:10' });
  });

  it('overwrites a cloud save this device cannot load', async () => {
    const cloud = new FakeCloud();
    const phone = device(cloud, 'save:10');
    await phone.sync.sync();
    cloud.otherDeviceWrites('garbage');
    expect(await phone.sync.sync()).toBe('kept_local');
    expect(cloud.save?.data).toBe('save:10');
  });

  it('does nothing while signed out or offline, and remembers players separately', async () => {
    const cloud = new FakeCloud();
    expect(await device(cloud, 'save:1', null).sync.sync()).toBe('offline');
    const d = device(cloud, 'save:10');
    cloud.offline = true;
    expect(await d.sync.sync()).toBe('offline');
    cloud.offline = false;
    expect(await d.sync.sync()).toBe('uploaded');

    const sameStorageOtherPlayer = new CloudSync(cloud, d.storage, d.host, () => Promise.resolve('p2'));
    // p2 never synced on this device, and the cloud copy is p1's here (the fake has one slot).
    expect(await sameStorageOtherPlayer.sync()).toBe('kept_local');
  });

  it('runs one sync at a time', async () => {
    const cloud = new FakeCloud();
    const d = device(cloud, 'save:10');
    const results = await Promise.all([d.sync.sync(), d.sync.sync(), d.sync.sync()]);
    expect(results).toEqual(['uploaded', 'uploaded', 'uploaded']);
    expect(cloud.writes).toBe(1);
  });
});
