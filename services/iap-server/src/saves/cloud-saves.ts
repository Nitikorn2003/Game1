import type { Queryable } from '../db/pool.js';

/** Longest save text accepted, in characters. Request bodies are capped at 64 KiB. */
export const MAX_SAVE_LENGTH = 48 * 1024;

export interface CloudSave {
  revision: number;
  /** The game's own save text. This server never reads it. */
  data: string;
  updatedAt: string;
}

export type WriteResult = { status: 'saved'; save: CloudSave } | { status: 'conflict'; current: CloudSave | null };

interface SaveRow {
  revision: number;
  data: string;
  updated_at: Date;
}

const view = (row: SaveRow): CloudSave => ({ revision: row.revision, data: row.data, updatedAt: row.updated_at.toISOString() });

export async function readCloudSave(db: Queryable, gameId: string, playerId: string): Promise<CloudSave | null> {
  const res = await db.query<SaveRow>(
    'SELECT revision, data, updated_at FROM cloud_saves WHERE game_id = $1 AND player_id = $2',
    [gameId, playerId],
  );
  const row = res.rows[0];
  return row ? view(row) : null;
}

/**
 * Replaces the player's cloud save, but only if it is still the revision the device started
 * from (null: the device saw no cloud save). Otherwise nothing changes and the device gets the
 * newer save back, so two devices never silently overwrite each other's progress.
 */
export async function writeCloudSave(
  db: Queryable,
  input: { gameId: string; playerId: string; baseRevision: number | null; data: string },
): Promise<WriteResult> {
  const { gameId, playerId, baseRevision, data } = input;
  const res =
    baseRevision === null
      ? await db.query<SaveRow>(
          `INSERT INTO cloud_saves (game_id, player_id, revision, data) VALUES ($1, $2, 1, $3)
           ON CONFLICT (game_id, player_id) DO NOTHING
           RETURNING revision, data, updated_at`,
          [gameId, playerId, data],
        )
      : await db.query<SaveRow>(
          `UPDATE cloud_saves SET revision = revision + 1, data = $4, updated_at = now()
           WHERE game_id = $1 AND player_id = $2 AND revision = $3
           RETURNING revision, data, updated_at`,
          [gameId, playerId, baseRevision, data],
        );
  const row = res.rows[0];
  if (row) return { status: 'saved', save: view(row) };
  return { status: 'conflict', current: await readCloudSave(db, gameId, playerId) };
}
