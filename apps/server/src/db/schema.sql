-- TAPat schema. Amounts: integer stroops. Times: unix ms unless the column ends in _at_s.

CREATE TABLE program (
  id                     TEXT    PRIMARY KEY,
  name                   TEXT    NOT NULL,
  salt                   TEXT    NOT NULL,              -- 32 hex chars, 16 random bytes; server-only
  status                 TEXT    NOT NULL CHECK (status IN ('draft','active','ending','ended')),
  per_tap_cap_stroops    INTEGER NOT NULL DEFAULT 500000000,
  tranche_stroops        INTEGER NOT NULL DEFAULT 1500000000,
  expires_at_s           INTEGER NOT NULL,              -- 1796054399 = 2026-11-30T23:59:59+08:00
  price_threshold_php    REAL    NOT NULL DEFAULT 65.00,
  alpha                  REAL    NOT NULL DEFAULT 0.05,
  beta                   REAL    NOT NULL DEFAULT 0.02,
  budget_verified_stroops INTEGER NOT NULL DEFAULT 0,
  budget_funded_stroops  INTEGER NOT NULL DEFAULT 0,
  tranche_fired          INTEGER NOT NULL DEFAULT 0,     -- 0/1
  created_at             INTEGER NOT NULL
);

CREATE TABLE beneficiaries (
  id               TEXT    PRIMARY KEY,
  program_id       TEXT    NOT NULL REFERENCES program(id),
  last_name        TEXT    NOT NULL,
  first_name       TEXT    NOT NULL,
  middle_name      TEXT,
  suffix           TEXT,
  birthdate        TEXT    NOT NULL,                     -- 'YYYY-MM-DD'
  plate            TEXT    NOT NULL,                     -- as printed on the OR/CR (normalized for compare, not for display)
  toda             TEXT    NOT NULL,
  barangay         TEXT    NOT NULL,
  source           TEXT    NOT NULL CHECK (source IN ('ocr_precomputed','csv')),
  score            REAL,                                 -- genuineness score s_i in [0,1]
  status           TEXT    NOT NULL CHECK (status IN ('approved','rejected','uncertain','evidence_requested','enrolled')),
  rule_code        TEXT,                                 -- UNDERAGE | PLATE_MULTI_NAME | DUPLICATE_PLATE
  decision_reason  TEXT,
  link_code        TEXT    UNIQUE,                       -- 8 chars, Telegram deep-link token
  telegram_chat_id TEXT,
  created_at       INTEGER NOT NULL
);

CREATE TABLE cards (
  id                  TEXT    PRIMARY KEY,
  beneficiary_id      TEXT    NOT NULL REFERENCES beneficiaries(id),
  device_hash         TEXT    NOT NULL UNIQUE,           -- 64 hex chars, SHA-256
  uid_last4           TEXT    NOT NULL,                  -- last 4 chars of the normalized UID, for humans
  virtual             INTEGER NOT NULL DEFAULT 0,        -- 0/1
  agent_public        TEXT    NOT NULL,                  -- card agent G-address
  agent_secret_enc    TEXT    NOT NULL,                  -- AES-256-GCM ciphertext, never serialized
  max_amount_stroops  INTEGER NOT NULL,
  expires_at_s        INTEGER NOT NULL,
  last_nonce          INTEGER NOT NULL DEFAULT 0,         -- u64; strictly increasing per (device, agent)
  status              TEXT    NOT NULL CHECK (status IN ('pending','active','failed','revoked','swept')),
  returned_stroops    INTEGER NOT NULL DEFAULT 0,         -- amount swept back to the Program Wallet
  error               TEXT,
  created_at          INTEGER NOT NULL
);

CREATE TABLE stations (
  id            TEXT PRIMARY KEY,                        -- 'A' | 'B'
  name          TEXT NOT NULL,                           -- 'Petron San Roque' | 'Rotonda Fuels'
  public_key    TEXT NOT NULL,
  secret_enc    TEXT NOT NULL,                           -- never serialized
  status        TEXT NOT NULL CHECK (status IN ('active','frozen')),
  frozen_reason TEXT,
  frozen_at     INTEGER
);

CREATE TABLE chain_txs (
  id              TEXT    PRIMARY KEY,
  kind            TEXT    NOT NULL,                      -- register|register_agent|fund|authorize|claim|revoke_agent|sweep|revoke_device
  contract_id     TEXT    NOT NULL,
  method          TEXT    NOT NULL,
  source_public   TEXT    NOT NULL,
  status          TEXT    NOT NULL CHECK (status IN ('pending','succeeded','failed','submission_unknown')),
  gas_mode        TEXT    NOT NULL CHECK (gas_mode IN ('velo','direct')),
  velo_request_id TEXT,
  inner_hash      TEXT,                                  -- inner tx hash (what the signer signed)
  outer_hash      TEXT,                                  -- fee-bump hash when Gas Station submitted it
  error_code      TEXT,                                  -- 'ContractRejection:3' | 'VeloRateLimitError' | ...
  error           TEXT,                                  -- full message, for the logs and the UI tooltip
  created_at      INTEGER NOT NULL,
  updated_at      INTEGER NOT NULL
);

