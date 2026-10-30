-- Initial schema for server-verified Google Play one-time purchases.
--
-- Invariants enforced by the database itself (not only by application code):
--   * A purchase token is stored once per app (play_purchases_token_unique), so two
--     requests for the same token always meet on the same row and its row lock.
--   * Every currency movement is a ledger row with an idempotency key that is unique per
--     game and currency, so a purchase can credit currency at most once, ever.
--   * A granted or revoked purchase always has an owner, a product and a quantity.

CREATE TABLE player_billing_accounts (
  game_id               TEXT        NOT NULL,
  player_id             TEXT        NOT NULL,
  -- Random opaque value passed to BillingFlowParams.setObfuscatedAccountId(). It is not
  -- derived from the player id, so it reveals nothing about the player.
  obfuscated_account_id TEXT        NOT NULL CHECK (length(obfuscated_account_id) <= 64),
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (game_id, player_id),
  CONSTRAINT player_billing_accounts_obfuscated_unique UNIQUE (game_id, obfuscated_account_id)
);

CREATE TABLE play_purchases (
  id                          BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  game_id                     TEXT        NOT NULL,
  package_name                TEXT        NOT NULL,
  purchase_token              TEXT        NOT NULL,
  product_id                  TEXT,
  product_type                TEXT CHECK (product_type IN ('consumable', 'non_consumable')),
  -- Per-unit grant recorded at grant time, so later catalog edits cannot change what a
  -- refund claws back. Example: {"currency": {"gems": 100}} or {"entitlement": "remove_ads"}.
  grant_spec                  JSONB,
  player_id                   TEXT,
  order_id                    TEXT,
  obfuscated_account_id       TEXT,
  quantity                    INTEGER CHECK (quantity > 0),
  state                       TEXT        NOT NULL
    CHECK (state IN ('new', 'pending', 'unclaimed', 'granted', 'revoked', 'canceled', 'rejected')),
  revoked_quantity            INTEGER     NOT NULL DEFAULT 0 CHECK (revoked_quantity >= 0),
  is_test                     BOOLEAN     NOT NULL DEFAULT false,
  google_purchase_state       TEXT,
  rejection_reason            TEXT,
  fulfillment_state           TEXT        NOT NULL DEFAULT 'not_required'
    CHECK (fulfillment_state IN ('not_required', 'pending', 'done', 'failed')),
  fulfillment_attempts        INTEGER     NOT NULL DEFAULT 0,
  fulfillment_next_attempt_at TIMESTAMPTZ,
  fulfillment_last_error      TEXT,
  recheck_at                  TIMESTAMPTZ,
  recheck_attempts            INTEGER     NOT NULL DEFAULT 0,
  purchase_completed_at       TIMESTAMPTZ,
  granted_at                  TIMESTAMPTZ,
  revoked_at                  TIMESTAMPTZ,
  refund_requested_at         TIMESTAMPTZ,
  created_at                  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at                  TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT play_purchases_token_unique UNIQUE (package_name, purchase_token),
  CONSTRAINT play_purchases_revoked_within_quantity
    CHECK (quantity IS NULL OR revoked_quantity <= quantity),
  CONSTRAINT play_purchases_granted_is_complete
    CHECK (state NOT IN ('granted', 'revoked')
           OR (player_id IS NOT NULL AND product_id IS NOT NULL AND product_type IS NOT NULL
               AND quantity IS NOT NULL AND grant_spec IS NOT NULL))
);

CREATE INDEX play_purchases_fulfillment_due
  ON play_purchases (fulfillment_next_attempt_at) WHERE fulfillment_state = 'pending';
CREATE INDEX play_purchases_recheck_due
  ON play_purchases (recheck_at) WHERE recheck_at IS NOT NULL;
CREATE INDEX play_purchases_owner ON play_purchases (game_id, player_id);

-- Every refund, chargeback or revocation signal Google sent, from either source. A full
-- void recorded here blocks any later grant of the same token.
CREATE TABLE play_voided_purchases (
  id              BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  package_name    TEXT        NOT NULL,
  purchase_token  TEXT        NOT NULL,
  order_id        TEXT,
  source          TEXT        NOT NULL CHECK (source IN ('rtdn', 'voided_api')),
  refund_type     TEXT        NOT NULL CHECK (refund_type IN ('full', 'partial')),
  voided_quantity INTEGER,
  voided_reason   INTEGER,
  voided_source   INTEGER,
  voided_time_ms  BIGINT      NOT NULL,
  received_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT play_voided_purchases_dedupe
    UNIQUE (package_name, purchase_token, source, refund_type, voided_time_ms)
);

CREATE INDEX play_voided_purchases_token ON play_voided_purchases (package_name, purchase_token);

CREATE TABLE wallet_balances (
  game_id    TEXT        NOT NULL,
  player_id  TEXT        NOT NULL,
  currency   TEXT        NOT NULL,
  -- May go negative after a refund claws back currency that was already spent. Spending
  -- is refused while the balance is too low (see wallet/ledger.ts).
  balance    BIGINT      NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (game_id, player_id, currency)
);

CREATE TABLE wallet_ledger (
  id              BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  game_id         TEXT        NOT NULL,
  player_id       TEXT        NOT NULL,
  currency        TEXT        NOT NULL,
  delta           BIGINT      NOT NULL CHECK (delta <> 0),
  reason          TEXT        NOT NULL CHECK (reason IN ('play_purchase', 'play_revocation', 'spend')),
  idempotency_key TEXT        NOT NULL,
  purchase_id     BIGINT REFERENCES play_purchases (id),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT wallet_ledger_idempotency UNIQUE (game_id, idempotency_key, currency)
);

CREATE INDEX wallet_ledger_owner ON wallet_ledger (game_id, player_id, currency);

CREATE TABLE entitlements (
  game_id     TEXT        NOT NULL,
  player_id   TEXT        NOT NULL,
  entitlement TEXT        NOT NULL,
  purchase_id BIGINT      NOT NULL REFERENCES play_purchases (id),
  state       TEXT        NOT NULL CHECK (state IN ('active', 'revoked')),
  granted_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  revoked_at  TIMESTAMPTZ,
  PRIMARY KEY (game_id, player_id, entitlement)
);

-- Pub/Sub delivers at least once. A message id is stored only after it was handled, so a
-- delivery that failed half way is processed again instead of being dropped.
CREATE TABLE rtdn_messages (
  message_id        TEXT PRIMARY KEY,
  package_name      TEXT,
  notification_kind TEXT        NOT NULL,
  processed_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE play_sync_state (
  package_name         TEXT PRIMARY KEY,
  voided_checkpoint_ms BIGINT      NOT NULL,
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Append-only audit trail. Stores a hash of the purchase token, never the token itself.
CREATE TABLE play_purchase_events (
  id                  BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  package_name        TEXT        NOT NULL,
  purchase_token_hash TEXT        NOT NULL,
  purchase_id         BIGINT REFERENCES play_purchases (id),
  event               TEXT        NOT NULL,
  detail              JSONB       NOT NULL DEFAULT '{}'::jsonb,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX play_purchase_events_purchase ON play_purchase_events (purchase_id);
