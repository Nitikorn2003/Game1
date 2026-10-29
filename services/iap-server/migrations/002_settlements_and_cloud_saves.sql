-- Settlements move wallet currency into the game's own save; cloud saves keep a copy of that
-- save for each player.
--
-- Invariants enforced by the database itself:
--   * A settlement id is used once per player and game, so asking again with the same id
--     returns the recorded amounts instead of moving currency a second time.
--   * A cloud save has one row per player and game, and its revision only grows.

ALTER TABLE wallet_ledger DROP CONSTRAINT wallet_ledger_reason_check;
ALTER TABLE wallet_ledger ADD CONSTRAINT wallet_ledger_reason_check
  CHECK (reason IN ('play_purchase', 'play_revocation', 'spend', 'settlement'));

CREATE TABLE wallet_settlements (
  game_id       TEXT        NOT NULL,
  player_id     TEXT        NOT NULL,
  settlement_id TEXT        NOT NULL CHECK (settlement_id ~ '^[A-Za-z0-9_-]{8,64}$'),
  -- What moved into the save, e.g. {"gems": 550}. Negative after a refund took back currency
  -- that had already been settled; {} when there was nothing to move.
  amounts       JSONB       NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (game_id, player_id, settlement_id)
);

CREATE TABLE cloud_saves (
  game_id    TEXT        NOT NULL,
  player_id  TEXT        NOT NULL,
  revision   BIGINT      NOT NULL CHECK (revision > 0),
  data       TEXT        NOT NULL CHECK (length(data) BETWEEN 1 AND 65536),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (game_id, player_id)
);