CREATE TABLE taps (
  id             TEXT    PRIMARY KEY,
  card_id        TEXT    REFERENCES cards(id),           -- NULL when the tap was refused before a card was resolved
  card_ref       TEXT,                                   -- virtual card id from a fixture (burst/honest edges, e.g. 'virtual01'); NULL for real cards
  station_id     TEXT    NOT NULL REFERENCES stations(id),
  amount_stroops INTEGER NOT NULL,
  nonce          INTEGER,
  status         TEXT    NOT NULL CHECK (status IN ('authorized','rejected','refused','failed')),
  reason_code    TEXT,                                   -- EXPIRED|OVER_CAP|POLICY_DENIED|INSUFFICIENT_ESCROW|STATION_FROZEN|CARD_NOT_ENROLLED|SIMULATED_EDGE
  chain_tx_id    TEXT    REFERENCES chain_txs(id),
  simulated      INTEGER NOT NULL DEFAULT 0,
  midas_score    REAL,
  tick           INTEGER,                                -- freeze-sim clock tick the edge was scored on
  created_at     INTEGER NOT NULL
);

CREATE TABLE agent_decisions (
  id           TEXT PRIMARY KEY,
  agent        TEXT NOT NULL CHECK (agent IN ('intake','tranche','freeze','settlement','sweep')),
  decision     TEXT NOT NULL,                            -- vocabulary in §2.2
  inputs_json  TEXT NOT NULL,                            -- JSON object, numbers only
  outputs_json TEXT NOT NULL,                            -- JSON object
  tx_ids_json  TEXT NOT NULL DEFAULT '[]',               -- JSON array of chain_txs.id
  created_at   INTEGER NOT NULL
);

CREATE TABLE velo_intents (
  id             TEXT PRIMARY KEY,                       -- Velo paymentIntentId
  purpose        TEXT NOT NULL,                          -- 'budget'
  amount         TEXT NOT NULL,                          -- XLM decimal string, always 2 decimals ('1000.00')
  asset          TEXT NOT NULL,                          -- 'XLM'
  status         TEXT NOT NULL,                          -- 'created'|'paid'|'failed'
  checkout_url   TEXT,
  tx_hash        TEXT,
  payer_address  TEXT,
  created_at     INTEGER NOT NULL,
  paid_at        INTEGER
);

CREATE TABLE webhook_deliveries (
  delivery_id  TEXT PRIMARY KEY,                         -- x-velo-delivery
  type         TEXT NOT NULL,                            -- payment.succeeded|payment.failed|payment.created|contract.event|...
  received_at  INTEGER NOT NULL,
  payload_json TEXT NOT NULL
);

CREATE TABLE price_points (
  program_id TEXT    NOT NULL REFERENCES program(id),
  idx        INTEGER NOT NULL,                            -- 1-based index into the fixture
  price_php  REAL    NOT NULL,
  simulated  INTEGER NOT NULL DEFAULT 1,
  cp_recent  REAL,                                        -- BOCPD P(r_t < 10)
  map_r      INTEGER,                                     -- BOCPD MAP run length
  PRIMARY KEY (program_id, idx)
);

CREATE INDEX idx_beneficiaries_program_status ON beneficiaries(program_id, status);
CREATE INDEX idx_cards_beneficiary            ON cards(beneficiary_id);
CREATE INDEX idx_taps_station_created         ON taps(station_id, created_at);
CREATE INDEX idx_taps_created                 ON taps(created_at);
CREATE INDEX idx_chain_txs_status             ON chain_txs(status);
CREATE INDEX idx_agent_decisions_created      ON agent_decisions(agent, created_at);

-- @auth-schema: schema version 2 (accounts, docs/api-and-data.md §5.2 #22-#25). db/index.ts applies everything from
-- this marker on to a version-1 database, so the DDL below is the one source of truth for the v1 -> v2 migration.

CREATE TABLE users (
  id            TEXT    PRIMARY KEY,                     -- 'usr_' + 12 hex
  email         TEXT    NOT NULL UNIQUE,                 -- lowercased
  display_name  TEXT    NOT NULL,
  role          TEXT    NOT NULL CHECK (role IN ('officer','viewer')),
  password_hash TEXT    NOT NULL,                        -- scrypt$N$r$p$saltHex$hashHex
  created_at    INTEGER NOT NULL
);

CREATE TABLE sessions (
  id          TEXT    PRIMARY KEY,                       -- sha256(cookie token) hex; the raw token is never stored
  user_id     TEXT    NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at  INTEGER NOT NULL,
  expires_at  INTEGER NOT NULL
);

CREATE INDEX sessions_user ON sessions(user_id);
